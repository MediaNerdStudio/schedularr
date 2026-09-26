import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Song, Artist, Category } from '../models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILES = [
  'WestRadio - Omni Database [Synced] - Musicals.tsv',
  'WestRadio - Omni Database [Synced] - Eurovisie.tsv',
].map(name => path.resolve(__dirname, '..', '..', 'Development', name));

function parseRows(filePath) {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(line => line.trim());
  const headers = lines[0].split('\t').map(header => header.trim());
  return lines.slice(1).map(line => {
    const columns = line.split('\t');
    return Object.fromEntries(headers.map((header, index) => [header, (columns[index] || '').trim()]));
  });
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to MongoDB: ${mongoose.connection.host}/${mongoose.connection.name}`);

  let category = await Category.findOne({ name: 'Musicals', parent: null });
  if (!category) {
    category = await Category.create({
      name: 'Musicals',
      code: 'MUSICALS',
      type: 'music',
      color: '#a855f7',
      folders: [{ name: 'Default', exposure: 100 }],
    });
    console.log('Created category: Musicals');
  }

  const artistMap = new Map((await Artist.find({}).lean()).map(artist => [artist.name.toLowerCase(), artist._id]));
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of FILES) {
    const rows = parseRows(file);
    console.log(`${path.basename(file)}: ${rows.length} rows`);

    for (const row of rows) {
      if (row.DEL === 'TRUE' || !row.title_id) {
        skipped++;
        continue;
      }

      try {
        const artistName = row.interpret || row.artist_display || 'Unknown';
        let artistId = artistMap.get(artistName.toLowerCase());
        if (!artistId) {
          const artist = await Artist.create({ name: artistName });
          artistId = artist._id;
          artistMap.set(artistName.toLowerCase(), artistId);
        }

        const properties = [];
        if (row.quality) properties.push({ key: 'quality', value: row.quality });
        if (row.version) properties.push({ key: 'version', value: row.version });
        if (row.version_info) properties.push({ key: 'version_info', value: row.version_info });
        if (row.REMARKS) properties.push({ key: 'remarks', value: row.REMARKS });
        if (row['LET OP']) properties.push({ key: 'let_op', value: row['LET OP'] });
        if (row['Original Source']) properties.push({ key: 'original_source', value: row['Original Source'] });
        if (row.top40_id) properties.push({ key: 'top40_id', value: row.top40_id });
        if (row.npo_id) properties.push({ key: 'npo_id', value: row.npo_id });

        const title = row.title || row.title_display || 'Untitled';
        const externalIds = {
          omniTitleId: row.title_id,
          omniItemCode: row.reference_text || '',
          automationFilename: row.soundfile_name || '',
          spotifyTrackId: row['Spotify ID'] || '',
          spotifyTrackUrl: row['Spotify Link'] || '',
          isrc: row.ISRC || '',
        };
        const song = await Song.findOne({ 'externalIds.omniTitleId': row.title_id });

        if (song) {
          if (!song.categoryAssignments.some(assignment => String(assignment.category) === String(category._id))) {
            song.categoryAssignments.push({ category: category._id, addedAt: new Date() });
          }
          song.title = title;
          song.primaryArtist = artistId;
          song.artistDisplay = row.artist_display || artistName;
          song.albumTitle = row.Album || '';
          song.duration = parseInt(row.duration, 10) || 0;
          song.year = parseInt(row.year, 10) || 0;
          song.bpm = row.bpm ? Math.round(parseFloat(row.bpm.replace(',', '.'))) : 0;
          song.properties = properties;
          song.externalIds = { ...song.externalIds, ...externalIds };
          await song.save();
          updated++;
        } else {
          await Song.create({
            title,
            primaryArtist: artistId,
            artistDisplay: row.artist_display || artistName,
            albumTitle: row.Album || '',
            duration: parseInt(row.duration, 10) || 0,
            year: parseInt(row.year, 10) || 0,
            bpm: row.bpm ? Math.round(parseFloat(row.bpm.replace(',', '.'))) : 0,
            rotationLabels: [],
            chartHistory: [],
            categoryAssignments: [{ category: category._id, addedAt: new Date() }],
            properties,
            externalIds,
            isActive: true,
            isArchived: false,
            weight: 50,
          });
          created++;
        }
      } catch (error) {
        console.error(`Error on row ${row.title_id}: ${error.message}`);
        errors++;
      }
    }
  }

  const count = await Song.countDocuments({ 'categoryAssignments.category': category._id });
  console.log(`Musicals import complete: created ${created}, updated ${updated}, skipped ${skipped}, errors ${errors}`);
  console.log(`Musicals category now contains ${count} songs`);
  await mongoose.disconnect();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

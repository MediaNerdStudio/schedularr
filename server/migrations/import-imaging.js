/**
 * Import the Vormgeving (Imaging) TSV and assign every track to the
 * "Imaging" category. Existing songs are updated, new songs are created.
 * Rotation/category tags from the TSV are ignored.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Song, Artist, Category } from '../models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, '..', '..', 'Development', 'WestRadio - Omni Database [Synced] - Vormgeving.tsv');
const BATCH_SIZE = 500;

function parseRows(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());
  const headers = lines[0].split('\t').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    const row = {};
    headers.forEach((h, j) => { row[h] = (cols[j] || '').trim(); });
    rows.push(row);
  }
  return rows;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to MongoDB: ${mongoose.connection.host}/${mongoose.connection.name}`);

  const rows = parseRows(FILE);
  console.log(`Imaging rows: ${rows.length}`);

  // Ensure Imaging category
  let imagCat = await Category.findOne({ name: 'Imaging', parent: null }).lean();
  if (!imagCat) {
    imagCat = await Category.create({
      name: 'Imaging',
      code: 'IMAG',
      type: 'imaging',
      color: '#ef4444',
      folders: [{ name: 'Default', exposure: 100 }],
    });
    console.log('Created category: Imaging');
  }
  const targetCatId = imagCat._id;

  // Pre-load artist map
  const artistMap = new Map();
  for (const a of await Artist.find({}).lean()) {
    artistMap.set(a.name.toLowerCase(), a._id);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      if (row.DEL === 'TRUE') { skipped++; continue; }
      const titleId = row.title_id;
      if (!titleId) { skipped++; continue; }

      const artistName = row.interpret || row.artist_display || 'Unknown';
      let artistId = artistMap.get(artistName.toLowerCase());
      if (!artistId) {
        const newArtist = await Artist.create({ name: artistName });
        artistId = newArtist._id;
        artistMap.set(artistName.toLowerCase(), artistId);
      }

      const title = row.title || row.title_display || 'Untitled';
      const duration = parseInt(row.duration, 10) || 0;
      const year = parseInt(row.year, 10) || 0;
      let bpm = 0;
      if (row.bpm) bpm = Math.round(parseFloat(row.bpm.replace(',', '.')));

      const properties = [];
      if (row.quality) properties.push({ key: 'quality', value: row.quality });
      if (row.version) properties.push({ key: 'version', value: row.version });
      if (row.version_info) properties.push({ key: 'version_info', value: row.version_info });
      if (row.REMARKS) properties.push({ key: 'remarks', value: row.REMARKS });
      if (row['LET OP']) properties.push({ key: 'let_op', value: row['LET OP'] });
      if (row['Original Source']) properties.push({ key: 'original_source', value: row['Original Source'] });
      if (row.top40_id) properties.push({ key: 'top40_id', value: row.top40_id });
      if (row.npo_id) properties.push({ key: 'npo_id', value: row.npo_id });

      const externalIds = {
        omniTitleId: titleId,
        omniItemCode: row.reference_text || '',
        automationFilename: row.soundfile_name || '',
        spotifyTrackId: row['Spotify ID'] || '',
        spotifyTrackUrl: row['Spotify Link'] || '',
        isrc: row.ISRC || '',
      };

      try {
        const existing = await Song.findOne({ 'externalIds.omniTitleId': titleId });
        if (existing) {
          // Add to Imaging if not already there; update basic fields
          if (!existing.categoryAssignments.some(ca => String(ca.category) === String(targetCatId))) {
            existing.categoryAssignments.push({ category: targetCatId, addedAt: new Date() });
          }
          existing.title = title;
          existing.primaryArtist = artistId;
          existing.artistDisplay = row.artist_display || artistName;
          existing.albumTitle = row.Album || '';
          existing.duration = duration;
          existing.year = year;
          existing.bpm = bpm;
          existing.properties = properties;
          existing.externalIds = { ...existing.externalIds, ...externalIds };
          existing.keywords = ['vormgeving', 'imaging'];
          await existing.save();
          updated++;
        } else {
          const doc = {
            title,
            primaryArtist: artistId,
            artistDisplay: row.artist_display || artistName,
            albumTitle: row.Album || '',
            duration,
            year,
            bpm,
            rotationLabels: [],
            chartHistory: [],
            categoryAssignments: [{ category: targetCatId, addedAt: new Date() }],
            properties,
            externalIds,
            keywords: ['vormgeving', 'imaging'],
            isActive: true,
            isArchived: false,
            weight: 50,
          };
          if (row.Released && /^\d{4}$/.test(row.Released)) {
            doc.releaseDate = new Date(`${row.Released}-01-01`);
            doc.releaseDatePrecision = 'year';
          }
          await Song.create(doc);
          created++;
        }
      } catch (err) {
        console.error(`Error on row ${titleId}: ${err.message}`);
        errors++;
      }
    }

    console.log(`  Processed ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} (created: ${created}, updated: ${updated}, skipped: ${skipped}, errors: ${errors})`);
  }

  console.log('\nImaging import complete');
  console.log(`  Created: ${created}`);
  console.log(`  Updated/added to Imaging: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

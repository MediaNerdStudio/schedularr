/**
 * Import the NMF (New Music Friday) TSV and assign every track exclusively to
 * Category "New Music" > "New Music Friday".
 *
 * If a song already exists (matched by omniTitleId), it is moved exclusively:
 * all other category assignments are removed and only NMF remains.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Song, Artist, Category } from '../models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, '..', '..', 'Development', 'WestRadio - Omni Database [Synced] - NMF.tsv');
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
  console.log(`NMF rows: ${rows.length}`);

  // Ensure categories
  let rootCat = await Category.findOne({ name: 'New Music', parent: null }).lean();
  if (!rootCat) {
    rootCat = await Category.create({
      name: 'New Music',
      code: 'NEW',
      type: 'music',
      color: '#10b981',
      folders: [{ name: 'Default', exposure: 100 }],
    });
    console.log('Created root category: New Music');
  }
  let nmfCat = await Category.findOne({ name: 'New Music Friday', parent: rootCat._id }).lean();
  if (!nmfCat) {
    nmfCat = await Category.create({
      name: 'New Music Friday',
      code: 'NEW-NMF',
      type: 'music',
      parent: rootCat._id,
      folders: [{ name: 'Default', exposure: 100 }],
    });
    console.log('Created subcategory: New Music Friday');
  }
  const targetCatId = nmfCat._id;

  // Pre-load artist map
  const artistMap = new Map();
  for (const a of await Artist.find({}).lean()) {
    artistMap.set(a.name.toLowerCase(), a._id);
  }

  let created = 0;
  let moved = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      if (row.DEL === 'TRUE') { skipped++; continue; }
      const titleId = row.title_id;
      if (!titleId) { skipped++; continue; }

      // Ensure artist
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

      const rotationLabels = [];
      if (row.HIT === 'TRUE') rotationLabels.push('hit');
      if (row.TOTH === 'TRUE') rotationLabels.push('toth');
      if (row['Album Track'] === 'TRUE') rotationLabels.push('album-track');
      if (row['A-Rotation'] === 'TRUE') rotationLabels.push('a-rotation');
      if (row['B-Rotation'] === 'TRUE') rotationLabels.push('b-rotation');
      if (row['C-Rotation'] === 'TRUE') rotationLabels.push('c-rotation');

      const chartHistory = [];
      if (row.Top40 === 'TRUE') chartHistory.push({ chartName: 'Top 40', peakPosition: 0, weeksOnChart: 0 });
      if (row.Tipparade === 'TRUE') chartHistory.push({ chartName: 'Tipparade', peakPosition: 0, weeksOnChart: 0 });

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
          // Move exclusively to NMF
          existing.categoryAssignments = existing.categoryAssignments.filter(
            ca => String(ca.category) === String(targetCatId)
          );
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
          existing.rotationLabels = rotationLabels;
          existing.chartHistory = chartHistory;
          existing.properties = properties;
          existing.externalIds = { ...existing.externalIds, ...externalIds };
          await existing.save();
          moved++;
        } else {
          // Create new song assigned exclusively to NMF
          const doc = {
            title,
            primaryArtist: artistId,
            artistDisplay: row.artist_display || artistName,
            albumTitle: row.Album || '',
            duration,
            year,
            bpm,
            rotationLabels,
            chartHistory,
            categoryAssignments: [{ category: targetCatId, addedAt: new Date() }],
            properties,
            externalIds,
            isActive: true,
            isArchived: false,
            weight: 50,
          };
          if (row.Released && /^\d{4}$/.test(row.Released)) {
            doc.releaseDate = new Date(`${row.Released}-01-01`);
            doc.releaseDatePrecision = 'year';
          }
          if (row.Vormgeving === 'TRUE') doc.keywords = ['vormgeving', 'imaging'];
          await Song.create(doc);
          created++;
        }
      } catch (err) {
        console.error(`Error on row ${titleId}: ${err.message}`);
        errors++;
      }
    }

    console.log(`  Processed ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} (created: ${created}, moved: ${moved}, skipped: ${skipped}, errors: ${errors})`);
  }

  console.log('\nNMF import complete');
  console.log(`  Created: ${created}`);
  console.log(`  Moved exclusively to NMF: ${moved}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

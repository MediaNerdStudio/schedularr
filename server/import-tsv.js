/**
 * Import songs from WestRadio Omni Database TSV export.
 *
 * Usage:
 *   node server/import-tsv.js [--file <path>] [--dry-run] [--skip-existing] [--batch-size 500]
 *
 * Columns mapped:
 *   title_id       -> externalIds.omniTitleId
 *   interpret      -> primaryArtist (auto-created)
 *   title          -> title
 *   Category       -> category assignment (auto-created)
 *   soundfile_name -> externalIds.automationFilename
 *   duration       -> duration (ms)
 *   reference_text -> externalIds.omniItemCode
 *   year           -> year
 *   bpm            -> bpm (parsed from comma-decimal)
 *   quality        -> (stored as property)
 *   Album          -> albumTitle
 *   Released       -> releaseDate (year)
 *   version        -> (stored as property)
 *   version_info   -> (stored as property)
 *   HIT/TOTH/Album Track/A-Rotation/B-Rotation/C-Rotation -> rotationLabels
 *   Top40/Tipparade -> chartHistory entries
 *   Vormgeving     -> category type = imaging
 *   artist_display -> artistDisplay
 *   title_display  -> (used if title empty)
 *   Spotify ID     -> externalIds.spotifyTrackId
 *   ISRC           -> externalIds.isrc
 *   top40_id       -> externalIds (custom property)
 *   npo_id         -> externalIds (custom property)
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Song, Artist, Category } from './models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const hasFlag = (name) => args.includes(name);

const FILE = getArg('--file', path.resolve(__dirname, '..', 'Development', 'WestRadio - Omni Database [Synced] - All Songs.tsv'));
const DRY_RUN = hasFlag('--dry-run');
const SKIP_EXISTING = hasFlag('--skip-existing');
const BATCH_SIZE = parseInt(getArg('--batch-size', '500'), 10);

async function main() {
  console.log(`Importing from: ${FILE}`);
  console.log(`Dry run: ${DRY_RUN}, Skip existing: ${SKIP_EXISTING}, Batch size: ${BATCH_SIZE}`);

  // Connect to MongoDB
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to MongoDB: ${mongoose.connection.host}/${mongoose.connection.name}`);

  // Read and parse TSV
  const raw = fs.readFileSync(FILE, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());
  const headers = lines[0].split('\t').map(h => h.trim());
  console.log(`Headers: ${headers.join(', ')}`);
  console.log(`Total rows: ${lines.length - 1}`);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    const row = {};
    headers.forEach((h, j) => { row[h] = (cols[j] || '').trim(); });
    rows.push(row);
  }

  // Phase 1: Build unique artists map
  console.log('\n--- Phase 1: Artists ---');
  const artistNames = new Set();
  for (const row of rows) {
    const name = row.interpret || row.artist_display;
    if (name) artistNames.add(name);
  }
  console.log(`Unique artist names: ${artistNames.size}`);

  // Batch-find existing artists
  const existingArtists = await Artist.find({}).lean();
  const artistMap = new Map(); // name -> _id
  for (const a of existingArtists) {
    artistMap.set(a.name.toLowerCase(), a._id);
  }
  console.log(`Existing artists in DB: ${existingArtists.length}`);

  // Create missing artists in batches
  const newArtists = [];
  for (const name of artistNames) {
    if (!artistMap.has(name.toLowerCase())) {
      newArtists.push({ name });
    }
  }
  console.log(`New artists to create: ${newArtists.length}`);

  if (!DRY_RUN && newArtists.length > 0) {
    for (let i = 0; i < newArtists.length; i += BATCH_SIZE) {
      const batch = newArtists.slice(i, i + BATCH_SIZE);
      const created = await Artist.insertMany(batch, { ordered: false }).catch(err => {
        // Ignore duplicate key errors
        if (err.insertedDocs) return err.insertedDocs;
        throw err;
      });
      for (const a of (Array.isArray(created) ? created : [])) {
        artistMap.set(a.name.toLowerCase(), a._id);
      }
      process.stdout.write(`\r  Artists: ${Math.min(i + BATCH_SIZE, newArtists.length)}/${newArtists.length}`);
    }
    console.log();
    // Re-fetch to catch any we missed
    const all = await Artist.find({}).lean();
    for (const a of all) artistMap.set(a.name.toLowerCase(), a._id);
  }

  // Phase 2: Build categories from the Category column
  console.log('\n--- Phase 2: Categories ---');
  const categoryNames = new Set();
  for (const row of rows) {
    if (row.Category) categoryNames.add(row.Category);
  }
  console.log(`Unique categories: ${categoryNames.size}`);

  const existingCats = await Category.find({}).lean();
  const catMap = new Map(); // name -> _id
  for (const c of existingCats) {
    catMap.set(c.name.toLowerCase(), c._id);
  }

  // Auto-create categories
  const catDefs = [];
  let catSort = existingCats.length;
  for (const name of categoryNames) {
    if (catMap.has(name.toLowerCase())) continue;
    // Determine type and code
    let type = 'music';
    let code = name.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase() || 'MISC';
    // Make code unique
    const existingCodes = new Set([...existingCats.map(c => c.code), ...catDefs.map(c => c.code)]);
    let baseCode = code;
    let suffix = 1;
    while (existingCodes.has(code)) {
      code = baseCode.slice(0, 5) + suffix;
      suffix++;
    }

    // Color based on category type
    let color = '#6b7280'; // gray default
    if (/^(19[5-9]\d|20[0-2]\d|1960|1970|1980|1990|2000|2010|2020)$/.test(name)) {
      color = '#3b82f6'; // blue for decade categories
    } else if (name === 'New Music') {
      color = '#10b981'; // green
    } else if (name === 'Nederlands') {
      color = '#f97316'; // orange
    } else if (name === 'Christmas') {
      color = '#ef4444'; // red
    } else if (name === 'EDM') {
      color = '#8b5cf6'; // purple
    } else if (name.startsWith('_') || name.startsWith('Import') || name === 'Omni 20' || name.startsWith('Omni ') || name === 'Decenium') {
      color = '#9ca3af'; // light gray for import/staging
    } else if (name === 'Eurovision') {
      color = '#ec4899'; // pink
    }

    catDefs.push({
      code,
      name,
      type,
      color,
      sortOrder: catSort++,
      folders: [{ name: 'Default', exposure: 100, songOrder: [] }],
    });
  }

  console.log(`New categories to create: ${catDefs.length}`);
  if (!DRY_RUN && catDefs.length > 0) {
    const created = await Category.insertMany(catDefs, { ordered: false }).catch(err => {
      if (err.insertedDocs) return err.insertedDocs;
      throw err;
    });
    for (const c of (Array.isArray(created) ? created : [])) {
      catMap.set(c.name.toLowerCase(), c._id);
    }
    // Re-fetch
    const allCats = await Category.find({}).lean();
    for (const c of allCats) catMap.set(c.name.toLowerCase(), c._id);
  }

  // Phase 3: Import songs
  console.log('\n--- Phase 3: Songs ---');

  // Check for existing songs by omniTitleId
  let existingTitleIds = new Set();
  if (SKIP_EXISTING) {
    const existing = await Song.find({ 'externalIds.omniTitleId': { $ne: '' } }, 'externalIds.omniTitleId').lean();
    for (const s of existing) {
      if (s.externalIds?.omniTitleId) existingTitleIds.add(s.externalIds.omniTitleId);
    }
    console.log(`Existing songs in DB (by omniTitleId): ${existingTitleIds.size}`);
  }

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const songDocs = [];

    for (const row of batch) {
      // Skip deleted rows
      if (row.DEL === 'TRUE') { skipped++; continue; }

      const titleId = row.title_id;
      if (SKIP_EXISTING && titleId && existingTitleIds.has(titleId)) { skipped++; continue; }

      const artistName = row.interpret || row.artist_display || 'Unknown';
      const artistId = artistMap.get(artistName.toLowerCase());
      if (!artistId) { errors++; continue; }

      const title = row.title || row.title_display || 'Untitled';
      const duration = parseInt(row.duration, 10) || 0;
      const year = parseInt(row.year, 10) || 0;

      // Parse BPM (may have comma decimal like "148,689")
      let bpm = 0;
      if (row.bpm) {
        bpm = Math.round(parseFloat(row.bpm.replace(',', '.')));
      }

      // Build rotation labels
      const rotationLabels = [];
      if (row.HIT === 'TRUE') rotationLabels.push('hit');
      if (row.TOTH === 'TRUE') rotationLabels.push('toth');
      if (row['Album Track'] === 'TRUE') rotationLabels.push('album-track');
      if (row['A-Rotation'] === 'TRUE') rotationLabels.push('a-rotation');
      if (row['B-Rotation'] === 'TRUE') rotationLabels.push('b-rotation');
      if (row['C-Rotation'] === 'TRUE') rotationLabels.push('c-rotation');

      // Build chart history
      const chartHistory = [];
      if (row.Top40 === 'TRUE') {
        chartHistory.push({ chartName: 'Top 40', peakPosition: 0, weeksOnChart: 0 });
      }
      if (row.Tipparade === 'TRUE') {
        chartHistory.push({ chartName: 'Tipparade', peakPosition: 0, weeksOnChart: 0 });
      }

      // Category assignment
      const categoryAssignments = [];
      if (row.Category) {
        const catId = catMap.get(row.Category.toLowerCase());
        if (catId) {
          categoryAssignments.push({
            category: catId,
            addedAt: new Date(),
          });
        }
      }

      // Custom properties
      const properties = [];
      if (row.quality) properties.push({ key: 'quality', value: row.quality });
      if (row.version) properties.push({ key: 'version', value: row.version });
      if (row.version_info) properties.push({ key: 'version_info', value: row.version_info });
      if (row.REMARKS) properties.push({ key: 'remarks', value: row.REMARKS });
      if (row['LET OP']) properties.push({ key: 'let_op', value: row['LET OP'] });
      if (row['Original Source']) properties.push({ key: 'original_source', value: row['Original Source'] });

      // Build song document
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
        categoryAssignments,
        properties,
        externalIds: {
          omniTitleId: titleId || '',
          omniItemCode: row.reference_text || '',
          automationFilename: row.soundfile_name || '',
          spotifyTrackId: row['Spotify ID'] || '',
          spotifyTrackUrl: row['Spotify Link'] || '',
          isrc: row.ISRC || '',
        },
        isActive: true,
        isArchived: false,
        weight: 50,
      };

      // Release date from year
      if (row.Released && /^\d{4}$/.test(row.Released)) {
        doc.releaseDate = new Date(`${row.Released}-01-01`);
        doc.releaseDatePrecision = 'year';
      }

      // top40_id and npo_id as custom properties
      if (row.top40_id) properties.push({ key: 'top40_id', value: row.top40_id });
      if (row.npo_id) properties.push({ key: 'npo_id', value: row.npo_id });

      // Vormgeving = imaging
      if (row.Vormgeving === 'TRUE') {
        doc.keywords = ['vormgeving', 'imaging'];
      }

      songDocs.push(doc);
    }

    if (!DRY_RUN && songDocs.length > 0) {
      try {
        await Song.insertMany(songDocs, { ordered: false });
      } catch (err) {
        // Count successful inserts from bulk write error
        if (err.insertedDocs) {
          imported += err.insertedDocs.length;
          errors += songDocs.length - err.insertedDocs.length;
        } else {
          errors += songDocs.length;
          console.error(`\n  Batch error: ${err.message}`);
        }
        continue;
      }
      imported += songDocs.length;
    } else if (DRY_RUN) {
      imported += songDocs.length;
    }

    process.stdout.write(`\r  Songs: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} (imported: ${imported}, skipped: ${skipped}, errors: ${errors})`);
  }

  console.log(`\n\nImport complete!`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Artists: ${artistMap.size}`);
  console.log(`  Categories: ${catMap.size}`);

  // Print stats
  if (!DRY_RUN) {
    const songCount = await Song.countDocuments();
    const artistCount = await Artist.countDocuments();
    const catCount = await Category.countDocuments();
    console.log(`\nDatabase totals:`);
    console.log(`  Songs: ${songCount}`);
    console.log(`  Artists: ${artistCount}`);
    console.log(`  Categories: ${catCount}`);
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

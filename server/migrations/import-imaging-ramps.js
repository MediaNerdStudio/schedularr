/**
 * Import Imaging - Ramps TSV. Any ramp not already in the database is created
 * and assigned to the "Imaging" category. Existing tracks are added to Imaging
 * if they aren't already there.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Song, Artist, Category } from '../models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, '..', '..', 'Development', 'Imaging - Ramps.tsv');

function parseRows(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());
  const headers = lines[0].split('\t').map(h => h.trim().replace(/\r$/, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    const row = {};
    headers.forEach((h, j) => { row[h] = (cols[j] || '').trim().replace(/\r$/, ''); });
    rows.push(row);
  }
  return rows;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to MongoDB: ${mongoose.connection.host}/${mongoose.connection.name}`);

  const rows = parseRows(FILE);
  console.log(`Ramps rows: ${rows.length}`);

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

  const artistMap = new Map();
  for (const a of await Artist.find({}).lean()) {
    artistMap.set(a.name.toLowerCase(), a._id);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const titleId = row.titleId || row.titleid || '';
    const artistName = row.artist || 'Unknown';
    const title = row.title || 'Untitled';
    const duration = parseInt(row.duration, 10) || 0;

    let artistId = artistMap.get(artistName.toLowerCase());
    if (!artistId) {
      const newArtist = await Artist.create({ name: artistName });
      artistId = newArtist._id;
      artistMap.set(artistName.toLowerCase(), artistId);
    }

    const externalIds = {
      omniTitleId: titleId,
      omniItemCode: row.itemcode || '',
      automationFilename: row.filename || '',
    };

    let existing = null;
    if (titleId) {
      existing = await Song.findOne({ 'externalIds.omniTitleId': titleId });
    }
    if (!existing && row.filename) {
      existing = await Song.findOne({ 'externalIds.automationFilename': row.filename });
    }

    try {
      if (existing) {
        let changed = false;
        if (!existing.categoryAssignments.some(ca => String(ca.category) === String(targetCatId))) {
          existing.categoryAssignments.push({ category: targetCatId, addedAt: new Date() });
          changed = true;
        }
        if (!existing.keywords?.includes('vormgeving')) {
          existing.keywords = [...(existing.keywords || []), 'vormgeving', 'imaging'];
          changed = true;
        }
        if (changed) {
          await existing.save();
          updated++;
        } else {
          skipped++;
        }
      } else {
        await Song.create({
          title,
          primaryArtist: artistId,
          artistDisplay: artistName,
          duration,
          categoryAssignments: [{ category: targetCatId, addedAt: new Date() }],
          externalIds,
          keywords: ['vormgeving', 'imaging'],
          isActive: true,
          isArchived: false,
          weight: 50,
        });
        created++;
      }
    } catch (err) {
      console.error(`Error on row ${title || titleId}: ${err.message}`);
    }
  }

  console.log('\nRamps import complete');
  console.log(`  Created: ${created}`);
  console.log(`  Updated/added to Imaging: ${updated}`);
  console.log(`  Already present: ${skipped}`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

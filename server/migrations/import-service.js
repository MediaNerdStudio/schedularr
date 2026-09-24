/**
 * Import NEWS.tsv service songs into a "Service" category.
 *
 * The TSV header names are present but trailing columns contain the real IDs.
 * We read by column position:
 *   0=artist, 1=title, 2=category, 3=duration(ms),
 *   8=itemcode, 9=titleId
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Song, Artist, Category } from '../models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, '..', '..', 'Development', 'NEWS.tsv');

function parseRows(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t').map(c => c.trim().replace(/\r$/, ''));
    if (cols.length < 4) continue;
    rows.push({
      artist: cols[0],
      title: cols[1],
      category: cols[2],
      duration: parseInt(cols[3], 10) || 0,
      itemcode: cols[8] || '',
      titleId: cols[9] || '',
      filename: cols[4] || '',
    });
  }
  return rows;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to MongoDB: ${mongoose.connection.host}/${mongoose.connection.name}`);

  const rows = parseRows(FILE);
  console.log(`Service rows: ${rows.length}`);

  let serviceCat = await Category.findOne({ name: 'Service', parent: null }).lean();
  if (!serviceCat) {
    serviceCat = await Category.create({
      name: 'Service',
      code: 'SERV',
      type: 'news',
      color: '#ef4444',
      folders: [{ name: 'Default', exposure: 100 }],
    });
    console.log('Created category: Service');
  }
  const targetCatId = serviceCat._id;

  const artistMap = new Map();
  for (const a of await Artist.find({}).lean()) {
    artistMap.set(a.name.toLowerCase(), a._id);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const titleId = row.titleId;
    if (!titleId) { skipped++; continue; }

    const artistName = row.artist || 'Unknown';
    let artistId = artistMap.get(artistName.toLowerCase());
    if (!artistId) {
      const newArtist = await Artist.create({ name: artistName });
      artistId = newArtist._id;
      artistMap.set(artistName.toLowerCase(), artistId);
    }

    const existing = await Song.findOne({ 'externalIds.omniTitleId': titleId });
    try {
      if (existing) {
        let changed = false;
        if (!existing.categoryAssignments.some(ca => String(ca.category) === String(targetCatId))) {
          existing.categoryAssignments.push({ category: targetCatId, addedAt: new Date() });
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
          title: row.title || 'Untitled',
          primaryArtist: artistId,
          artistDisplay: artistName,
          duration: row.duration,
          categoryAssignments: [{ category: targetCatId, addedAt: new Date() }],
          externalIds: {
            omniTitleId: titleId,
            omniItemCode: row.itemcode,
            automationFilename: row.filename,
          },
          isActive: true,
          isArchived: false,
          weight: 50,
        });
        created++;
      }
    } catch (err) {
      console.error(`Error on row ${titleId}: ${err.message}`);
    }
  }

  console.log('\nService import complete');
  console.log(`  Created: ${created}`);
  console.log(`  Updated/added to Service: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

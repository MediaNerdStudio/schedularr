import 'dotenv/config';
import { connectDB } from '../db.js';
import { Category, Song, Clock, Block, Rule } from '../models/index.js';
import mongoose from 'mongoose';

// Wipe all existing categories and rebuild a clean tree:
// - One parent per decade (from the song's year)
// - Subcategories per rotation label (Hits, TOTH, A/B/C rotation, etc.)
// - One "Uncategorised" bucket for songs without a usable year
// All other imported categories are deleted.

const LABELS = [
  { key: 'hit', suffix: 'HIT', name: 'Hits' },
  { key: 'toth', suffix: 'TOTH', name: 'TOTH' },
  { key: 'a-rotation', suffix: 'AROT', name: 'A Rotation' },
  { key: 'b-rotation', suffix: 'BROT', name: 'B Rotation' },
  { key: 'c-rotation', suffix: 'CROT', name: 'C Rotation' },
  { key: 'album-track', suffix: 'ALBM', name: 'Album Tracks' },
  { key: 'top40', suffix: 'TOP40', name: 'Top40' },
  { key: 'tipparade', suffix: 'TIPP', name: 'Tipparade' },
  { key: 'vormgeving', suffix: 'VORM', name: 'Vormgeving' },
];

const DECADE_COLORS = {
  1950: '#8c564b', 1960: '#7f7f7f', 1970: '#bcbd22', 1980: '#17becf',
  1990: '#9467bd', 2000: '#e377c2', 2010: '#ff7f0e', 2020: '#d62728',
};

function decadeColor(decade) {
  return DECADE_COLORS[decade] || '#3b82f6';
}

function makeCode(rootCode, suffix) {
  const base = String(rootCode).replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10);
  return `${base}-${suffix}`.slice(0, 16);
}

async function createSubcat(root, suffix, name, overrides = {}) {
  const code = makeCode(root.code, suffix);
  try {
    return await Category.create({
      code,
      name,
      parent: root._id,
      color: root.color,
      type: root.type,
      ...overrides,
    });
  } catch (err) {
    if (err.code === 11000) {
      return Category.findOne({ code });
    }
    throw err;
  }
}

async function run() {
  await connectDB();

  // 1. Discover decades from actual song years
  const pipeline = [
    { $match: { year: { $gte: 1900, $lte: 2100 } } },
    { $project: { decade: { $multiply: [{ $floor: { $divide: ['$year', 10] } }, 10] } } },
    { $group: { _id: '$decade', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ];
  const decadeCounts = await Song.aggregate(pipeline);
  console.log('Decades found:', decadeCounts.map(d => `${d._id} (${d.count})`).join(', '));

  const keepIds = [];

  // 2. Create decade parents and subcategories
  const decadeMap = {};
  for (const { _id: decade, count } of decadeCounts) {
    const code = String(decade);
    let root = await Category.findOne({ code });
    if (!root) {
      root = await Category.create({
        code,
        name: `${decade}s`,
        type: 'music',
        color: decadeColor(decade),
      });
    }
    keepIds.push(root._id);

    const allSongs = await createSubcat(root, 'ALL', 'All Songs', { rotationLabel: '' });
    keepIds.push(allSongs._id);

    const labelCats = {};
    for (const label of LABELS) {
      const overrides = { rotationLabel: label.key };
      if (label.key === 'vormgeving') overrides.type = 'imaging';
      const sub = await createSubcat(root, label.suffix, label.name, overrides);
      keepIds.push(sub._id);
      labelCats[label.key] = sub;
    }

    decadeMap[decade] = { root, allSongs, labelCats };
    console.log(`  ${decade}s: created ${Object.keys(labelCats).length + 1} subcats`);
  }

  // 3. Create Uncategorised bucket
  let uncatRoot = await Category.findOne({ code: 'UNCAT' });
  if (!uncatRoot) {
    uncatRoot = await Category.create({
      code: 'UNCAT',
      name: 'Uncategorised',
      type: 'music',
      color: '#6b7280',
    });
  }
  keepIds.push(uncatRoot._id);
  const uncatAllSongs = await createSubcat(uncatRoot, 'ALL', 'All Songs', { rotationLabel: '' });
  keepIds.push(uncatAllSongs._id);

  // 4. Rebuild every song's category assignments
  console.log('\nReassigning songs...');
  let processed = 0;
  const batchSize = 1000;

  const cursor = Song.find({}).cursor();
  let batch = [];

  for (let song = await cursor.next(); song != null; song = await cursor.next()) {
    const year = song.year;
    let group;
    if (year && year >= 1900 && year <= 2100) {
      const decade = Math.floor(year / 10) * 10;
      group = decadeMap[decade];
    }

    const targetAllSongs = group ? group.allSongs : uncatAllSongs;
    const assignments = [{ category: targetAllSongs._id, addedAt: new Date() }];

    if (group) {
      for (const labelKey of song.rotationLabels || []) {
        const sub = group.labelCats[labelKey];
        if (sub && !assignments.some(a => a.category.equals(sub._id))) {
          assignments.push({ category: sub._id, addedAt: new Date() });
        }
      }
    }

    batch.push({
      updateOne: {
        filter: { _id: song._id },
        update: { $set: { categoryAssignments: assignments } },
      },
    });

    if (batch.length >= batchSize) {
      await Song.bulkWrite(batch);
      processed += batch.length;
      if (processed % 5000 === 0) console.log(`  ${processed} songs updated`);
      batch = [];
    }
  }

  if (batch.length) {
    await Song.bulkWrite(batch);
    processed += batch.length;
  }

  console.log(`  ${processed} songs total updated`);

  // 5. Strip old category references from clocks, blocks, and rules
  console.log('\nCleaning up references...');
  const [clockRes, blockRes, ruleRes] = await Promise.all([
    Clock.updateMany(
      { 'elements.category': { $ne: null } },
      { $set: { 'elements.$[el].category': null } },
      { arrayFilters: [{ 'el.category': { $ne: null } }] }
    ),
    Block.updateMany(
      { 'elements.category': { $ne: null } },
      { $set: { 'elements.$[el].category': null } },
      { arrayFilters: [{ 'el.category': { $ne: null } }] }
    ),
    Rule.updateMany({ category: { $ne: null } }, { $set: { category: null } }),
  ]);
  console.log(`  Clock elements cleared: ${clockRes.modifiedCount}`);
  console.log(`  Block elements cleared: ${blockRes.modifiedCount}`);
  console.log(`  Rules cleared: ${ruleRes.modifiedCount}`);

  // 6. Delete all categories not in the keep list
  const deleteRes = await Category.deleteMany({ _id: { $nin: keepIds } });
  console.log(`\nDeleted ${deleteRes.deletedCount} old categories`);

  // Summary
  const [totalCats, uncatCount] = await Promise.all([
    Category.countDocuments(),
    Song.countDocuments({ 'categoryAssignments.category': uncatAllSongs._id }),
  ]);
  console.log(`\nDone. Categories: ${totalCats}, Uncategorised songs: ${uncatCount}`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

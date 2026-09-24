import 'dotenv/config';
import { connectDB } from '../db.js';
import { Category, Song, Clock, Block, Rule } from '../models/index.js';
import mongoose from 'mongoose';

// Organize flat imported categories into a tree:
// Each existing category becomes a parent group, songs are moved into
// subcategories based on their rotation labels (and an "All Songs" bucket).

const LABEL_ORDER = [
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

const SUFFIX_FOR_LABEL = Object.fromEntries(LABEL_ORDER.map(l => [l.key, l]));

function makeCode(rootCode, suffix) {
  // Keep codes compact: root code + dash + suffix, max 16 chars
  const base = rootCode.replace(/[^A-Z0-9]/g, '').slice(0, 10);
  return `${base}-${suffix}`.slice(0, 16);
}

async function findOrCreateSubcat(root, suffix, name, overrides = {}) {
  const existing = await Category.findOne({ parent: root._id, name });
  if (existing) return existing;
  const code = makeCode(root.code, suffix);
  const type = overrides.type || root.type || 'music';
  try {
    return await Category.create({
      code,
      name,
      type,
      parent: root._id,
      color: root.color,
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

  const roots = await Category.find({ parent: null }).sort('code');
  console.log(`Found ${roots.length} parent categories to organize`);

  for (const root of roots) {
    // Load all songs currently in this root category
    const songsInRoot = await Song.find({ 'categoryAssignments.category': root._id }).lean();
    if (songsInRoot.length === 0) {
      console.log(`  ${root.code} ${root.name}: no songs, skipping`);
      continue;
    }

    console.log(`  ${root.code} ${root.name}: ${songsInRoot.length} songs`);

    // Detect imaging-style groups by label or name
    const isImagingGroup = root.name.toLowerCase().includes('vormgeving')
      || root.name.toLowerCase().includes('imaging')
      || root.name.toLowerCase().includes('jingle');
    if (isImagingGroup && root.type === 'music') {
      root.type = 'imaging';
      await root.save();
    }

    // Create "All Songs" subcategory
    const allSongsCat = await findOrCreateSubcat(root, 'ALL', 'All Songs', {
      type: root.type,
      rotationLabel: '',
    });

    // Figure out which labels exist in this group
    const labelSubcats = {};
    for (const label of LABEL_ORDER) {
      const count = songsInRoot.filter(s => (s.rotationLabels || []).includes(label.key)).length;
      if (count > 0) {
        const overrides = { rotationLabel: label.key };
        if (label.key === 'vormgeving') {
          overrides.type = 'imaging';
        }
        labelSubcats[label.key] = await findOrCreateSubcat(root, label.suffix, label.name, overrides);
      }
    }

    // Move songs: remove direct root assignment, add All Songs + each label subcat
    let moved = 0;
    const bulk = songsInRoot.map(song => {
      const assignments = (song.categoryAssignments || []).filter(
        a => String(a.category) !== String(root._id)
      );

      // Always add to All Songs
      if (!assignments.some(a => String(a.category) === String(allSongsCat._id))) {
        assignments.push({ category: allSongsCat._id, addedAt: new Date() });
      }

      // Add label subcats
      for (const labelKey of song.rotationLabels || []) {
        const subcat = labelSubcats[labelKey];
        if (subcat && !assignments.some(a => String(a.category) === String(subcat._id))) {
          assignments.push({ category: subcat._id, addedAt: new Date() });
        }
      }

      return {
        updateOne: {
          filter: { _id: song._id },
          update: { $set: { categoryAssignments: assignments } },
        },
      };
    });

    if (bulk.length) {
      const result = await Song.bulkWrite(bulk);
      moved = result.modifiedCount;
    }

    // Update any clock/block/rule that pointed directly at the root category
    // to point at the All Songs bucket (safe default; user can reassign later)
    const [clockUpdates, blockUpdates, ruleUpdates] = await Promise.all([
      Clock.updateMany(
        { 'elements.category': root._id },
        { $set: { 'elements.$[el].category': allSongsCat._id } },
        { arrayFilters: [{ 'el.category': root._id }] }
      ),
      Block.updateMany(
        { 'elements.category': root._id },
        { $set: { 'elements.$[el].category': allSongsCat._id } },
        { arrayFilters: [{ 'el.category': root._id }] }
      ),
      Rule.updateMany(
        { category: root._id },
        { $set: { category: allSongsCat._id } }
      ),
    ]);

    console.log(`    created ${Object.keys(labelSubcats).length} label subcats, moved ${moved} songs`);
    if (clockUpdates.modifiedCount) console.log(`    updated ${clockUpdates.modifiedCount} clock elements`);
    if (blockUpdates.modifiedCount) console.log(`    updated ${blockUpdates.modifiedCount} block elements`);
    if (ruleUpdates.modifiedCount) console.log(`    updated ${ruleUpdates.modifiedCount} rules`);
  }

  // Summary
  const [totalCats, totalSongs] = await Promise.all([
    Category.countDocuments(),
    Song.countDocuments(),
  ]);
  console.log(`\nDone. Categories: ${totalCats}, Songs: ${totalSongs}`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

import 'dotenv/config';
import { connectDB } from '../db.js';
import { AssignmentGrid } from '../models/index.js';

async function run() {
  await connectDB();

  const all = await AssignmentGrid.find({});
  console.log(`Found ${all.length} grids`);

  const byStation = {};
  for (const grid of all) {
    const sid = String(grid.station);
    if (!byStation[sid]) byStation[sid] = [];
    byStation[sid].push(grid);
  }

  for (const [stationId, grids] of Object.entries(byStation)) {
    // If any grid is already default, leave it; otherwise make the first one default.
    const hasDefault = grids.some(g => g.isDefault);
    if (!hasDefault) {
      const first = grids.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name))[0];
      first.isDefault = true;
      first.isActive = true;
      await first.save();
      console.log(`  Station ${stationId}: set "${first.name}" as default`);
    }
  }

  // Ensure all grids are active unless explicitly inactive
  await AssignmentGrid.updateMany({ isActive: { $exists: false } }, { $set: { isActive: true } });
  console.log('Done');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

import 'dotenv/config';
import { connectDB } from '../db.js';
import { Category } from '../models/index.js';

async function run() {
  await connectDB();
  const result = await Category.updateMany(
    { parent: { $ne: null }, color: { $ne: '' } },
    { $set: { color: '' } }
  );
  console.log(`Cleared color on ${result.modifiedCount} subcategories`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

import mongoose from 'mongoose';

const chartEntrySchema = new mongoose.Schema({
  song: { type: mongoose.Schema.Types.ObjectId, ref: 'Song', required: true },
  rankThisWeek: { type: Number, required: true },
  rankLastWeek: { type: Number, default: 0 }, // 0 = new entry
  rankTwoWeeksAgo: { type: Number, default: 0 },
  rankThreeWeeksAgo: { type: Number, default: 0 },
  peakPosition: { type: Number, default: 0 },
  peakDate: { type: Date },
  weeksOnChart: { type: Number, default: 1 },
  debutDate: { type: Date },
  movement: { type: String, enum: ['new', 'up', 'down', 'same', 'reentry'], default: 'new' },
  note: { type: String, default: '' }, // "Add", "Drop", etc.
}, { _id: false });

const chartSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "Top 40", "Mega Top 50"
  description: { type: String, default: '' },
  maxEntries: { type: Number, default: 40 },

  // Current chart data
  chartDate: { type: Date, required: true },
  entries: [chartEntrySchema],

  // History of previous weeks (for reference)
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

chartSchema.index({ name: 1, chartDate: -1 });

export default mongoose.model('Chart', chartSchema);

import mongoose from 'mongoose';

// 168-cell grid: 7 days x 24 hours, mapping each hour to a clock
const hourAssignmentSchema = new mongoose.Schema({
  day: { type: Number, required: true, min: 0, max: 6 }, // 0=Monday, 1=Tuesday, ... 6=Sunday
  hour: { type: Number, required: true, min: 0, max: 23 },
  clock: { type: mongoose.Schema.Types.ObjectId, ref: 'Clock', default: null },
}, { _id: false });

const assignmentGridSchema = new mongoose.Schema({
  name: { type: String, required: true },
  station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true },
  description: { type: String, default: '' },
  color: { type: String, default: '#3b82f6' },

  // 168 hour assignments (7 days x 24 hours)
  hours: [hourAssignmentSchema],

  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

assignmentGridSchema.index({ station: 1, isActive: 1 });

export default mongoose.model('AssignmentGrid', assignmentGridSchema);

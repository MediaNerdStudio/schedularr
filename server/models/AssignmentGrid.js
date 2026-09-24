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

  // Default grid for the station. Only one default may be active at a time.
  isDefault: { type: Boolean, default: false },

  // Period grids are active between periodStart and periodEnd (inclusive).
  // They override the default grid during scheduling when active.
  periodStart: { type: Date, default: null },
  periodEnd: { type: Date, default: null },

  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

assignmentGridSchema.index({ station: 1, isActive: 1 });
assignmentGridSchema.index({ station: 1, isDefault: 1, isActive: 1 });
assignmentGridSchema.index({ station: 1, isActive: 1, periodStart: 1, periodEnd: 1 });

// Ensure only one active default grid per station
assignmentGridSchema.pre('save', async function () {
  if (this.isDefault && this.isActive) {
    await mongoose.model('AssignmentGrid').updateMany(
      { station: this.station, _id: { $ne: this._id }, isDefault: true, isActive: true },
      { $set: { isDefault: false } }
    );
  }
});

// Ensure period grids are not marked as default
assignmentGridSchema.pre('save', function () {
  if (this.periodStart || this.periodEnd) {
    this.isDefault = false;
  }
});

export default mongoose.model('AssignmentGrid', assignmentGridSchema);

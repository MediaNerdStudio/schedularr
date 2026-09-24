import mongoose from 'mongoose';

// Grid rotation and date-specific overrides (like MusicMaster Format Scheduler)
const gridRotationEntrySchema = new mongoose.Schema({
  grid: { type: mongoose.Schema.Types.ObjectId, ref: 'AssignmentGrid', required: true },
  sortOrder: { type: Number, default: 0 },
}, { _id: false });

const dateOverrideSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  grid: { type: mongoose.Schema.Types.ObjectId, ref: 'AssignmentGrid' }, // override entire day
  hourOverrides: [{
    hour: { type: Number, min: 0, max: 23 },
    clock: { type: mongoose.Schema.Types.ObjectId, ref: 'Clock' },
  }],
  label: { type: String, default: '' }, // e.g., "Holiday", "Special Event"
}, { _id: false });

const formatCalendarSchema = new mongoose.Schema({
  station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true },

  // Weekly grid rotation — cycles through these grids week by week
  gridRotation: [gridRotationEntrySchema],

  // Date-specific overrides
  dateOverrides: [dateOverrideSchema],

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

formatCalendarSchema.index({ station: 1 }, { unique: true });

export default mongoose.model('FormatCalendar', formatCalendarSchema);

import mongoose from 'mongoose';

// A single scheduled item within an hour
const scheduleItemSchema = new mongoose.Schema({
  position: { type: Number, required: true },

  // What was scheduled
  type: {
    type: String,
    enum: ['song', 'imaging', 'jingle', 'note', 'command', 'traffic', 'block', 'empty'],
    required: true,
  },
  song: { type: mongoose.Schema.Types.ObjectId, ref: 'Song' },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  folder: { type: mongoose.Schema.Types.ObjectId },
  block: { type: mongoose.Schema.Types.ObjectId, ref: 'Block' },

  // Display info (denormalized for performance)
  title: { type: String, default: '' },
  artist: { type: String, default: '' },
  duration: { type: Number, default: 0 }, // ms

  // Clock element reference
  clockElementId: { type: mongoose.Schema.Types.ObjectId },

  // Scheduling metadata
  estimatedStartTime: { type: Date }, // calculated start time
  ruleViolations: [{
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rule' },
    ruleName: { type: String },
    severity: { type: String, enum: ['breakable', 'unbreakable'], default: 'breakable' },
    description: { type: String, default: '' },
  }],

  // Reconciliation
  reconcileStatus: {
    type: String,
    enum: ['pending', 'played', 'skipped', 'replaced', 'added'],
    default: 'pending',
  },
  actualPlayTime: { type: Date },
  replacedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Song' },

  // Manual edits
  isManuallyPlaced: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false }, // locked items can't be moved by auto-scheduler
  text: { type: String, default: '' }, // for notes/commands
}, { _id: true });

const scheduleHourSchema = new mongoose.Schema({
  station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true },
  date: { type: Date, required: true }, // date (midnight)
  hour: { type: Number, required: true, min: 0, max: 23 },

  // Clock used for this hour
  clock: { type: mongoose.Schema.Types.ObjectId, ref: 'Clock' },
  grid: { type: mongoose.Schema.Types.ObjectId, ref: 'AssignmentGrid' },

  // Scheduled items
  items: [scheduleItemSchema],

  // Status
  status: {
    type: String,
    enum: ['empty', 'scheduled', 'partial', 'edited', 'closed', 'reconciled'],
    default: 'empty',
  },

  // Timing
  totalDuration: { type: Number, default: 0 }, // total ms of all items
  overrun: { type: Number, default: 0 }, // ms over/under target

  // Scheduling session info
  scheduledAt: { type: Date },
  scheduledBy: { type: String, default: 'auto' },

  // Notes
  notes: { type: String, default: '' },
}, { timestamps: true });

scheduleHourSchema.index({ station: 1, date: 1, hour: 1 }, { unique: true });
scheduleHourSchema.index({ station: 1, date: 1 });
scheduleHourSchema.index({ status: 1 });

export default mongoose.model('ScheduleHour', scheduleHourSchema);

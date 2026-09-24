import mongoose from 'mongoose';

const stationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: { type: String, default: '' },
  parentStation: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', default: null },
  logo: { type: String, default: '' },
  color: { type: String, default: '#3b82f6' },
  timezone: { type: String, default: 'Europe/Amsterdam' },
  broadcastWeekStart: { type: Number, default: 1, min: 0, max: 6 }, // 0=Sun, 1=Mon
  settings: {
    defaultClockDuration: { type: Number, default: 60 }, // minutes
    schedulingDepth: { type: Number, default: 20 }, // search depth %
    allowOverrun: { type: Boolean, default: true }, // allow schedule to go over hour boundary
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

stationSchema.index({ parentStation: 1 });

export default mongoose.model('Station', stationSchema);

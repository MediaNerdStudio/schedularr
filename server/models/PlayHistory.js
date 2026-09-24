import mongoose from 'mongoose';

const playHistorySchema = new mongoose.Schema({
  station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true },
  song: { type: mongoose.Schema.Types.ObjectId, ref: 'Song', required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  folder: { type: mongoose.Schema.Types.ObjectId },

  // When it was scheduled vs when it actually played
  scheduledAt: { type: Date },
  playedAt: { type: Date, required: true },

  // Source
  source: {
    type: String,
    enum: ['scheduled', 'manual', 'reconciled', 'imported'],
    default: 'scheduled',
  },

  // Schedule reference
  scheduleHour: { type: mongoose.Schema.Types.ObjectId, ref: 'ScheduleHour' },

  // Denormalized fields for fast queries
  songTitle: { type: String, default: '' },
  artistName: { type: String, default: '' },
  duration: { type: Number, default: 0 },
}, { timestamps: true });

// Heavy indexing for scheduling engine lookups
playHistorySchema.index({ station: 1, song: 1, playedAt: -1 });
playHistorySchema.index({ station: 1, playedAt: -1 });
playHistorySchema.index({ song: 1, playedAt: -1 });
playHistorySchema.index({ station: 1, artistName: 1, playedAt: -1 });
playHistorySchema.index({ station: 1, category: 1, playedAt: -1 });

export default mongoose.model('PlayHistory', playHistorySchema);

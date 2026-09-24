import mongoose from 'mongoose';

// A Block is a mini-format — a self-contained sequence of elements
// e.g., "20 minutes of dance music" or "news block"
const blockElementSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['fixed', 'imaging', 'note', 'command'],
    required: true,
  },
  position: { type: Number, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  folder: { type: mongoose.Schema.Types.ObjectId },
  text: { type: String, default: '' },
  estimatedDuration: { type: Number, default: 0 }, // ms
  label: { type: String, default: '' },
  color: { type: String, default: '' },
}, { _id: true });

const blockSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, maxlength: 6, uppercase: true },
  description: { type: String, default: '' },
  color: { type: String, default: '#8b5cf6' },

  // Target duration for the entire block
  targetDuration: { type: Number, default: 1200000 }, // ms (20 min default)

  // Elements in this block
  elements: [blockElementSchema],

  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

blockSchema.index({ code: 1 }, { unique: true });

export default mongoose.model('Block', blockSchema);

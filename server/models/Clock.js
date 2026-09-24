import mongoose from 'mongoose';

// A single element in a clock (one position in the hour)
const clockElementSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'fixed',        // Fixed category position (most common)
      'migrating',    // Randomized category position
      'block',        // Mini-format block
      'note',         // Log note / text marker
      'command',      // Automation command
      'artist-block', // Artist block begin/end
      'flow-list',    // Rotating category list
      'traffic',      // Traffic merge position
      'time-marker',  // Time marker (target time)
      'imaging',      // Radio imaging (pick random from category)
      'special-set',  // Theme/multi-song set
      'song',         // Specific fixed song
    ],
    required: true,
  },
  position: { type: Number, required: true }, // order within clock (0-based)

  // For fixed/migrating/imaging elements
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  folder: { type: mongoose.Schema.Types.ObjectId }, // specific folder within category

  // For specific-song elements
  song: { type: mongoose.Schema.Types.ObjectId, ref: 'Song' },

  // For migrating elements — multiple category options
  migratingCategories: [{
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    folder: { type: mongoose.Schema.Types.ObjectId },
    minPerHour: { type: Number, default: 0 },
    maxPerHour: { type: Number, default: 0 },
    weight: { type: Number, default: 50 },
  }],

  // For block elements
  block: { type: mongoose.Schema.Types.ObjectId, ref: 'Block' },

  // For flow-list elements — rotating list of categories
  flowList: [{
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    folder: { type: mongoose.Schema.Types.ObjectId },
    frequency: { type: Number, default: 1 }, // how often this entry appears in rotation
  }],
  flowListPosition: { type: Number, default: 0 }, // current position in rotation

  // For note/command elements
  text: { type: String, default: '' },
  commandType: { type: String, default: '' }, // automation command type

  // For artist-block
  artistBlockAction: { type: String, enum: ['', 'begin', 'end'], default: '' },

  // For time-marker
  targetTime: { type: Number, default: 0 }, // minutes into the hour
  isHardTime: { type: Boolean, default: false }, // must hit this time exactly

  // For special-set
  specialSetConfig: {
    matchField: { type: String, default: 'artist' },
    matchDirection: { type: String, enum: ['', 'previous', 'next'], default: '' },
    matchScope: { type: String, enum: ['', 'any', 'music-only', 'same-set'], default: '' },
  },

  // Timing
  estimatedDuration: { type: Number, default: 0 }, // ms
  minDuration: { type: Number, default: 0 }, // ms
  maxDuration: { type: Number, default: 0 }, // ms

  // Natural Flow (Powergold)
  isPinned: { type: Boolean, default: true }, // pinned = fixed position, unpinned = can float

  // Display
  label: { type: String, default: '' },
  color: { type: String, default: '' },
}, { _id: true });

const clockSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, maxlength: 6, uppercase: true },
  station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true },
  description: { type: String, default: '' },
  color: { type: String, default: '#3b82f6' },

  // Clock type
  flowType: {
    type: String,
    enum: ['fixed', 'natural-flow'], // Powergold: Fixed Position vs Natural Flow
    default: 'fixed',
  },
  naturalFlowLevel: {
    type: String,
    enum: ['category', 'folder'], // separation level for Natural Flow
    default: 'category',
  },

  // Elements in this clock
  elements: [clockElementSchema],

  // Target hour duration
  targetDuration: { type: Number, default: 3600000 }, // ms (60 min)

  // Special programming tag
  specialTag: { type: String, default: '' },

  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

clockSchema.index({ station: 1, code: 1 }, { unique: true });
clockSchema.index({ station: 1, isActive: 1 });

export default mongoose.model('Clock', clockSchema);

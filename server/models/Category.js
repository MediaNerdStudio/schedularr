import mongoose from 'mongoose';

const folderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  exposure: { type: Number, default: 100, min: 0, max: 100 }, // % exposure when category has multiple folders
  songOrder: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Song' }], // rotation order
});

const categorySchema = new mongoose.Schema({
  code: { type: String, required: true, maxlength: 16, uppercase: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  type: {
    type: String,
    enum: ['music', 'non-music', 'imaging', 'jingle', 'liner', 'promo', 'news', 'traffic', 'other'],
    default: 'music',
  },
  color: { type: String, default: '#3b82f6' },
  icon: { type: String, default: '' },

  // Parent category (for tree structure)
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },

  // Rotation label — quick classification
  rotationLabel: {
    type: String,
    enum: ['', 'hit', 'toth', 'album-track', 'a-rotation', 'b-rotation', 'c-rotation', 'gold', 'recurrent', 'power', 'library', 'top40', 'tipparade', 'vormgeving'],
    default: '',
  },

  // Folders within this category (songs rotate within folders)
  folders: [folderSchema],

  // Scheduling rules (category-level defaults)
  rules: {
    songSeparation: { type: Number, default: 0 }, // minutes between same song
    artistPrimarySeparation: { type: Number, default: 0 }, // minutes between same primary artist
    artistSecondarySeparation: { type: Number, default: 0 }, // minutes between same secondary artist
    titleSeparation: { type: Number, default: 0 }, // minutes between same title (different versions)
    songYesterdayOffset: { type: Number, default: 0 }, // minutes offset from yesterday's play
    songFridayMondayOffset: { type: Number, default: 0 },
    artistSameHourSeparation: { type: Number, default: 0 }, // days — artist can't repeat in same hour for X days
    maxPlaysPerDay: { type: Number, default: 0 }, // 0 = unlimited
    artistMaxPlaysPerDay: { type: Number, default: 0 },
    searchDepth: { type: Number, default: 20 }, // % of folder to search
    noRepeatHours: { type: Boolean, default: false },
  },

  // Category group for quick filtering
  group: { type: String, default: '' },

  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

categorySchema.index({ code: 1 }, { unique: true });
categorySchema.index({ parent: 1 });
categorySchema.index({ type: 1 });
categorySchema.index({ group: 1 });
categorySchema.index({ rotationLabel: 1 });

export default mongoose.model('Category', categorySchema);

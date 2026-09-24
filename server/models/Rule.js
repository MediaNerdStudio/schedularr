import mongoose from 'mongoose';

const ruleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', default: null }, // null = global rule
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null }, // null = applies to all

  type: {
    type: String,
    enum: [
      // Song history rules
      'song-minimum-rest',
      'song-maximum-rest',
      'song-max-plays-per-day',
      'song-no-repeat',
      'song-dayparting',
      'song-same-hour-separation',
      'song-yesterday-offset',
      'song-friday-monday-offset',

      // Artist rules
      'artist-primary-separation',
      'artist-secondary-separation',
      'artist-same-hour-separation',
      'artist-max-plays-per-day',
      'artist-yesterday-offset',

      // Title/CD rules
      'title-separation',
      'cd-separation',

      // Attribute/property rules
      'property-max-in-row',
      'property-min-per-hour',
      'property-max-per-hour',
      'property-target-per-hour',

      // Keyword rules
      'keyword-separation',
      'keyword-hour-rotation',

      // Mood/energy rules
      'mood-flow',
      'energy-flow',
      'tempo-flow',

      // Numeric rules
      'numeric-min-value',
      'numeric-max-value',
      'numeric-target',

      // Format/clock rules
      'hour-timing',
      'segment-timing',
    ],
    required: true,
  },

  // Rule severity
  isBreakable: { type: Boolean, default: true }, // breakable (yellow) vs unbreakable (red)
  priority: { type: Number, default: 50, min: 0, max: 100 }, // higher = more important

  // Rule parameters (varies by type)
  params: {
    // Time-based params (minutes)
    separation: { type: Number, default: 0 },
    offset: { type: Number, default: 0 },
    days: { type: Number, default: 0 },

    // Count-based params
    maxCount: { type: Number, default: 0 },
    minCount: { type: Number, default: 0 },
    targetCount: { type: Number, default: 0 },
    maxInRow: { type: Number, default: 0 },

    // Property-specific
    propertyKey: { type: String, default: '' },
    propertyValue: { type: String, default: '' },
    propertyValues: [String],

    // Keyword-specific
    keyword: { type: String, default: '' },
    keywordGroup: { type: String, default: '' },

    // Numeric
    numericField: { type: String, default: '' },
    numericMin: { type: Number, default: 0 },
    numericMax: { type: Number, default: 0 },
    numericTarget: { type: Number, default: 0 },

    // Timing
    targetMinutes: { type: Number, default: 0 },
    toleranceMinutes: { type: Number, default: 0 },
  },

  // Daypart restrictions — rule only applies during these hours
  daypartRestriction: {
    enabled: { type: Boolean, default: false },
    grid: { type: [[Boolean]], default: [] }, // 7x24 grid
  },

  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

ruleSchema.index({ station: 1, category: 1, type: 1 });
ruleSchema.index({ type: 1, isActive: 1 });

export default mongoose.model('Rule', ruleSchema);

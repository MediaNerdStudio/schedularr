import mongoose from 'mongoose';

const chartEntrySchema = new mongoose.Schema({
  chartName: { type: String, required: true }, // e.g., "Top 40", "Mega Top 50"
  peakPosition: { type: Number, default: 0 },
  peakDate: { type: Date },
  weeksOnChart: { type: Number, default: 0 },
  debutDate: { type: Date },
  debutPosition: { type: Number, default: 0 },
}, { _id: false });

const externalIdSchema = new mongoose.Schema({
  // Spotify
  spotifyTrackId: { type: String, default: '' },
  spotifyTrackUrl: { type: String, default: '' },
  spotifyAlbumId: { type: String, default: '' },
  spotifyAlbumUrl: { type: String, default: '' },
  isrc: { type: String, default: '' },

  // YouTube
  youtubeVideoId: { type: String, default: '' },
  youtubeUrl: { type: String, default: '' },

  // OmniPlayer
  omniItemCode: { type: String, default: '' },
  omniTitleId: { type: String, default: '' },

  // Propfrexx
  propfrexxId: { type: String, default: '' },

  // RadioDJ
  radioDjId: { type: String, default: '' },

  // mAirList
  mairlistId: { type: String, default: '' },

  // Generic automation
  automationId: { type: String, default: '' },
  automationFilename: { type: String, default: '' },
  automationPath: { type: String, default: '' },
}, { _id: false });

const spotifyFeaturesSchema = new mongoose.Schema({
  acousticness: { type: Number, default: null },
  danceability: { type: Number, default: null },
  energy: { type: Number, default: null },
  instrumentalness: { type: Number, default: null },
  key: { type: Number, default: null }, // 0-11 (C, C#, D, ... B)
  liveness: { type: Number, default: null },
  loudness: { type: Number, default: null }, // dB
  mode: { type: Number, default: null }, // 0=minor, 1=major
  speechiness: { type: Number, default: null },
  tempo: { type: Number, default: null }, // BPM from Spotify
  timeSignature: { type: Number, default: null },
  valence: { type: Number, default: null }, // 0-1 (sad to happy)
}, { _id: false });

const songSchema = new mongoose.Schema({
  // Core identification
  title: { type: String, required: true, index: true },
  sortTitle: { type: String, default: '' }, // for sorting (e.g., without "The")

  // Artists
  primaryArtist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
  secondaryArtists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Artist' }],
  featuredArtists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Artist' }],
  artistDisplay: { type: String, default: '' }, // formatted display string: "Artist ft. Artist2"
  composer: { type: String, default: '' },
  lyricist: { type: String, default: '' },
  producer: { type: String, default: '' },

  // Album
  albumTitle: { type: String, default: '' },
  albumArtist: { type: String, default: '' },
  albumType: { type: String, enum: ['', 'album', 'single', 'compilation', 'ep'], default: '' },
  discNumber: { type: Number, default: 1 },
  trackNumber: { type: Number, default: 1 },
  totalTracks: { type: Number, default: 0 },
  releaseDate: { type: Date },
  releaseDatePrecision: { type: String, enum: ['', 'year', 'month', 'day'], default: '' },
  label: { type: String, default: '' },

  // Audio properties
  duration: { type: Number, default: 0 }, // milliseconds
  bpm: { type: Number, default: 0 }, // beats per minute (user-set or from Spotify)
  musicalKey: { type: String, default: '' }, // e.g., "Am", "C#"
  intro: { type: Number, default: 0 }, // intro duration in ms (ramp time)
  outro: { type: Number, default: 0 }, // outro duration in ms
  cueIn: { type: Number, default: 0 }, // ms - point where audio starts
  cueOut: { type: Number, default: 0 }, // ms - point where audio ends (0 = end)
  hookStart: { type: Number, default: 0 }, // ms - hook/chorus start
  hookEnd: { type: Number, default: 0 }, // ms - hook/chorus end
  ending: { type: String, enum: ['', 'fade', 'cold', 'jingle'], default: '' },
  explicit: { type: Boolean, default: false },

  // Classification
  genre: { type: String, default: '' },
  subGenre: { type: String, default: '' },
  genres: [String], // all genres (from Spotify or manual)
  era: { type: String, default: '' }, // e.g., "80s", "90s", "2020s"
  year: { type: Number, default: 0 },
  language: { type: String, default: '' },
  country: { type: String, default: '' }, // country of origin

  // Mood & Energy (manual + Spotify-derived)
  mood: {
    type: String,
    enum: ['', 'very-sad', 'melancholy', 'neutral', 'happy', 'very-happy'],
    default: '',
  },
  energy: {
    type: String,
    enum: ['', 'very-low', 'low', 'medium', 'high', 'very-high'],
    default: '',
  },
  tempo: {
    type: String,
    enum: ['', 'very-slow', 'slow', 'medium', 'fast', 'very-fast'],
    default: '',
  },

  // Rotation & scheduling labels
  rotationLabels: [{
    type: String,
    enum: ['hit', 'toth', 'album-track', 'a-rotation', 'b-rotation', 'c-rotation', 'gold', 'recurrent', 'power', 'library'],
  }],

  // Custom properties (like Powergold properties — key/value pairs)
  properties: [{
    key: String,
    value: String,
  }],

  // Keywords (for keyword separation)
  keywords: [String],

  // Category/folder assignment
  categoryAssignments: [{
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    folder: { type: mongoose.Schema.Types.ObjectId }, // folder _id within category
    position: { type: Number, default: 0 }, // rotation position within folder
    addedAt: { type: Date, default: Date.now },
  }],

  // Dayparting — restrict when this song can play
  dayparting: {
    enabled: { type: Boolean, default: false },
    // 7x24 grid: array of 7 arrays of 24 booleans (true = allowed)
    // [0]=Sunday, [1]=Monday, ... [6]=Saturday
    grid: { type: [[Boolean]], default: [] },
  },

  // Charts
  chartHistory: [chartEntrySchema],

  // External IDs
  externalIds: { type: externalIdSchema, default: () => ({}) },

  // Spotify audio features
  spotifyFeatures: { type: spotifyFeaturesSchema, default: () => ({}) },

  // Images
  images: [{
    url: String,
    height: Number,
    width: Number,
  }],
  artwork: { type: String, default: '' }, // primary artwork URL

  // Weights (0-100, higher = more likely to be scheduled)
  weight: { type: Number, default: 50, min: 0, max: 100 },

  // Packet — grouped songs that rotate together
  packetId: { type: String, default: '' },

  // Notes
  notes: { type: String, default: '' },

  // Status
  isActive: { type: Boolean, default: true },
  isArchived: { type: Boolean, default: false },

  // Spotify sync
  spotifyLastSync: { type: Date },
}, { timestamps: true });

// Indexes for common queries
songSchema.index({ 'primaryArtist': 1 });
songSchema.index({ 'categoryAssignments.category': 1 });
songSchema.index({ 'externalIds.spotifyTrackId': 1 });
songSchema.index({ 'externalIds.omniItemCode': 1 });
songSchema.index({ 'externalIds.omniTitleId': 1 });
songSchema.index({ 'externalIds.isrc': 1 });
songSchema.index({ rotationLabels: 1 });
songSchema.index({ genre: 1, year: 1 });
songSchema.index({ isActive: 1, isArchived: 1 });
songSchema.index({ title: 'text', artistDisplay: 'text', albumTitle: 'text' }, { language_override: 'searchLanguage' });

export default mongoose.model('Song', songSchema);

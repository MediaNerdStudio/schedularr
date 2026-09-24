import mongoose from 'mongoose';

const artistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sortName: { type: String, default: '' }, // e.g., "Jepsen, Carly Rae"
  aliases: [String], // alternative names / spellings

  // Spotify data
  spotifyId: { type: String, default: '', index: true },
  spotifyUrl: { type: String, default: '' },
  genres: [String],
  images: [{
    url: String,
    height: Number,
    width: Number,
  }],
  popularity: { type: Number, default: 0 },

  // Separation grouping — songs by linked artists are treated as "same artist" for separation
  separationGroup: { type: String, default: '' },

  // Country of origin
  country: { type: String, default: '' },

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

artistSchema.index({ name: 1 });
artistSchema.index({ 'aliases': 1 });

export default mongoose.model('Artist', artistSchema);

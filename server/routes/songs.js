import { Router } from 'express';
import { Song, Artist } from '../models/index.js';

const router = Router();

// List / search songs with filtering
router.get('/', async (req, res) => {
  try {
    const { q, category, rotationLabel, genre, year, isActive, limit = 100, skip = 0, sort = 'title' } = req.query;
    const filter = {};

    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { artistDisplay: { $regex: q, $options: 'i' } },
        { albumTitle: { $regex: q, $options: 'i' } },
      ];
    }
    if (category) filter['categoryAssignments.category'] = category;
    if (rotationLabel) filter.rotationLabels = rotationLabel;
    if (genre) filter.genre = { $regex: genre, $options: 'i' };
    if (year) filter.year = Number(year);
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    // Default: exclude archived
    if (!req.query.includeArchived) filter.isArchived = { $ne: true };

    const sortObj = {};
    if (sort.startsWith('-')) {
      sortObj[sort.slice(1)] = -1;
    } else {
      sortObj[sort] = 1;
    }

    const [songs, total] = await Promise.all([
      Song.find(filter)
        .populate('primaryArtist', 'name spotifyId images')
        .populate('secondaryArtists', 'name')
        .populate('featuredArtists', 'name')
        .populate('categoryAssignments.category', 'code name color type rotationLabel')
        .sort(sortObj)
        .skip(Number(skip))
        .limit(Number(limit)),
      Song.countDocuments(filter),
    ]);
    res.json({ songs, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single song with full details
router.get('/:id', async (req, res) => {
  try {
    const song = await Song.findById(req.params.id)
      .populate('primaryArtist')
      .populate('secondaryArtists')
      .populate('featuredArtists')
      .populate('categoryAssignments.category');
    if (!song) return res.status(404).json({ error: 'Song not found' });
    res.json(song);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create song
router.post('/', async (req, res) => {
  try {
    // Auto-create artist if only name is provided
    if (req.body.primaryArtistName && !req.body.primaryArtist) {
      let artist = await Artist.findOne({ name: req.body.primaryArtistName });
      if (!artist) {
        artist = await Artist.create({ name: req.body.primaryArtistName });
      }
      req.body.primaryArtist = artist._id;
      if (!req.body.artistDisplay) {
        req.body.artistDisplay = artist.name;
      }
    }

    const song = await Song.create(req.body);
    const populated = await Song.findById(song._id)
      .populate('primaryArtist', 'name spotifyId images')
      .populate('categoryAssignments.category', 'code name color type');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update song
router.put('/:id', async (req, res) => {
  try {
    const song = await Song.findByIdAndUpdate(req.params.id, req.body, { returnDocument: "after", runValidators: true })
      .populate('primaryArtist', 'name spotifyId images')
      .populate('secondaryArtists', 'name')
      .populate('featuredArtists', 'name')
      .populate('categoryAssignments.category', 'code name color type');
    if (!song) return res.status(404).json({ error: 'Song not found' });
    res.json(song);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete song (soft delete — archive)
router.delete('/:id', async (req, res) => {
  try {
    const { hard } = req.query;
    if (hard === 'true') {
      const song = await Song.findByIdAndDelete(req.params.id);
      if (!song) return res.status(404).json({ error: 'Song not found' });
      return res.json({ deleted: true });
    }
    const song = await Song.findByIdAndUpdate(req.params.id, { isArchived: true, isActive: false }, { returnDocument: "after" });
    if (!song) return res.status(404).json({ error: 'Song not found' });
    res.json({ archived: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk update songs (mass changer)
router.post('/bulk-update', async (req, res) => {
  try {
    const { songIds, update } = req.body;
    if (!songIds?.length) return res.status(400).json({ error: 'No song IDs provided' });
    const result = await Song.updateMany({ _id: { $in: songIds } }, update);
    res.json({ matched: result.matchedCount, modified: result.modifiedCount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

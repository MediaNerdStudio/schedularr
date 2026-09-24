import { Router } from 'express';
import { Artist } from '../models/index.js';

const router = Router();

// List / search artists
router.get('/', async (req, res) => {
  try {
    const { q, limit = 100, skip = 0 } = req.query;
    const filter = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { aliases: { $regex: q, $options: 'i' } },
      ];
    }
    const [artists, total] = await Promise.all([
      Artist.find(filter).sort('name').skip(Number(skip)).limit(Number(limit)),
      Artist.countDocuments(filter),
    ]);
    res.json({ artists, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single artist
router.get('/:id', async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });
    res.json(artist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create artist
router.post('/', async (req, res) => {
  try {
    const artist = await Artist.create(req.body);
    res.status(201).json(artist);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update artist
router.put('/:id', async (req, res) => {
  try {
    const artist = await Artist.findByIdAndUpdate(req.params.id, req.body, { returnDocument: "after", runValidators: true });
    if (!artist) return res.status(404).json({ error: 'Artist not found' });
    res.json(artist);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete artist
router.delete('/:id', async (req, res) => {
  try {
    const artist = await Artist.findByIdAndDelete(req.params.id);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

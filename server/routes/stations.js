import { Router } from 'express';
import { Station } from '../models/index.js';

const router = Router();

// List all stations (optionally filter by parent)
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.parent) filter.parentStation = req.query.parent;
    if (req.query.parent === 'null') filter.parentStation = null;
    const stations = await Station.find(filter).sort('name').populate('parentStation', 'name slug');
    res.json(stations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single station
router.get('/:id', async (req, res) => {
  try {
    const station = await Station.findById(req.params.id).populate('parentStation', 'name slug');
    if (!station) return res.status(404).json({ error: 'Station not found' });
    // Also get sub-stations
    const subStations = await Station.find({ parentStation: station._id }).sort('name');
    res.json({ ...station.toObject(), subStations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create station
router.post('/', async (req, res) => {
  try {
    const station = await Station.create(req.body);
    res.status(201).json(station);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Slug already exists' });
    res.status(400).json({ error: err.message });
  }
});

// Update station
router.put('/:id', async (req, res) => {
  try {
    const station = await Station.findByIdAndUpdate(req.params.id, req.body, { returnDocument: "after", runValidators: true });
    if (!station) return res.status(404).json({ error: 'Station not found' });
    res.json(station);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete station
router.delete('/:id', async (req, res) => {
  try {
    const station = await Station.findByIdAndDelete(req.params.id);
    if (!station) return res.status(404).json({ error: 'Station not found' });
    // Also clear parent references
    await Station.updateMany({ parentStation: req.params.id }, { parentStation: null });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

import { Router } from 'express';
import { Clock } from '../models/index.js';

const router = Router();

// List clocks (filter by station)
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.station) filter.station = req.query.station;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    const clocks = await Clock.find(filter)
      .populate('station', 'name slug')
      .populate('elements.category', 'code name color type')
      .sort('sortOrder code');
    res.json(clocks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single clock
router.get('/:id', async (req, res) => {
  try {
    const clock = await Clock.findById(req.params.id)
      .populate('station', 'name slug')
      .populate('elements.category', 'code name color type')
      .populate('elements.migratingCategories.category', 'code name color type')
      .populate('elements.flowList.category', 'code name color type')
      .populate('elements.block', 'name code color targetDuration');
    if (!clock) return res.status(404).json({ error: 'Clock not found' });
    res.json(clock);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create clock
router.post('/', async (req, res) => {
  try {
    const clock = await Clock.create(req.body);
    res.status(201).json(clock);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Clock code already exists for this station' });
    res.status(400).json({ error: err.message });
  }
});

// Update clock
router.put('/:id', async (req, res) => {
  try {
    const clock = await Clock.findByIdAndUpdate(req.params.id, req.body, { returnDocument: "after", runValidators: true })
      .populate('station', 'name slug')
      .populate('elements.category', 'code name color type');
    if (!clock) return res.status(404).json({ error: 'Clock not found' });
    res.json(clock);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete clock
router.delete('/:id', async (req, res) => {
  try {
    const clock = await Clock.findByIdAndDelete(req.params.id);
    if (!clock) return res.status(404).json({ error: 'Clock not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Duplicate clock
router.post('/:id/duplicate', async (req, res) => {
  try {
    const source = await Clock.findById(req.params.id);
    if (!source) return res.status(404).json({ error: 'Clock not found' });
    const obj = source.toObject();
    delete obj._id;
    delete obj.createdAt;
    delete obj.updatedAt;
    obj.name = req.body.name || `${source.name} (copy)`;
    obj.code = req.body.code || `${source.code}C`;
    const clock = await Clock.create(obj);
    res.status(201).json(clock);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

import { Router } from 'express';
import { Rule } from '../models/index.js';

const router = Router();

// List rules (filter by station, category, type)
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.station) filter.station = req.query.station;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.type) filter.type = req.query.type;
    const rules = await Rule.find(filter)
      .populate('station', 'name slug')
      .populate('category', 'code name color')
      .sort('sortOrder name');
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single rule
router.get('/:id', async (req, res) => {
  try {
    const rule = await Rule.findById(req.params.id)
      .populate('station', 'name slug')
      .populate('category', 'code name color');
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json(rule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create rule
router.post('/', async (req, res) => {
  try {
    const rule = await Rule.create(req.body);
    res.status(201).json(rule);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update rule
router.put('/:id', async (req, res) => {
  try {
    const rule = await Rule.findByIdAndUpdate(req.params.id, req.body, { returnDocument: "after", runValidators: true })
      .populate('station', 'name slug')
      .populate('category', 'code name color');
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json(rule);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete rule
router.delete('/:id', async (req, res) => {
  try {
    const rule = await Rule.findByIdAndDelete(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

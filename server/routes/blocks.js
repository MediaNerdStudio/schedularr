import { Router } from 'express';
import { Block } from '../models/index.js';

const router = Router();

// List blocks
router.get('/', async (req, res) => {
  try {
    const blocks = await Block.find({ isActive: true })
      .populate('elements.category', 'code name color type')
      .sort('sortOrder name');
    res.json(blocks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single block
router.get('/:id', async (req, res) => {
  try {
    const block = await Block.findById(req.params.id)
      .populate('elements.category', 'code name color type');
    if (!block) return res.status(404).json({ error: 'Block not found' });
    res.json(block);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create block
router.post('/', async (req, res) => {
  try {
    const block = await Block.create(req.body);
    res.status(201).json(block);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Block code already exists' });
    res.status(400).json({ error: err.message });
  }
});

// Update block
router.put('/:id', async (req, res) => {
  try {
    const block = await Block.findByIdAndUpdate(req.params.id, req.body, { returnDocument: "after", runValidators: true })
      .populate('elements.category', 'code name color type');
    if (!block) return res.status(404).json({ error: 'Block not found' });
    res.json(block);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete block
router.delete('/:id', async (req, res) => {
  try {
    const block = await Block.findByIdAndDelete(req.params.id);
    if (!block) return res.status(404).json({ error: 'Block not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

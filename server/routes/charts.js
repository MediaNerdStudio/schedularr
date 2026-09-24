import { Router } from 'express';
import { Chart, Song } from '../models/index.js';

const router = Router();

// List charts
router.get('/', async (req, res) => {
  try {
    const { name } = req.query;
    const filter = {};
    if (name) filter.name = name;
    const charts = await Chart.find(filter)
      .populate('entries.song', 'title artistDisplay artwork duration')
      .sort('-chartDate');
    res.json(charts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single chart
router.get('/:id', async (req, res) => {
  try {
    const chart = await Chart.findById(req.params.id)
      .populate('entries.song', 'title artistDisplay artwork duration year genre');
    if (!chart) return res.status(404).json({ error: 'Chart not found' });
    res.json(chart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create chart
router.post('/', async (req, res) => {
  try {
    const chart = await Chart.create(req.body);
    res.status(201).json(chart);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update chart (including entries)
router.put('/:id', async (req, res) => {
  try {
    const chart = await Chart.findByIdAndUpdate(req.params.id, req.body, { returnDocument: "after", runValidators: true })
      .populate('entries.song', 'title artistDisplay artwork duration');
    if (!chart) return res.status(404).json({ error: 'Chart not found' });

    // Sync chart data back to songs
    if (req.body.syncToSongs) {
      for (const entry of chart.entries) {
        if (!entry.song) continue;
        await Song.findByIdAndUpdate(entry.song._id || entry.song, {
          $addToSet: {
            chartHistory: {
              chartName: chart.name,
              peakPosition: entry.peakPosition,
              peakDate: entry.peakDate,
              weeksOnChart: entry.weeksOnChart,
              debutDate: entry.debutDate,
            },
          },
        });
      }
    }

    res.json(chart);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete chart
router.delete('/:id', async (req, res) => {
  try {
    const chart = await Chart.findByIdAndDelete(req.params.id);
    if (!chart) return res.status(404).json({ error: 'Chart not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

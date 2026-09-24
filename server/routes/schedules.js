import { Router } from 'express';
import { ScheduleHour, PlayHistory } from '../models/index.js';
import { scheduleHours } from '../lib/scheduler.js';

const router = Router();

// === Scheduler (static paths BEFORE parameterized) ===

// Run the automatic scheduler
router.post('/run', async (req, res) => {
  try {
    const { stationId, date, startHour = 0, endHour = 23, gridId } = req.body;
    if (!stationId || !date) {
      return res.status(400).json({ error: 'stationId and date are required' });
    }
    const result = await scheduleHours({
      stationId,
      date: new Date(date),
      startHour: Number(startHour),
      endHour: Number(endHour),
      gridId,
    });
    res.json(result);
  } catch (err) {
    console.error('Scheduler error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Clear schedule for a station/date range
router.post('/clear', async (req, res) => {
  try {
    const { stationId, date, startHour, endHour } = req.body;
    if (!stationId || !date) {
      return res.status(400).json({ error: 'stationId and date are required' });
    }
    const filter = { station: stationId, date: new Date(date) };
    if (startHour !== undefined && endHour !== undefined) {
      filter.hour = { $gte: Number(startHour), $lte: Number(endHour) };
    }
    const result = await ScheduleHour.deleteMany(filter);
    res.json({ deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Play History (static paths BEFORE parameterized) ===

// Get play history for a song
router.get('/history/song/:songId', async (req, res) => {
  try {
    const { station, limit = 50 } = req.query;
    const filter = { song: req.params.songId };
    if (station) filter.station = station;
    const history = await PlayHistory.find(filter)
      .populate('station', 'name slug')
      .sort('-playedAt')
      .limit(Number(limit));
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get play history for a station (recent)
router.get('/history/station/:stationId', async (req, res) => {
  try {
    const { limit = 100, since } = req.query;
    const filter = { station: req.params.stationId };
    if (since) filter.playedAt = { $gte: new Date(since) };
    const history = await PlayHistory.find(filter)
      .sort('-playedAt')
      .limit(Number(limit));
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Schedule CRUD (parameterized routes) ===

// Get schedule for a station and date range
router.get('/', async (req, res) => {
  try {
    const { station, startDate, endDate } = req.query;
    if (!station) return res.status(400).json({ error: 'Station is required' });
    const filter = { station };
    if (startDate) filter.date = { $gte: new Date(startDate) };
    if (endDate) filter.date = { ...filter.date, $lte: new Date(endDate) };

    const hours = await ScheduleHour.find(filter)
      .populate('clock', 'name code color')
      .populate('items.song', 'title artistDisplay artwork duration')
      .populate('items.category', 'code name color')
      .sort('date hour');
    res.json(hours);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single schedule hour
router.get('/:id', async (req, res) => {
  try {
    const hour = await ScheduleHour.findById(req.params.id)
      .populate('clock', 'name code color elements')
      .populate('items.song', 'title artistDisplay artwork duration primaryArtist')
      .populate('items.category', 'code name color type');
    if (!hour) return res.status(404).json({ error: 'Schedule hour not found' });
    res.json(hour);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create/update schedule hour
router.put('/:stationId/:date/:hour', async (req, res) => {
  try {
    const { stationId, date, hour } = req.params;
    const scheduleHour = await ScheduleHour.findOneAndUpdate(
      { station: stationId, date: new Date(date), hour: Number(hour) },
      { ...req.body, station: stationId, date: new Date(date), hour: Number(hour) },
      { returnDocument: "after", upsert: true, runValidators: true }
    );
    res.json(scheduleHour);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update a single item in a schedule hour
router.patch('/:id/items/:itemId', async (req, res) => {
  try {
    const hour = await ScheduleHour.findById(req.params.id);
    if (!hour) return res.status(404).json({ error: 'Schedule hour not found' });
    const item = hour.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    Object.assign(item, req.body);
    await hour.save();
    res.json(hour);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete schedule hour
router.delete('/:id', async (req, res) => {
  try {
    const hour = await ScheduleHour.findByIdAndDelete(req.params.id);
    if (!hour) return res.status(404).json({ error: 'Schedule hour not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

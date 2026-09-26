import { Router } from 'express';
import { getLiveChartEntries, listLiveChartPeriods, listLiveCharts } from '../lib/liveCharts.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    res.json(await listLiveCharts());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:slug/periods', async (req, res) => {
  try {
    res.json(await listLiveChartPeriods(req.params.slug));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:slug/entries', async (req, res) => {
  try {
    const period = { year: req.query.year, week: req.query.week, edition: req.query.edition };
    if (!Number.isFinite(Number(period.year))) return res.status(400).json({ error: 'A valid year is required' });
    const periodData = await listLiveChartPeriods(req.params.slug);
    if (periodData.periodType === 'week' && !Number.isFinite(Number(period.week))) return res.status(400).json({ error: 'A valid week is required' });
    if (periodData.periodType === 'edition' && !Number.isFinite(Number(period.edition))) return res.status(400).json({ error: 'A valid edition is required' });
    res.json(await getLiveChartEntries(req.params.slug, period));
  } catch (error) {
    const status = error.message === 'Chart not found' ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
});

export default router;

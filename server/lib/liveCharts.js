import mongoose from 'mongoose';
import { Song, Category } from '../models/index.js';

const WEEK_CHARTS = new Set(['top40', 'tipparade']);

function collections() {
  return {
    charts: process.env.LIVE_CHARTS_COLLECTION || 'Charts',
    periods: process.env.LIVE_CHART_PERIODS_COLLECTION || 'ChartPeriods',
    entries: process.env.LIVE_CHART_ENTRIES_COLLECTION || 'ChartEntries',
  };
}

function database() {
  return mongoose.connection.client.db(process.env.LIVE_CHARTS_DB || 'WatHoordeIk');
}

export async function listLiveCharts() {
  const { charts } = collections();
  const docs = await database().collection(charts)
    .find({}, { projection: { slug: 1, name: 1, publisher: 1 } })
    .sort({ name: 1 })
    .toArray();
  return docs.map(doc => ({
    slug: doc.slug,
    name: doc.name || doc.slug,
    publisher: doc.publisher || '',
    periodType: WEEK_CHARTS.has(doc.slug) ? 'week' : 'edition',
  }));
}

export async function listLiveChartPeriods(slug) {
  const periodType = WEEK_CHARTS.has(slug) ? 'week' : 'edition';
  const { periods } = collections();
  const projection = periodType === 'week'
    ? { _id: 0, year: 1, week: 1 }
    : { _id: 0, year: 1, edition: 1 };
  const sort = periodType === 'week' ? { year: -1, week: -1 } : { year: -1, edition: -1 };
  const docs = await database().collection(periods)
    .find({ chartSlug: slug, periodType }, { projection })
    .sort(sort)
    .toArray();
  return { slug, periodType, periods: docs };
}

export async function getLiveChartEntries(slug, period) {
  const chart = await database().collection(collections().charts).findOne({ slug }, { projection: { publisher: 1, name: 1 } });
  if (!chart) throw new Error('Chart not found');
  const periodType = WEEK_CHARTS.has(slug) ? 'week' : 'edition';
  const filter = { chartSlug: slug, periodType, year: Number(period.year) };
  if (periodType === 'week') filter.week = Number(period.week);
  else filter.edition = Number(period.edition);
  const entries = await database().collection(collections().entries)
    .find(filter, {
      projection: {
        _id: 0, chartSlug: 1, periodType: 1, year: 1, week: 1, edition: 1,
        section: 1, current: 1, last: 1, weeks: 1, movement: 1,
        movement_label: 1, state: 1, status: 1, alarmschijf: 1,
        artist: 1, title: 1, sourceId: 1,
      },
    })
    .sort({ section: 1, current: 1 })
    .toArray();
  const propertyKey = chart.publisher === 'NPO' ? 'npo_id' : chart.publisher === 'Stichting Top40' ? 'top40_id' : null;
  let linkedIds = new Set();
  if (propertyKey) {
    const sourceIds = [...new Set(entries.map(entry => String(entry.sourceId || '')).filter(Boolean))];
    const songs = await Song.find({ properties: { $elemMatch: { key: propertyKey, value: { $in: sourceIds } } } }, 'properties').lean();
    linkedIds = new Set(songs.flatMap(song => song.properties.filter(property => property.key === propertyKey).map(property => property.value)));
  }
  return {
    slug,
    name: chart.name || slug,
    publisher: chart.publisher || '',
    periodType,
    entries: entries.map(entry => ({ ...entry, linked: linkedIds.has(String(entry.sourceId || '')) })),
  };
}

async function latestWeek(slug) {
  const periodData = await listLiveChartPeriods(slug);
  const period = periodData.periods[0];
  if (!period) throw new Error(`No periods found for ${slug}`);
  return getLiveChartEntries(slug, period);
}

function propertyValue(song, key) {
  return song.properties?.find(property => property.key === key)?.value || '';
}

async function categoryTreeTargets() {
  const categories = await Category.find({}).lean();
  const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const root = name => categories.find(category => !category.parent && normalize(category.name) === normalize(name));
  const child = (parent, name) => categories.find(category => String(category.parent) === String(parent?._id) && normalize(category.name) === normalize(name));
  const hits = root('Hits');
  const top40 = child(hits, 'Top 40');
  const tipparade = child(hits, 'Tipparade');
  if (!hits || !top40 || !tipparade) throw new Error('Required categories Hits > Top 40 and Hits > Tipparade were not found');
  const decadeTargets = new Map();
  for (const decade of categories.filter(category => !category.parent && /^\d{4}$/.test(category.name))) {
    const rotation = child(decade, 'A Rotation');
    if (rotation) decadeTargets.set(decade.name, rotation);
  }
  return { top40, tipparade, decadeTargets };
}

export async function prepareWestRadioChartSync() {
  const [top40Chart, tipparadeChart, targets] = await Promise.all([
    latestWeek('top40'),
    latestWeek('tipparade'),
    categoryTreeTargets(),
  ]);
  const activeSourceIds = {
    top40: new Set(top40Chart.entries.filter(entry => entry.current !== 0 && entry.section === 'main' && entry.sourceId).map(entry => String(entry.sourceId))),
    tipparade: new Set(tipparadeChart.entries.filter(entry => entry.current !== 0 && entry.section === 'main' && entry.sourceId).map(entry => String(entry.sourceId))),
  };
  const sourceIds = [...new Set([...activeSourceIds.top40, ...activeSourceIds.tipparade])];
  const linkedSongs = await Song.find({ properties: { $elemMatch: { key: 'top40_id', value: { $in: sourceIds } } } }).lean();
  const top40Songs = linkedSongs.filter(song => activeSourceIds.top40.has(String(propertyValue(song, 'top40_id'))));
  const top40SongIds = new Set(top40Songs.map(song => String(song._id)));
  const tipparadeSongs = linkedSongs.filter(song => !top40SongIds.has(String(song._id)) && activeSourceIds.tipparade.has(String(propertyValue(song, 'top40_id'))));

  const currentChartSongs = await Song.find({
    'categoryAssignments.category': { $in: [targets.top40._id, targets.tipparade._id] },
  }).lean();
  const activeSongIds = new Set([...top40Songs, ...tipparadeSongs].map(song => String(song._id)));
  const exits = [];
  const unresolved = [];
  for (const song of currentChartSongs) {
    if (activeSongIds.has(String(song._id))) continue;
    const decade = song.year ? `${Math.floor(song.year / 10) * 10}` : '';
    const target = targets.decadeTargets.get(decade);
    if (!target) {
      unresolved.push({ songId: song._id, artist: song.artistDisplay, title: song.title, year: song.year, reason: 'No release-decade A Rotation category' });
      continue;
    }
    exits.push({ song, target });
  }
  return {
    charts: {
      top40: { year: top40Chart.entries[0]?.year, week: top40Chart.entries[0]?.week, entries: activeSourceIds.top40.size, linked: top40Songs.length },
      tipparade: { year: tipparadeChart.entries[0]?.year, week: tipparadeChart.entries[0]?.week, entries: activeSourceIds.tipparade.size, linked: tipparadeSongs.length },
    },
    targets,
    top40Songs,
    tipparadeSongs,
    exits,
    unresolved,
  };
}

export function westRadioChartSyncSummary(plan) {
  return {
    charts: plan.charts,
    activateTop40: plan.top40Songs.length,
    activateTipparade: plan.tipparadeSongs.length,
    releaseToDecades: plan.exits.length,
    unresolved: plan.unresolved,
  };
}

export async function syncWestRadioCharts() {
  const plan = await prepareWestRadioChartSync();
  if (plan.unresolved.length) {
    const error = new Error(`${plan.unresolved.length} exiting chart songs have no release-decade A Rotation target`);
    error.details = plan.unresolved;
    throw error;
  }
  const now = new Date();
  const operations = [];
  for (const { song, target } of plan.exits) {
    const targetIds = new Set([String(plan.targets.top40._id), String(plan.targets.tipparade._id)]);
    const assignments = (song.categoryAssignments || []).filter(assignment => !targetIds.has(String(assignment.category)));
    if (!assignments.some(assignment => String(assignment.category) === String(target._id))) assignments.push({ category: target._id, addedAt: now });
    operations.push({ updateOne: { filter: { _id: song._id }, update: { $set: { categoryAssignments: assignments } } } });
  }
  for (const song of plan.tipparadeSongs) {
    operations.push({ updateOne: { filter: { _id: song._id }, update: { $set: { categoryAssignments: [{ category: plan.targets.tipparade._id, addedAt: now }] } } } });
  }
  for (const song of plan.top40Songs) {
    operations.push({ updateOne: { filter: { _id: song._id }, update: { $set: { categoryAssignments: [{ category: plan.targets.top40._id, addedAt: now }] } } } });
  }
  if (operations.length) await Song.bulkWrite(operations, { ordered: true });
  return { ...westRadioChartSyncSummary(plan), updatedSongs: operations.length };
}

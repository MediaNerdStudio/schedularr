import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { Song, Artist } from '../models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OMNI_ENV = path.resolve(__dirname, '..', '..', '..', 'MediaNerd.OmniDatabase', '.env');
const DEFAULT_CREDENTIALS_FILE = path.resolve(__dirname, '..', '..', '..', 'MediaNerd.OmniDatabase', 'medianerd-api-ab35756261a3.json');
const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Sheet columns that are never synced: title_id (identity), reference_text (Omni ItemCode),
// Category (Schedularr-only), DEL/DONE/update_omni/row (sheet workflow columns).
const MANAGED_PROPERTY_KEYS = ['quality', 'version', 'version_info', 'remarks', 'let_op', 'original_source', 'top40_id', 'npo_id'];
const MANAGED_CHARTS = [
  { column: 'Top40', chartName: 'Top 40' },
  { column: 'Tipparade', chartName: 'Tipparade' },
];
const ROTATION_FLAGS = [
  { column: 'HIT', label: 'hit' },
  { column: 'TOTH', label: 'toth' },
  { column: 'Album Track', label: 'album-track' },
  { column: 'A-Rotation', label: 'a-rotation' },
  { column: 'B-Rotation', label: 'b-rotation' },
  { column: 'C-Rotation', label: 'c-rotation' },
];
const SYNCED_FIELDS = [
  'primaryArtist', 'title', 'artistDisplay', 'albumTitle', 'duration', 'year', 'bpm',
  'releaseDate', 'releaseDatePrecision', 'rotationLabels', 'chartHistory', 'keywords', 'properties',
  'externalIds.automationFilename', 'externalIds.spotifyTrackId', 'externalIds.spotifyTrackUrl', 'externalIds.isrc',
];

function loadConfig() {
  const file = process.env.OMNI_ENV_FILE || DEFAULT_OMNI_ENV;
  const fallback = fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
  const value = key => process.env[key] || fallback[key];
  const config = {
    credentialsFile: process.env.GOOGLE_CREDENTIALS_FILE || DEFAULT_CREDENTIALS_FILE,
    sheetId: value('GOOGLE_SHEET_OMNI'),
    sheetName: process.env.GOOGLE_SHEET_NAME || 'All Songs',
  };
  if (!config.sheetId) throw new Error('Missing Google sheet configuration: GOOGLE_SHEET_OMNI');
  if (!fs.existsSync(config.credentialsFile)) throw new Error(`Google service account credentials not found: ${config.credentialsFile}`);
  return config;
}

function parseTsv(buffer) {
  const lines = Buffer.from(buffer).toString('utf-8').split(/\r?\n/).filter(line => line.trim());
  const headers = lines.shift().split('\t').map(header => header.trim());
  return lines.map(line => {
    const columns = line.split('\t');
    const row = {};
    headers.forEach((header, index) => { row[header] = (columns[index] || '').trim(); });
    return row;
  });
}

export async function downloadSheetRows() {
  const config = loadConfig();
  const credentials = JSON.parse(fs.readFileSync(config.credentialsFile, 'utf-8'));
  const auth = new JWT({ email: credentials.client_email, key: credentials.private_key, scopes: GOOGLE_SCOPES });
  const document = new GoogleSpreadsheet(config.sheetId, auth);
  await document.loadInfo();
  const sheet = document.sheetsByTitle[config.sheetName];
  if (!sheet) throw new Error(`Sheet "${config.sheetName}" not found in spreadsheet ${config.sheetId}`);
  const rows = parseTsv(await sheet.downloadAsTSV());
  return { sheetName: config.sheetName, rows };
}

function flag(row, column) {
  return String(row[column] || '').toUpperCase() === 'TRUE';
}

function integer(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseReleased(value) {
  const text = String(value || '').trim();
  if (/^\d{4}$/.test(text)) return { releaseDate: new Date(`${text}-01-01T00:00:00.000Z`), releaseDatePrecision: 'year' };
  if (/^\d{4}-\d{2}$/.test(text)) return { releaseDate: new Date(`${text}-01T00:00:00.000Z`), releaseDatePrecision: 'month' };
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return { releaseDate: new Date(`${text}T00:00:00.000Z`), releaseDatePrecision: 'day' };
  return { releaseDate: null, releaseDatePrecision: '' };
}

// Builds the desired synced fields for a sheet row. Managed properties replace the
// sheet-managed keys while unmanaged keys already on the song are preserved.
function desiredFields(row, song, artistMap) {
  const fields = {};

  const artistName = row.interpret || row.artist_display || 'Unknown';
  fields.primaryArtist = artistMap.get(artistName.toLowerCase()) || song.primaryArtist;
  fields.artistDisplay = row.artist_display || artistName;
  fields.title = row.title || row.title_display || song.title;
  fields.albumTitle = row.Album || '';
  fields.duration = integer(row.duration);
  fields.year = integer(row.year);
  fields.bpm = row.bpm ? Math.round(Number.parseFloat(row.bpm.replace(',', '.')) || 0) : 0;
  Object.assign(fields, parseReleased(row.Released));

  fields.rotationLabels = ROTATION_FLAGS.filter(({ column }) => flag(row, column)).map(({ label }) => label);

  // Managed chart flags add missing bare entries and remove bare entries that have
  // no recorded positions; richer chart entries are left untouched.
  const chartHistory = (song.chartHistory || []).map(entry => ({ ...entry }));
  for (const { column, chartName } of MANAGED_CHARTS) {
    const existing = chartHistory.findIndex(entry => entry.chartName === chartName);
    if (flag(row, column) && existing === -1) {
      chartHistory.push({ chartName, peakPosition: 0, weeksOnChart: 0 });
    } else if (!flag(row, column) && existing !== -1) {
      const entry = chartHistory[existing];
      if (!entry.peakPosition && !entry.weeksOnChart && !entry.peakDate && !entry.debutDate) chartHistory.splice(existing, 1);
    }
  }
  fields.chartHistory = chartHistory;

  const keywords = new Set(song.keywords || []);
  if (flag(row, 'Vormgeving')) { keywords.add('vormgeving'); keywords.add('imaging'); }
  fields.keywords = [...keywords];

  const properties = (song.properties || []).filter(property => !MANAGED_PROPERTY_KEYS.includes(property.key));
  const managedValues = {
    quality: row.quality, version: row.version, version_info: row.version_info,
    remarks: row.REMARKS, let_op: row['LET OP'], original_source: row['Original Source'],
    top40_id: row.top40_id, npo_id: row.npo_id,
  };
  for (const [key, value] of Object.entries(managedValues)) {
    if (String(value || '').trim()) properties.push({ key, value: String(value).trim() });
  }
  fields.properties = properties;

  fields['externalIds.automationFilename'] = row.soundfile_name || '';
  fields['externalIds.spotifyTrackId'] = row['Spotify ID'] || '';
  fields['externalIds.spotifyTrackUrl'] = row['Spotify Link'] || '';
  fields['externalIds.isrc'] = row.ISRC || '';

  return fields;
}

function getPath(object, dotted) {
  return dotted.split('.').reduce((value, key) => value?.[key], object);
}

function normalize(value) {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object' && value._bsontype === 'ObjectId') return String(value);
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).sort()) {
      if (key === '_id') continue;
      result[key] = normalize(value[key]);
    }
    return result;
  }
  if (value === null || value === undefined) return '';
  return value;
}

function diffFields(song, desired) {
  const changes = {};
  for (const field of SYNCED_FIELDS) {
    const current = normalize(getPath(song, field));
    const next = normalize(desired[field]);
    if (JSON.stringify(current) !== JSON.stringify(next)) changes[field] = desired[field];
  }
  return changes;
}

function buildPlan(rows, songsByTitleId, artistMap) {
  const plan = { updates: [], unchanged: 0, unmatchedRows: [], noTitleId: 0, fieldChanges: {} };
  for (const row of rows) {
    const titleId = String(row.title_id || '').trim();
    if (!titleId) { plan.noTitleId += 1; continue; }
    const song = songsByTitleId.get(titleId);
    if (!song) {
      plan.unmatchedRows.push({ title_id: titleId, interpret: row.interpret || '', title: row.title || '' });
      continue;
    }
    const changes = diffFields(song, desiredFields(row, song, artistMap));
    if (Object.keys(changes).length === 0) { plan.unchanged += 1; continue; }
    for (const field of Object.keys(changes)) plan.fieldChanges[field] = (plan.fieldChanges[field] || 0) + 1;
    plan.updates.push({ song, changes, label: `${song.artistDisplay || row.interpret} — ${song.title}` });
  }
  return plan;
}

async function loadSongsByTitleId() {
  const songs = await Song.find(
    { 'externalIds.omniTitleId': { $nin: ['', null] } },
    'title artistDisplay primaryArtist albumTitle duration year bpm releaseDate releaseDatePrecision rotationLabels chartHistory keywords properties externalIds',
  ).lean();
  return new Map(songs.map(song => [String(song.externalIds.omniTitleId), song]));
}

function summarize(sheetName, rows, activeRows, plan, newArtistNames) {
  return {
    sheetName,
    rows: rows.length,
    skippedDeleted: rows.length - activeRows.length,
    noTitleId: plan.noTitleId,
    matched: plan.updates.length + plan.unchanged,
    changed: plan.updates.length,
    unchanged: plan.unchanged,
    unmatchedRows: plan.unmatchedRows.slice(0, 50),
    unmatchedTotal: plan.unmatchedRows.length,
    fieldChanges: plan.fieldChanges,
    newArtists: [...newArtistNames.values()],
    sampleChanges: plan.updates.slice(0, 25).map(({ label, changes }) => ({ song: label, fields: Object.keys(changes) })),
  };
}

export async function prepareGoogleSheetSync() {
  const { sheetName, rows } = await downloadSheetRows();
  const activeRows = rows.filter(row => !flag(row, 'DEL'));

  const artists = await Artist.find({}, 'name').lean();
  const artistMap = new Map(artists.map(artist => [artist.name.toLowerCase(), artist._id]));
  const newArtistNames = new Map();
  for (const row of activeRows) {
    const name = row.interpret || row.artist_display || 'Unknown';
    if (!artistMap.has(name.toLowerCase()) && !newArtistNames.has(name.toLowerCase())) newArtistNames.set(name.toLowerCase(), name);
  }

  const songsByTitleId = await loadSongsByTitleId();
  const plan = buildPlan(activeRows, songsByTitleId, artistMap);
  return { summary: summarize(sheetName, rows, activeRows, plan, newArtistNames), plan, activeRows, songsByTitleId, artistMap, newArtistNames };
}

export async function previewGoogleSheetSync() {
  const prepared = await prepareGoogleSheetSync();
  return prepared.summary;
}

export async function syncGoogleSheet() {
  const prepared = await prepareGoogleSheetSync();
  const { summary, activeRows, songsByTitleId, artistMap, newArtistNames } = prepared;

  let artistsCreated = 0;
  if (newArtistNames.size) {
    const docs = await Artist.insertMany([...newArtistNames.values()].map(name => ({ name })), { ordered: false }).catch(error => error.insertedDocs || []);
    for (const artist of docs) artistMap.set(artist.name.toLowerCase(), artist._id);
    artistsCreated = docs.length;
  }

  // Rebuild the plan so updates resolve the freshly created artists.
  const plan = artistsCreated ? buildPlan(activeRows, songsByTitleId, artistMap) : prepared.plan;

  const operations = plan.updates.map(({ song, changes }) => ({
    updateOne: { filter: { _id: song._id }, update: { $set: changes } },
  }));
  const result = operations.length ? await Song.bulkWrite(operations, { ordered: false }) : { modifiedCount: 0 };

  return { ...summary, changed: plan.updates.length, updated: result.modifiedCount, artistsCreated };
}

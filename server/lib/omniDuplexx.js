import fs from 'fs';
import path from 'path';
import Sybase from 'sybase';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { ScheduleHour, Station } from '../models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OMNI_ENV = path.resolve(__dirname, '..', '..', '..', 'MediaNerd.OmniDatabase', '.env');

function loadConfig() {
  const file = process.env.OMNI_ENV_FILE || DEFAULT_OMNI_ENV;
  const fallback = fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
  const value = key => process.env[key] || fallback[key];
  const config = {
    host: value('SYBASE_HOST'),
    port: Number(value('SYBASE_PORT')),
    database: value('SYBASE_DB'),
    username: value('SYBASE_USER'),
    password: value('SYBASE_PASSWORD'),
    radioId: Number(value('OMNI_RADIO_ID') || value('STATION_ID')),
    toth: String(value('OMNI_TOTH_BLOCK') ?? value('BLOCKS_TOTH') ?? 'false').toLowerCase() === 'true',
    powerIntroLink: String(value('OMNI_POWERINTRO_LINK') ?? value('OPTION_POWERINTRO_LINK') ?? 'false').toLowerCase() === 'true',
    powerIntroSuffix: value('OMNI_POWERINTRO_SUFFIX') || value('OPTION_POWERINTRO_ITEMCODE_SUFFIX') || '',
  };
  const missing = Object.entries(config)
    .filter(([key, entry]) => ['host', 'port', 'database', 'username', 'password', 'radioId'].includes(key) && !entry)
    .map(([key]) => key);
  if (missing.length) throw new Error(`Missing Omni Sybase configuration: ${missing.join(', ')}`);
  return config;
}

function connect(config) {
  const connection = new Sybase(
    config.host,
    config.port,
    config.database,
    config.username,
    config.password,
    false,
    undefined,
    { encoding: 'latin1' },
  );
  return new Promise((resolve, reject) => connection.connect(error => error ? reject(error) : resolve(connection)));
}

function query(connection, sql) {
  return new Promise((resolve, reject) => connection.query(sql, (error, rows) => error ? reject(error) : resolve(rows || [])));
}

function escapeSql(value) {
  return String(value ?? '').replaceAll("'", "''");
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function nextDate(date) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function sqlTime(date, hour) {
  if (hour < 24) return `${date} ${String(hour).padStart(2, '0')}:00:00.000`;
  return `${nextDate(date)} 00:00:00.000`;
}

function itemCode(value) {
  const code = String(value || '').trim();
  return code.length < 5 ? code.padStart(5, '0') : code;
}

function itemStartTime(item, date, hour, timezone) {
  if (!item.estimatedStartTime) return `${date} ${String(hour).padStart(2, '0')}:00:00.000`;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(item.estimatedStartTime));
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}.000`;
}

async function loadSchedule(selection) {
  const station = await Station.findById(selection.stationId).lean();
  if (!station) throw new Error('Station not found');
  const filter = {
    station: station._id,
    status: { $in: ['scheduled', 'edited', 'closed', 'reconciled'] },
  };
  if (selection.mode === 'future') {
    filter.date = { $gte: new Date(`${selection.fromDate}T00:00:00.000Z`) };
  } else {
    filter.date = new Date(`${selection.date}T00:00:00.000Z`);
    filter.hour = { $gte: selection.startHour, $lte: selection.endHour };
  }
  const hours = await ScheduleHour.find(filter)
    .populate('clock', 'name')
    .populate('items.song', 'externalIds')
    .sort('date hour')
    .lean();
  if (!hours.length) throw new Error('No scheduled hours found for the selected period');
  return { station, hours };
}

async function prepare(selection) {
  const config = loadConfig();
  const { station, hours } = await loadSchedule(selection);
  const unresolved = [];
  const scheduleItems = [];
  for (const hour of hours) {
    for (const item of hour.items || []) {
      if (!item.song && ['song', 'imaging', 'jingle'].includes(item.type)) {
        unresolved.push({ date: dateKey(hour.date), hour: hour.hour, title: item.title, reason: 'Linked Schedularr song was not found' });
        continue;
      }
      if (!item.song) continue;
      const code = itemCode(item.song.externalIds?.omniItemCode);
      if (!code) {
        unresolved.push({ date: dateKey(hour.date), hour: hour.hour, title: item.title, reason: 'Missing Omni ItemCode' });
        continue;
      }
      scheduleItems.push({ hour, item, code });
    }
  }
  if (unresolved.length) {
    const error = new Error(`${unresolved.length} scheduled items have no Omni ItemCode`);
    error.details = unresolved.slice(0, 100);
    throw error;
  }

  const connection = await connect(config);
  try {
    const references = await query(connection, 'SELECT "title_id", "reference_text" FROM "dalet_group"."titles_references" WHERE "reference_id" = 1');
    const referenceMap = new Map();
    for (const reference of references) {
      const code = String(reference.reference_text || '').trim();
      if (code && !referenceMap.has(code)) referenceMap.set(code, reference.title_id);
    }
    for (const entry of scheduleItems) {
      const powerIntroCode = `${entry.code}${config.powerIntroSuffix}`;
      entry.titleId = config.powerIntroLink && referenceMap.has(powerIntroCode)
        ? referenceMap.get(powerIntroCode)
        : referenceMap.get(entry.code);
      if (!entry.titleId) {
        unresolved.push({ date: dateKey(entry.hour.date), hour: entry.hour.hour, title: entry.item.title, itemCode: entry.code, reason: 'ItemCode not found in Omni' });
      }
    }
    if (unresolved.length) {
      const error = new Error(`${unresolved.length} scheduled ItemCodes could not be resolved in Omni`);
      error.details = unresolved.slice(0, 100);
      throw error;
    }

    const clockChecks = hours.map(hour => {
      const date = dateKey(hour.date);
      return `(\"clock_date\"='${sqlTime(date, hour.hour)}')`;
    });
    const existing = await query(connection, `SELECT "clock_id", "clock_date" FROM "dalet_group"."clocks" WHERE "radio_id"=${config.radioId} AND (${clockChecks.join(' OR ')})`);
    if (existing.length) {
      const error = new Error(`${existing.length} selected hours already exist in Omni; synchronization was not started`);
      error.details = existing.slice(0, 100);
      throw error;
    }

    const titleIds = [...new Set(scheduleItems.map(entry => Number(entry.titleId)))];
    const mixes = new Map();
    for (let index = 0; index < titleIds.length; index += 500) {
      const batch = titleIds.slice(index, index + 500);
      const rows = await query(connection, `SELECT "title_id","begin_offset","end_offset","fade_in","fade_out","crossfade" FROM "dalet_group"."titles_mix" WHERE "title_id" IN (${batch.join(',')})`);
      for (const row of rows) mixes.set(Number(row.title_id), row);
    }
    const missingMix = scheduleItems.filter(entry => !mixes.has(Number(entry.titleId)));
    if (missingMix.length) {
      const error = new Error(`${missingMix.length} scheduled items have no Omni mix data`);
      error.details = missingMix.slice(0, 100).map(entry => ({ title: entry.item.title, itemCode: entry.code, titleId: entry.titleId }));
      throw error;
    }

    const counters = await Promise.all([
      query(connection, 'SELECT "counter" FROM "dalet_group"."cclock"'),
      query(connection, 'SELECT "counter" FROM "dalet_group"."cblock"'),
      query(connection, 'SELECT "counter" FROM "dalet_group"."citem" WHERE "block_id"=0'),
    ]);
    return {
      config,
      station,
      hours,
      scheduleItems,
      mixes,
      counters: {
        clock: Number(counters[0][0]?.counter),
        block: Number(counters[1][0]?.counter),
        item: Number(counters[2][0]?.counter),
      },
    };
  } finally {
    connection.disconnect();
  }
}

function makePlan(prepared) {
  const { config, station, hours, scheduleItems, counters, mixes } = prepared;
  let clockCounter = counters.clock;
  let blockCounter = counters.block;
  let itemCounter = counters.item;
  const entriesByHour = new Map();
  for (const entry of scheduleItems) {
    const key = `${dateKey(entry.hour.date)}-${entry.hour.hour}`;
    if (!entriesByHour.has(key)) entriesByHour.set(key, []);
    entriesByHour.get(key).push(entry);
  }
  const clocks = hours.map(hour => {
    const date = dateKey(hour.date);
    const clock = {
      date,
      hour: hour.hour,
      clockId: ++clockCounter,
      blockId: ++blockCounter,
      name: hour.clock?.name || `Schedularr ${date} ${String(hour.hour).padStart(2, '0')}:00`,
      start: sqlTime(date, hour.hour),
      end: sqlTime(date, hour.hour + 1),
      toth: null,
      items: [],
    };
    if (config.toth) {
      clock.toth = { blockId: ++blockCounter, itemId: ++itemCounter, items: [] };
    }
    const hourItems = entriesByHour.get(`${date}-${hour.hour}`) || [];
    hourItems.sort((a, b) => a.item.position - b.item.position).forEach((entry, index) => {
      const planned = {
        itemId: ++itemCounter,
        order: (index + 1) * 10000,
        titleId: Number(entry.titleId),
        itemCode: entry.code,
        title: entry.item.title,
        artist: entry.item.artist,
        start: itemStartTime(entry.item, date, hour.hour, station.timezone || 'Europe/Amsterdam'),
        mix: mixes.get(Number(entry.titleId)),
      };
      if (clock.toth && index === 0) clock.toth.items.push(planned);
      else clock.items.push(planned);
    });
    return clock;
  });
  return {
    radioId: config.radioId,
    stationName: station.name,
    clocks,
    oldCounters: counters,
    newCounters: { clock: clockCounter + 1, block: blockCounter + 1, item: itemCounter + 1 },
  };
}

function spotSql(blockId, item, mix) {
  return `INSERT INTO "dalet_group"."spots" ("block_id","item_id","title_id","mix_type","volume","begin_offset","end_offset","fade_in","fade_out","crossfade","mni_omni_psmode","mni_omni_psvalue","mni_omni_gain") VALUES(${blockId},${item.itemId},${item.titleId},9,0,${number(mix.begin_offset)},${number(mix.end_offset)},${number(mix.fade_in)},${number(mix.fade_out)},${number(mix.crossfade)},0,0,0)`;
}

function itemSql(blockId, clockId, itemId, order, radioId, scheduledTime = '1900-01-01 00:00:00.000', type = 1) {
  return `INSERT INTO "dalet_group"."items" ("block_id","item_id","item_type","item_reference","scheduled_time","computed_time","item_comment","item_order","radio_id","clock_id","use_manual_duration","mni_omni_chaintonext") VALUES(${blockId},${itemId},${type},'','${scheduledTime}','${scheduledTime}','',${order},${radioId},${clockId},0,0)`;
}

async function execute(plan, config) {
  const connection = await connect(config);
  let statements = 0;
  try {
    await query(connection, 'BEGIN TRANSACTION');
    const currentCounters = await Promise.all([
      query(connection, 'SELECT "counter" FROM "dalet_group"."cclock"'),
      query(connection, 'SELECT "counter" FROM "dalet_group"."cblock"'),
      query(connection, 'SELECT "counter" FROM "dalet_group"."citem" WHERE "block_id"=0'),
    ]);
    if (Number(currentCounters[0][0]?.counter) !== plan.oldCounters.clock
      || Number(currentCounters[1][0]?.counter) !== plan.oldCounters.block
      || Number(currentCounters[2][0]?.counter) !== plan.oldCounters.item) {
      throw new Error('Omni counters changed after preflight; run preflight again');
    }
    const clockChecks = plan.clocks.map(clock => `(\"clock_date\"='${clock.start}')`);
    const existing = await query(connection, `SELECT "clock_id" FROM "dalet_group"."clocks" WHERE "radio_id"=${plan.radioId} AND (${clockChecks.join(' OR ')})`);
    if (existing.length) throw new Error('One or more selected Omni clocks were created after preflight; synchronization stopped');

    await query(connection, `UPDATE "dalet_group"."cclock" SET "counter"=${plan.newCounters.clock} WHERE "counter"=${plan.oldCounters.clock}`); statements++;
    await query(connection, `UPDATE "dalet_group"."cblock" SET "counter"=${plan.newCounters.block} WHERE "counter"=${plan.oldCounters.block}`); statements++;
    await query(connection, `UPDATE "dalet_group"."citem" SET "counter"=${plan.newCounters.item} WHERE "block_id"=0 AND "counter"=${plan.oldCounters.item}`); statements++;

    for (const clock of plan.clocks) {
      await query(connection, `INSERT INTO "dalet_group"."clocks" ("clock_id","radio_id","clock_date") VALUES(${clock.clockId},${plan.radioId},'${clock.start}')`); statements++;
      await query(connection, `INSERT INTO "dalet_group"."clock_versions" ("clock_id","version","block_id","end_time","name","production_number","archive_number","clock_reference","clock_comment","clock_duration","ruleset_id","reviewed","clock_orig_duration") VALUES(${clock.clockId},0,${clock.blockId},'${clock.end}','${escapeSql(clock.name)}','','','','',0,0,0,0)`); statements++;
      await query(connection, `INSERT INTO "dalet_group"."blocks" ("block_id","block_type_id","block_level","n_used","last_modif_time","title","block_mode","end_time","duration","shelf_block_id") VALUES(${clock.blockId},0,0,1,CURRENT TIMESTAMP,'',0,'1900-01-01 00:00:00.000',0,NULL)`); statements++;

      if (clock.toth) {
        await query(connection, `INSERT INTO "dalet_group"."blocks" ("block_id","block_type_id","block_level","n_used","last_modif_time","title","block_mode","end_time","duration","shelf_block_id") VALUES(${clock.toth.blockId},0,1,1,CURRENT TIMESTAMP,'TOTH Block [Floating]',2,'1900-01-01 00:00:00.000',0,NULL)`); statements++;
        await query(connection, itemSql(clock.blockId, clock.clockId, clock.toth.itemId, 10000, plan.radioId, clock.start, 5)); statements++;
        await query(connection, `INSERT INTO "dalet_group"."block_item" ("block_id","item_id","child_block_id") VALUES(${clock.blockId},${clock.toth.itemId},${clock.toth.blockId})`); statements++;
        for (const item of clock.toth.items) {
          await query(connection, itemSql(clock.toth.blockId, clock.clockId, item.itemId, item.order, plan.radioId)); statements++;
          await query(connection, spotSql(clock.toth.blockId, item, item.mix)); statements++;
        }
      }

      for (const item of clock.items) {
        await query(connection, itemSql(clock.blockId, clock.clockId, item.itemId, item.order, plan.radioId)); statements++;
        await query(connection, spotSql(clock.blockId, item, item.mix)); statements++;
      }
    }
    await query(connection, 'COMMIT');
    return { statements };
  } catch (error) {
    try { await query(connection, 'ROLLBACK'); } catch {}
    throw error;
  } finally {
    connection.disconnect();
  }
}

function summary(plan) {
  const items = plan.clocks.reduce((total, clock) => total + clock.items.length + (clock.toth?.items.length || 0), 0);
  const dates = [...new Set(plan.clocks.map(clock => clock.date))];
  return {
    station: plan.stationName,
    radioId: plan.radioId,
    dates,
    hours: plan.clocks.length,
    items,
    firstHour: plan.clocks[0] ? `${plan.clocks[0].date} ${String(plan.clocks[0].hour).padStart(2, '0')}:00` : null,
    lastHour: plan.clocks.at(-1) ? `${plan.clocks.at(-1).date} ${String(plan.clocks.at(-1).hour).padStart(2, '0')}:00` : null,
  };
}

export async function previewOmniDuplexx(selection) {
  const prepared = await prepare(selection);
  return summary(makePlan(prepared));
}

export async function syncOmniDuplexx(selection) {
  const prepared = await prepare(selection);
  const plan = makePlan(prepared);
  const result = await execute(plan, prepared.config);
  return { ...summary(plan), ...result };
}

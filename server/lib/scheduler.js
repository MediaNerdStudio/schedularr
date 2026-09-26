/**
 * Schedularr — Core Scheduling Engine
 *
 * Inspired by Powergold and MusicMaster scheduling concepts:
 * - Category-based rotation (front-to-back folder model)
 * - Rule evaluation with breakable/unbreakable severity
 * - Optimum Goal Scheduling (weighted tie-breaking)
 * - Pass ordering (plot numbers)
 * - Search depth control
 */

import {
  Song, Artist, Category, Clock, AssignmentGrid, FormatCalendar,
  Rule, ScheduleHour, PlayHistory
} from '../models/index.js';

/**
 * Schedule one or more hours for a station.
 *
 * @param {Object} options
 * @param {string} options.stationId - Station to schedule for
 * @param {Date}   options.date      - Date to schedule (midnight)
 * @param {number} options.startHour - First hour (0-23)
 * @param {number} options.endHour   - Last hour inclusive (0-23)
 * @param {string} [options.gridId]  - Override assignment grid (uses active grid if not set)
 * @returns {Object} - { hours: ScheduleHour[], stats: {} }
 */
export async function scheduleHours(options) {
  const { stationId, date, startHour = 0, endHour = 23, gridId } = options;

  // 1. Load the grid (or find active one)
  const grid = gridId
    ? await AssignmentGrid.findById(gridId).populate('hours.clock')
    : await findActiveGrid(stationId, date);

  if (!grid) {
    throw new Error('No assignment grid found for this station. Create a grid first.');
  }

  // 2. Load all rules for this station
  const rules = await Rule.find({
    $or: [
      { station: stationId },
      { station: null }, // global rules
    ],
    isActive: true,
  }).lean();

  // 3. Load categories with their rules
  const allCategories = await Category.find({ isActive: true }).lean();
  const categoryMap = new Map(allCategories.map(c => [c._id.toString(), c]));

  // 4. Load recent play history for rule evaluation (last 7 days)
  const historyStart = new Date(date);
  historyStart.setDate(historyStart.getDate() - 7);
  const recentHistory = await PlayHistory.find({
    station: stationId,
    playedAt: { $gte: historyStart },
  }).sort('-playedAt').lean();

  // Also load already-scheduled hours for this date (to avoid conflicts)
  const existingSchedule = await ScheduleHour.find({
    station: stationId,
    date: date,
  }).lean();

  // Build a unified play log (history + already scheduled items from today)
  const playLog = buildPlayLog(recentHistory, existingSchedule);

  // 5. Determine day of week for grid lookup (0=Mon, 6=Sun)
  const jsDay = new Date(date).getDay(); // 0=Sun
  const gridDay = jsDay === 0 ? 6 : jsDay - 1; // convert to 0=Mon

  const results = [];
  const stats = { totalSongs: 0, totalViolations: 0, unscheduledPositions: 0 };
  const candidateCache = new Map();

  // 6. Schedule each hour
  for (let hour = startHour; hour <= endHour; hour++) {
    // Skip already-scheduled hours unless they're empty
    const existing = existingSchedule.find(h => h.hour === hour);
    if (existing && existing.status !== 'empty') {
      results.push(existing);
      continue;
    }

    // Find clock for this hour
    const hourEntry = grid.hours.find(h => h.day === gridDay && h.hour === hour);
    const clock = hourEntry?.clock;

    if (!clock || !clock.elements?.length) {
      // No clock assigned — create empty hour
      const emptyHour = await ScheduleHour.findOneAndUpdate(
        { station: stationId, date, hour },
        { station: stationId, date, hour, clock: clock?._id, items: [], status: 'empty' },
        { upsert: true, returnDocument: "after" }
      );
      results.push(emptyHour);
      stats.unscheduledPositions++;
      continue;
    }

    // Schedule this hour
    const scheduledHour = await scheduleOneHour({
      stationId, date, hour, clock, rules, categoryMap, candidateCache, playLog, stats,
    });
    results.push(scheduledHour);
  }

  return { hours: results, stats };
}

/**
 * Schedule a single hour.
 */
async function scheduleOneHour({ stationId, date, hour, clock, rules, categoryMap, candidateCache, playLog, stats }) {
  const items = [];
  let runningTime = 0; // ms into the hour

  // Sort elements by position
  const elements = [...(clock.elements || [])].sort((a, b) => a.position - b.position);

  for (const element of elements) {
    const estimatedStart = new Date(date);
    estimatedStart.setHours(hour);
    estimatedStart.setMinutes(0);
    estimatedStart.setSeconds(0);
    estimatedStart.setMilliseconds(runningTime);

    let item;

    switch (element.type) {
      case 'fixed':
      case 'imaging': {
        item = await scheduleFixedElement(element, {
          stationId, date, hour, rules, categoryMap, candidateCache, playLog, estimatedStart, stats,
        });
        break;
      }
      case 'song': {
        item = await scheduleSpecificSong(element, {
          rules, categoryMap, playLog, estimatedStart, stats,
        });
        break;
      }
      case 'note': {
        item = {
          position: element.position,
          type: 'note',
          title: element.label || 'Note',
          text: element.text || element.label || '',
          duration: element.estimatedDuration || 0,
        };
        break;
      }
      case 'command': {
        item = {
          position: element.position,
          type: 'command',
          title: element.label || 'Command',
          text: element.text || element.commandType || '',
          duration: element.estimatedDuration || 0,
        };
        break;
      }
      case 'time-marker': {
        item = {
          position: element.position,
          type: 'note',
          title: `Time: ${element.targetTime || 0}:00`,
          text: `Target time: ${element.targetTime} minutes`,
          duration: 0,
        };
        break;
      }
      default: {
        // For unimplemented types, create placeholder
        item = {
          position: element.position,
          type: 'empty',
          title: `[${element.type}] ${element.label || ''}`,
          duration: element.estimatedDuration || 0,
        };
        break;
      }
    }

    if (item) {
      item.clockElementId = element._id;
      item.estimatedStartTime = estimatedStart;
      items.push(item);
      runningTime += item.duration || 0;
      if (item.song) {
        playLog.unshift({
          song: item.song.toString(),
          artist: item.artist,
          title: item.title,
          category: item.category?.toString(),
          playedAt: estimatedStart,
          station: stationId,
        });
      }
      if (item.type === 'song') stats.totalSongs++;
    }
  }

  // Calculate timing
  const totalDuration = items.reduce((sum, i) => sum + (i.duration || 0), 0);
  const overrun = totalDuration - 3600000; // vs 60 minutes

  // Save the schedule hour
  const scheduleHour = await ScheduleHour.findOneAndUpdate(
    { station: stationId, date, hour },
    {
      station: stationId, date, hour,
      clock: clock._id,
      items,
      status: 'scheduled',
      totalDuration,
      overrun,
      scheduledAt: new Date(),
      scheduledBy: 'auto',
    },
    { upsert: true, returnDocument: "after" }
  );

  return scheduleHour;
}

/**
 * Schedule a fixed category element — pick the best song from the category.
 */
async function scheduleFixedElement(element, ctx) {
  const { stationId, date, hour, rules, categoryMap, candidateCache, playLog, estimatedStart } = ctx;
  const categoryId = element.category?._id?.toString() || element.category?.toString();

  if (!categoryId) {
    return {
      position: element.position,
      type: 'empty',
      title: `[No category] ${element.label || ''}`,
      duration: element.estimatedDuration || 0,
    };
  }

  const category = categoryMap.get(categoryId);
  if (!category) {
    return {
      position: element.position,
      type: 'empty',
      title: `[Category not found] ${element.label || ''}`,
      duration: element.estimatedDuration || 0,
    };
  }

  let candidates = candidateCache.get(categoryId);
  if (!candidates) {
    candidates = await Song.find({
      'categoryAssignments.category': category._id,
      isActive: true,
      isArchived: { $ne: true },
    })
      .populate('primaryArtist', 'name separationGroup')
      .lean();
    candidateCache.set(categoryId, candidates);
  }

  if (candidates.length === 0) {
    return {
      position: element.position,
      type: 'empty',
      title: `[Empty category: ${category.code}] ${element.label || ''}`,
      duration: element.estimatedDuration || 0,
    };
  }

  // Evaluate each candidate against rules
  const scored = [];
  for (const song of candidates) {
    const evaluation = evaluateRules(song, category, rules, playLog, estimatedStart);
    const weight = Math.max(1, song.weight || 50);
    scored.push({ song, evaluation, randomRank: Math.pow(Math.random(), 100 / weight) });
  }

  // Sort: unbreakable violations first (eliminate), then by score (fewer violations = better)
  scored.sort((a, b) => {
    // Songs with unbreakable violations go to the bottom
    if (a.evaluation.hasUnbreakable !== b.evaluation.hasUnbreakable) {
      return a.evaluation.hasUnbreakable ? 1 : -1;
    }
    // Fewer total violations = better
    if (a.evaluation.totalViolations !== b.evaluation.totalViolations) {
      return a.evaluation.totalViolations - b.evaluation.totalViolations;
    }
    if (a.evaluation.score !== b.evaluation.score) {
      return b.evaluation.score - a.evaluation.score;
    }
    return b.randomRank - a.randomRank;
  });

  const best = scored[0];
  const song = best.song;

  ctx.stats.totalViolations += best.evaluation.totalViolations;

  // Build the schedule item
  return {
    position: element.position,
    type: element.type === 'imaging' ? 'imaging' : 'song',
    song: song._id,
    category: category._id,
    title: song.title,
    artist: song.artistDisplay || song.primaryArtist?.name || '',
    duration: song.duration || element.estimatedDuration || 0,
    ruleViolations: best.evaluation.violations.map(v => ({
      ruleName: v.ruleName,
      severity: v.severity,
      description: v.description,
    })),
    reconcileStatus: 'pending',
    isManuallyPlaced: false,
    isLocked: false,
  };
}

/**
 * Schedule a specific fixed song element (e.g., a news service song).
 */
async function scheduleSpecificSong(element, ctx) {
  const { rules, categoryMap, playLog, estimatedStart, stats } = ctx;
  const songId = element.song?._id?.toString?.() || element.song?.toString?.() || element.song;

  if (!songId) {
    return {
      position: element.position,
      type: 'empty',
      title: `[No song] ${element.label || ''}`,
      duration: element.estimatedDuration || 0,
    };
  }

  const song = await Song.findById(songId)
    .populate('primaryArtist', 'name separationGroup')
    .lean();

  if (!song) {
    return {
      position: element.position,
      type: 'empty',
      title: `[Song not found] ${element.label || ''}`,
      duration: element.estimatedDuration || 0,
    };
  }

  let violations = [];
  let hasUnbreakable = false;
  let category;
  if (element.category) {
    const categoryId = element.category._id?.toString?.() || element.category.toString();
    category = categoryMap.get(categoryId);
  } else if (song.categoryAssignments?.length) {
    category = categoryMap.get(song.categoryAssignments[0].category.toString());
  }

  if (category) {
    const evaluation = evaluateRules(song, category, rules, playLog, estimatedStart);
    violations = evaluation.violations;
    hasUnbreakable = evaluation.hasUnbreakable;
    stats.totalViolations += evaluation.totalViolations;
  }

  return {
    position: element.position,
    type: 'song',
    song: song._id,
    category: category?._id || element.category || null,
    title: song.title,
    artist: song.artistDisplay || song.primaryArtist?.name || '',
    duration: song.duration || element.estimatedDuration || 0,
    ruleViolations: violations.map(v => ({
      ruleName: v.ruleName,
      severity: v.severity,
      description: v.description,
    })),
    unbreakable: hasUnbreakable,
    reconcileStatus: 'pending',
    isManuallyPlaced: false,
    isLocked: false,
  };
}

/**
 * Evaluate all applicable rules for a candidate song.
 */
function evaluateRules(song, category, rules, playLog, scheduledTime) {
  const violations = [];
  const repeatedThisHour = playLog.some(entry => {
    const playedAt = new Date(entry.playedAt);
    return entry.song === song._id.toString()
      && playedAt.getFullYear() === scheduledTime.getFullYear()
      && playedAt.getMonth() === scheduledTime.getMonth()
      && playedAt.getDate() === scheduledTime.getDate()
      && playedAt.getHours() === scheduledTime.getHours();
  });
  if (repeatedThisHour) {
    violations.push({
      ruleName: 'Same Hour Repeat',
      severity: 'unbreakable',
      description: 'Song is already scheduled in this hour',
    });
  }

  // Category-level rules (embedded in the category document)
  const catRules = category.rules || {};

  // Song separation
  if (catRules.songSeparation > 0) {
    const lastPlay = findLastPlay(playLog, { songId: song._id.toString(), before: scheduledTime });
    if (lastPlay) {
      const minutesSince = (scheduledTime - lastPlay.playedAt) / 60000;
      if (minutesSince < catRules.songSeparation) {
        violations.push({
          ruleName: 'Song Separation',
          severity: 'unbreakable',
          description: `Song played ${Math.round(minutesSince)}m ago (min: ${catRules.songSeparation}m)`,
        });
      }
    }
  }

  // Artist primary separation
  if (catRules.artistPrimarySeparation > 0 && song.primaryArtist) {
    const artistName = song.primaryArtist.name || song.artistDisplay;
    const artistGroup = song.primaryArtist.separationGroup || artistName;
    const lastArtistPlay = findLastPlay(playLog, { artistName: artistGroup, before: scheduledTime });
    if (lastArtistPlay) {
      const minutesSince = (scheduledTime - lastArtistPlay.playedAt) / 60000;
      if (minutesSince < catRules.artistPrimarySeparation) {
        violations.push({
          ruleName: 'Artist Primary Separation',
          severity: 'breakable',
          description: `Artist "${artistName}" played ${Math.round(minutesSince)}m ago (min: ${catRules.artistPrimarySeparation}m)`,
        });
      }
    }
  }

  // Title separation
  if (catRules.titleSeparation > 0) {
    const lastTitlePlay = findLastPlay(playLog, { title: song.title, before: scheduledTime });
    if (lastTitlePlay && lastTitlePlay.song !== song._id.toString()) {
      const minutesSince = (scheduledTime - lastTitlePlay.playedAt) / 60000;
      if (minutesSince < catRules.titleSeparation) {
        violations.push({
          ruleName: 'Title Separation',
          severity: 'breakable',
          description: `Title "${song.title}" played ${Math.round(minutesSince)}m ago (min: ${catRules.titleSeparation}m)`,
        });
      }
    }
  }

  // Max plays per day
  if (catRules.maxPlaysPerDay > 0) {
    const todayStart = new Date(scheduledTime);
    todayStart.setHours(0, 0, 0, 0);
    const playsToday = playLog.filter(p =>
      p.song === song._id.toString() &&
      new Date(p.playedAt) >= todayStart
    ).length;
    if (playsToday >= catRules.maxPlaysPerDay) {
      violations.push({
        ruleName: 'Max Plays Per Day',
        severity: 'unbreakable',
        description: `Song already played ${playsToday}x today (max: ${catRules.maxPlaysPerDay})`,
      });
    }
  }

  // Artist max plays per day
  if (catRules.artistMaxPlaysPerDay > 0 && song.primaryArtist) {
    const artistName = song.primaryArtist.name || song.artistDisplay;
    const todayStart = new Date(scheduledTime);
    todayStart.setHours(0, 0, 0, 0);
    const artistPlaysToday = playLog.filter(p =>
      p.artist === artistName &&
      new Date(p.playedAt) >= todayStart
    ).length;
    if (artistPlaysToday >= catRules.artistMaxPlaysPerDay) {
      violations.push({
        ruleName: 'Artist Max Plays Per Day',
        severity: 'breakable',
        description: `Artist "${artistName}" already played ${artistPlaysToday}x today (max: ${catRules.artistMaxPlaysPerDay})`,
      });
    }
  }

  // Same hour separation (artist can't be in same hour for X days)
  if (catRules.artistSameHourSeparation > 0 && song.primaryArtist) {
    const artistName = song.primaryArtist.name || song.artistDisplay;
    const sameHourPlays = playLog.filter(p => {
      if (p.artist !== artistName) return false;
      const pDate = new Date(p.playedAt);
      return pDate.getHours() === scheduledTime.getHours() &&
        (scheduledTime - pDate) / 86400000 < catRules.artistSameHourSeparation;
    });
    if (sameHourPlays.length > 0) {
      violations.push({
        ruleName: 'Artist Same Hour Separation',
        severity: 'breakable',
        description: `Artist "${artistName}" played in this hour within ${catRules.artistSameHourSeparation} days`,
      });
    }
  }

  // Evaluate global/station rules from the Rule collection
  for (const rule of rules) {
    // Skip rules not applicable to this category
    if (rule.category && rule.category.toString() !== category._id.toString()) continue;

    const violation = evaluateExternalRule(rule, song, playLog, scheduledTime);
    if (violation) violations.push(violation);
  }

  // Dayparting check
  if (song.dayparting?.enabled && song.dayparting?.grid?.length) {
    const dayIndex = scheduledTime.getDay(); // 0=Sun
    const hourIndex = scheduledTime.getHours();
    const dayGrid = song.dayparting.grid[dayIndex];
    if (dayGrid && dayGrid[hourIndex] === false) {
      violations.push({
        ruleName: 'Dayparting',
        severity: 'unbreakable',
        description: `Song not allowed in this daypart`,
      });
    }
  }

  return {
    violations,
    totalViolations: violations.length,
    hasUnbreakable: violations.some(v => v.severity === 'unbreakable'),
    breakableCount: violations.filter(v => v.severity === 'breakable').length,
    score: calculateGoalScore(song, playLog, scheduledTime),
  };
}

/**
 * Evaluate a Rule document against a song.
 */
function evaluateExternalRule(rule, song, playLog, scheduledTime) {
  const severity = rule.isBreakable ? 'breakable' : 'unbreakable';
  const params = rule.params || {};

  switch (rule.type) {
    case 'song-minimum-rest': {
      if (!params.separation) return null;
      const lastPlay = findLastPlay(playLog, { songId: song._id.toString(), before: scheduledTime });
      if (lastPlay) {
        const minutesSince = (scheduledTime - lastPlay.playedAt) / 60000;
        if (minutesSince < params.separation) {
          return { ruleName: rule.name, severity, description: `Rest ${Math.round(minutesSince)}m < ${params.separation}m` };
        }
      }
      return null;
    }

    case 'artist-primary-separation': {
      if (!params.separation || !song.primaryArtist) return null;
      const artistName = song.primaryArtist.name || song.artistDisplay;
      const lastPlay = findLastPlay(playLog, { artistName, before: scheduledTime });
      if (lastPlay) {
        const minutesSince = (scheduledTime - lastPlay.playedAt) / 60000;
        if (minutesSince < params.separation) {
          return { ruleName: rule.name, severity, description: `Artist "${artistName}" rest ${Math.round(minutesSince)}m < ${params.separation}m` };
        }
      }
      return null;
    }

    case 'song-max-plays-per-day': {
      if (!params.maxCount) return null;
      const todayStart = new Date(scheduledTime);
      todayStart.setHours(0, 0, 0, 0);
      const plays = playLog.filter(p => p.song === song._id.toString() && new Date(p.playedAt) >= todayStart).length;
      if (plays >= params.maxCount) {
        return { ruleName: rule.name, severity, description: `${plays} plays today (max: ${params.maxCount})` };
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Optimum Goal Scoring — weighted tie-breaking score.
 * Higher score = better candidate.
 */
function calculateGoalScore(song, playLog, scheduledTime) {
  let score = 0;

  // Goal 1: Optimum Song Rest (prefer songs that haven't played in a while)
  const lastPlay = findLastPlay(playLog, { songId: song._id.toString(), before: scheduledTime });
  if (lastPlay) {
    const hoursSince = (scheduledTime - lastPlay.playedAt) / 3600000;
    score += Math.min(hoursSince, 168); // cap at 1 week
  } else {
    score += 200; // never played = very high rest
  }

  // Goal 2: Weight
  score += (song.weight || 50) * 0.5;

  // Goal 3: Artist spread (prefer artists not recently played)
  const artistName = song.primaryArtist?.name || song.artistDisplay;
  if (artistName) {
    const lastArtistPlay = findLastPlay(playLog, { artistName, before: scheduledTime });
    if (lastArtistPlay) {
      const hoursSince = (scheduledTime - lastArtistPlay.playedAt) / 3600000;
      score += Math.min(hoursSince, 48) * 0.3;
    } else {
      score += 20;
    }
  }

  return score;
}

/**
 * Find the most recent play matching criteria.
 */
function findLastPlay(playLog, criteria) {
  for (const entry of playLog) {
    if (criteria.before && new Date(entry.playedAt) > criteria.before) continue;
    if (criteria.songId && entry.song === criteria.songId) return entry;
    if (criteria.artistName && entry.artist === criteria.artistName) return entry;
    if (criteria.title && entry.title === criteria.title) return entry;
  }
  return null;
}

/**
 * Build a unified play log from history + already-scheduled items.
 */
function buildPlayLog(history, scheduledHours) {
  const log = [];

  // Add real history
  for (const h of history) {
    log.push({
      song: h.song.toString(),
      artist: h.artistName,
      title: h.songTitle,
      category: h.category?.toString(),
      playedAt: h.playedAt,
      station: h.station.toString(),
    });
  }

  // Add already-scheduled items
  for (const hour of scheduledHours) {
    for (const item of hour.items || []) {
      if (item.song) {
        const estimatedTime = item.estimatedStartTime || new Date(hour.date);
        if (!item.estimatedStartTime) {
          estimatedTime.setHours(hour.hour);
          estimatedTime.setMinutes(item.position * 3);
        }
        log.push({
          song: item.song.toString(),
          artist: item.artist,
          title: item.title,
          category: item.category?.toString(),
          playedAt: estimatedTime,
          station: hour.station.toString(),
        });
      }
    }
  }

  // Sort by playedAt descending (most recent first)
  log.sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt));

  return log;
}

/**
 * Find the active grid for a station and date.
 */
async function findActiveGrid(stationId, date) {
  // 1. Format calendar date-specific override (highest priority)
  const calendar = await FormatCalendar.findOne({ station: stationId });
  if (calendar?.dateOverrides?.length) {
    const dateStr = new Date(date).toISOString().slice(0, 10);
    const override = calendar.dateOverrides.find(o =>
      new Date(o.date).toISOString().slice(0, 10) === dateStr
    );
    if (override?.grid) {
      return AssignmentGrid.findById(override.grid).populate('hours.clock');
    }
  }

  // 2. Format calendar grid rotation
  if (calendar?.gridRotation?.length) {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const weekNumber = Math.floor((date - startOfYear) / 604800000);
    const rotIndex = weekNumber % calendar.gridRotation.length;
    const gridId = calendar.gridRotation[rotIndex].grid;
    return AssignmentGrid.findById(gridId).populate('hours.clock');
  }

  // 3. Active period grid for this date (start of day comparisons)
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const periodGrid = await AssignmentGrid.findOne({
    station: stationId,
    isActive: true,
    isDefault: { $ne: true },
    periodStart: { $lte: dayStart },
    periodEnd: { $gte: dayStart },
  }).sort({ periodStart: -1 }).populate('hours.clock');
  if (periodGrid) return periodGrid;

  // 4. Active default grid for the station
  const defaultGrid = await AssignmentGrid.findOne({
    station: stationId,
    isActive: true,
    isDefault: true,
  }).populate('hours.clock');
  if (defaultGrid) return defaultGrid;

  // 5. Fallback: any active grid
  return AssignmentGrid.findOne({ station: stationId, isActive: true }).populate('hours.clock');
}

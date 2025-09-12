import { getEvents } from './calendarService.js';
import {  isOverlapping, addBuffer} from '../utils/timeUtils.js';
import { DEFAULT_BUFFER_MINUTES, WORK_START_HOUR, WORK_END_HOUR } from '../config/defaults.js';


export const detectConflictss = (proposedEvent) => {
    const conflicts = [];
    const events = getEvents();


    for (const event of events) {
        const common = event.participants.filter(p => proposedEvent.participants.includes(p));


        if (common.length > 0) {
            const bufferedStart = addBuffer(event.start, -DEFAULT_BUFFER_MINUTES);
            const bufferedEnd = addBuffer(event.end, DEFAULT_BUFFER_MINUTES);


            if (isOverlapping(proposedEvent.start, proposedEvent.end, bufferedStart, bufferedEnd)) {
                conflicts.push({ event, participants: common });
            }
        }
    }
    return conflicts;
};


function parseDateFlexible(obj, key) {
  const val = obj?.[key] ?? obj?.[key === 'start' ? 'startTime' : 'endTime'];
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) throw new Error(`Invalid date value for ${key}: ${val}`);
  return d;
}

// detect whether input ISO includes a timezone indicator (Z or ±HH:MM)
function isoHasTZ(s) {
  if (typeof s !== 'string') return false;
  return /Z$|[+\-]\d{2}:\d{2}$/.test(s);
}

// build day's working window (returns { startMs, endMs }) for the given Date `baseDate`
// workingHours: { start: "09:00", end: "17:00" }
// usesUTC: boolean - if true use UTC hours (for ISO with Z / timezone), else local time.
function buildDayWindowMs(baseDate, workingHours, usesUTC = false) {
  const [wsH, wsM] = (workingHours.start || '09:00').split(':').map(Number);
  const [weH, weM] = (workingHours.end || '17:00').split(':').map(Number);

  if (usesUTC) {
    const y = baseDate.getUTCFullYear();
    const mo = baseDate.getUTCMonth();
    const d = baseDate.getUTCDate();
    const start = Date.UTC(y, mo, d, wsH, wsM, 0, 0);
    const end = Date.UTC(y, mo, d, weH, weM, 0, 0);
    return { startMs: start, endMs: end };
  } else {
    const y = baseDate.getFullYear();
    const mo = baseDate.getMonth();
    const d = baseDate.getDate();
    const start = new Date(y, mo, d, wsH, wsM, 0, 0).getTime();
    const end = new Date(y, mo, d, weH, weM, 0, 0).getTime();
    return { startMs: start, endMs: end };
  }
}

// merge sorted intervals (array of {startMs, endMs}); returns merged array
function mergeIntervals(intervals) {
  if (!intervals || intervals.length === 0) return [];
  const sorted = intervals.slice().sort((a, b) => a.startMs - b.startMs);
  const out = [];
  let cur = { startMs: sorted[0].startMs, endMs: sorted[0].endMs };
  for (let i = 1; i < sorted.length; i++) {
    const it = sorted[i];
    if (it.startMs > cur.endMs) {
      out.push(cur);
      cur = { startMs: it.startMs, endMs: it.endMs };
    } else {
      // overlap -> extend
      if (it.endMs > cur.endMs) cur.endMs = it.endMs;
    }
  }
  out.push(cur);
  return out;
}

// compute free intervals inside a window given merged busy intervals
// window = { startMs, endMs }, busy = [{startMs,endMs}, ... merged]
function freeFromBusy(window, busyMerged) {
  const frees = [];
  let cursor = window.startMs;
  for (const b of busyMerged) {
    if (b.startMs > cursor) frees.push({ startMs: cursor, endMs: b.startMs });
    cursor = Math.max(cursor, b.endMs);
    if (cursor >= window.endMs) break;
  }
  if (cursor < window.endMs) frees.push({ startMs: cursor, endMs: window.endMs });
  return frees;
}

// intersect two lists of intervals (both sorted, non-overlapping), return intersection list
function intersectIntervalLists(a, b) {
  const res = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    const A = a[i], B = b[j];
    const s = Math.max(A.startMs, B.startMs);
    const e = Math.min(A.endMs, B.endMs);
    if (s < e) res.push({ startMs: s, endMs: e });
    if (A.endMs < B.endMs) i++; else j++;
  }
  return res;
}

// clamp number between min and max
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// choose candidate start inside free interval close to desiredStartMs
function chooseStartInInterval(freeInterval, desiredStartMs, durationMs) {
  const earliest = freeInterval.startMs;
  const latest = freeInterval.endMs - durationMs;
  if (latest < earliest) return null;
  // prefer desiredStartMs if in range; otherwise pick earliest or latest
  let chosen = clamp(desiredStartMs, earliest, latest);
  return chosen;
}

/* -------------------------
   Main exported functions
   ------------------------- */

/**
 * detectConflicts(proposedEvent, options)
 * returns { conflict: boolean, details: [{ participant, overlappingEvents: [events...] }, ...] }
 */
export function detectConflicts(proposedEvent, options = {}) {
  const bufferMinutes = options.bufferMinutes ?? DEFAULT_BUFFER_MINUTES;
  if (!proposedEvent) throw new Error('proposedEvent is required');
  const startDate = parseDateFlexible(proposedEvent, 'start');
  const endDate = parseDateFlexible(proposedEvent, 'end');
  if (!startDate || !endDate) throw new Error('proposedEvent.start and .end required');
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  if (endMs <= startMs) throw new Error('Invalid event: end must be after start');

  const details = [];

  // For each participant, fetch only their events (supports index by participant optimization)
  for (const participant of proposedEvent.participants || []) {
    // if your calendarService supports getEventsForParticipant use it, else fallback to scanning getEvents()
    const eventsForParticipant = (typeof getEventsForParticipant === 'function')
      ? getEventsForParticipant(participant)
      : getEvents().filter(ev => (ev.participants || []).includes(participant));

    const overlapping = [];
    for (const ev of eventsForParticipant) {
      const evStart = parseDateFlexible(ev, 'start') ?? parseDateFlexible(ev, 'startTime');
      const evEnd = parseDateFlexible(ev, 'end') ?? parseDateFlexible(ev, 'endTime');
      if (!evStart || !evEnd) continue;
      const bufferedStart = evStart.getTime() - bufferMinutes * 60000;
      const bufferedEnd = evEnd.getTime() + bufferMinutes * 60000;

      // overlap if start < bufferedEnd AND end > bufferedStart
      if (startMs < bufferedEnd && endMs > bufferedStart) {
        overlapping.push(ev);
      }
    }

    if (overlapping.length) details.push({ participant, overlappingEvents: overlapping });
  }

  return { conflict: details.length > 0, details };
}


export function suggestAlternativeTimes(proposedEvent, options = {}) {
  const bufferMinutes = options.bufferMinutes ?? DEFAULT_BUFFER_MINUTES;
  const workingHours =  { start: WORK_START_HOUR, end: WORK_END_HOUR };
  const maxSuggestions = options.maxSuggestions ?? 3;
  const searchDays = options.searchDays ?? 3;

  if (!proposedEvent) throw new Error('proposedEvent is required');
  // parse start/end (support both key names)
  const startISO = proposedEvent.start ?? proposedEvent.startTime;
  const endISO = proposedEvent.end ?? proposedEvent.endTime;
  if (!startISO || !endISO) throw new Error('proposedEvent.start and proposedEvent.end are required');

  const startDate = new Date(startISO);
  const endDate = new Date(endISO);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) throw new Error('Invalid start/end date format');
  if (endDate.getTime() <= startDate.getTime()) throw new Error('proposedEvent end must be after start');

  // Decide whether to interpret working hours in UTC or local:
  // If input ISO contains timezone (Z or ±HH:MM) we use UTC mode; otherwise local time.
  const useUTC = isoHasTZ(startISO);

  const durationMs = endDate.getTime() - startDate.getTime();
  const desiredStartMs = startDate.getTime();

  // Validate proposed event itself is inside working hours -> user requested this behavior
  {
    const dayWindow = buildDayWindowMs(startDate, workingHours, useUTC);
    if (!(desiredStartMs >= dayWindow.startMs && (desiredStartMs + durationMs) <= dayWindow.endMs)) {
      // proposed event is outside allowed working hours for that day -> throw
      throw new Error(`Proposed event is outside working hours (${workingHours.start} - ${workingHours.end})`);
    }
  }

  const suggestions = [];

  // iterate days: 0 = same day, 1 = next day, ... until searchDays-1
  for (let dayOffset = 0; dayOffset < searchDays && suggestions.length < maxSuggestions; dayOffset++) {
    // build base day date
    const candidateDay = new Date(startDate.getTime());
    candidateDay.setDate(candidateDay.getDate() + dayOffset);

    const window = buildDayWindowMs(candidateDay, workingHours, useUTC);
    const windowStartMs = window.startMs;
    const windowEndMs = window.endMs;

    // For every participant compute their busy intervals (clipped to window, expanded by buffer)
    // We'll compute the common free intervals across participants by intersecting their free lists.
    // Start with commonFree = [window]
    let commonFree = [{ startMs: windowStartMs, endMs: windowEndMs }];

    const participants = proposedEvent.participants ?? [];
    // If no participants provided, treat as free across the whole window (still returns slots)
    for (const participant of participants) {
      // fetch only participant events if available
      const eventsForParticipant = (typeof getEventsForParticipant === 'function')
        ? getEventsForParticipant(participant)
        : getEvents().filter(ev => (ev.participants || []).includes(participant));

      // collect busy intervals that intersect the window
      const busy = [];
      for (const ev of eventsForParticipant) {
        const evStart = parseDateFlexible(ev, 'start') ?? parseDateFlexible(ev, 'startTime');
        const evEnd = parseDateFlexible(ev, 'end') ?? parseDateFlexible(ev, 'endTime');
        if (!evStart || !evEnd) continue;
        const evStartMs = evStart.getTime();
        const evEndMs = evEnd.getTime();
        if (evEndMs <= windowStartMs || evStartMs >= windowEndMs) continue; // no overlap
        const bStart = Math.max(windowStartMs, evStartMs - bufferMinutes * 60000);
        const bEnd = Math.min(windowEndMs, evEndMs + bufferMinutes * 60000);
        busy.push({ startMs: bStart, endMs: bEnd });
      }

      const mergedBusy = mergeIntervals(busy);
      const frees = freeFromBusy({ startMs: windowStartMs, endMs: windowEndMs }, mergedBusy);

      // intersect with current commonFree
      commonFree = intersectIntervalLists(commonFree, frees);
      if (commonFree.length === 0) break; // no common free time this day
    }

    if (commonFree.length === 0) continue;

    // For each free interval that fits duration, create candidate start(s)
    const candidates = [];
    for (const free of commonFree) {
      if (free.endMs - free.startMs < durationMs) continue;
      const chosenStartMs = chooseStartInInterval(free, desiredStartMs, durationMs);
      if (chosenStartMs !== null) {
        candidates.push({ startMs: chosenStartMs, endMs: chosenStartMs + durationMs });
      } else {
        // if desiredStart doesn't fit but there is room, pick earliest
        const earliest = free.startMs;
        candidates.push({ startMs: earliest, endMs: earliest + durationMs });
      }
    }

    // sort candidates by absolute distance to desiredStartMs
    candidates.sort((a, b) => Math.abs(a.startMs - desiredStartMs) - Math.abs(b.startMs - desiredStartMs));

    for (const c of candidates) {
      if (suggestions.length >= maxSuggestions) break;
      // avoid duplicates
      if (!suggestions.some(s => s.startMs === c.startMs && s.endMs === c.endMs)) {
        suggestions.push({ start: new Date(c.startMs).toISOString(), end: new Date(c.endMs).toISOString(), startMs: c.startMs, endMs: c.endMs });
      }
    }
  }

  // strip ms fields before returning
  return suggestions.map(s => ({ start: s.start, end: s.end }));
}
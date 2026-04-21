function pad2(n) {
  return String(n).padStart(2, '0');
}

function toYmd(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function normalizeDate(input, now = new Date()) {
  if (typeof input !== 'string') return null;
  const raw = input.trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();

  if (lower === 'today') return toYmd(now);

  if (lower === 'tomorrow') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return toYmd(d);
  }

  const nextMatch = lower.match(/^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (nextMatch) {
    const name = nextMatch[1];
    const dayMap = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6
    };

    const target = dayMap[name];
    const current = now.getDay();
    const delta = (target - current + 7) % 7 || 7;
    const d = new Date(now);
    d.setDate(d.getDate() + delta);
    return toYmd(d);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return null;
    return raw;
  }

  const monthMatch = raw.match(/^(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})$/i);
  if (monthMatch) {
    const monthName = monthMatch[1].toLowerCase();
    const day = Number(monthMatch[2]);
    if (!Number.isFinite(day) || day < 1 || day > 31) return null;

    const monthIndexMap = {
      january: 0,
      february: 1,
      march: 2,
      april: 3,
      may: 4,
      june: 5,
      july: 6,
      august: 7,
      september: 8,
      october: 9,
      november: 10,
      december: 11
    };

    const monthIndex = monthIndexMap[monthName];
    const d = new Date(now.getFullYear(), monthIndex, day);
    if (Number.isNaN(d.getTime())) return null;
    return toYmd(d);
  }

  return null;
}

export function normalizeTime(input) {
  if (typeof input !== 'string') return null;
  const raw = input.trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();

  if (lower === 'morning') return '09:00';
  if (lower === 'afternoon') return '14:00';
  if (lower === 'evening') return '18:00';
  if (lower === 'noon') return '12:00';
  if (lower === 'midnight') return '00:00';

  const hm = lower.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) {
    const h = Number(hm[1]);
    const m = Number(hm[2]);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return `${pad2(h)}:${pad2(m)}`;
  }

  const ampm = lower.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = ampm[2] ? Number(ampm[2]) : 0;
    const mer = ampm[3];

    if (h < 1 || h > 12 || m < 0 || m > 59) return null;

    if (mer === 'pm' && h !== 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;

    return `${pad2(h)}:${pad2(m)}`;
  }

  const hourOnly = lower.match(/^(\d{1,2})(am|pm)$/);
  if (hourOnly) {
    let h = Number(hourOnly[1]);
    const mer = hourOnly[2];
    if (h < 1 || h > 12) return null;

    if (mer === 'pm' && h !== 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;

    return `${pad2(h)}:00`;
  }

  return null;
}

export function isWithinClinicHours(time) {
  // inclusive start 09:00, exclusive end 18:00
  if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) return false;
  return time >= '09:00' && time < '18:00';
}

export function isPastDateTime(dateYmd, timeHm, now = new Date()) {
  if (!dateYmd || !timeHm) return true;
  const dt = new Date(`${dateYmd}T${timeHm}:00`);
  if (Number.isNaN(dt.getTime())) return true;
  return dt.getTime() < now.getTime();
}

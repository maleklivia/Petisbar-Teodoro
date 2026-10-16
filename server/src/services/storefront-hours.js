const TIME_ZONE = 'America/Sao_Paulo';
const DAY_INDEX = new Map([
  ['domingo', 0], ['segunda', 1], ['terca', 2], ['quarta', 3],
  ['quinta', 4], ['sexta', 5], ['sabado', 6],
]);

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function parseTime(value) {
  const match = /^(\d{1,2})(?::(\d{2})|h(?:\s*(\d{2}))?)?$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? match[3] ?? 0);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function parseStorefrontHours(value) {
  const normalized = normalize(value);
  const match = /^(domingo|segunda(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado)(?:\s+(?:a|ate)\s+(domingo|segunda(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado))?\s*[-–—]\s*(\d{1,2}(?::\d{2}|h(?:\s*\d{2})?)?)\s+(?:as|ate)\s+(\d{1,2}(?::\d{2}|h(?:\s*\d{2})?)?)$/.exec(normalized);
  if (!match) return null;
  const dayName = name => DAY_INDEX.get(name.replace(/-feira$/, ''));
  const startDay = dayName(match[1]);
  const endDay = match[2] ? dayName(match[2]) : startDay;
  const opensAt = parseTime(match[3]);
  const closesAt = parseTime(match[4]);
  if (startDay === undefined || endDay === undefined || opensAt === null || closesAt === null || closesAt <= opensAt) return null;
  const days = [];
  for (let day = startDay; ; day = (day + 1) % 7) {
    days.push(day);
    if (day === endDay) break;
  }
  return { days, opensAt, closesAt };
}

export function storefrontHoursStatus(hours, now = new Date()) {
  const schedule = parseStorefrontHours(hours);
  if (!schedule) return { open: false, reason: 'invalid_hours' };
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const day = new Map([['Sunday', 0], ['Monday', 1], ['Tuesday', 2], ['Wednesday', 3], ['Thursday', 4], ['Friday', 5], ['Saturday', 6]]).get(values.weekday);
  const minute = Number(values.hour) * 60 + Number(values.minute);
  const open = schedule.days.includes(day) && minute >= schedule.opensAt && minute < schedule.closesAt;
  return { open, reason: open ? null : 'outside_hours' };
}

export function storefrontAcceptance(manuallyEnabled, hours, now = new Date()) {
  if (!manuallyEnabled) return { open: false, reason: 'manually_closed' };
  return storefrontHoursStatus(hours, now);
}

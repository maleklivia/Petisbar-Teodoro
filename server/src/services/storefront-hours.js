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
  if (startDay === undefined || endDay === undefined || opensAt === null || closesAt === null || closesAt === opensAt) return null;
  const days = [];
  for (let day = startDay; ; day = (day + 1) % 7) {
    days.push(day);
    if (day === endDay) break;
  }
  return { days, opensAt, closesAt };
}

const DAY_KEYS=['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
export function weeklyHours(hours){
  if(hours&&typeof hours==='object'&&!Array.isArray(hours)){
    const week={};
    for(const key of DAY_KEYS){
      const value=normalize(hours[key]);
      if(value==='fechado'){week[key]=null;continue;}
      const match=/^(\d{1,2}(?::\d{2}|h(?:\s*\d{2})?)?)\s*(?:[-–—]|as|ate)\s*(\d{1,2}(?::\d{2}|h(?:\s*\d{2})?)?)$/.exec(value);
      if(!match)return null;
      const opensAt=parseTime(match[1]),closesAt=parseTime(match[2]);
      if(opensAt===null||closesAt===null||opensAt===closesAt)return null;
      week[key]={opensAt,closesAt};
    }
    return week;
  }
  const schedule=parseStorefrontHours(hours);if(!schedule)return null;
  return Object.fromEntries(DAY_KEYS.map((key,day)=>[key,schedule.days.includes(day)?{opensAt:schedule.opensAt,closesAt:schedule.closesAt}:null]));
}

export function weeklyHoursText(hours){
  const week=weeklyHours(hours);if(!week)return null;
  const time=v=>`${String(Math.floor(v/60)).padStart(2,'0')}:${String(v%60).padStart(2,'0')}`;
  return Object.fromEntries(DAY_KEYS.map(key=>[key,week[key]?`${time(week[key].opensAt)} – ${time(week[key].closesAt)}`:'Fechado']));
}

export function storefrontHoursStatus(hours, now = new Date()) {
  const week=weeklyHours(hours);
  if(!week)return {open:false,reason:'invalid_hours'};
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const day = new Map([['Sunday', 0], ['Monday', 1], ['Tuesday', 2], ['Wednesday', 3], ['Thursday', 4], ['Friday', 5], ['Saturday', 6]]).get(values.weekday);
  const minute = Number(values.hour) * 60 + Number(values.minute);
  const today=week[DAY_KEYS[day]],yesterday=week[DAY_KEYS[(day+6)%7]];
  const open = Boolean(today&&(today.closesAt>today.opensAt?minute>=today.opensAt&&minute<today.closesAt:minute>=today.opensAt)
    ||yesterday&&yesterday.closesAt<yesterday.opensAt&&minute<yesterday.closesAt);
  return { open, reason: open ? null : 'outside_hours' };
}

export function storefrontAcceptance(manuallyEnabled, hours, now = new Date()) {
  if (!manuallyEnabled) return { open: false, reason: 'manually_closed' };
  return storefrontHoursStatus(hours, now);
}

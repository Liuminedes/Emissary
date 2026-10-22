// hub/src/compliance/time.js
// Día y hora locales de un tenant, según su zona horaria (IANA, ej. America/Bogota).

export const localDay = (ms, tz) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms); // YYYY-MM-DD

export const localHour = (ms, tz) =>
  Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(ms));

export const localMonth = (ms, tz) => localDay(ms, tz).slice(0, 7); // YYYY-MM

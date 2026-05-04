export function todayIso() {
  return formatLocalDate(new Date());
}

export function tomorrowIso() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatLocalDate(date);
}

export function nightsBetween(startDate, endDate) {
  const start = parseIsoDateLocal(startDate);
  const end = parseIsoDateLocal(endDate);
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

export function parseIsoDateLocal(value) {
  if (!value) return new Date(NaN);
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

export function addDaysIso(value, days) {
  const date = parseIsoDateLocal(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + Number(days || 0));
  return formatLocalDate(date);
}

export function isIsoOnOrBefore(left, right) {
  const l = parseIsoDateLocal(left);
  const r = parseIsoDateLocal(right);
  if (Number.isNaN(l.getTime()) || Number.isNaN(r.getTime())) return false;
  return l.getTime() <= r.getTime();
}

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

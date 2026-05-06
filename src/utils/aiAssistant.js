import { addDaysIso, todayIso } from "./dates.js";

const CITY_ALIASES = [
  { en: "Ramallah", ar: "رام الله" },
  { en: "Jerusalem", ar: "القدس" },
  { en: "Bethlehem", ar: "بيت لحم" },
  { en: "Hebron", ar: "الخليل" },
  { en: "Nablus", ar: "نابلس" },
  { en: "Jericho", ar: "أريحا" },
  { en: "Jenin", ar: "جنين" },
  { en: "Tulkarm", ar: "طولكرم" },
  { en: "Qalqilya", ar: "قلقيلية" },
  { en: "Salfit", ar: "سلفيت" },
  { en: "Tubas", ar: "طوباس" },
  { en: "Gaza", ar: "غزة" },
  { en: "Khan Yunis", ar: "خان يونس" },
  { en: "Rafah", ar: "رفح" },
];

const COUNTRY_ALIASES = [
  { en: "Palestine", ar: "فلسطين" },
];

function normalize(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[’'"]/g, "")
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactAscii(value) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[rows - 1][cols - 1];
}

function findClosestCityAlias(input) {
  const candidate = compactAscii(input);
  if (!candidate) return null;

  const scored = CITY_ALIASES.map((row) => {
    const english = compactAscii(row.en);
    if (!english) return null;
    const distance = levenshteinDistance(candidate, english);
    const includesBonus = english.includes(candidate) || candidate.includes(english) ? -1 : 0;
    return { city: row.en, score: distance + includesBonus };
  })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);

  if (!scored.length) return null;
  const best = scored[0];
  const threshold = Math.max(2, Math.floor(candidate.length * 0.34));
  return best.score <= threshold ? best.city : null;
}

export function resolveKnownCityBilingual(input) {
  const n = normalize(input);
  if (!n) return "";
  for (const row of CITY_ALIASES) {
    if (normalize(row.en) === n) return row.en;
    if (normalize(row.ar) === n) return row.en;
  }
  return findClosestCityAlias(input) || "";
}

export function resolveCityBilingual(input) {
  return resolveKnownCityBilingual(input) || String(input || "").trim();
}

export function extractKnownCityFromText(text) {
  const words = normalize(text).split(/\s+/).filter(Boolean);
  for (let size = Math.min(2, words.length); size >= 1; size -= 1) {
    for (let i = 0; i <= words.length - size; i += 1) {
      const candidate = words.slice(i, i + size).join(" ");
      const resolved = resolveKnownCityBilingual(candidate);
      if (resolved) return resolved;
    }
  }
  return "";
}

export function resolveCountryBilingual(input) {
  const n = normalize(input);
  if (!n) return "";
  for (const row of COUNTRY_ALIASES) {
    if (normalize(row.en) === n) return row.en;
    if (normalize(row.ar) === n) return row.en;
  }
  return String(input).trim();
}

function looksLikeGuestOrDateText(text) {
  const raw = String(text || "").toLowerCase();
  const t = normalize(raw);
  return (
    /\b(guest|guests|people|person|persons|traveler|travelers|traveller|travellers|pax|date|dates|today|tomorrow|check in|check out|night|nights)\b/.test(t) ||
    /\b\d{4}-\d{2}-\d{2}\b/.test(raw) ||
    /\b\d{1,2}[\/\-.]\d{1,2}([\/\-.]\d{2,4})?\b/.test(raw)
  );
}

export function parseUserPickIndex(text) {
  const t = normalize(text);
  if (!t || looksLikeGuestOrDateText(text)) return null;

  const english = [
    ["first", 1],
    ["1st", 1],
    ["one", 1],
    ["second", 2],
    ["2nd", 2],
    ["two", 2],
    ["third", 3],
    ["3rd", 3],
    ["three", 3],
    ["fourth", 4],
    ["4th", 4],
    ["four", 4],
    ["fifth", 5],
    ["5th", 5],
    ["five", 5],
  ];
  for (const [token, n] of english) {
    const r = new RegExp(`\\b${token}\\b`, "i");
    if (r.test(t)) return n - 1;
  }

  const arabic = [
    ["الأول", 1],
    ["اول", 1],
    ["١", 1],
    ["1", 1],
    ["الثاني", 2],
    ["تاني", 2],
    ["٢", 2],
    ["2", 2],
    ["الثالث", 3],
    ["تالت", 3],
    ["٣", 3],
    ["3", 3],
    ["الرابع", 4],
    ["رابع", 4],
    ["٤", 4],
    ["4", 4],
    ["الخامس", 5],
    ["خامس", 5],
    ["٥", 5],
    ["5", 5],
  ];
  for (const [token, n] of arabic) {
    if (t.includes(normalize(token))) return n - 1;
  }

  const match = t.match(/\b(?:option|number|#)?\s*(\d{1,2})\b/);
  if (match) {
    const num = Number(match[1]);
    if (Number.isFinite(num) && num >= 1 && num <= 20) return num - 1;
  }

  return null;
}

function resolveDayMonth(first, second) {
  if (first > 12 && second <= 12) return { day: first, month: second };
  if (second > 12 && first <= 12) return { day: second, month: first };
  return { day: first, month: second };
}

function isValidMonthDay(month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(2024, month - 1, day);
  return d.getMonth() === month - 1 && d.getDate() === day;
}

export function normalizeAssistantDateInput(text) {
  return String(text || "").replace(
    /\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/g,
    (raw, p1, p2, p3) => {
      const first = Number(p1);
      const second = Number(p2);
      const { day, month } = resolveDayMonth(first, second);
      if (!isValidMonthDay(month, day)) return raw;

      let year = p3 ? Number(p3) : new Date().getFullYear();
      if (year < 100) year += 2000;

      let iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (!p3 && iso < todayIso()) {
        iso = addDaysIso(`${year + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, 0);
      }
      return iso || raw;
    },
  );
}

export function extractAssistantGuestsCount(text) {
  const t = String(text || "").toLowerCase();
  const explicit = t.match(/\b(\d{1,2})\s*(?:guests?|people|persons?|travelers?|travellers?|pax)\b/);
  if (explicit) {
    const n = Number(explicit[1]);
    return Number.isFinite(n) && n > 0 && n <= 20 ? n : null;
  }

  const withoutDates = t
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b\d{1,2}[\/\-.]\d{1,2}([\/\-.]\d{2,4})?\b/g, " ");
  const phrased = withoutDates.match(/\b(?:for|party of|group of|we are|we're|were)\s+(\d{1,2})\b/);
  const bare = withoutDates.trim().match(/^(\d{1,2})$/);
  const match = phrased || bare;
  if (!match) return null;

  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 && n <= 20 ? n : null;
}

export function extendBilingualCityRows(rows) {
  const out = [...(rows ?? [])];
  const seen = new Set(out.map((r) => `${normalize(r?.name)}|${normalize(r?.countryName)}`));

  for (const { en, ar } of CITY_ALIASES) {
    const keyEn = `${normalize(en)}|`;
    const keyAr = `${normalize(ar)}|`;
    if (!seen.has(keyEn)) {
      out.push({ name: en, countryName: "" });
      seen.add(keyEn);
    }
    if (!seen.has(keyAr)) {
      out.push({ name: ar, countryName: "" });
      seen.add(keyAr);
    }
  }

  for (const { en, ar } of COUNTRY_ALIASES) {
    const keyEn = `|${normalize(en)}`;
    const keyAr = `|${normalize(ar)}`;
    if (!seen.has(keyEn)) {
      out.push({ name: "", countryName: en });
      seen.add(keyEn);
    }
    if (!seen.has(keyAr)) {
      out.push({ name: "", countryName: ar });
      seen.add(keyAr);
    }
  }

  return out.filter((r) => (r?.name ?? "").trim());
}

import { addDaysIso, todayIso } from "./dates.js";

const CITY_ALIASES = [
  // Palestine
  { en: "Ramallah", ar: "رام الله", countryEn: "Palestine", countryAr: "فلسطين" },
  { en: "Jerusalem", ar: "القدس", countryEn: "Palestine", countryAr: "فلسطين" },
  { en: "Bethlehem", ar: "بيت لحم", countryEn: "Palestine", countryAr: "فلسطين" },
  { en: "Hebron", ar: "الخليل", countryEn: "Palestine", countryAr: "فلسطين" },
  { en: "Nablus", ar: "نابلس", countryEn: "Palestine", countryAr: "فلسطين" },
  { en: "Jericho", ar: "أريحا", countryEn: "Palestine", countryAr: "فلسطين" },
  { en: "Jenin", ar: "جنين", countryEn: "Palestine", countryAr: "فلسطين" },
  { en: "Tulkarm", ar: "طولكرم", countryEn: "Palestine", countryAr: "فلسطين" },
  { en: "Qalqilya", ar: "قلقيلية", countryEn: "Palestine", countryAr: "فلسطين" },
  { en: "Salfit", ar: "سلفيت", countryEn: "Palestine", countryAr: "فلسطين" },
  { en: "Tubas", ar: "طوباس", countryEn: "Palestine", countryAr: "فلسطين" },
  { en: "Gaza", ar: "غزة", countryEn: "Palestine", countryAr: "فلسطين" },
  { en: "Khan Yunis", ar: "خان يونس", countryEn: "Palestine", countryAr: "فلسطين" },
  { en: "Rafah", ar: "رفح", countryEn: "Palestine", countryAr: "فلسطين" },

  // Jordan (add more as needed)
  { en: "Amman", ar: "عمان", countryEn: "Jordan", countryAr: "الأردن" },
  { en: "Irbid", ar: "إربد", countryEn: "Jordan", countryAr: "الأردن" },
  { en: "Zarqa", ar: "الزرقاء", countryEn: "Jordan", countryAr: "الأردن" },
  { en: "Aqaba", ar: "العقبة", countryEn: "Jordan", countryAr: "الأردن" },
  { en: "Madaba", ar: "مادبا", countryEn: "Jordan", countryAr: "الأردن" },
];

const COUNTRY_ALIASES = [
  { en: "Palestine", ar: "فلسطين" },
  { en: "Jordan", ar: "الاردن" },
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
  if (candidate.length < 4) return null;

  const scored = CITY_ALIASES.map((row) => {
    const english = compactAscii(row.en);
    if (!english) return null;
    if (candidate[0] !== english[0]) return null;
    const distance = levenshteinDistance(candidate, english);
    const includesBonus = english.includes(candidate) || candidate.includes(english) ? -1 : 0;
    const score = distance + includesBonus;
    const ratio = distance / Math.max(candidate.length, english.length);
    return { city: row.en, score, ratio };
  })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);

  if (!scored.length) return null;
  const best = scored[0];
  const threshold = Math.max(1, Math.floor(candidate.length * 0.22));
  const ratioThreshold = 0.25;
  return best.score <= threshold && best.ratio <= ratioThreshold ? best.city : null;
}

function findSuggestedCityAlias(input) {
  const candidate = compactAscii(input);
  if (!candidate || candidate.length < 4) return null;
  const scored = CITY_ALIASES.map((row) => {
    const english = compactAscii(row.en);
    if (!english) return null;
    if (candidate[0] !== english[0]) return null;
    const distance = levenshteinDistance(candidate, english);
    const ratio = distance / Math.max(candidate.length, english.length);
    return { city: row.en, distance, ratio };
  })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance || a.ratio - b.ratio);
  if (!scored.length) return null;
  const best = scored[0];
  const threshold = Math.max(2, Math.floor(candidate.length * 0.34));
  return best.distance <= threshold && best.ratio <= 0.34 ? best.city : null;
}

export function matchCityBilingual(input) {
  const n = normalize(input);
  if (!n) return { status: "none", city: "" };
  for (const row of CITY_ALIASES) {
    if (normalize(row.en) === n) return { status: "exact", city: row.en };
    if (normalize(row.ar) === n) return { status: "exact", city: row.en };
  }
  const suggested = findSuggestedCityAlias(input);
  if (suggested) return { status: "suggested", city: suggested };
  return { status: "none", city: "" };
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
  const match = matchCityBilingual(input);
  if (match.status === "exact") return match.city;
  if (match.status === "suggested") return findClosestCityAlias(input) || "";
  return "";
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
  // "3 guests", "3 people", etc.
  const explicit = t.match(/\b(\d{1,2})\s*(?:guests?|people|persons?|travelers?|travellers?|pax)\b/);
  if (explicit) {
    const n = Number(explicit[1]);
    return Number.isFinite(n) && n > 0 && n <= 20 ? n : null;
  }

  // "guests 3", "guests: 3", "pax=2", etc.
  const explicitReversed = t.match(/\b(?:guests?|people|persons?|travelers?|travellers?|pax)\s*[:=]?\s*(\d{1,2})\b/);
  if (explicitReversed) {
    const n = Number(explicitReversed[1]);
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

/** `YYYY-MM-DD` + local-calendar day delta → ISO date string */
function isoAddDays(baseIsoYmd, deltaDays) {
  const parts = String(baseIsoYmd || "").split("-").map(Number);
  const dt = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
  if (Number.isNaN(dt.getTime())) return "";
  dt.setDate(dt.getDate() + Number(deltaDays || 0));
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Offset from "today" (0 = tonight/today stay, 1 = tomorrow, …) for loose user text snippets.
 */
function relativeDayOffsetFromText(segment) {
  const sn = normalize(
    String(segment ?? "")
      .replace(/\btmrw\b/gi, "tomorrow")
      .replace(/\btomor+o?w*\b/gi, "tomorrow"),
  );
  // Longest phrase wins so "day after tomorrow" beats "tomorrow"
  let bestIdx = -1;
  let bestLen = -1;
  let offset = /** @type {number | null} */ (null);
  const phrases = /** @type {const} */ ([
    ["day after tomorrow", 2],
    ["tomorrow", 1],
    ["tonight", 0],
    ["today", 0],
  ]);
  for (const [phrase, off] of phrases) {
    const ix = sn.indexOf(normalize(phrase));
    if (ix >= 0 && phrase.replace(/\s+/g, "").length > bestLen) {
      bestLen = phrase.replace(/\s+/g, "").length;
      bestIdx = ix;
      offset = off;
    }
  }
  if (offset !== null && bestIdx >= 0) return offset;
  return null;
}

/**
 * Parses phrases like “today to tomorrow”, “from today until tomorrow”, “tonight thru tomorrow”.
 * Returns `{ checkIn, checkOut }` in local ISO; both are calendar dates (checkout is departure morning).
 *
 * Pass `todayIsoFn` when the assistant uses `_today` (e.g. for consistent “today”).
 */
export function parseNaturalDateRange(text, todayIsoFn) {
  const raw = String(text ?? "").trim();
  if (!raw) return null;
  const typoFixedRaw = raw
    .replace(/\btomorow\b/gi, "tomorrow")
    .replace(/\btomorro\b/gi, "tomorrow")
    .replace(/\btommorow\b/gi, "tomorrow")
    .replace(/\btomorroww\b/gi, "tomorrow")
    .replace(/\btmrw\b/gi, "tomorrow")
    .replace(/\btomor+o?w*\b/gi, "tomorrow");

  const anchor =
    typeof todayIsoFn === "function"
      ? String(todayIsoFn() || "").trim()
      : (() => {
          const z = new Date();
          const y = z.getFullYear();
          const m = String(z.getMonth() + 1).padStart(2, "0");
          const d = String(z.getDate()).padStart(2, "0");
          return `${y}-${m}-${d}`;
        })();

  if (!anchor || !/^\d{4}-\d{2}-\d{2}$/.test(anchor)) return null;

  const lowered = typoFixedRaw.toLowerCase();
  if (!/\b(today|tomorrow|tonight)\b|day\s+after\s+tomorrow/.test(lowered)) return null;

  const connectorRe = /\s+(?:to|-|–|—|until|till|'til|through)\s+/i;

  /** @returns {{checkIn:string,checkOut:string}|null} */
  function finish(checkInIso, checkoutIso) {
    let checkIn = checkInIso;
    let checkOut = checkoutIso;
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      checkOut = isoAddDays(checkIn, 1);
    }
    return { checkIn, checkOut };
  }

  if (connectorRe.test(typoFixedRaw)) {
    const pieces = typoFixedRaw.split(connectorRe);
    if (pieces.length < 2) return null;
    const left = String(pieces[0] || "").replace(/^from\s+/i, "").trim();
    const right = String(pieces[1] || "").trim();
    const oL = relativeDayOffsetFromText(left);
    const oR = relativeDayOffsetFromText(right);
    if (oL !== null && oR !== null) {
      const checkIn = isoAddDays(anchor, oL);
      const checkOut = isoAddDays(anchor, oR);
      return finish(checkIn, checkOut);
    }
    return null;
  }

  // Two phrases separated by commas: “today , tomorrow”
  const commaSplit = typoFixedRaw.split(/\s*,\s*/);
  if (commaSplit.length === 2) {
    const oL = relativeDayOffsetFromText(commaSplit[0]);
    const oR = relativeDayOffsetFromText(commaSplit[1]);
    if (oL !== null && oR !== null) {
      return finish(isoAddDays(anchor, oL), isoAddDays(anchor, oR));
    }
  }

  // Loose “today … tomorrow” (words not necessarily adjacent to “to”).
  const todayThenTomorrow =
    /\b(?:from\s+)?today\b.+?\btomorrow\b/i.test(lowered) && !/\btomorrow\b.+?\btoday\b/i.test(lowered);
  if (todayThenTomorrow) {
    return finish(isoAddDays(anchor, 0), isoAddDays(anchor, 1));
  }

  const tonightTomorrow = /\btonight\b.+?\btomorrow\b/i.test(lowered);
  if (tonightTomorrow) {
    return finish(isoAddDays(anchor, 0), isoAddDays(anchor, 1));
  }

  const tomorrowDat = /\b(tomorrow)\b.+?\b(day\s+after\s+tomorrow)\b/i.test(lowered);
  if (tomorrowDat) {
    return finish(isoAddDays(anchor, 1), isoAddDays(anchor, 2));
  }

  // Single-day hints (avoid plain “today” alone — too noisy in long sentences)
  if (/\btonight\b/.test(lowered) && relativeDayOffsetFromText(typoFixedRaw) === 0) {
    if (/\b(check|stay|book|room|night)\b/i.test(lowered)) {
      return finish(isoAddDays(anchor, 0), isoAddDays(anchor, 1));
    }
  }

  const onlyTomorrow =
    /^(?:please\s+)?(?:check[-\s]?in\s+)?tomorrow\b/i.test(typoFixedRaw.trim()) &&
    !/\b(today|tonight)\b/.test(lowered);
  if (onlyTomorrow) {
    return finish(isoAddDays(anchor, 1), isoAddDays(anchor, 2));
  }

  return null;
}

export function extendBilingualCityRows(rows) {
  const out = [...(rows ?? [])];
  const seen = new Set(out.map((r) => `${normalize(r?.name)}|${normalize(r?.countryName)}`));

  for (const { en, ar, countryEn, countryAr } of CITY_ALIASES) {
    const cEn = countryEn || "";
    const cAr = countryAr || "";
    if (!cEn || !cAr) continue;
    const keyEn = `${normalize(en)}|${normalize(cEn)}`;
    const keyAr = `${normalize(ar)}|${normalize(cAr)}`;
    if (!seen.has(keyEn)) {
      out.push({ name: en, countryName: cEn });
      seen.add(keyEn);
    }
    if (!seen.has(keyAr)) {
      out.push({ name: ar, countryName: cAr });
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

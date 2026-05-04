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

export function resolveCityBilingual(input) {
  const n = normalize(input);
  if (!n) return "";
  for (const row of CITY_ALIASES) {
    if (normalize(row.en) === n) return row.en;
    if (normalize(row.ar) === n) return row.en;
  }
  const fuzzy = findClosestCityAlias(input);
  if (fuzzy) return fuzzy;
  return String(input).trim();
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

export function parseUserPickIndex(text) {
  const t = normalize(text);
  if (!t) return null;

  // English ordinals / numbers
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

  // Arabic ordinals / numbers (common)
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

  const match = t.match(/\b(\d{1,2})\b/);
  if (match) {
    const num = Number(match[1]);
    if (Number.isFinite(num) && num >= 1 && num <= 20) return num - 1;
  }

  return null;
}

export function extendBilingualCityRows(rows) {
  const out = [...(rows ?? [])];
  const seen = new Set(out.map((r) => `${normalize(r?.name)}|${normalize(r?.countryName)}`));

  for (const { en, ar } of CITY_ALIASES) {
    // Add Arabic alias as a searchable option (same country unknown).
    // If an English entry exists already, keep it; we add the Arabic variant too for matching.
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


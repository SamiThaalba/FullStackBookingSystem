import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { bookingApi } from "../api/bookingApi";
import { useAuth } from "../auth/AuthContext";
import { useBookingUi } from "../context/BookingUiContext";
import {
  extractAssistantGuestsCount,
  extractKnownCityFromText,
  matchCityBilingual,
  normalizeAssistantDateInput,
  parseNaturalDateRange,
  parseUserPickIndex,
  resolveCityBilingual,
  resolveKnownCityBilingual,
} from "../utils/aiAssistant";
import { money } from "../utils/format";
import { addDaysIso, isIsoOnOrBefore, todayIso } from "../utils/dates";

const ASSISTANT_MEMORY_KEY = "quickreserve-ai-memory-v2";
const ASSISTANT_POSITION_KEY = "quickreserve-ai-position-v1";
const ASSISTANT_AUTO_OPEN_KEY = "quickreserve-ai-auto-open-v1";
const ASSISTANT_AWAITING_BOOKING_SUCCESS_KEY = "quickreserve-ai-awaiting-booking-success-v1";
const ASSISTANT_BOOKING_SUCCESS_EVENT = "quickreserve:booking-success";
const HOTELS_PAGE_SIZE = 6;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function loadAssistantPosition() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ASSISTANT_POSITION_KEY) || "null");
    const x = Number(parsed?.x);
    const y = Number(parsed?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  } catch {
    return null;
  }
}

function saveAssistantPosition(pos) {
  try {
    localStorage.setItem(ASSISTANT_POSITION_KEY, JSON.stringify(pos));
  } catch {
    // noop
  }
}

function clearAssistantPosition() {
  try {
    localStorage.removeItem(ASSISTANT_POSITION_KEY);
  } catch {
    // noop
  }
}

function resetAssistantToBottomRight(posRef, setPos) {
  posRef.current = null;
  setPos(null);
  clearAssistantPosition();
}

function loadMemory() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(ASSISTANT_MEMORY_KEY) || "null");
    return {
      context: parsed?.context || {},
      history: Array.isArray(parsed?.history) ? parsed.history : [],
      ui: parsed?.ui || {},
    };
  } catch {
    return { context: {}, history: [], ui: {} };
  }
}

function saveMemory(memory) {
  try {
    sessionStorage.setItem(ASSISTANT_MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // noop
  }
}

function isValidRoomName(name) {
  if (!name || typeof name !== "string") return false;
  const n = name.trim().toLowerCase();
  return n && n !== "room type name is required.";
}

function normalizeHotelName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]/g, "");
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

function findBestHotelNameMatch(hotels, requestedName) {
  const normalizedRequested = normalizeHotelName(requestedName);
  if (!normalizedRequested) return null;

  const scored = (hotels || [])
    .map((hotel) => {
      const normalizedCandidate = normalizeHotelName(hotel?.name);
      if (!normalizedCandidate) return null;
      const distance = levenshteinDistance(normalizedRequested, normalizedCandidate);
      const includesScore =
        normalizedCandidate.includes(normalizedRequested) || normalizedRequested.includes(normalizedCandidate)
          ? -2
          : 0;
      return {
        hotel,
        score: distance + includesScore,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);

  if (!scored.length) return null;
  const best = scored[0];
  const threshold = Math.max(2, Math.floor(normalizedRequested.length * 0.25));
  if (best.score <= threshold) return best.hotel;
  return null;
}

function findSimilarHotelNameMatches(hotels, requestedName, limit = 5) {
  const normalizedRequested = normalizeHotelName(requestedName);
  if (!normalizedRequested) return [];
  const scored = (hotels || [])
    .map((hotel) => {
      const normalizedCandidate = normalizeHotelName(hotel?.name);
      if (!normalizedCandidate) return null;
      const distance = levenshteinDistance(normalizedRequested, normalizedCandidate);
      const includesScore =
        normalizedCandidate.includes(normalizedRequested) || normalizedRequested.includes(normalizedCandidate)
          ? -2
          : 0;
      const score = distance + includesScore;
      return { hotel, score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);
  const threshold = Math.max(2, Math.floor(normalizedRequested.length * 0.4));
  return scored.filter((x) => x.score <= threshold).slice(0, limit).map((x) => x.hotel);
}

function shouldShowGuide(text) {
  const value = String(text || "").toLowerCase();
  if (!value) return false;
  return (
    value.includes("guide me") ||
    value.includes("guidance") ||
    value.includes("steps") ||
    value.includes("step by step")
  );
}

function isAnyCityIntent(text) {
  const value = String(text || "").toLowerCase().trim();
  if (!value) return false;
  const compact = value.replace(/\s+/g, "");
  return (
    value.includes("any city") ||
    compact.includes("anycity") ||
    value.includes("anything") ||
    value.includes("for all") ||
    value.includes("all hotels") ||
    value.includes("all hotel") ||
    value.includes("lets see all") ||
    value.includes("let's see all") ||
    value.includes("lets see for all") ||
    value.includes("show all") ||
    value.includes("doesn't matter") ||
    value.includes("doesnt matter") ||
    value.includes("dosnt matter") ||
    value.includes("dont care") ||
    value.includes("don't care") ||
    value === "any" ||
    value === "anyone" ||
    value.includes("anywhere")
  );
}

function isBrowseHotelsIntent(text) {
  const value = String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ");
  if (!value) return false;
  if (!/\bhotels?\b/.test(value)) return false;
  if (/\b(called|named|name is)\b/.test(value)) return false;
  if (/^(all\s+)?hotels?$/.test(value)) return true;

  const asksToBrowse = /\b(show|list|see|view|browse|display|give|get|find|search)\b/.test(value);
  const asksForCollection = /\b(all|available|options|every|any)\b/.test(value) || /\bhotels?\s*(please)?$/.test(value);
  return asksToBrowse && asksForCollection;
}

function isUnsureIntent(text) {
  const value = String(text || "").toLowerCase().trim();
  if (!value) return false;
  const compact = value.replace(/\s+/g, "");
  return (
    value === "idk" ||
    value === "i dont know" ||
    value === "i don't know" ||
    value === "not sure" ||
    value === "unsure" ||
    value === "whatever" ||
    compact === "dontknow" ||
    compact === "idontknow"
  );
}

function isResetChatIntent(text) {
  const value = String(text || "").toLowerCase().trim();
  if (!value) return false;
  return (
    value === "clear" ||
    value === "clear chat" ||
    value === "reset" ||
    value === "reset chat" ||
    value === "new chat" ||
    value === "restart chat"
  );
}

function isAffirmativeIntent(text) {
  const value = String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ");
  return [
    "yes",
    "yeah",
    "yep",
    "yup",
    "correct",
    "right",
    "sure",
    "ok",
    "okay",
    "yes please",
    "please",
    "that's right",
    "that is right",
  ].includes(value);
}

function isNegativeIntent(text) {
  const value = String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ");
  return ["no", "nope", "nah", "not that", "wrong", "not correct"].includes(value);
}

function isCasualGreetingIntent(text) {
  const value = String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ");
  if (!value) return false;
  if (/\b(hotel|book|booking|reserve|room|city|date|guest|stay|check|bethlehem|jerusalem|ramallah|nablus|hebron|gaza)\b/.test(value)) {
    return false;
  }
  return /^(hi|hello|hey|hey there|hello there|yo|good morning|good afternoon|good evening|salam)$/.test(value);
}

function greetingReply() {
  return "Hi, I'm here. Tell me what you're looking for, or tap Guide me and I'll walk you through it.";
}

function formatHotelChoicesMessage(hotels) {
  if (!Array.isArray(hotels) || hotels.length === 0) return null;
  const names = hotels.map((h) => h?.name).filter(Boolean);
  if (!names.length) return null;
  return `I've found some options for you. The available hotels are: ${names.join(", ")}. Which one would you like to choose?`;
}

function toHotelOption(hotel) {
  return {
    id: Number(hotel?.id || 0),
    name: hotel?.name,
    city: hotel?.city,
    price: Number(hotel?.lowestPrice ?? hotel?.pricePerNight ?? 0),
  };
}

function isCityQuestion(text) {
  const value = String(text || "").toLowerCase();
  return (
    value.includes("which city") ||
    value.includes("in which city") ||
    value.includes("what city") ||
    value.includes("city would you prefer")
  );
}

function extractHotelNameFromSelectionText(text) {
  const value = String(text || "");
  const match = value.match(/you['’]ve selected the\s+(.+?)\.\s+the available room types are/i);
  return match?.[1]?.trim() || null;
}

function extractHotelNameFromDatesPromptText(text) {
  const value = String(text || "");
  const m1 = value.match(/you['’]ve selected\s+(.+?)\.\s+what are your check-in and check-out dates\?/i);
  if (m1?.[1]) return m1[1].trim();
  const m2 = value.match(
    /you['’]ve selected\s+(.+?)(?:\s*\([^)]*\))?\.\s+(?:please\s+provide\s+your\s+)?check-in\s+date,\s*check-out\s+date,\s*and\s+number\s+of\s+guests\./i,
  );
  if (m2?.[1]) return m2[1].trim();
  const m3 = value.match(/you['’]ve selected\s+(.+?)(?:\s*\([^)]*\))?\./i);
  return m3?.[1] ? m3[1].trim() : null;
}

// Generic words that should NEVER be treated as a city name.
const INVALID_CITY_WORDS = new Set([
  "city", "town", "place", "area", "location", "hotel", "somewhere",
  "anywhere", "there", "here", "it", "this", "that", "some", "a", "the",
  "yes", "no", "ok", "okay", "sure", "fine", "any", "another", "other",
]);

function isValidCityName(name) {
  if (!name || typeof name !== "string") return false;
  const n = name.trim().toLowerCase();
  return n.length >= 2 && !INVALID_CITY_WORDS.has(n);
}

function extractCityCorrection(text) {
  const value = String(text || "").trim();
  // Ordered from most-specific to least-specific
  const patterns = [
    /^(?:i mean|no[,\s]*i mean)\s+([a-zA-Z\u0600-\u06FF\s-]+)$/i,
    /^(?:the\s+)?city\s+is\s+([a-zA-Z\u0600-\u06FF\s-]+)$/i,
    /^i(?:'m|\s+am)\s+(?:going\s+to|staying\s+in|looking\s+in|in)\s+([a-zA-Z\u0600-\u06FF\s-]+)$/i,
    /^(?:i\s+want|i\s+wanna|book\s+in|stay\s+in)\s+([a-zA-Z\u0600-\u06FF\s-]+)$/i,
    /^([a-zA-Z\u0600-\u06FF\s-]+)\s+(?:city|please|hotel)$/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) {
      const resolved = resolveCityBilingual(match[1].trim());
      if (resolved && isValidCityName(resolved)) return resolved;
    }
  }
  return "";
}

function getStrictCurrentStep(context, confirmDraft) {
  const hasCity = Boolean(context?.city || context?.anyCity);
  const hasDatesGuests = Boolean(context?.checkIn && context?.checkOut && Number(context?.guests || 0) > 0);
  const hasHotel = Number(context?.selectedHotelId || 0) > 0;
  const hasRoom = Number(context?.selectedRoomTypeId || 0) > 0;
  if (!hasCity) return 2;
  if (!hasDatesGuests) return 3;
  if (!hasHotel) return 4;
  if (!hasRoom) return 5;
  return confirmDraft ? 7 : 7;
}

const GUIDED_FLOW_TOTAL_STEPS = 5;

function getFlowStep(context, confirmDraft, lang = "en") {
  const hasHotel = Number(context?.selectedHotelId || 0) > 0;
  const hasCity = Boolean(context?.city || context?.anyCity);
  const hasDates = Boolean(context?.checkIn && context?.checkOut);
  const hasGuests = Number(context?.guests || 0) > 0;
  const hasRoom = Number(context?.selectedRoomTypeId || 0) > 0;

  const labels =
    lang === "ar"
      ? {
          dest: "اختيار الوجهة",
          datesGuests: "التواريخ وعدد الضيوف",
          hotel: "اختيار الفندق",
          room: "اختيار نوع الغرفة",
          confirm: "تأكيد الحجز",
        }
      : {
          dest: "Choose destination",
          datesGuests: "Dates & guests",
          hotel: "Choose hotel",
          room: "Choose room type",
          confirm: "Confirm booking",
        };

  if (!hasCity && !hasHotel) return { number: 1, label: labels.dest };
  if (!hasDates || !hasGuests) return { number: 2, label: labels.datesGuests };
  if (!hasHotel) return { number: 3, label: labels.hotel };
  if (!hasRoom) return { number: 4, label: labels.room };
  return confirmDraft ? { number: 5, label: labels.confirm } : { number: 5, label: labels.confirm };
}

/** After destination: show date + guest pickers until both dates and guest count are set. */
function isFlowDatesStep(context) {
  const hasHotel = Number(context?.selectedHotelId || 0) > 0;
  const hasCity = Boolean(context?.city || context?.anyCity);
  const hasDates = Boolean(context?.checkIn && context?.checkOut);
  const hasGuests = Number(context?.guests || 0) > 0;
  if (!hasCity && !hasHotel) return false;
  return !hasDates || !hasGuests;
}

function createDefaultDatesGuestsDraft() {
  const checkIn = todayIso();
  return { checkIn, checkOut: addDaysIso(checkIn, 1), guests: 1 };
}

function getGuideQuestion(context, confirmDraft, lang = "en") {
  if (!context?.city && !context?.anyCity && !Number(context?.selectedHotelId || 0)) {
    return lang === "ar"
      ? "تمام — الخطوة 1: في أي مدينة تريد الإقامة؟ (أو قل: أي مدينة)"
      : "Great — step 1: which city do you want to stay in? (Or say: any city)";
  }
  if (!context?.checkIn || !context?.checkOut || !Number(context?.guests || 0)) {
    return lang === "ar"
      ? "الخطوة 2: اختر تواريخ الدخول والمغادرة وعدد الضيوف (الحقول أدناه)، أو اكتب التواريخ وعدد الضيوف."
      : "Step 2: choose check-in, check-out, and guests using the pickers below — or type dates and guest count.";
  }
  if (!Number(context?.selectedHotelId || 0)) {
    return lang === "ar" ? "الخطوة 3: اختر الفندق من الخيارات في الأسفل." : "Step 3: which hotel would you like from the options below?";
  }
  if (!Number(context?.selectedRoomTypeId || 0)) {
    return lang === "ar" ? "الخطوة 4: ما نوع الغرفة الذي تريده؟" : "Step 4: which room type would you like for this hotel?";
  }
  if (confirmDraft) {
    return lang === "ar"
      ? "الخطوة 5: سأفتح صفحة الدفع لتختار طريقة الدفع وتكمل الحجز."
      : "Step 5: I will open the payment form so you can choose your payment method and complete booking.";
  }
  return lang === "ar" ? "كل شيء جاهز. اضغط تأكيد الحجز عندما تكون جاهزاً." : "Everything is ready. Press Confirm booking when you are ready.";
}

function humanizeError(err) {
  if (!err) return "Something went wrong. Please try again.";
  if (err.status === 400 || err.status === 422) {
    return err.message || "Booking details are invalid. Please review dates and guests.";
  }
  if (err.status === 403) {
    return "I cannot complete that action with your current permissions. You can still search hotels or adjust your request.";
  }
  if (err.status === 401) {
    return "Please log in again to continue the booking flow.";
  }
  return err.message || "I hit an issue while processing your request.";
}

// ─── Smart date parsing ───────────────────────────────────────────────────────
// Converts user-typed "D-M" / "D/M" / "D.M" patterns → "YYYY-MM-DD" using the
// current calendar year, so the backend always receives unambiguous ISO dates.
// Patterns that already contain a 4-digit year (e.g. "2026-05-07") are left alone.
function normalizeDateInput(text) {
  return normalizeAssistantDateInput(text);
}

// ─── "Another hotel" intent ───────────────────────────────────────────────────
function isChangeHotelIntent(text) {
  const v = String(text || "").toLowerCase().trim();
  const hasAnotherWord = /\b(another|different|other|change|switch)\b/.test(v);
  const hasHotelWord = /\bhotel\b/.test(v);
  const exactPhrases = ["i want another", "i wanna another", "show me another", "try another", "another one"];
  if (hasAnotherWord && hasHotelWord) return true;
  if (exactPhrases.some((p) => v === p || v.startsWith(p + " "))) return true;
  return false;
}

function isChangeRoomIntent(text) {
  const v = String(text || "").toLowerCase().trim();
  if (!v) return false;
  if (/\b(room|room type)\b/.test(v) && /\b(another|different|other|change|switch)\b/.test(v)) return true;
  if (/\b(don't|dont)\b/.test(v) && /\bwant\b/.test(v) && /\bthis\b/.test(v) && /\broom\b/.test(v)) return true;
  if (/\bneed\b/.test(v) && /\banother\b/.test(v) && /\broom\b/.test(v)) return true;
  return false;
}

// ─── Detect explicit city in user text ───────────────────────────────────────
function extractExplicitCity(text) {
  const words = String(text || "").trim().split(/\s+/);
  const candidates = [...words];
  for (let i = 0; i < words.length - 1; i++) candidates.push(`${words[i]} ${words[i + 1]}`);
  for (const c of candidates) {
    const resolved = resolveKnownCityBilingual(c);
    if (resolved) return resolved;
  }
  return "";
}

function cleanHotelNameIntent(value) {
  let v = String(value || "").trim();
  if (!v) return "";

  // Remove common lead-in phrases so we keep only the actual hotel name.
  v = v.replace(
    /^(?:i\s*(?:want|wanna)\s*(?:to\s*)?(?:book|reserve)\s*(?:me\s*)?(?:in|at)\s+|(?:book|reserve)\s*(?:me\s*)?(?:in|at)\s+|(?:in|at)\s+)/i,
    "",
  );
  // Handle: "hotel called postman", "hotel named postman", "hotel postman"
  v = v.replace(/^(?:the\s+)?hotel\s+(?:called|named)\s+/i, "");
  v = v.replace(/^(?:the\s+)?hotel\s+/i, "");
  v = v.replace(/^(?:the\s+)?hotel\s+name\s+/i, "");
  v = v.replace(/^name\s+/i, "");
  v = v.replace(/^(?:called|named)\s+/i, "");
  v = v.replace(/^the\s+/i, "");
  v = v.replace(/[.?!,;:]+$/g, "").trim();
  return v;
}

function isLikelyHotelName(value) {
  const v = String(value || "").trim();
  if (!v) return false;
  const n = v.toLowerCase().replace(/\s+/g, " ").trim();
  if (n.length < 2) return false;
  // Avoid treating pure filler as a hotel name.
  if (["a", "an", "the", "hotel", "room", "booking", "book", "reserve"].includes(n)) return false;
  return true;
}

function extractIsoDates(text) {
  const t = String(text || "");
  const matches = t.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
  return matches.slice(0, 3);
}

function resolveCheckInOutFromUserText(text, todayAnchorFn = todayIso) {
  const iso = extractIsoDates(text);
  if (iso.length >= 2) {
    let [checkIn, checkOut] = iso;
    if (new Date(checkOut) <= new Date(checkIn)) {
      const d = new Date(checkIn);
      d.setDate(d.getDate() + 1);
      checkOut = d.toISOString().slice(0, 10);
    }
    return { checkIn, checkOut };
  }
  const natural = parseNaturalDateRangeEnhanced(text, todayAnchorFn);
  if (natural?.checkIn && natural?.checkOut) return natural;
  return null;
}

function parseNaturalDateRangeEnhanced(text, todayAnchorFn = todayIso) {
  const base = parseNaturalDateRange(text, todayAnchorFn);
  if (base?.checkIn && base?.checkOut) return base;

  // Add support for common weekday ranges:
  // - "today to sunday"
  // - "monday to sunday"
  // - "next monday to next sunday"
  // - "tomorrow until friday"
  const vRaw = String(text || "");
  const v = vRaw.toLowerCase();
  const anchorIso = todayAnchorFn();
  const anchor = new Date(`${anchorIso}T00:00:00`);
  const dayIndex = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  function nextWeekday(targetIdx, fromDate, { allowSameDay = false } = {}) {
    const d = new Date(fromDate);
    const fromIdx = d.getDay();
    let delta = (targetIdx - fromIdx + 7) % 7;
    if (delta === 0 && !allowSameDay) delta = 7; // interpret as next occurrence
    d.setDate(d.getDate() + delta);
    return d;
  }

  const weekdayWords = Object.keys(dayIndex);
  const hasRange = /\b(to|until|till|through|thru)\b/i.test(v);
  if (!hasRange) return null;

  function weekdayMentions() {
    const re = /\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi;
    const out = [];
    let m;
    while ((m = re.exec(vRaw)) != null) {
      out.push({
        word: String(m[2] || "").toLowerCase(),
        next: Boolean(m[1]),
      });
      if (out.length >= 4) break;
    }
    return out;
  }

  const mentions = weekdayMentions().filter((x) => weekdayWords.includes(x.word));
  const hasTomorrowStart = /\b(tomorrow)\b/i.test(v);
  const hasTodayStart = /\b(today)\b/i.test(v);

  let start = new Date(anchor);
  if (hasTomorrowStart) start.setDate(start.getDate() + 1);

  const parts = v.split(/\b(?:to|until|till|through|thru)\b/i);
  const left = parts[0] || "";
  const right = parts.slice(1).join(" ") || "";

  const leftMention = mentions.find((m) => new RegExp(`\\b${m.word}\\b`, "i").test(left)) || null;
  const rightMention = [...mentions].reverse().find((m) => new RegExp(`\\b${m.word}\\b`, "i").test(right)) || null;

  if (leftMention) {
    const sIdx = dayIndex[leftMention.word];
    const allowSame = hasTodayStart && !leftMention.next;
    start = nextWeekday(sIdx, start, { allowSameDay: allowSame });
    if (leftMention.next) start = nextWeekday(sIdx, start, { allowSameDay: false });
  }

  const endMention =
    rightMention ||
    mentions.find((m) => new RegExp(`\\b${m.word}\\b`, "i").test(v)) ||
    null;
  if (!endMention) return null;
  const endIdx = dayIndex[endMention.word];
  let end = nextWeekday(endIdx, start, { allowSameDay: false });
  if (endMention.next) end = nextWeekday(endIdx, end, { allowSameDay: false });

  const checkIn = start.toISOString().slice(0, 10);
  const checkOut = end.toISOString().slice(0, 10);
  if (new Date(checkOut) <= new Date(checkIn)) return null;
  return { checkIn, checkOut };
}

function findBestRoomNameMatch(rooms, requestedName) {
  const normalizedRequested = normalizeHotelName(requestedName);
  if (!normalizedRequested) return null;
  const scored = (rooms || [])
    .map((room) => {
      const normalizedCandidate = normalizeHotelName(room?.name);
      if (!normalizedCandidate) return null;
      const distance = levenshteinDistance(normalizedRequested, normalizedCandidate);
      const includesScore =
        normalizedCandidate.includes(normalizedRequested) || normalizedRequested.includes(normalizedCandidate)
          ? -2
          : 0;
      return { room, score: distance + includesScore };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);
  if (!scored.length) return null;
  const best = scored[0];
  const threshold = Math.max(2, Math.floor(normalizedRequested.length * 0.35));
  return best.score <= threshold ? best.room : null;
}

function pickRoomByText(text, rooms) {
  if (!Array.isArray(rooms) || !rooms.length) return null;
  const idx = parseUserPickIndex(text);
  if (typeof idx === "number" && idx >= 0 && idx < rooms.length) return rooms[idx];
  return findBestRoomNameMatch(rooms, text) || null;
}

function duplicateBookingPrepMessage(draft) {
  return (
    `\n\nBooking summary:\n` +
    `Hotel: ${draft.hotel?.name}\n` +
    `Room type: ${draft.room?.name}\n` +
    `Dates: ${draft.checkIn} to ${draft.checkOut}\n` +
    `Guests: ${draft.guests}\n` +
    `Price: ${money(draft.quote?.totalPrice)}\n\n` +
    `Do you want to confirm this booking?\n` +
    `Please choose a payment method, then press Confirm booking.`
  );
}

function extractGuestsCount(text) {
  return extractAssistantGuestsCount(text);
}

function isCapacityIntent(text) {
  const t = String(text || "").toLowerCase();
  if (!t) return false;
  return (
    /\bfit\b/.test(t) ||
    /\bcapacity\b/.test(t) ||
    /\b(can|could)\s+(fit|host|hold)\b/.test(t) ||
    /\bfor\s+\d{1,2}\s*(guest|guests|geust|geusts|guset|gusets|person|people)\b/.test(t) ||
    /\b\d{1,2}\s*(guest|guests|geust|geusts|guset|gusets|person|people)\b/.test(t) ||
    /\bi\s+want\s+for\s+\d{1,2}\b/.test(t)
  );
}

function guestsMissing(context) {
  return !(Number(context?.guests || 0) > 0);
}

/** Solely digits → often "how many guests?" not "hotel #1" when guests are still missing. */
function isPlainGuestCountDigits(text) {
  return /^\s*\d{1,2}\s*$/.test(String(text || ""));
}

async function fetchHotelOptionsForContext(ctx) {
  const resp = await bookingApi.listHotels({
    city: ctx?.anyCity ? undefined : (ctx?.city || undefined),
    name: ctx?.name || undefined,
    from: ctx?.checkIn || undefined,
    to: ctx?.checkOut || undefined,
    checkInDate: ctx?.checkIn || undefined,
    checkOutDate: ctx?.checkOut || undefined,
    guests: Number(ctx?.guests || 0) > 0 ? Number(ctx.guests) : undefined,
    page: 0,
    size: 10,
  });
  const list = resp?.content || [];
  return list.map(toHotelOption).filter((h) => h.id > 0 && h.name);
}

// ─── Extract "book in this hotel <name>" intent ───────────────────────────────
function extractHotelNameIntent(text) {
  const v = String(text || "").trim();
  if (!v) return "";

  // 0) "book/reserve in/at <name>" (no "hotel" word required)
  // Examples:
  // - "I wanna to book in Postman"
  // - "book in postman"
  // - "reserve at The Postman."
  const bookIn = v.match(/\b(?:book|reserve)(?:\s+me)?(?:\s+a)?(?:\s+room)?\s+(?:in|at)\s+(.+?)$/i);
  if (bookIn?.[1]) {
    const cleaned = cleanHotelNameIntent(bookIn[1]).replace(/\bhotel\b$/i, "").trim();
    if (isLikelyHotelName(cleaned)) return cleaned;
  }

  // 1) "... hotel <name>"
  const afterHotel = v.match(/\bhotel\s+(.+)$/i);
  if (afterHotel?.[1]) {
    const cleaned = cleanHotelNameIntent(afterHotel[1]);
    if (isLikelyHotelName(cleaned)) return cleaned;
    return "";
  }

  // 2) "... in/at <name> hotel" or "<name> hotel" (hotel word at the end)
  // Examples:
  // - "I wanna book in postman hotel"
  // - "book at The Postman Hotel."
  // - "postman hotel"
  const beforeHotel = v.match(/\b(?:in|at)?\s*([a-zA-Z0-9\u0600-\u06FF][\w\u0600-\u06FF\s'’&.-]{1,80}?)\s+hotel\b/i);
  if (beforeHotel?.[1]) {
    const cleaned = cleanHotelNameIntent(beforeHotel[1]);
    if (isLikelyHotelName(cleaned)) return cleaned;
    return "";
  }

  // If user typed a name without "hotel", we skip to avoid false positives.
  return "";
}

function extractLooseHotelNameIntent(text) {
  const v = String(text || "").trim();
  if (!v) return "";
  const withHotel = v.match(/(?:^|\b)hotel\b[\s:,-]*(.+)$/i);
  if (withHotel?.[1]) {
    const cleaned = cleanHotelNameIntent(withHotel[1]);
    if (isLikelyHotelName(cleaned)) return cleaned;
  }
  const wantsHotel = /\b(i\s+want|i\s+wanna|book|reserve|looking\s+for|search)\b/i.test(v) && /\bhotel\b/i.test(v);
  if (wantsHotel) {
    const cleaned = cleanHotelNameIntent(v.replace(/\bhotel\b/gi, "").trim());
    if (isLikelyHotelName(cleaned)) return cleaned;
  }
  return "";
}

// ─── Context-aware partial-input prompt ──────────────────────────────────────
// Returns a question for ONLY the pieces still missing.
function getMissingDatesGuestsMessage(context) {
  const hasCheckIn  = Boolean(context?.checkIn);
  const hasCheckOut = Boolean(context?.checkOut);
  const hasGuests   = Number(context?.guests || 0) > 0;
  const missing = [];
  if (!hasCheckIn)  missing.push("check-in date");
  if (!hasCheckOut) missing.push("check-out date");
  if (!hasGuests)   missing.push("number of guests");
  if (!missing.length) return null;
  if (missing.length === 3) return "Please provide your check-in date, check-out date, and number of guests.";
  const list = missing.length === 2 ? `${missing[0]} and ${missing[1]}` : missing[0];
  return `Got it — I just need your ${list}.`;
}

function navigateWithContext({ navigate, updateBookingUi, ctx, fallbackGuests = 1 }) {
  const guests = Number(ctx?.guests || fallbackGuests || 1);
  const checkIn = ctx?.checkIn || "";
  const checkOut = ctx?.checkOut || "";
  const hasAnyCity = Boolean(ctx?.anyCity) || !ctx?.city;
  const city = hasAnyCity ? "" : String(ctx?.city || "");

  updateBookingUi({
    city,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    guests,
  });

  const q = new URLSearchParams();
  if (city) q.set("city", city);
  if (checkIn) q.set("from", checkIn);
  if (checkOut) q.set("to", checkOut);
  q.set("guests", String(guests));

  if (Number(ctx?.selectedHotelId || 0) > 0) {
    navigate(`/hotels/${Number(ctx.selectedHotelId)}?${q.toString()}`);
    return;
  }
  navigate(`/hotels?${q.toString()}`);
}

// ─── Match typed text against current hotel options ───────────────────────────
function pickHotelByText(text, options) {
  if (!Array.isArray(options) || !options.length) return null;
  const idx = parseUserPickIndex(text);
  if (typeof idx === "number" && idx >= 0 && idx < options.length) return options[idx];
  return findBestHotelNameMatch(options, text) || null;
}


function TypingIndicator() {
  return (
    <div className="assistant-row assistant-row--bot">
      <div className="assistant-botAvatar" aria-hidden>
        <img src="/ai_assistant_logo.png" alt="" />
      </div>
      <div className="assistant-msg assistant-msg--typing" aria-label="Assistant is thinking">
        <span className="assistant-dot" />
        <span className="assistant-dot" />
        <span className="assistant-dot" />
      </div>
    </div>
  );
}

class BookingAssistantErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // Surface in devtools for diagnosis; UI also shows a minimal message.
    // eslint-disable-next-line no-console
    console.error("BookingAssistant crashed:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ position: "fixed", right: 12, bottom: 12, zIndex: 9999, maxWidth: 380 }}>
          <div style={{ background: "#111827", color: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 10px 30px rgba(0,0,0,.35)" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Assistant error</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              {String(this.state.error?.message || this.state.error || "Unknown error")}
            </div>
            <button
              type="button"
              style={{ marginTop: 10, background: "#2563eb", color: "#fff", border: 0, padding: "8px 10px", borderRadius: 10, cursor: "pointer" }}
              onClick={() => this.setState({ error: null })}
            >
              Dismiss
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function BookingAssistantInner({ embedded = false }) {
  const { i18n } = useTranslation();
  const auth = useAuth();
  const { updateBookingUi } = useBookingUi();
  const navigate = useNavigate();
  const location = useLocation();
  const initialMemory = useMemo(() => loadMemory(), []);
  const [open, setOpen] = useState(embedded);
  const rootRef = useRef(null);
  const [pos, setPos] = useState(() => (embedded ? null : loadAssistantPosition()));
  const posRef = useRef(pos);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({
    active: false,
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    startX: 0,
    startY: 0,
    moved: false,
  });
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState(() => initialMemory.history);
  const [context, setContext] = useState(() => initialMemory.context);
  const [loading, setLoading] = useState(false);
  const [datesGuestsDraft, setDatesGuestsDraft] = useState(() => {
    const mem = initialMemory?.context || {};
    if (mem.checkIn && mem.checkOut) {
      return {
        checkIn: mem.checkIn,
        checkOut: mem.checkOut,
        guests: clamp(Number(mem.guests || 1) || 1, 1, 7),
      };
    }
    return createDefaultDatesGuestsDraft();
  });
  const [confirmDraft, setConfirmDraft] = useState(null);
  const [hotelOptions, setHotelOptions] = useState([]);
  const [roomOptions, setRoomOptions] = useState([]);
  const [selectedRoomOptionId, setSelectedRoomOptionId] = useState(null);
  const [pickDialog, setPickDialog] = useState(null); // { type:"hotel"|"room", title:string, items:[] }
  const [assistantPickerDismissed, setAssistantPickerDismissed] = useState(false);
  const [guideEnabled, setGuideEnabled] = useState(false);
  const [pendingCitySuggestion, setPendingCitySuggestion] = useState(null);
  const wasAuthenticatedRef = useRef(Boolean(auth.isAuthenticated));
  const scrollerRef = useRef(null);
  const inputRef = useRef(null);

  const canUseAssistant = true;

  const bookingContextHint = location.pathname.startsWith("/hotels")
    ? "Using current discover/booking context."
    : "I can search hotels and complete booking steps for you.";

  const systemLang = String(i18n?.language || "en").toLowerCase().startsWith("ar") ? "ar" : "en";
  const showDatesGuestsPicker = isFlowDatesStep(context) && !confirmDraft && !pickDialog;

  if (!canUseAssistant) return null;

  useEffect(() => {
    function onBookingSuccess() {
      const awaiting = sessionStorage.getItem(ASSISTANT_AWAITING_BOOKING_SUCCESS_KEY) === "1";
      if (!awaiting) return;
      sessionStorage.removeItem(ASSISTANT_AWAITING_BOOKING_SUCCESS_KEY);

      pushTurn(
        "assistant",
        systemLang === "ar"
          ? "شكراً للحجز معنا. سأبدأ محادثة جديدة الآن."
          : "Thanks for booking. I’ll start a new chat now.",
      );

      window.setTimeout(() => {
        resetConversation();
        if (!embedded) setOpen(false);
      }, 2000);
    }

    window.addEventListener(ASSISTANT_BOOKING_SUCCESS_EVENT, onBookingSuccess);
    return () => window.removeEventListener(ASSISTANT_BOOKING_SUCCESS_EVENT, onBookingSuccess);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, systemLang]);

  useEffect(() => {
    const checkIn = context?.checkIn || datesGuestsDraft.checkIn || todayIso();
    const nextCheckOut = context?.checkOut || datesGuestsDraft.checkOut || addDaysIso(checkIn, 1);
    const safeCheckOut = isIsoOnOrBefore(nextCheckOut, checkIn) ? addDaysIso(checkIn, 1) : nextCheckOut;
    const guests = clamp(Number(context?.guests || datesGuestsDraft.guests || 1) || 1, 1, 7);
    setDatesGuestsDraft((prev) => ({ ...prev, checkIn, checkOut: safeCheckOut, guests }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context?.checkIn, context?.checkOut, context?.guests]);

  function getHotelsPageFilters(overrides = {}) {
    const params = new URLSearchParams(location.search || "");
    const from = overrides.from ?? params.get("from") ?? context?.checkIn ?? "";
    const to = overrides.to ?? params.get("to") ?? context?.checkOut ?? "";
    const guests = Number(overrides.guests ?? params.get("guests") ?? context?.guests ?? 1) || 1;
    const filters = {
      page: Number(overrides.page ?? params.get("page") ?? 0) || 0,
      size: Number(overrides.size ?? HOTELS_PAGE_SIZE) || HOTELS_PAGE_SIZE,
      city: overrides.city ?? params.get("city") ?? context?.city ?? undefined,
      country: overrides.country ?? params.get("country") ?? undefined,
      name: overrides.name ?? params.get("name") ?? undefined,
      from: from || undefined,
      to: to || undefined,
      checkInDate: from || undefined,
      checkOutDate: to || undefined,
      guests,
      adults: overrides.adults ?? params.get("adults") ?? undefined,
      children: overrides.children ?? params.get("children") ?? undefined,
    };
    Object.keys(filters).forEach((key) => {
      if (filters[key] === "" || filters[key] == null) delete filters[key];
    });
    return filters;
  }

  async function fetchCurrentHotelsPageOptions(overrides = {}) {
    if (location.pathname !== "/hotels") return [];
    const resp = await bookingApi.listHotels(getHotelsPageFilters(overrides));
    const list = resp?.content || [];
    return list.map(toHotelOption).filter((hotel) => hotel.id > 0 && hotel.name);
  }

  useEffect(() => {
    if (embedded) {
      setOpen(true);
    }
  }, [embedded]);

  // Auto-open when another screen navigates and wants the assistant visible.
  useEffect(() => {
    if (embedded) return;
    try {
      const flag = sessionStorage.getItem(ASSISTANT_AUTO_OPEN_KEY);
      if (!flag) return;
      sessionStorage.removeItem(ASSISTANT_AUTO_OPEN_KEY);
      setOpen(true);
      setGuideEnabled(true);
    } catch {
      // ignore storage issues
    }
  }, [embedded, location.pathname]);

  // Keep ref in sync with state (for pointer handlers).
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  // Global drag listeners (always installed) for reliable dragging.
  useEffect(() => {
    if (embedded) return;

    function computeClampedPosition(next, { w, h }) {
      const pad = 8;
      const maxX = Math.max(pad, window.innerWidth - w - pad);
      const maxY = Math.max(pad, window.innerHeight - h - pad);
      return {
        x: clamp(next.x, pad, maxX),
        y: clamp(next.y, pad, maxY),
      };
    }

    function onPointerMove(e) {
      const d = dragRef.current;
      if (!d.active) return;
      if (d.pointerId != null && e.pointerId !== d.pointerId) return;

      const dx = e.clientX - d.startClientX;
      const dy = e.clientY - d.startClientY;
      if (!d.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) d.moved = true;

      const rect = rootRef.current?.getBoundingClientRect();
      const w = rect?.width || 0;
      const h = rect?.height || 0;
      const unclamped = { x: d.startX + dx, y: d.startY + dy };
      const next = computeClampedPosition(unclamped, { w, h });

      posRef.current = next;
      setPos(next);
    }

    function stopDrag(e) {
      const d = dragRef.current;
      if (!d.active) return;
      if (d.pointerId != null && e?.pointerId != null && e.pointerId !== d.pointerId) return;
      d.active = false;
      d.pointerId = null;
      setDragging(false);
      const p = posRef.current;
      if (p) saveAssistantPosition(p);
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", stopDrag, { passive: true });
    window.addEventListener("pointercancel", stopDrag, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    };
  }, [embedded]);

  // Keep the assistant inside viewport as its content size changes while chatting.
  useEffect(() => {
    if (embedded) return;
    if (!open) return;
    if (!posRef.current) return;

    const rectify = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      const w = rect?.width || 0;
      const h = rect?.height || 0;
      const pad = 8;
      const maxX = Math.max(pad, window.innerWidth - w - pad);
      const maxY = Math.max(pad, window.innerHeight - h - pad);
      const current = posRef.current;
      const clamped = {
        x: clamp(current.x, pad, maxX),
        y: clamp(current.y, pad, maxY),
      };
      if (clamped.x !== current.x || clamped.y !== current.y) {
        posRef.current = clamped;
        setPos(clamped);
        saveAssistantPosition(clamped);
      }
    };

    const raf = requestAnimationFrame(rectify);
    window.addEventListener("resize", rectify, { passive: true });
    let ro = null;
    if (typeof ResizeObserver !== "undefined" && rootRef.current) {
      ro = new ResizeObserver(() => {
        rectify();
      });
      ro.observe(rootRef.current);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", rectify);
      if (ro) ro.disconnect();
    };
  }, [embedded, open, chat.length, loading, hotelOptions.length, roomOptions.length, Boolean(pickDialog), Boolean(confirmDraft)]);

  function startDrag(e) {
    if (embedded) return;
    // Only allow dragging while the panel is open.
    if (!open) return;
    if (e.button != null && e.button !== 0) return;

    const target = e.target;
    const isHandle =
      target instanceof Element &&
      Boolean(target.closest("[data-assistant-drag-handle='true']"));
    if (!isHandle) return;

    // Avoid starting drag when interacting with controls.
    if (
      target instanceof Element &&
      target.closest("input, textarea, select, button, a") &&
      !target.closest("[data-assistant-drag-handle='true']")
    ) {
      return;
    }

    const existing = posRef.current;
    const fromRect =
      existing ||
      (() => {
        const rect = rootRef.current?.getBoundingClientRect();
        if (!rect) return null;
        return { x: rect.left, y: rect.top };
      })();
    if (!fromRect) return;

    // If we were in default bottom-right mode, lock into left/top now.
    if (!existing) {
      posRef.current = fromRect;
      setPos(fromRect);
    }

    const d = dragRef.current;
    d.active = true;
    d.pointerId = e.pointerId;
    d.startClientX = e.clientX;
    d.startClientY = e.clientY;
    d.startX = fromRect.x;
    d.startY = fromRect.y;
    d.moved = false;
    setDragging(true);
  }

  useEffect(() => {
    const wasAuthenticated = wasAuthenticatedRef.current;
    const isAuthenticated = Boolean(auth.isAuthenticated);
    if (wasAuthenticated && !isAuthenticated) {
      setContext({});
      setChat([]);
      setConfirmDraft(null);
      setHotelOptions([]);
      setRoomOptions([]);
      setSelectedRoomOptionId(null);
      setAssistantPickerDismissed(false);
      setGuideEnabled(false);
      setPendingCitySuggestion(null);
      saveMemory({ context: {}, history: [] });
    }
    wasAuthenticatedRef.current = isAuthenticated;
  }, [auth.isAuthenticated]);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
        inputRef.current?.focus();
      });
    }
  }, [open]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const hasPageScopedSearch =
      ["name", "city", "country", "from", "to", "guests", "adults", "children"].some((key) => Boolean(params.get(key))) ||
      Boolean(context?.city || context?.checkIn || context?.checkOut || Number(context?.guests || 0) > 0);
    const shouldSyncWithHotelsPage =
      open &&
      !loading &&
      !confirmDraft &&
      hotelOptions.length > 0 &&
      !Number(context?.selectedHotelId || 0) &&
      location.pathname === "/hotels";
    if (!shouldSyncWithHotelsPage) return;

    let cancelled = false;

    (async () => {
      try {
        const resp = await bookingApi.listHotels({
          city,
          from,
          to,
          guests,
          checkInDate: from,
          checkOutDate: to,
          page,
          size,
        });
        const list = resp?.content || [];
        if (cancelled || !Array.isArray(list) || list.length === 0) return;
        setHotelOptions(list.map(toHotelOption).filter((hotel) => hotel.id > 0 && hotel.name));
      } catch {
        // Keep existing options if page-sync request fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    loading,
    confirmDraft,
    hotelOptions.length,
    context?.selectedHotelId,
    context?.city,
    context?.checkIn,
    context?.checkOut,
    context?.guests,
    location.pathname,
    location.search,
  ]);


  function pushTurn(role, content, nextChat = chat, contextOverride = context) {
    const updated = [...nextChat, { role, content }];
    setChat(updated);
    saveMemory({ context: contextOverride || {}, history: updated, ui: { guideEnabled } });
    queueMicrotask(() => {
      scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
    });
    return updated;
  }

  async function showHotelsFromBrowseIntent(normalizedText, chatWithUserTurn) {
    const cityFromText = extractExplicitCity(normalizedText);
    const contextCity = context?.anyCity ? "" : (context?.city || "");
    const browseAll = isAnyCityIntent(normalizedText) || (!cityFromText && !contextCity);
    const city = browseAll ? null : (cityFromText || contextCity);
    const nextContext = {
      ...context,
      city,
      anyCity: browseAll,
      selectedHotelId: null,
      selectedHotelName: null,
      selectedRoomTypeId: null,
      selectedRoomTypeName: null,
      pendingHotelName: null,
    };

    const params = {
      city: browseAll ? undefined : city,
      from: nextContext.checkIn || undefined,
      to: nextContext.checkOut || undefined,
      checkInDate: nextContext.checkIn || undefined,
      checkOutDate: nextContext.checkOut || undefined,
      guests: Number(nextContext.guests || 0) > 0 ? Number(nextContext.guests) : undefined,
      page: 0,
      size: HOTELS_PAGE_SIZE,
    };
    const response = await bookingApi.listHotels(params);
    const options = (response?.content || []).map(toHotelOption).filter((hotel) => hotel.id > 0 && hotel.name);

    const q = new URLSearchParams();
    if (!browseAll && city) q.set("city", city);
    if (nextContext.checkIn) q.set("from", nextContext.checkIn);
    if (nextContext.checkOut) q.set("to", nextContext.checkOut);
    if (Number(nextContext.guests || 0) > 0) q.set("guests", String(Number(nextContext.guests)));

    updateBookingUi({
      city: browseAll ? "" : city,
      checkInDate: nextContext.checkIn || "",
      checkOutDate: nextContext.checkOut || "",
      guests: Number(nextContext.guests || 1),
    });
    navigate(`/hotels${q.toString() ? `?${q.toString()}` : ""}`);

    setContext(nextContext);
    setConfirmDraft(null);
    setHotelOptions(options);
    setRoomOptions([]);
    setPendingCitySuggestion(null);
    saveMemory({ context: nextContext, history: chatWithUserTurn, ui: { guideEnabled } });

    const place = browseAll ? "all cities" : city;
    const reply =
      options.length > 0
        ? `Sure. I found ${options.length} hotel${options.length === 1 ? "" : "s"} for ${place}. Choose one from the options below.`
        : `I could not find hotels for ${place} right now. Try another city or different filters.`;
    pushTurn("assistant", reply, chatWithUserTurn, nextContext);
  }

  async function prepareBookingFromAction(action, recommendations, userText) {
    const rawCity = action?.city || context?.city;
    const city = resolveCityBilingual(rawCity);
    let checkIn = action?.checkIn || context?.checkIn || null;
    let checkOut = action?.checkOut || context?.checkOut || null;
    const guests = Number(action?.guests || context?.guests || 0);
    if (!checkIn || !checkOut || guests <= 0) {
      throw new Error("Before choosing room type, please provide check-in, check-out, and number of guests.");
    }
    if (isIsoOnOrBefore(checkOut, checkIn)) {
      checkOut = addDaysIso(checkIn, 1);
    }

    let hotelId = action?.hotelId || context?.selectedHotelId || null;
    let hotelName = action?.hotelName || context?.selectedHotelName || null;

    const pickIndex = parseUserPickIndex(userText);
    if (!hotelId && !hotelName && Array.isArray(recommendations) && recommendations.length && typeof pickIndex === "number") {
      if (pickIndex >= 0 && pickIndex < recommendations.length) {
        hotelId = recommendations[pickIndex].hotelId;
        hotelName = recommendations[pickIndex].hotelName;
      }
    }

    if (!hotelId && hotelName) {
      const resp = await bookingApi.listHotels({ name: hotelName, page: 0, size: 5 });
      const list = resp?.content || [];
      if (list.length === 1) {
        hotelId = list[0].id;
      } else if (!list.length) {
        const broad = await bookingApi.listHotels({
          city: city || undefined,
          page: 0,
          size: 50,
        });
        const broadList = broad?.content || [];
        const bestMatch = findBestHotelNameMatch(broadList, hotelName);
        if (bestMatch?.id) {
          hotelId = bestMatch.id;
          hotelName = bestMatch.name;
        }
      } else if (list.length > 1) {
        const bestMatch = findBestHotelNameMatch(list, hotelName);
        if (bestMatch?.id) {
          hotelId = bestMatch.id;
          hotelName = bestMatch.name;
        } else {
          throw new Error("I found multiple hotels with that name. Please choose the exact hotel from the list.");
        }
      }
    }

    if (!hotelId && city) {
      const resp = await bookingApi.listHotels({ city, page: 0, size: 5 });
      const list = resp?.content || [];
      if (!list.length) {
        throw new Error(`No hotels found in ${city}. Try another city or dates.`);
      }
      throw new Error("Please choose a hotel from the available options before I continue.");
    }

    if (!hotelId) {
      throw new Error("I need a city or a selected hotel to proceed with booking.");
    }

    const query = new URLSearchParams();
    if (city) query.set("city", city);
    if (checkIn) query.set("from", checkIn);
    if (checkOut) query.set("to", checkOut);
    query.set("guests", String(guests));
    updateBookingUi({
      city: city || "",
      checkInDate: checkIn,
      checkOutDate: checkOut,
      guests,
    });
    console.info("[BookingUi] AI updated dates/city", { city, checkIn, checkOut, guests });
    // Go directly to the selected hotel's details for the booking flow.
    navigate(`/hotels/${hotelId}?${query.toString()}`);

    const [hotel, rooms] = await Promise.all([
      bookingApi.getHotel(hotelId),
      bookingApi.getRoomTypes(hotelId),
    ]);
    const validRooms = (rooms || []).filter((r) => isValidRoomName(r?.name));
    const roomTypeId = Number(action?.roomTypeId || context?.selectedRoomTypeId || 0);
    if (!roomTypeId) {
      throw new Error("Please choose a room type before I prepare the booking.");
    }
    const room = validRooms.find((r) => Number(r.id) === roomTypeId) || null;
    if (!room) {
      throw new Error("That room type is not available here. Please choose one of the room types listed for this hotel.");
    }
    if (Number(room.capacity || 0) < guests) {
      throw new Error(
        `That room (${room.name}) only holds up to ${room.capacity} guest(s). Pick a room that fits ${guests} guest(s) from the options below.`,
      );
    }

    const quote = await bookingApi.checkAvailability({
      roomTypeId: room.id,
      checkIn,
      checkOut,
      numberOfGuests: guests,
    });

    if (!quote?.available) {
      throw new Error("The selected room is not available for those dates. You can ask me for alternatives.");
    }

    return {
      hotel,
      room,
      quote,
      checkIn,
      checkOut,
      guests,
      paymentMethod: null,
    };
  }

  async function sendMessage(overrideText) {
    const text = (overrideText ?? message).trim();
    if (!text || loading) return;
    if (isResetChatIntent(text)) {
      resetConversation();
      setMessage("");
      if (open) {
        pushTurn("assistant", "Chat reset. You can start again anytime.", [], {});
      }
      return;
    }
    if (shouldShowGuide(text)) {
      startGuidedFlow({ userText: text });
      setMessage("");
      return;
    }
    // Normalize shorthand dates ("7-5" → "2026-05-07") before processing or sending to backend.
    const normalizedText = normalizeDateInput(text);
    const userMeansAnyCity = isAnyCityIntent(normalizedText);
    setMessage("");
    const withUser = pushTurn("user", text);
    if (
      !guideEnabled &&
      pendingCitySuggestion &&
      !context?.city &&
      !context?.anyCity &&
      !Number(context?.selectedHotelId || 0)
    ) {
      if (isAffirmativeIntent(normalizedText)) {
        const nextContext = { ...context, city: pendingCitySuggestion, anyCity: false };
        setPendingCitySuggestion(null);
        setContext(nextContext);
        setHotelOptions([]);
        setRoomOptions([]);
        saveMemory({ context: nextContext, history: withUser });
        navigateWithContext({ navigate, updateBookingUi, ctx: nextContext, fallbackGuests: 1 });
        const missingMsg = getMissingDatesGuestsMessage(nextContext) ||
          "Please share your check-in date, check-out date, and number of guests.";
        pushTurn("assistant", `City set to ${nextContext.city}. ${missingMsg}`, withUser, nextContext);
        return;
      }
      if (isNegativeIntent(normalizedText)) {
        setPendingCitySuggestion(null);
        pushTurn("assistant", "No problem. Type the city again, or say: any city.", withUser, context);
        return;
      }
      setPendingCitySuggestion(null);
    }
    if (!guideEnabled && isCasualGreetingIntent(normalizedText)) {
      pushTurn("assistant", greetingReply(), withUser, context);
      return;
    }
    setLoading(true);

    try {
      if (isBrowseHotelsIntent(normalizedText)) {
        await showHotelsFromBrowseIntent(normalizedText, withUser);
        return;
      }

      // ── Guided flow (local step-by-step; no backend chat) ─────────────────────
      if (guideEnabled) {
        // ── City correction: handle at any stage so the user can always fix their city ──
        const cityCorrectionGuide = extractCityCorrection(normalizedText);
        if (cityCorrectionGuide) {
          setPendingCitySuggestion(null);
          const nextContext = {
            ...context,
            city: cityCorrectionGuide,
            anyCity: false,
            selectedHotelId: null,
            selectedHotelName: null,
            selectedRoomTypeId: null,
            selectedRoomTypeName: null,
          };
          setContext(nextContext);
          setHotelOptions([]);
          setRoomOptions([]);
          setConfirmDraft(null);
          saveMemory({ context: nextContext, history: withUser });
          navigateWithContext({ navigate, updateBookingUi, ctx: nextContext, fallbackGuests: 1 });
          const missingMsg = getMissingDatesGuestsMessage(nextContext) ||
            "Please provide your check-in date, check-out date, and number of guests.";
          pushTurn("assistant", `City updated to ${cityCorrectionGuide}. ${missingMsg}`, withUser, nextContext);
          return;
        }

        const hasHotel = Number(context?.selectedHotelId || 0) > 0;
        const hasCity = Boolean(context?.city || context?.anyCity);
        const hasDates = Boolean(context?.checkIn && context?.checkOut);
        const hasGuests = Number(context?.guests || 0) > 0;
        const canSearchHotelByName = hasCity && hasDates && hasGuests && !hasHotel;

        // Guest correction after step 2 is complete (dates + guests already set).
        if (!hasHotel && hasDates && hasGuests) {
          const correctedGuests = extractGuestsCount(normalizedText);
          const previousGuests = Number(context?.guests || 0);
          const looksLikeCorrection =
            /^\s*\d{1,2}\s*$/.test(normalizedText) ||
            /\b(i\s*mean|sorry|no\s*,?\s*i\s*mean)\b/i.test(normalizedText) ||
            /\bguest|guests|people|person\b/i.test(normalizedText);
          if (correctedGuests && correctedGuests !== previousGuests && looksLikeCorrection) {
            const nextContext = { ...context, guests: correctedGuests };
            setContext(nextContext);
            saveMemory({ context: nextContext, history: withUser });

            const q = new URLSearchParams();
            if (!nextContext.anyCity && nextContext.city) q.set("city", nextContext.city);
            q.set("from", nextContext.checkIn);
            q.set("to", nextContext.checkOut);
            q.set("guests", String(correctedGuests));
            navigate(`/hotels?${q.toString()}`);

            const options = await fetchHotelOptionsForContext(nextContext);
            setHotelOptions(options);
            setRoomOptions([]);
            pushTurn(
              "assistant",
              options.length
                ? `Got it — ${correctedGuests} guest(s). Step 3: choose a hotel from the options below.`
                : `Got it — ${correctedGuests} guest(s). I couldn't find hotels with these filters. Try different dates or another city.`,
              withUser,
              nextContext,
            );
            return;
          }
        }

        if (pendingCitySuggestion && !hasCity && !hasHotel) {
          if (isAffirmativeIntent(normalizedText)) {
            const resolved = pendingCitySuggestion;
            const nextContext = { ...context, city: resolved, anyCity: false };
            setPendingCitySuggestion(null);
            setContext(nextContext);
            saveMemory({ context: nextContext, history: withUser });
            navigateWithContext({ navigate, updateBookingUi, ctx: nextContext, fallbackGuests: 1 });
            setHotelOptions([]);
            setRoomOptions([]);
            pushTurn(
              "assistant",
              systemLang === "ar"
                ? `تم حفظ الخطوة 1 — المدينة: ${resolved}. الخطوة 2: اختر التواريخ وعدد الضيوف من الحقول أدناه أو اكتبها.`
                : `Step 1 saved. City: ${resolved}. Step 2: choose check-in, check-out, and guests using the pickers below — or type them.`,
              withUser,
              nextContext,
            );
            return;
          }
          if (isNegativeIntent(normalizedText)) {
            setPendingCitySuggestion(null);
            pushTurn("assistant", "No problem. Type the city again, or say: any city.", withUser, context);
            return;
          }
          setPendingCitySuggestion(null);
        }

        if (!hasHotel && extractHotelNameIntent(normalizedText) && !canSearchHotelByName) {
          pushTurn(
            "assistant",
            "Let’s stay in order: city first, then dates and guests, then hotel and room.",
            withUser,
            context,
          );
          return;
        }

        if (canSearchHotelByName) {
          const hotelNameIntent = extractHotelNameIntent(normalizedText);
          if (hotelNameIntent) {
            const q = new URLSearchParams();
            q.set("name", hotelNameIntent);
            if (context?.city && !context?.anyCity) q.set("city", context.city);
            if (context?.checkIn) q.set("from", context.checkIn);
            if (context?.checkOut) q.set("to", context.checkOut);
            if (Number(context?.guests || 0) > 0) q.set("guests", String(Number(context.guests)));
            navigate(`/hotels?${q.toString()}`);

            const resp = await bookingApi.listHotels({
              name: hotelNameIntent,
              city: context?.city && !context?.anyCity ? context.city : undefined,
              from: context?.checkIn || undefined,
              to: context?.checkOut || undefined,
              checkInDate: context?.checkIn || undefined,
              checkOutDate: context?.checkOut || undefined,
              guests: Number(context?.guests || 1) || 1,
              page: 0,
              size: HOTELS_PAGE_SIZE,
            });
            const list = resp?.content || [];
            const options = list.map(toHotelOption).filter((h) => h.id > 0 && h.name);
            if (options.length === 0) {
              pushTurn("assistant", `I couldn't find a hotel named "${hotelNameIntent}". Please check the spelling.`, withUser);
              return;
            }
            if (options.length > 1) {
              setHotelOptions(options);
              setRoomOptions([]);
              pushTurn("assistant", `I found ${options.length} matching hotels on this page. Choose one below.`, withUser);
              return;
            }
            await selectHotelLocally(options[0], withUser);
            return;
          }
        }

        // Step 1: city (or any city)
        if (!hasCity && !hasHotel) {
          const any = isAnyCityIntent(normalizedText);
          if (!any && isUnsureIntent(normalizedText)) {
            pushTurn(
              "assistant",
              "No problem. If you are not sure about city, just say: any city. Then I will show available hotels in Palestine.",
              withUser,
              context,
            );
            return;
          }
          const cityMatch = any ? { status: "exact", city: "" } : matchCityBilingual(normalizedText);
          if (!any && cityMatch.status === "suggested") {
            setPendingCitySuggestion(cityMatch.city);
            pushTurn(
              "assistant",
              `I couldn't find "${normalizedText}" as a city in Palestine. Did you mean ${cityMatch.city}?`,
              withUser,
              context,
            );
            return;
          }
          const resolved = any ? "" : (cityMatch.city || extractKnownCityFromText(normalizedText));
          if (!any && !resolved) {
            setPendingCitySuggestion(null);
            pushTurn(
              "assistant",
              `There is no city called "${normalizedText}" in Palestine. Please enter a valid city like Bethlehem, Jerusalem, Ramallah, Nablus, Hebron, or Gaza.`,
              withUser,
              context,
            );
            return;
          }

          const nextContext = { ...context, city: resolved || "", anyCity: any };
          setPendingCitySuggestion(null);
          setContext(nextContext);
          saveMemory({ context: nextContext, history: withUser });
          navigateWithContext({ navigate, updateBookingUi, ctx: nextContext, fallbackGuests: 1 });
          setHotelOptions([]);
          setRoomOptions([]);

          pushTurn(
            "assistant",
            systemLang === "ar"
              ? `تم حفظ الخطوة 1. ${any ? "أي مدينة مناسبة." : `المدينة: ${resolved}.`} الخطوة 2: اختر التواريخ وعدد الضيوف من الحقول أدناه أو اكتبها.`
              : `Step 1 saved. ${any ? "Any city is fine." : `City: ${resolved}.`} Step 2: choose check-in, check-out, and guests using the pickers below — or type them.`,
            withUser,
            nextContext,
          );
          return;
        }

        // Step 2: dates + guests (one step; matches date/guest pickers in the panel)
        if (!hasHotel && hasCity && (!hasDates || !hasGuests)) {
          const resolvedDates = resolveCheckInOutFromUserText(normalizedText, todayIso);
          const guestsFromText = extractGuestsCount(normalizedText);

          let checkIn = context.checkIn;
          let checkOut = context.checkOut;
          if (resolvedDates) {
            let cin = resolvedDates.checkIn;
            let cout = resolvedDates.checkOut;
            if (new Date(cout) <= new Date(cin)) {
              const d = new Date(cin);
              d.setDate(d.getDate() + 1);
              cout = d.toISOString().slice(0, 10);
            }
            checkIn = cin;
            checkOut = cout;
          }

          let guests = Number(context.guests) || 0;
          if (guestsFromText) guests = guestsFromText;

          const hasD = Boolean(checkIn && checkOut);
          const hasG = Number(guests) > 0;

          if (resolvedDates && hasD && !hasG) {
            const partial = { ...context, checkIn, checkOut };
            setContext(partial);
            saveMemory({ context: partial, history: withUser });
            navigateWithContext({ navigate, updateBookingUi, ctx: partial, fallbackGuests: 1 });
            setHotelOptions([]);
            setRoomOptions([]);
            pushTurn(
              "assistant",
              systemLang === "ar"
                ? "تم حفظ التواريخ. اختر عدد الضيوف من الشريط أدناه أو اكتب العدد (مثال: 3)."
                : "Dates saved. Choose the number of guests with the slider below, or say how many (e.g. 3).",
              withUser,
              partial,
            );
            return;
          }

          if (guestsFromText && hasG && !hasD) {
            const partial = { ...context, guests };
            setContext(partial);
            saveMemory({ context: partial, history: withUser });
            navigateWithContext({ navigate, updateBookingUi, ctx: partial, fallbackGuests: guests });
            setHotelOptions([]);
            setRoomOptions([]);
            pushTurn(
              "assistant",
              systemLang === "ar"
                ? "تم حفظ عدد الضيوف. اختر تواريخ الدخول والخروج في الأعلى أو اكتبها."
                : "Guest count saved. Pick check-in and check-out above, or type your dates.",
              withUser,
              partial,
            );
            return;
          }

          if (!hasD) {
            pushTurn(
              "assistant",
              systemLang === "ar"
                ? "رجاءً حدد تاريخي الدخول والخروج في الحقول أدناه، أو اكتب تاريخين بصيغة YYYY-MM-DD."
                : "Please choose check-in and check-out using the fields below, or type two dates (YYYY-MM-DD).",
              withUser,
            );
            return;
          }
          if (!hasG) {
            pushTurn(
              "assistant",
              systemLang === "ar"
                ? "رجاءً اختر عدد الضيوف من الشريط أدناه، أو اكتب العدد (مثال: 3 ضيوف)."
                : "Please choose the number of guests with the slider below, or say the count (e.g. 3 guests).",
              withUser,
            );
            return;
          }

          const nextContext = { ...context, checkIn, checkOut, guests };
          setContext(nextContext);
          saveMemory({ context: nextContext, history: withUser });
          navigateWithContext({ navigate, updateBookingUi, ctx: nextContext, fallbackGuests: guests });

          const q = new URLSearchParams();
          if (!nextContext?.anyCity && nextContext?.city) q.set("city", nextContext.city);
          q.set("from", nextContext.checkIn);
          q.set("to", nextContext.checkOut);
          q.set("guests", String(guests));
          navigate(`/hotels?${q.toString()}`);

          const options = await fetchHotelOptionsForContext(nextContext);
          setHotelOptions(options);
          setRoomOptions([]);

          pushTurn(
            "assistant",
            options.length
              ? systemLang === "ar"
                ? "تم حفظ الخطوة 2 (التواريخ والضيوف). الخطوة 3: اختر فندقاً من الخيارات أدناه."
                : "Step 2 saved (dates & guests). Step 3: choose a hotel from the options below."
              : systemLang === "ar"
                ? "لم أجد فنادق بهذه المعايير. جرّب تواريخ أو عدد ضيوف مختلفاً، أو مدينة أخرى."
                : "I couldn't find hotels with these filters. Try different dates, guests, or another city.",
            withUser,
            nextContext,
          );
          return;
        }

        // Step 3: ensure hotel options are visible once city + dates + guests are set
        if (!hasHotel) {
          const options = await fetchHotelOptionsForContext(context);
          setHotelOptions(options);
          setRoomOptions([]);
          pushTurn(
            "assistant",
            options.length
              ? systemLang === "ar"
                ? "الخطوة 3: اختر فندقاً من الخيارات أدناه."
                : "Step 3: choose a hotel from the options below."
              : systemLang === "ar"
                ? "لم يُعثر على فنادق. جرّب تغيير التواريخ أو الضيوف."
                : "No hotels found. Try changing dates or guests.",
            withUser,
          );
          return;
        }

        // Steps 4–5: room selection + confirm / payment (existing UI).
      }

      if (
        userMeansAnyCity &&
        !context?.city &&
        !Number(context?.selectedHotelId || 0)
      ) {
        const nextContext = { ...context, anyCity: true };
        const hasDatesGuests =
          Boolean(nextContext?.checkIn) &&
          Boolean(nextContext?.checkOut) &&
          Number(nextContext?.guests || 0) > 0;
        if (hasDatesGuests) {
          const resp = await bookingApi.listHotels({
            from: nextContext.checkIn,
            to: nextContext.checkOut,
            checkInDate: nextContext.checkIn,
            checkOutDate: nextContext.checkOut,
            guests: Number(nextContext.guests),
            page: 0,
            size: 10,
          });
          const list = resp?.content || [];
          setContext(nextContext);
          saveMemory({ context: nextContext, history: withUser });
          setHotelOptions(list.map(toHotelOption).filter((hotel) => hotel.id > 0 && hotel.name));
          setRoomOptions([]);
          if (list.length > 0) {
            pushTurn(
              "assistant",
              `Perfect. I found hotels across Palestine for ${nextContext.guests} guest(s), ${nextContext.checkIn} to ${nextContext.checkOut}. Please choose a hotel from the options below.`,
              withUser,
              nextContext,
            );
          } else {
            pushTurn(
              "assistant",
              `I couldn't find hotels for ${nextContext.guests} guest(s), ${nextContext.checkIn} to ${nextContext.checkOut}. Try different dates or guests.`,
              withUser,
              nextContext,
            );
          }
          return;
        }
        setContext(nextContext);
        saveMemory({ context: nextContext, history: withUser });
        setHotelOptions([]);
        setRoomOptions([]);
        pushTurn(
          "assistant",
          "Great, any city works. Tell me your check-in date, check-out date, and number of guests.",
          withUser,
          nextContext,
        );
        return;
      }

      if (
        isUnsureIntent(normalizedText) &&
        !context?.city &&
        !context?.anyCity &&
        !Number(context?.selectedHotelId || 0)
      ) {
        const nextContext = { ...context, anyCity: true, city: "" };
        setContext(nextContext);
        saveMemory({ context: nextContext, history: withUser });
        navigateWithContext({ navigate, updateBookingUi, ctx: nextContext, fallbackGuests: 1 });
        pushTurn(
          "assistant",
          "No problem — I will search across any city in Palestine. Now tell me your check-in, check-out, and number of guests.",
          withUser,
          nextContext,
        );
        return;
      }

      if (isCapacityIntent(normalizedText) && !guideEnabled) {
        const guests = extractGuestsCount(normalizedText);
        if (guests) {
          const explicitCity = extractExplicitCity(normalizedText);
          const nextContext = {
            ...context,
            city: explicitCity || context?.city || "",
            anyCity: explicitCity ? false : context?.anyCity,
            guests,
          };
          setContext(nextContext);
          saveMemory({ context: nextContext, history: withUser });
          navigateWithContext({ navigate, updateBookingUi, ctx: nextContext, fallbackGuests: guests });
          if (nextContext?.checkIn && nextContext?.checkOut) {
            const refreshed = await fetchHotelOptionsForContext(nextContext);
            setHotelOptions(refreshed);
            setRoomOptions([]);
          }
          const missingMsg =
            getMissingDatesGuestsMessage(nextContext) ||
            "Please provide your city, check-in date, and check-out date.";
          pushTurn(
            "assistant",
            `Got it — you need a hotel for ${guests} guests. ${missingMsg}`,
            withUser,
            nextContext,
          );
          return;
        }
      }

      // ── "Another hotel" intent ─────────────────────────────────────────────────
      if (isChangeHotelIntent(normalizedText)) {
        const nextContext = {
          ...context,
          selectedHotelId: null,
          selectedHotelName: null,
          selectedRoomTypeId: null,
          selectedRoomTypeName: null,
        };
        setContext(nextContext);
        setConfirmDraft(null);
        setRoomOptions([]);
        saveMemory({ context: nextContext, history: withUser });
        const hasCity = Boolean(nextContext.city || nextContext.anyCity);
        const hasDatesGuests =
          Boolean(nextContext.checkIn) && Boolean(nextContext.checkOut) && Number(nextContext.guests || 0) > 0;
        if (hasCity && hasDatesGuests) {
          const q = new URLSearchParams();
          if (!nextContext.anyCity && nextContext.city) q.set("city", nextContext.city);
          q.set("from", nextContext.checkIn);
          q.set("to", nextContext.checkOut);
          q.set("guests", String(Number(nextContext.guests)));
          navigate(`/hotels?${q.toString()}`);
          const hotelsResp = await bookingApi.listHotels({
            city: nextContext.anyCity ? undefined : nextContext.city,
            from: nextContext.checkIn,
            to: nextContext.checkOut,
            checkInDate: nextContext.checkIn,
            checkOutDate: nextContext.checkOut,
            guests: Number(nextContext.guests),
            page: 0,
            size: 10,
          });
          const hotelsList = hotelsResp?.content || [];
          setHotelOptions(hotelsList.map(toHotelOption).filter((h) => h.id > 0 && h.name));
          const cityLabel = nextContext.city || "your selected area";
          pushTurn(
            "assistant",
            hotelsList.length > 0
              ? `Sure! Here are the available hotels in ${cityLabel}. Which one would you like?`
              : `No other hotels found in ${cityLabel} for those dates. Try different dates or guests.`,
            withUser,
            nextContext,
          );
        } else if (!hasCity) {
          setHotelOptions([]);
          pushTurn("assistant", "Which city would you like to stay in?", withUser, nextContext);
        } else {
          setHotelOptions([]);
          pushTurn("assistant", getMissingDatesGuestsMessage(nextContext) || "Please provide your check-in date, check-out date, and number of guests.", withUser, nextContext);
        }
        return;
      }

      if (isChangeRoomIntent(normalizedText) && Number(context?.selectedHotelId || 0) > 0) {
        const hid = Number(context.selectedHotelId);
        const nextContext = {
          ...context,
          selectedRoomTypeId: null,
          selectedRoomTypeName: null,
        };
        setContext(nextContext);
        setConfirmDraft(null);
        setSelectedRoomOptionId(null);
        saveMemory({ context: nextContext, history: withUser });

        const q = new URLSearchParams();
        if (nextContext.city) q.set("city", nextContext.city);
        if (nextContext.checkIn) q.set("from", nextContext.checkIn);
        if (nextContext.checkOut) q.set("to", nextContext.checkOut);
        if (Number(nextContext.guests || 0) > 0) q.set("guests", String(Number(nextContext.guests)));
        navigate(`/hotels/${hid}?${q.toString()}#room-types`, {
          state: { intent: { hotelId: hid, fromAssistant: true } },
        });

        try {
          const rooms = await bookingApi.getRoomTypes(hid);
          const validRooms = (rooms || []).filter((r) => isValidRoomName(r?.name));
          setRoomOptions(validRooms);
          const hotelLabel = nextContext.selectedHotelName || "this hotel";
          pushTurn(
            "assistant",
            validRooms.length
              ? `No problem — let's pick another room at ${hotelLabel}. Choose one from the options below.`
              : `No problem — but I couldn't find room types for ${hotelLabel}. Try another hotel.`,
            withUser,
            nextContext,
          );
        } catch (err) {
          pushTurn("assistant", humanizeError(err), withUser, nextContext);
        }
        return;
      }

      // ── Plain number while guests missing: interpret as guest count, not hotel #
      // (Otherwise "1" after "Got it — I just need your number of guests" picks hotel #1.)
      if (
        !isChangeHotelIntent(normalizedText) &&
        guestsMissing(context) &&
        Boolean(context?.checkIn && context?.checkOut) &&
        Boolean(context?.city || context?.anyCity) &&
        isPlainGuestCountDigits(normalizedText)
      ) {
        const guests = extractGuestsCount(normalizedText);
        if (guests) {
          const nextContext = { ...context, guests };
          setContext(nextContext);
          saveMemory({ context: nextContext, history: withUser });

          if (Number(nextContext.selectedHotelId || 0) > 0) {
            const hotelId = Number(nextContext.selectedHotelId);
            const q = new URLSearchParams();
            if (nextContext.city) q.set("city", nextContext.city);
            if (nextContext.checkIn) q.set("from", nextContext.checkIn);
            if (nextContext.checkOut) q.set("to", nextContext.checkOut);
            q.set("guests", String(guests));
            updateBookingUi({
              city: nextContext.city || "",
              checkInDate: nextContext.checkIn,
              checkOutDate: nextContext.checkOut,
              guests,
            });
            navigate(`/hotels/${hotelId}?${q.toString()}#room-types`, {
              state: { intent: { hotelId, fromAssistant: true } },
            });
            setHotelOptions([]);
            try {
              const rooms = await bookingApi.getRoomTypes(hotelId);
              const validRooms = (rooms || []).filter((r) => isValidRoomName(r?.name));
              setRoomOptions(validRooms);
              const hotelLabel = nextContext.selectedHotelName || "the hotel";
              if (validRooms.length > 0) {
                const options = validRooms.map(
                  (r, idx) =>
                    `${idx + 1}) ${r.name} — ${money(r.basePrice)} (up to ${r.capacity} guest${Number(r.capacity) !== 1 ? "s" : ""})`,
                );
                pushTurn(
                  "assistant",
                  `Guests: ${guests}. You've selected ${hotelLabel}. Here are the available room types:\n${options.join("\n")}\nWhich room would you like?`,
                  withUser,
                  nextContext,
                );
              } else {
                pushTurn(
                  "assistant",
                  `Guests: ${guests}. You've selected ${hotelLabel}, but no room types are listed right now.`,
                  withUser,
                  nextContext,
                );
              }
            } catch (err) {
              pushTurn("assistant", humanizeError(err), withUser, nextContext);
            }
            return;
          }

          const q = new URLSearchParams();
          if (!nextContext.anyCity && nextContext.city) q.set("city", nextContext.city);
          q.set("from", nextContext.checkIn);
          q.set("to", nextContext.checkOut);
          q.set("guests", String(guests));
          navigate(`/hotels?${q.toString()}`);
          const options = await fetchHotelOptionsForContext(nextContext);
          setHotelOptions(options);
          setRoomOptions([]);
          pushTurn(
            "assistant",
            options.length
              ? `Guests saved (${guests}). Choose a hotel from the options below.`
              : `I couldn't find hotels for ${guests} guest(s) with those dates. Try adjusting dates or city.`,
            withUser,
            nextContext,
          );
          return;
        }
      }

      // ── Hotel selection by text ───────────────────────────────────────────────
      // When hotel buttons are visible, typing a number or a name picks the hotel
      // instantly — no AI call, hotel buttons cleared, room types shown immediately.
      if (hotelOptions.length > 0 && !isChangeHotelIntent(normalizedText)) {
        const pickedHotel = pickHotelByText(normalizedText, hotelOptions);
        if (pickedHotel) {
          await selectHotelLocally(pickedHotel, withUser);
          return;
        }
      }

      // ── Typed / spoken room pick while options are shown (must match hotel & guest count) ─
      if (
        roomOptions.length > 0 &&
        Number(context?.selectedHotelId || 0) > 0 &&
        !confirmDraft &&
        Boolean(context?.checkIn && context?.checkOut) &&
        Number(context?.guests || 0) > 0 &&
        !isChangeHotelIntent(normalizedText)
      ) {
        const pickedRoom = pickRoomByText(normalizedText, roomOptions);
        if (pickedRoom) {
          const guestsN = Number(context.guests || 0);
          if (Number(pickedRoom.capacity || 0) < guestsN) {
            pushTurn(
              "assistant",
              `"${pickedRoom.name}" holds up to ${pickedRoom.capacity} guest(s), but you need ${guestsN}. Pick a room with enough capacity from the list below.`,
              withUser,
              context,
            );
            return;
          }
          try {
            const nextContext = {
              ...context,
              selectedRoomTypeId: pickedRoom.id,
              selectedRoomTypeName: pickedRoom.name,
            };
            setContext(nextContext);
            saveMemory({ context: nextContext, history: withUser });
            const draft = await prepareBookingFromAction(
              {
                hotelId: nextContext.selectedHotelId,
                hotelName: nextContext.selectedHotelName,
                roomTypeId: pickedRoom.id,
                checkIn: nextContext.checkIn,
                checkOut: nextContext.checkOut,
                guests: guestsN,
              },
              [],
              normalizedText,
            );
            setRoomOptions([]);
            setSelectedRoomOptionId(null);
            setConfirmDraft(draft);
            pushTurn(
              "assistant",
              `Great — ${pickedRoom.name} works for your group.` + duplicateBookingPrepMessage(draft),
              withUser,
              nextContext,
            );
          } catch (err) {
            try {
              const hid = Number(context.selectedHotelId);
              const rooms = await bookingApi.getRoomTypes(hid);
              setRoomOptions((rooms || []).filter((r) => isValidRoomName(r?.name)));
            } catch {
              // keep prior list
            }
            pushTurn("assistant", humanizeError(err), withUser, context);
          }
          return;
        }
      }

      // ── Hotel name intent (no city needed) ───────────────────────────────────
      // In normal chat, always allow changing hotel by name even if one is already selected.
      {
        const hotelNameIntent = extractHotelNameIntent(normalizedText) || extractLooseHotelNameIntent(normalizedText);
        if (hotelNameIntent && !guideEnabled) {
          const explicitCity = extractExplicitCity(normalizedText);
          const searchCity = explicitCity || context?.city || "";
          // Sync the Hotels page search field via URL param.
          {
            const q = new URLSearchParams();
            q.set("name", hotelNameIntent);
            if (searchCity) q.set("city", searchCity);
            if (context?.checkIn) q.set("from", context.checkIn);
            if (context?.checkOut) q.set("to", context.checkOut);
            if (Number(context?.guests || 0) > 0) q.set("guests", String(Number(context.guests)));
            navigate(`/hotels?${q.toString()}`);
          }

          const resp = await bookingApi.listHotels({
            name: hotelNameIntent,
            city: searchCity || undefined,
            from: context?.checkIn || undefined,
            to: context?.checkOut || undefined,
            checkInDate: context?.checkIn || undefined,
            checkOutDate: context?.checkOut || undefined,
            guests: Number(context?.guests || 1) || 1,
            page: 0,
            size: HOTELS_PAGE_SIZE,
          });
          const list = resp?.content || [];
          const options = list.map(toHotelOption).filter((h) => h.id > 0 && h.name);

          if (options.length === 0) {
            const broad = await bookingApi.listHotels({ city: searchCity || undefined, page: 0, size: 80 });
            const broadList = broad?.content || [];
            const broadOptions = broadList.map(toHotelOption).filter((h) => h.id > 0 && h.name);
            const direct = findBestHotelNameMatch(broadOptions, hotelNameIntent);
            if (direct) {
              await selectHotelLocally(direct, withUser);
              return;
            }
            const similar = findSimilarHotelNameMatches(broadOptions, hotelNameIntent, 5);
            if (similar.length > 1) {
              setHotelOptions(similar);
              setRoomOptions([]);
              pushTurn(
                "assistant",
                `I found similar hotels for "${hotelNameIntent}". Please choose one from the options below.`,
                withUser,
              );
              return;
            }
            pushTurn("assistant", `I couldn't find a hotel named "${hotelNameIntent}". Please check the spelling.`, withUser);
            return;
          }

          if (options.length > 1) {
            setHotelOptions(options);
            setRoomOptions([]);
            pushTurn(
              "assistant",
              `I found ${options.length} matching hotels on this page. Please choose one from the options below.`,
              withUser,
            );
            return;
          }

          // Exactly one match: select hotel and ask only for missing booking fields.
          const hotel = options[0];
          const nextContext = {
            ...context,
            selectedHotelId: hotel.id,
            selectedHotelName: hotel.name,
            selectedRoomTypeId: null,
            selectedRoomTypeName: null,
          };
          setContext(nextContext);
          setHotelOptions([]);
          setRoomOptions([]);
          setSelectedRoomOptionId(null);
          saveMemory({ context: nextContext, history: withUser });

          // Navigate to hotel details (room selection needs dates/guests anyway).
          navigate(`/hotels/${hotel.id}`);

          const ask = getMissingDatesGuestsMessage(nextContext) || "Great. Please provide your check-in date, check-out date, and number of guests.";
          pushTurn(
            "assistant",
            `Found it: ${hotel.name}${hotel.city ? ` (${hotel.city})` : ""}. ${ask}`,
            withUser,
            nextContext,
          );
          return;
        }
      }

      const parsedNatural = parseNaturalDateRangeEnhanced(normalizedText, todayIso);
      const contextForChatRequest =
        parsedNatural && (!context.checkIn || !context.checkOut)
          ? { ...context, checkIn: parsedNatural.checkIn, checkOut: parsedNatural.checkOut }
          : context;

      const response = await bookingApi.assistantChat({
        message: normalizedText,
        context: { ...contextForChatRequest, _today: todayIso(), _lang: systemLang },
        history: withUser,
      });

      const nextContext = response?.context || context;
      const normalizedContextCity = String(nextContext?.city || "")
        .toLowerCase()
        .replace(/\s+/g, "");
      const backendUsedAnyCityAsCity =
        normalizedContextCity === "anycity" || normalizedContextCity === "any" || normalizedContextCity === "anything";
      let effectiveContext = backendUsedAnyCityAsCity
        ? { ...nextContext, city: "", anyCity: true }
        : nextContext;

      if (
        parsedNatural?.checkIn &&
        parsedNatural?.checkOut &&
        (!effectiveContext.checkIn || !effectiveContext.checkOut)
      ) {
        effectiveContext = {
          ...effectiveContext,
          checkIn: parsedNatural.checkIn,
          checkOut: parsedNatural.checkOut,
        };
      }
      const correctedCity = extractCityCorrection(normalizedText);
      if (correctedCity) {
        effectiveContext = {
          ...effectiveContext,
          city: correctedCity,
          anyCity: false,
          selectedHotelId: null,
          selectedHotelName: null,
          selectedRoomTypeId: null,
          selectedRoomTypeName: null,
        };
        setHotelOptions([]);
        setRoomOptions([]);
      }
      // ── Context protection ──────────────────────────────────────────────────────
      {
        const prevCity    = context?.city    || "";
        const prevCheckIn  = context?.checkIn  || null;
        const prevCheckOut = context?.checkOut || null;
        const prevGuests   = Number(context?.guests || 0);
        const prevHotelId = Number(context?.selectedHotelId || 0);
        const prevHotelName = context?.selectedHotelName || null;
        const prevRoomId = Number(context?.selectedRoomTypeId || 0);
        const prevRoomName = context?.selectedRoomTypeName || null;
        const explicitNewCity = extractExplicitCity(normalizedText);
        const userChangedCity  = Boolean(explicitNewCity && explicitNewCity !== prevCity);
        if (!effectiveContext.city && prevCity && !userChangedCity && !correctedCity) {
          effectiveContext = { ...effectiveContext, city: prevCity };
        }
        // If the user explicitly typed a new city name, force it in — even if the
        // backend returned the old city in the context (it may lag behind).
        if (userChangedCity && explicitNewCity && !correctedCity) {
          effectiveContext = { ...effectiveContext, city: explicitNewCity };
        }
        if (!effectiveContext.checkIn && prevCheckIn) {
          effectiveContext = { ...effectiveContext, checkIn: prevCheckIn };
        }
        if (!effectiveContext.checkOut && prevCheckOut) {
          effectiveContext = { ...effectiveContext, checkOut: prevCheckOut };
        }
        if (!Number(effectiveContext.guests || 0) && prevGuests > 0) {
          effectiveContext = { ...effectiveContext, guests: prevGuests };
        }

        // Preserve selected hotel/room if backend omitted them (very common when user just answers dates/guests).
        if (!Number(effectiveContext.selectedHotelId || 0) && prevHotelId > 0 && !correctedCity) {
          effectiveContext = {
            ...effectiveContext,
            selectedHotelId: prevHotelId,
            selectedHotelName: effectiveContext?.selectedHotelName || prevHotelName,
          };
        }
        if (!Number(effectiveContext.selectedRoomTypeId || 0) && prevRoomId > 0 && !correctedCity) {
          effectiveContext = {
            ...effectiveContext,
            selectedRoomTypeId: prevRoomId,
            selectedRoomTypeName: effectiveContext?.selectedRoomTypeName || prevRoomName,
          };
        }
      }

      // Reject generic words saved as city names (e.g. user literally typed "city").
      if (effectiveContext.city && !isValidCityName(effectiveContext.city)) {
        effectiveContext = { ...effectiveContext, city: "", anyCity: false };
      }

      setContext(effectiveContext);
      saveMemory({ context: effectiveContext, history: withUser });

      let assistantText = response?.reply || "I processed your request.";
      if (correctedCity) {
        const missingAfterCity = getMissingDatesGuestsMessage({ ...effectiveContext, city: correctedCity }) ||
          "Please provide your check-in date, check-out date, and number of guests.";
        assistantText = `City set to ${correctedCity}. ${missingAfterCity}`;
        setHotelOptions([]);
        setRoomOptions([]);
      }
      setHotelOptions([]);
      let usedSyncedHotelOptions = false;
      if (
        userMeansAnyCity &&
        /which city would you like to stay in\??|in which city would you like to stay\??/i.test(assistantText)
      ) {
        const patchedContext = { ...nextContext, anyCity: true };
        setContext(patchedContext);
        saveMemory({ context: patchedContext, history: withUser });
        assistantText = "Any city is fine. Please share your check-in date, check-out date, and number of guests.";
      }
      if (
        /paris|new york|tokyo|popular cities/i.test(assistantText) &&
        !effectiveContext?.city &&
        !Number(effectiveContext?.selectedHotelId || 0)
      ) {
        const patchedContext = { ...effectiveContext, anyCity: true };
        setContext(patchedContext);
        saveMemory({ context: patchedContext, history: withUser });
        assistantText =
          "We only use hotels in Palestine here. If city does not matter, I will search all available hotels. Please share check-in date, check-out date, and number of guests.";
      }
      if (
        (effectiveContext?.anyCity || userMeansAnyCity) &&
        !effectiveContext?.city &&
        !Number(effectiveContext?.selectedHotelId || 0) &&
        Boolean(effectiveContext?.checkIn) &&
        Boolean(effectiveContext?.checkOut) &&
        Number(effectiveContext?.guests || 0) > 0 &&
        isCityQuestion(assistantText)
      ) {
        const allResp = await bookingApi.listHotels({
          from: effectiveContext.checkIn,
          to: effectiveContext.checkOut,
          checkInDate: effectiveContext.checkIn,
          checkOutDate: effectiveContext.checkOut,
          guests: Number(effectiveContext.guests),
          page: 0,
          size: HOTELS_PAGE_SIZE,
        });
        const allList = allResp?.content || [];
        setHotelOptions(allList.map(toHotelOption).filter((hotel) => hotel.id > 0 && hotel.name));
        usedSyncedHotelOptions = allList.length > 0;
        assistantText =
          allList.length > 0
            ? `I found available hotels across Palestine for ${effectiveContext.guests} guest(s), ${effectiveContext.checkIn} to ${effectiveContext.checkOut}. Please choose one from the options below.`
            : `I couldn't find available hotels for ${effectiveContext.guests} guest(s), ${effectiveContext.checkIn} to ${effectiveContext.checkOut}. Try different dates or guests.`;
      }
      if (
        Array.isArray(response?.recommendations) &&
        response.recommendations.length > 0 &&
        !Number(nextContext?.selectedHotelId || 0)
      ) {
        try {
          const currentPageOptions = await fetchCurrentHotelsPageOptions();
          if (currentPageOptions.length > 0) {
            setHotelOptions(currentPageOptions);
            usedSyncedHotelOptions = true;
            assistantText = `I am showing ${currentPageOptions.length} hotel${currentPageOptions.length === 1 ? "" : "s"} currently on this page. Choose one from the options below.`;
          } else {
            const city = response?.action?.city || nextContext?.city;
            const checkIn = response?.action?.checkIn || nextContext?.checkIn;
            const checkOut = response?.action?.checkOut || nextContext?.checkOut;
            const guests = Number(response?.action?.guests || nextContext?.guests || 1);
            const uiHotelsResp = await bookingApi.listHotels({
              city,
              from: checkIn,
              to: checkOut,
              checkInDate: checkIn,
              checkOutDate: checkOut,
              guests,
              page: 0,
              size: HOTELS_PAGE_SIZE,
            });
            const uiHotels = uiHotelsResp?.content || [];
            const uiMessage = formatHotelChoicesMessage(uiHotels);
            if (uiHotels.length > 0) {
              setHotelOptions(uiHotels.map(toHotelOption).filter((hotel) => hotel.id > 0 && hotel.name));
              usedSyncedHotelOptions = true;
            }
            if (uiMessage) {
              assistantText = uiMessage;
            }
          }
        } catch {
          // Keep backend text if synced list fails.
        }
      }
      if (
        !Number(nextContext?.selectedHotelId || 0) &&
        Array.isArray(response?.recommendations) &&
        response.recommendations.length > 0 &&
        !usedSyncedHotelOptions
      ) {
        setHotelOptions(
          response.recommendations
            .map((rec) => ({
              id: Number(rec.hotelId || 0),
              name: rec.hotelName,
              city: rec.city || "",
              price: Number(rec.pricePerNight ?? rec.price ?? 0),
            }))
            .filter((rec) => rec.id > 0 && rec.name),
        );
      }
      if (response?.action?.type === "NAVIGATE_DISCOVER") {
        const q = new URLSearchParams();
        const selectedHotelId = Number(effectiveContext?.selectedHotelId || 0);
        const city = response.action.city || effectiveContext?.city || "";
        const checkIn = response.action.checkIn || effectiveContext?.checkIn;
        const checkOut = response.action.checkOut || effectiveContext?.checkOut;
        const guests = Number(response.action.guests || effectiveContext?.guests || 1);
        if (city) q.set("city", city);
        if (checkIn) q.set("from", checkIn);
        if (checkOut) q.set("to", checkOut);
        if (guests > 0) q.set("guests", String(guests));
        updateBookingUi({
          city,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          guests,
        });
        if (selectedHotelId > 0) {
          navigate(`/hotels/${selectedHotelId}?${q.toString()}`);
        } else {
          navigate(`/hotels?${q.toString()}`);
        }
      } else if (response?.action?.type === "ASK_ROOM_SELECTION") {
        const hotelId = Number(response?.action?.hotelId || nextContext?.selectedHotelId || 0);
        const hasDatesGuests =
          Boolean(nextContext?.checkIn) &&
          Boolean(nextContext?.checkOut) &&
          Number(nextContext?.guests || 0) > 0;
        // Sync into effectiveContext so strictStep never re-fetches the hotel list.
        if (hotelId > 0) {
          effectiveContext = { ...effectiveContext, selectedHotelId: hotelId };
          setContext(effectiveContext);
          saveMemory({ context: effectiveContext, history: withUser });
        }
        if (hotelId > 0 && hasDatesGuests) {
          navigate(`/hotels/${hotelId}?ai=1#room-types`, { state: { intent: { hotelId, fromAssistant: true } } });
          const rooms = await bookingApi.getRoomTypes(hotelId);
          const validRooms = (rooms || []).filter((room) => isValidRoomName(room?.name));
          const options = validRooms.map((room, idx) =>
            `${idx + 1}) ${room.name} — ${money(room.basePrice)} (up to ${room.capacity} guest${Number(room.capacity) !== 1 ? "s" : ""})`,
          );
          setRoomOptions(validRooms);
          setSelectedRoomOptionId(Number(nextContext?.selectedRoomTypeId || 0) || null);
          if (options.length > 0) {
            assistantText = `You've selected ${response?.action?.hotelName || nextContext?.selectedHotelName || "the hotel"}. Here are the available room types:\n${options.join("\n")}\nWhich room would you like?`;
          }
        } else if (hotelId > 0 && !hasDatesGuests) {
          setRoomOptions([]);
          assistantText = getMissingDatesGuestsMessage(nextContext) ||
            "Great choice. Please tell me your check-in date, check-out date, and number of guests.";
        }
      } else if (response?.action?.type === "PREPARE_BOOKING") {
        setSelectedRoomOptionId(Number(nextContext?.selectedRoomTypeId || 0) || null);
        try {
          const draft = await prepareBookingFromAction(response.action, response.recommendations, text);
          setRoomOptions([]);
          setConfirmDraft(draft);
          assistantText += duplicateBookingPrepMessage(draft);
        } catch (prepErr) {
          const hid = Number(effectiveContext?.selectedHotelId || nextContext?.selectedHotelId || 0);
          if (hid > 0) {
            try {
              const rooms = await bookingApi.getRoomTypes(hid);
              setRoomOptions((rooms || []).filter((r) => isValidRoomName(r?.name)));
            } catch {
              /* keep existing list */
            }
          }
          throw prepErr;
        }
      }

      // Fallback: if backend only replies with room-type text, still show real UI room options.
      const mentionsRoomTypes =
        /available room types are|which one would you like to choose|what type of room would you like|which room type/i.test(
          assistantText,
        );
      if (
        mentionsRoomTypes &&
        response?.action?.type !== "ASK_ROOM_SELECTION" &&
        response?.action?.type !== "PREPARE_BOOKING"
      ) {
        const hasDatesGuests =
          Boolean(effectiveContext?.checkIn) &&
          Boolean(effectiveContext?.checkOut) &&
          Number(effectiveContext?.guests || 0) > 0;
        if (!hasDatesGuests) {
          setRoomOptions([]);
          assistantText = "Great choice. Before room type, please tell me your check-in date, check-out date, and number of guests.";
        } else {
        let hotelId = Number(response?.action?.hotelId || nextContext?.selectedHotelId || 0);
        if (!hotelId) {
          const hotelNameFromText = extractHotelNameFromSelectionText(assistantText);
          if (hotelNameFromText) {
            try {
              const named = await bookingApi.listHotels({ name: hotelNameFromText, page: 0, size: 10 });
              const namedList = named?.content || [];
              const bestMatch = findBestHotelNameMatch(namedList, hotelNameFromText);
              if (bestMatch?.id) {
                hotelId = Number(bestMatch.id);
              }
            } catch {
              // no-op
            }
          }
        }
        if (hotelId > 0) {
          navigate(`/hotels/${hotelId}?ai=1#room-types`, { state: { intent: { hotelId, fromAssistant: true } } });
          const rooms = await bookingApi.getRoomTypes(hotelId);
          const validRooms = (rooms || []).filter((room) => isValidRoomName(room?.name));
          if (validRooms.length > 0) {
            setRoomOptions(validRooms);
            setSelectedRoomOptionId(Number(nextContext?.selectedRoomTypeId || 0) || null);
            const options = validRooms.map((room, idx) =>
              `${idx + 1}) ${room.name} - ${money(room.basePrice)} (capacity ${room.capacity})`
            );
            assistantText = `Which room type would you like?\n${options.join("\n")}\nReply with room name or number.`;
          }
        }
        }
      }

      // Fallback: if backend confirms selected hotel in text and asks for dates,
      // sync selected hotel in UI and navigate to its details page.
      const asksForDatesAfterHotelSelection = /you['’]ve selected\s+.+?\.\s+what are your check-in and check-out dates\?/i.test(
        assistantText,
      );
      if (asksForDatesAfterHotelSelection) {
        let hotelId = Number(response?.action?.hotelId || nextContext?.selectedHotelId || 0);
        let resolvedHotelName = nextContext?.selectedHotelName || null;
        if (!hotelId) {
          const hotelNameFromText = extractHotelNameFromDatesPromptText(assistantText);
          if (hotelNameFromText) {
            const named = await bookingApi.listHotels({ name: hotelNameFromText, page: 0, size: 10 });
            const namedList = named?.content || [];
            const bestMatch = findBestHotelNameMatch(namedList, hotelNameFromText);
            if (bestMatch?.id) {
              hotelId = Number(bestMatch.id);
              resolvedHotelName = bestMatch.name;
            }
          }
        }
        if (hotelId > 0) {
          const checkIn = nextContext?.checkIn;
          const checkOut = nextContext?.checkOut;
          const guests = Number(nextContext?.guests || 0);
          const query = new URLSearchParams();
          if (checkIn) query.set("from", checkIn);
          if (checkOut) query.set("to", checkOut);
          if (guests > 0) query.set("guests", String(guests));
          if (checkIn && checkOut && guests > 0) {
            updateBookingUi({
              city: nextContext?.city || "",
              checkInDate: checkIn,
              checkOutDate: checkOut,
              guests,
            });
            navigate(`/hotels/${hotelId}?${query.toString()}`);
          } else {
            navigate(`/hotels/${hotelId}`);
          }
          setContext((prev) => ({
            ...prev,
            ...nextContext,
            selectedHotelId: hotelId,
            selectedHotelName: resolvedHotelName || prev?.selectedHotelName || null,
          }));
        }
      }

      // Frontend safety-net: when a hotel is selected but room is not selected yet,
      // force hotel-details room-selection flow even if backend action was not ASK_ROOM_SELECTION.
      if (
        response?.action?.type !== "ASK_ROOM_SELECTION" &&
        Number(nextContext?.selectedHotelId || 0) > 0 &&
        Boolean(nextContext?.checkIn) &&
        Boolean(nextContext?.checkOut) &&
        Number(nextContext?.guests || 0) > 0 &&
        !Number(nextContext?.selectedRoomTypeId || 0) &&
        response?.action?.type !== "PREPARE_BOOKING"
      ) {
        const selectedHotelId = Number(nextContext.selectedHotelId);
        navigate(`/hotels/${selectedHotelId}?ai=1#room-types`, {
          state: { intent: { hotelId: selectedHotelId, fromAssistant: true } },
        });
        const rooms = await bookingApi.getRoomTypes(selectedHotelId);
        const validRooms = (rooms || []).filter((room) => isValidRoomName(room?.name));
        const options = validRooms.map((room, idx) =>
          `${idx + 1}) ${room.name} - ${money(room.basePrice)} (capacity ${room.capacity})`
        );
        setRoomOptions(validRooms);
        setSelectedRoomOptionId(null);
        assistantText = `Which room type would you like?\n${options.join("\n")}\nReply with room name or number.`;
      }

      const responseIntent = String(response?.intent || "").toLowerCase();
      const responseMode = String(effectiveContext?.mode || "").toLowerCase();
      const hasActiveBookingContext = Boolean(
        effectiveContext?.city ||
          effectiveContext?.anyCity ||
          effectiveContext?.checkIn ||
          effectiveContext?.checkOut ||
          Number(effectiveContext?.guests || 0) > 0 ||
          Number(effectiveContext?.selectedHotelId || 0) > 0,
      );
      const shouldEnforceStrictStep =
        ["booking", "search", "filter"].includes(responseIntent) ||
        ["booking", "searching", "selecting_hotel", "selecting_room", "confirming"].includes(responseMode) ||
        hasActiveBookingContext;
      const strictStep = shouldEnforceStrictStep ? getStrictCurrentStep(effectiveContext, confirmDraft) : 7;
      const citySuggestionMatch = String(assistantText || "").match(/Did you mean\s+([^?]+)\?/i);
      const hasCityValidationReply =
        Boolean(citySuggestionMatch) ||
        /there is no city called|couldn't find ".+" as a city/i.test(String(assistantText || ""));
      if (citySuggestionMatch?.[1]) {
        setPendingCitySuggestion(citySuggestionMatch[1].trim());
      } else if (hasCityValidationReply) {
        setPendingCitySuggestion(null);
      }
      if (strictStep === 2 && !hasCityValidationReply) {
        setHotelOptions([]);
        setRoomOptions([]);
        assistantText = "Which city would you like to stay in?";
      } else if (strictStep === 3 && !correctedCity) {
        setHotelOptions([]);
        setRoomOptions([]);
        navigateWithContext({ navigate, updateBookingUi, ctx: effectiveContext, fallbackGuests: 1 });
        // Prefix with the saved city name so the user knows it was heard.
        const missingMsg = getMissingDatesGuestsMessage(effectiveContext) ||
          "Please provide your check-in date, check-out date, and number of guests.";
        assistantText = effectiveContext.city
          ? `${effectiveContext.city} is saved. ${missingMsg}`
          : missingMsg;
      } else if (strictStep === 4) {
        const hotelsResp = await bookingApi.listHotels({
          city: effectiveContext?.anyCity ? undefined : effectiveContext?.city,
          from: effectiveContext?.checkIn,
          to: effectiveContext?.checkOut,
          checkInDate: effectiveContext?.checkIn,
          checkOutDate: effectiveContext?.checkOut,
          guests: Number(effectiveContext?.guests || 1),
          page: 0,
          size: 10,
        });
        const hotelsList = hotelsResp?.content || [];
        setHotelOptions(hotelsList.map(toHotelOption).filter((h) => h.id > 0 && h.name));
        setRoomOptions([]);
        const q = new URLSearchParams();
        if (!effectiveContext?.anyCity && effectiveContext?.city) q.set("city", effectiveContext.city);
        q.set("from", effectiveContext.checkIn);
        q.set("to", effectiveContext.checkOut);
        q.set("guests", String(Number(effectiveContext?.guests || 1)));
        updateBookingUi({
          city: effectiveContext?.anyCity ? "" : (effectiveContext?.city || ""),
          checkInDate: effectiveContext?.checkIn,
          checkOutDate: effectiveContext?.checkOut,
          guests: Number(effectiveContext?.guests || 1),
        });
        navigate(`/hotels?${q.toString()}`);
        assistantText =
          hotelsList.length > 0
            ? `Here are available hotels${effectiveContext?.city ? ` in ${effectiveContext.city}` : ""}. Which hotel would you like?`
            : "No hotels found for these filters. Please update city, dates, or guests.";
      } else if (strictStep === 5) {
        const selectedHotelId = Number(effectiveContext?.selectedHotelId || 0);
        if (selectedHotelId > 0) {
          const q = new URLSearchParams();
          if (effectiveContext?.city) q.set("city", effectiveContext.city);
          q.set("from", effectiveContext.checkIn);
          q.set("to", effectiveContext.checkOut);
          q.set("guests", String(Number(effectiveContext?.guests || 1)));
          navigate(`/hotels/${selectedHotelId}?${q.toString()}`);
          const rooms = await bookingApi.getRoomTypes(selectedHotelId);
          const validRooms = (rooms || []).filter((room) => isValidRoomName(room?.name));
          setRoomOptions(validRooms);
          assistantText =
            validRooms.length > 0
              ? `Available room types:\n${validRooms.map((room, idx) => `${idx + 1}) ${room.name}`).join("\n")}\nWhich room type do you want?`
              : "No room types available for this hotel.";
        }
      }

      pushTurn("assistant", assistantText, withUser, effectiveContext);
    } catch (err) {
      pushTurn("assistant", humanizeError(err), withUser);
    } finally {
      setLoading(false);
    }
  }

  async function continueToPayment() {
    if (!confirmDraft || loading) return;
    if (!auth.isAuthenticated) {
      pushTurn("assistant", "Please log in to complete your booking.");
      navigate("/login", { state: { from: location.pathname } });
      setConfirmDraft(null);
      return;
    }
    if (!auth.hasPermission("booking:create")) {
      pushTurn("assistant", "Please log in to complete your booking.");
      setConfirmDraft(null);
      return;
    }
    const q = new URLSearchParams();
    if (confirmDraft.hotel?.city) q.set("city", confirmDraft.hotel.city);
    q.set("from", confirmDraft.checkIn);
    q.set("to", confirmDraft.checkOut);
    q.set("guests", String(confirmDraft.guests));
    updateBookingUi({
      city: confirmDraft.hotel?.city || "",
      checkInDate: confirmDraft.checkIn,
      checkOutDate: confirmDraft.checkOut,
      guests: Number(confirmDraft.guests || 1),
    });
    pushTurn("assistant", "Opening payment form. Choose card or cash and finish booking there.");
    try {
      sessionStorage.setItem(ASSISTANT_AWAITING_BOOKING_SUCCESS_KEY, "1");
    } catch {
      // ignore storage issues
    }
    navigate(`/hotels/${confirmDraft.hotel.id}?${q.toString()}#room-types`, {
      state: {
        intent: {
          hotelId: confirmDraft.hotel.id,
          roomTypeId: confirmDraft.room.id,
          checkIn: confirmDraft.checkIn,
          checkOut: confirmDraft.checkOut,
          guests: Number(confirmDraft.guests || 1),
          fromAssistant: true,
          openPayment: true,
        },
      },
    });
    setConfirmDraft(null);
  }

  function resetConversation() {
    setContext({});
    setChat([]);
    setMessage("");
    setConfirmDraft(null);
    setHotelOptions([]);
    setRoomOptions([]);
    setSelectedRoomOptionId(null);
    setPickDialog(null);
    setAssistantPickerDismissed(false);
    setGuideEnabled(false);
    setDatesGuestsDraft(createDefaultDatesGuestsDraft());
    saveMemory({ context: {}, history: [] });
    if (!embedded) resetAssistantToBottomRight(posRef, setPos);
  }

  // ── Local hotel-selection flow (no AI round-trip) ──────────────────────────
  async function selectHotelLocally(hotel, chatWithUserTurn) {
    const nextContext = {
      ...context,
      // When user picks a hotel, we always know its city.
      city: context?.city || hotel?.city || "",
      selectedHotelId: hotel.id,
      selectedHotelName: hotel.name,
      selectedRoomTypeId: null,
      selectedRoomTypeName: null,
    };
    setContext(nextContext);
    setHotelOptions([]);
    setRoomOptions([]);
    setSelectedRoomOptionId(null);
    saveMemory({ context: nextContext, history: chatWithUserTurn });

    // Ask for dates/guests first (room types depend on them).
    const missing = getMissingDatesGuestsMessage(nextContext);
    if (missing) {
      navigate(`/hotels/${hotel.id}`);
      pushTurn(
        "assistant",
        `You've selected ${hotel.name}${nextContext.city ? ` (${nextContext.city})` : ""}. ${missing}`,
        chatWithUserTurn,
        nextContext,
      );
      return;
    }

    const q = new URLSearchParams();
    if (nextContext.city) q.set("city", nextContext.city);
    if (nextContext.checkIn) q.set("from", nextContext.checkIn);
    if (nextContext.checkOut) q.set("to", nextContext.checkOut);
    q.set("guests", String(Number(nextContext.guests || 1)));
    updateBookingUi({
      city: nextContext.city || "",
      checkInDate: nextContext.checkIn,
      checkOutDate: nextContext.checkOut,
      guests: Number(nextContext.guests || 1),
    });
    navigate(`/hotels/${hotel.id}?${q.toString()}#room-types`, {
      state: { intent: { hotelId: hotel.id, fromAssistant: true } },
    });

    const rooms = await bookingApi.getRoomTypes(hotel.id);
    const validRooms = (rooms || []).filter((r) => isValidRoomName(r?.name));
    setRoomOptions(validRooms);

    if (validRooms.length > 0) {
      const options = validRooms.map(
        (r, idx) => `${idx + 1}) ${r.name} — ${money(r.basePrice)} (up to ${r.capacity} guest${Number(r.capacity) !== 1 ? "s" : ""})`,
      );
      pushTurn(
        "assistant",
        `You've selected ${hotel.name}. Here are the available room types:\n${options.join("\n")}\nWhich room would you like?`,
        chatWithUserTurn,
        nextContext,
      );
    } else {
      pushTurn(
        "assistant",
        `You've selected ${hotel.name}, but no room types are currently available. Please try another hotel.`,
        chatWithUserTurn,
        nextContext,
      );
    }
  }

  async function chooseHotelOption(hotel) {
    if (!hotel || loading) return;
    const withUser = pushTurn("user", hotel.name);
    setLoading(true);
    try {
      await selectHotelLocally(hotel, withUser);
    } catch (err) {
      pushTurn("assistant", humanizeError(err), withUser);
    } finally {
      setLoading(false);
    }
  }

  function chooseRoomOption(room) {
    if (!room || loading) return;
    const guestsN = Number(context.guests || 0);
    if (Number(room.capacity || 0) < guestsN) {
      pushTurn(
        "assistant",
        `"${room.name}" only holds up to ${room.capacity} guest(s). You requested ${guestsN}. Pick a room with enough capacity below.`,
      );
      return;
    }
    setSelectedRoomOptionId(Number(room.id));
    sendMessage(room.name);
  }

  function startGuidedFlow({ userText = "" } = {}) {
    if (loading) return;
    const nextContext = { mode: "guided" };
    const question = getGuideQuestion(nextContext, null, systemLang);
    const nextChat = userText
      ? [{ role: "user", content: userText }, { role: "assistant", content: question }]
      : [{ role: "assistant", content: question }];
    if (!embedded) resetAssistantToBottomRight(posRef, setPos);
    setGuideEnabled(true);
    setPendingCitySuggestion(null);
    setContext(nextContext);
    setChat(nextChat);
    setMessage("");
    setConfirmDraft(null);
    setHotelOptions([]);
    setRoomOptions([]);
    setSelectedRoomOptionId(null);
    setPickDialog(null);
    setAssistantPickerDismissed(false);
    setDatesGuestsDraft(createDefaultDatesGuestsDraft());
    saveMemory({ context: nextContext, history: nextChat, ui: { guideEnabled: true } });
    queueMicrotask(() => {
      scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
      inputRef.current?.focus();
    });
  }

  const pickerIdsKey = useMemo(() => {
    if (confirmDraft) return "";
    const h = hotelOptions.map((x) => x.id).join(",");
    const r = roomOptions.map((x) => x.id).join(",");
    if (!h && !r) return "";
    return `${h}|${r}`;
  }, [confirmDraft, hotelOptions, roomOptions]);

  useEffect(() => {
    if (!pickerIdsKey) return;
    setAssistantPickerDismissed(false);
  }, [pickerIdsKey]);

  const hasAssistantPickerOptions =
    open && !confirmDraft && (hotelOptions.length > 0 || roomOptions.length > 0);
  const assistantPickerModalOpen = hasAssistantPickerOptions && !assistantPickerDismissed;

  useEffect(() => {
    if (!assistantPickerModalOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setAssistantPickerDismissed(true);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [assistantPickerModalOpen]);

  const hasUnread = !open && chat.length > 0 && chat[chat.length - 1]?.role === "assistant";
  const flowStep = getFlowStep(context, confirmDraft, systemLang);
  const showStepper = open && !confirmDraft && (guideEnabled || chat.length > 0 || Object.keys(context || {}).length > 0);
  // Show picker whenever we actually have options, even if the stepper is behind.
  // (Example: user asks "hotel called X" in casual chat before the guide context is filled.)
  const pickerStep =
    !confirmDraft && hotelOptions.length > 0
      ? "hotel"
      : (!confirmDraft && roomOptions.length > 0 ? "room" : null);
  const dir = systemLang === "ar" ? "rtl" : "ltr";

  return (
    <div
      ref={rootRef}
      className={`assistant-shell ${embedded ? "assistant-shell--embedded" : ""} ${pos ? "assistant-shell--draggable" : ""} ${dragging ? "assistant-shell--dragging" : ""}`}
      style={
        embedded || !pos
          ? undefined
          : {
              left: `${Math.round(pos.x)}px`,
              top: `${Math.round(pos.y)}px`,
            }
      }
    >
      {/* Floating toggle button */}
      {!embedded && (
        <button
          type="button"
          className={`assistant-toggle ${open ? "assistant-toggle--open" : ""}`}
          data-assistant-drag-handle="true"
          title="Drag to move"
          onPointerDown={startDrag}
          onClick={() => {
            if (dragRef.current.moved) return;
            setOpen((v) => {
              const next = !v;
              // When closing, reset position back to bottom-right for next open.
              if (v === true && next === false) {
                resetAssistantToBottomRight(posRef, setPos);
              }
              return next;
            });
          }}
          aria-label={open ? "Close QuickReserve AI" : "Open QuickReserve AI"}
        >
          {open ? (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          ) : (
            <>
              <span className="assistant-toggle__logo" aria-hidden>
                <img src="/ai_assistant_logo.png" alt="" />
              </span>
              <span>QuickReserve AI</span>
              {hasUnread && <span className="assistant-toggle__dot" aria-hidden />}
            </>
          )}
        </button>
      )}

      {open && (
        <section className={`assistant-panel ${embedded ? "assistant-panel--embedded" : ""}`} dir={dir}>
          {/* Header */}
          <div
            className="assistant-head"
            data-assistant-drag-handle="true"
            title="Drag to move"
            onPointerDown={startDrag}
          >
            <div className="assistant-head__brand">
              <div className="assistant-head__avatar">
                <img src="/ai_assistant_logo.png" alt="" />
              </div>
              <div>
                <strong>
                  {systemLang === "ar"
                    ? (embedded ? "مساعد السفر بالذكاء الاصطناعي" : "مساعد الحجز بالذكاء الاصطناعي")
                    : (embedded ? "AI Travel Assistant" : "AI Booking Concierge")}
                </strong>
                <span className="muted">
                  {embedded
                    ? (systemLang === "ar"
                        ? "المدينة أولاً، ثم التواريخ وعدد الضيوف، ثم الفندق. سأرشدك خطوة بخطوة."
                        : "City first, then dates and guests, then your hotel — I will guide each step.")
                    : bookingContextHint}
                </span>
                {showStepper ? (
                  <div className="assistant-stepper" aria-label="Booking progress">
                    <div className="assistant-stepper__top">
                      <span>
                        {systemLang === "ar"
                          ? `الخطوة ${flowStep.number} من ${GUIDED_FLOW_TOTAL_STEPS}`
                          : `Step ${flowStep.number} of ${GUIDED_FLOW_TOTAL_STEPS}`}
                      </span>
                      <small>{flowStep.label}</small>
                    </div>
                    <div className="assistant-stepper__bar" role="presentation">
                      <span style={{ width: `${Math.round((flowStep.number / GUIDED_FLOW_TOTAL_STEPS) * 100)}%` }} />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="assistant-head__newChat"
                onClick={() => startGuidedFlow()}
                disabled={loading}
                aria-label={guideEnabled ? "Guide again" : "Guide me"}
                title={guideEnabled ? "Guide again" : "Guide me"}
              >
                {guideEnabled ? "Guide again" : "Guide me"}
              </button>
              <button
                type="button"
                className="assistant-head__newChat"
                onClick={resetConversation}
                disabled={loading}
                aria-label="New Chat"
                title="New Chat"
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M7 1v6m0 0v6m0-6H1m6 0h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {systemLang === "ar" ? "محادثة جديدة" : "New Chat"}
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="assistant-messages" ref={scrollerRef}>
            {chat.length === 0 ? (
              <p className="muted" style={{ padding: "8px 0", textAlign: "center", fontSize: "0.88rem" }}>
                Tell me what you want, and I'll handle search, follow-ups, and booking steps.
              </p>
            ) : (
              chat.map((m, i) => (
                <div key={`${m.role}-${i}`} className={`assistant-row ${m.role === "assistant" ? "assistant-row--bot" : "assistant-row--user"}`}>
                  {m.role === "assistant" && (
                    <div className="assistant-botAvatar" aria-hidden>
                      <img src="/ai_assistant_logo.png" alt="" />
                    </div>
                  )}
                  <div className={m.role === "assistant" ? "assistant-msg" : "user-msg"}>
                    {m.content}
                  </div>
                </div>
              ))
            )}
            {loading && <TypingIndicator />}
          </div>

          {/* Input row */}
          {showDatesGuestsPicker ? (
            <div className="assistant-datesGuests" aria-label="Choose dates and guests">
              <div className="assistant-datesGuests__row">
                <label className="assistant-datesGuests__field">
                  <span className="assistant-datesGuests__label">{systemLang === "ar" ? "تاريخ الوصول" : "Check-in"}</span>
                  <input
                    type="date"
                    value={datesGuestsDraft.checkIn}
                    min={todayIso()}
                    onChange={(e) => {
                      const checkIn = e.target.value;
                      const checkOut = isIsoOnOrBefore(datesGuestsDraft.checkOut, checkIn)
                        ? addDaysIso(checkIn, 1)
                        : datesGuestsDraft.checkOut;
                      setDatesGuestsDraft((prev) => ({ ...prev, checkIn, checkOut }));
                    }}
                    disabled={loading}
                  />
                </label>

                <label className="assistant-datesGuests__field">
                  <span className="assistant-datesGuests__label">{systemLang === "ar" ? "تاريخ المغادرة" : "Check-out"}</span>
                  <input
                    type="date"
                    value={datesGuestsDraft.checkOut}
                    min={addDaysIso(datesGuestsDraft.checkIn, 1)}
                    onChange={(e) => setDatesGuestsDraft((prev) => ({ ...prev, checkOut: e.target.value }))}
                    disabled={loading}
                  />
                </label>
              </div>

              <div className="assistant-datesGuests__row assistant-datesGuests__row--guests">
                <div className="assistant-datesGuests__guestsHead">
                  <span className="assistant-datesGuests__label">{systemLang === "ar" ? "عدد الضيوف" : "Guests"}</span>
                  <strong className="assistant-datesGuests__value">{datesGuestsDraft.guests}</strong>
                </div>
                <input
                  type="range"
                  min={1}
                  max={7}
                  step={1}
                  value={datesGuestsDraft.guests}
                  onChange={(e) => setDatesGuestsDraft((prev) => ({ ...prev, guests: Number(e.target.value) }))}
                  disabled={loading}
                  aria-label={systemLang === "ar" ? "اختيار عدد الضيوف" : "Choose number of guests"}
                />
              </div>

              <div className="assistant-datesGuests__actions">
                <button
                  type="button"
                  className="btn btn-teal assistant-datesGuests__apply"
                  disabled={loading || !datesGuestsDraft.checkIn || !datesGuestsDraft.checkOut}
                  onClick={() => {
                    const text = `Check-in ${datesGuestsDraft.checkIn}, check-out ${datesGuestsDraft.checkOut}, guests ${datesGuestsDraft.guests}`;
                    sendMessage(text);
                  }}
                >
                  {systemLang === "ar" ? "تأكيد" : "Apply"}
                </button>
              </div>
            </div>
          ) : null}
          <div className="assistant-actions">
            <input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={systemLang === "ar" ? "مثال: احجز لي فندقاً في رام الله من today إلى Sunday" : "e.g. Book me a hotel in Ramallah for tomorrow"}
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button
              type="button"
              className="assistant-sendBtn"
              onClick={() => sendMessage()}
              disabled={loading || !message.trim()}
              aria-label="Send"
            >
              {loading ? (
                <span className="assistant-sendSpinner" aria-hidden />
              ) : (
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M3 10L17 3l-7 7 7 7-14-7z" fill="currentColor"/>
                </svg>
              )}
            </button>
          </div>

          {/* Confirm / payment */}
          <div className="assistant-confirm">
            {pickerStep && !confirmDraft ? (
              <button
                type="button"
                className="assistant-pickTrigger"
                onClick={() => {
                  if (pickerStep === "hotel") {
                    setPickDialog({
                      type: "hotel",
                      title:
                        systemLang === "ar"
                          ? `الخطوة 3: اختر الفندق (${hotelOptions.length})`
                          : `Step 3: Choose your hotel (${hotelOptions.length} options)`,
                      items: hotelOptions,
                    });
                  } else if (pickerStep === "room") {
                    setPickDialog({
                      type: "room",
                      title:
                        systemLang === "ar"
                          ? `الخطوة 4: اختر نوع الغرفة (${roomOptions.length})`
                          : `Step 4: Choose your room type (${roomOptions.length} options)`,
                      items: roomOptions,
                    });
                  }
                }}
                disabled={loading}
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 4v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {pickerStep === "hotel"
                  ? (systemLang === "ar"
                      ? `${hotelOptions.length} فندق متاح — اضغط للاختيار`
                      : `${hotelOptions.length} hotel${hotelOptions.length !== 1 ? "s" : ""} available — tap to choose`)
                  : (systemLang === "ar"
                      ? `${roomOptions.length} نوع غرفة متاح — اضغط للاختيار`
                      : `${roomOptions.length} room type${roomOptions.length !== 1 ? "s" : ""} available — tap to choose`)}
              </button>
            ) : null}
            {confirmDraft ? (
              <>
                <button type="button" className="btn btn-primary btn-small" onClick={continueToPayment} disabled={loading}>
                  {systemLang === "ar" ? "المتابعة للدفع" : "Continue to payment"}
                </button>
                <button type="button" className="btn btn-outline btn-small" onClick={() => setConfirmDraft(null)} disabled={loading}>
                  {systemLang === "ar" ? "إلغاء" : "Cancel"}
                </button>
              </>
            ) : null}
          </div>
        {/* ── Pick dialog ─────────────────────────────────────────────────── */}
        {pickDialog && !confirmDraft && (
          <div className="assistant-dialogBackdrop" onClick={() => setPickDialog(null)}>
            <div
              className="assistant-dialog"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={pickDialog.title}
            >
              <div className="assistant-dialogHead">
                <strong>{pickDialog.title}</strong>
                <button
                  type="button"
                  className="assistant-dialogClose"
                  onClick={() => setPickDialog(null)}
                  aria-label="Close"
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
                    <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
              <div className="assistant-dialogList">
                {pickDialog.type === "hotel"
                  ? pickDialog.items.map((hotel) => (
                      <button
                        key={hotel.id}
                        type="button"
                        className="assistant-dialogItem"
                        onClick={() => { setPickDialog(null); chooseHotelOption(hotel); }}
                        disabled={loading}
                      >
                        <span className="assistant-dialogItem__name">
                          <span className="assistant-dialogItem__index">{pickDialog.items.indexOf(hotel) + 1}.</span> {hotel.name}
                        </span>
                        <span className="assistant-dialogItem__meta">
                          {hotel.city || "Hotel"}
                          {hotel.price > 0 ? ` · from ${money(hotel.price)}` : ""}
                        </span>
                      </button>
                    ))
                  : pickDialog.items.map((room) => (
                      <button
                        key={room.id}
                        type="button"
                        className={`assistant-dialogItem${Number(selectedRoomOptionId) === Number(room.id) ? " assistant-dialogItem--selected" : ""}`}
                        onClick={() => { setPickDialog(null); chooseRoomOption(room); }}
                        disabled={loading}
                      >
                        <span className="assistant-dialogItem__name">
                          <span className="assistant-dialogItem__index">{pickDialog.items.indexOf(room) + 1}.</span> {room.name}
                        </span>
                        <span className="assistant-dialogItem__meta">
                          {money(room.basePrice)} · up to {room.capacity} guest{Number(room.capacity) !== 1 ? "s" : ""}
                        </span>
                      </button>
                    ))}
              </div>
            </div>
          </div>
        )}
        </section>
      )}
    </div>
  );
}

export default function BookingAssistant(props) {
  return (
    <BookingAssistantErrorBoundary>
      <BookingAssistantInner {...props} />
    </BookingAssistantErrorBoundary>
  );
}

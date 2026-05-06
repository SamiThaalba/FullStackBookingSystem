import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { bookingApi } from "../api/bookingApi";
import { useAuth } from "../auth/AuthContext";
import { useBookingUi } from "../context/BookingUiContext";
import {
  extractAssistantGuestsCount,
  extractKnownCityFromText,
  matchCityBilingual,
  normalizeAssistantDateInput,
  parseUserPickIndex,
  resolveCityBilingual,
} from "../utils/aiAssistant";
import { money } from "../utils/format";
import { addDaysIso, isIsoOnOrBefore } from "../utils/dates";

const ASSISTANT_MEMORY_KEY = "quickreserve-ai-memory-v2";
const ASSISTANT_AUTO_OPEN_KEY = "quickreserve-ai-auto-open-v1";

function loadMemory() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(ASSISTANT_MEMORY_KEY) || "null");
    return {
      context: parsed?.context || {},
      history: Array.isArray(parsed?.history) ? parsed.history : [],
    };
  } catch {
    return { context: {}, history: [] };
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

function isAnyCityIntent(text) {
  const value = String(text || "").toLowerCase().trim();
  if (!value) return false;
  const compact = value.replace(/\s+/g, "");
  return (
    value.includes("any city") ||
    compact.includes("anycity") ||
    value.includes("anything") ||
    compact.includes("anything") ||
    value.includes("for all") ||
    value.includes("all hotels") ||
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

function isCityQuestion(text) {
  const value = String(text || "").toLowerCase();
  return (
    value.includes("which city") ||
    value.includes("in which city") ||
    value.includes("what city") ||
    value.includes("city would you prefer")
  );
}

function isHotelListPrompt(text) {
  const value = String(text || "").toLowerCase();
  return (
    value.includes("show you some options") ||
    value.includes("show you options") ||
    value.includes("hotel options") ||
    value.includes("would you like to see the list") ||
    value.includes("choose from the list") ||
    value.includes("please select one") ||
    value.includes("select one to see more details")
  );
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

// Converts user-typed "D-M" / "D/M" / "D.M" patterns → "YYYY-MM-DD" using current year.
function normalizeDateInput(text) {
  return normalizeAssistantDateInput(text);
}

function extractIsoDates(text) {
  const t = String(text || "");
  const matches = t.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
  return matches.slice(0, 3);
}

function extractGuestsCount(text) {
  return extractAssistantGuestsCount(text);
}

function getGuideQuestion(context, confirmDraft) {
  if (!context?.city && !context?.anyCity && !Number(context?.selectedHotelId || 0)) {
    return "Great — step 1: which city do you want to stay in? (Or say: any city)";
  }
  if (!context?.checkIn || !context?.checkOut) {
    return "Step 2: what are your check-in and check-out dates? (YYYY-MM-DD)";
  }
  if (!Number(context?.guests || 0)) {
    return "Step 3: how many guests will stay?";
  }
  if (confirmDraft) {
    return "Everything is ready. Please choose a payment method, then confirm booking.";
  }
  return "Great. I’ll open results — choose a hotel from the list.";
}

function getFlowStep(context, confirmDraft) {
  const hasHotel = Number(context?.selectedHotelId || 0) > 0;
  const hasCity = Boolean(context?.city || context?.anyCity);
  const hasDates = Boolean(context?.checkIn && context?.checkOut);
  const hasGuests = Number(context?.guests || 0) > 0;
  const hasRoom = Number(context?.selectedRoomTypeId || 0) > 0;

  if (!hasCity && !hasHotel) return { number: 1, label: "Choose destination" };
  if (!hasDates) return { number: 2, label: "Choose dates" };
  if (!hasGuests) return { number: 3, label: "Choose guests" };
  if (!hasHotel) return { number: 4, label: "Choose hotel" };
  if (!hasRoom) return { number: 5, label: "Choose room type" };
  return confirmDraft ? { number: 6, label: "Confirm booking" } : { number: 6, label: "Confirm booking" };
}

function navigateWithContext({ navigate, updateBookingUi, ctx, fallbackGuests = 1 }) {
  const guests = Number(ctx?.guests || fallbackGuests || 1);
  const checkIn = ctx?.checkIn || "";
  const checkOut = ctx?.checkOut || "";
  const hasAnyCity = Boolean(ctx?.anyCity) || !ctx?.city;
  const city = hasAnyCity ? "" : String(ctx?.city || "");

  // Ensure the floating assistant opens on the destination page (Layout hides it on "/").
  try {
    sessionStorage.setItem(ASSISTANT_AUTO_OPEN_KEY, "1");
  } catch {
    // ignore storage issues
  }

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

/** Small animated typing indicator — three bouncing dots */
function TypingIndicator() {
  return (
    <div className="home-ai__row home-ai__row--bot">
      <div className="home-ai__botAvatar" aria-hidden>
        <img src="/ai_assistant_logo.png" alt="" />
      </div>
      <div className="home-ai__msg home-ai__msg--bot home-ai__msg--typing" aria-label="Assistant is thinking">
        <span className="home-ai__dot" />
        <span className="home-ai__dot" />
        <span className="home-ai__dot" />
      </div>
    </div>
  );
}

/** Renders context the AI has accumulated as dismissable pills */
function ContextPills({ context, onClear }) {
  const pills = [];
  if (context?.city) pills.push({ key: "city", icon: "📍", label: context.city });
  if (context?.guests) pills.push({ key: "guests", icon: "👥", label: `${context.guests} guest${context.guests > 1 ? "s" : ""}` });
  if (context?.checkIn) pills.push({ key: "checkIn", icon: "📅", label: context.checkIn });
  if (context?.checkOut) pills.push({ key: "checkOut", icon: "🏁", label: context.checkOut });
  if (!pills.length) return null;
  return (
    <div className="home-ai__contextRow" aria-label="Active booking context">
      {pills.map((p) => (
        <span key={p.key} className="home-ai__contextPill">
          <span aria-hidden>{p.icon}</span> {p.label}
        </span>
      ))}
      <button
        type="button"
        className="home-ai__contextClear"
        onClick={onClear}
        title="Clear context"
        aria-label="Clear booking context"
      >
        ✕
      </button>
    </div>
  );
}

export default function HomeAiAssistant({ cities: _cities } = {}) {
  const { t } = useTranslation();
  const auth = useAuth();
  const { updateBookingUi } = useBookingUi();
  const navigate = useNavigate();
  const location = useLocation();
  const initialMemory = useMemo(() => loadMemory(), []);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState(() => initialMemory.history);
  const [context, setContext] = useState(() => initialMemory.context);
  const [loading, setLoading] = useState(false);
  const [guideEnabled, setGuideEnabled] = useState(false);
  const [confirmDraft, setConfirmDraft] = useState(null);
  const [pendingCitySuggestion, setPendingCitySuggestion] = useState(null);
  const scrollerRef = useRef(null);
  const inputRef = useRef(null);
  const wasAuthenticatedRef = useRef(Boolean(auth.isAuthenticated));

  const bookingContextHint = location.pathname.startsWith("/hotels")
    ? t("assistant.hintHotels")
    : t("assistant.hintHome");

  const flowStep = getFlowStep(context, confirmDraft);

  useEffect(() => {
    const wasAuthenticated = wasAuthenticatedRef.current;
    const isAuthenticated = Boolean(auth.isAuthenticated);
    if (wasAuthenticated && !isAuthenticated) {
      setContext({});
      setChat([]);
      setGuideEnabled(false);
      setConfirmDraft(null);
      setPendingCitySuggestion(null);
      saveMemory({ context: {}, history: [] });
    }
    wasAuthenticatedRef.current = isAuthenticated;
  }, [auth.isAuthenticated]);

  function scrollToBottom() {
    queueMicrotask(() => {
      scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  function pushTurn(role, content, nextChat = chat, contextOverride = context) {
    const updated = [...nextChat, { role, content }];
    setChat(updated);
    saveMemory({ context: contextOverride || {}, history: updated });
    scrollToBottom();
    return updated;
  }

  function startGuidedFlow() {
    if (loading) return;
    const nextContext = {};
    const question = getGuideQuestion(nextContext, null);
    if (!question) return;
    const nextChat = [{ role: "assistant", content: question }];
    setGuideEnabled(true);
    setPendingCitySuggestion(null);
    setContext(nextContext);
    setChat(nextChat);
    setMessage("");
    setConfirmDraft(null);
    saveMemory({ context: nextContext, history: nextChat });
    scrollToBottom();
    inputRef.current?.focus();
  }

  async function prepareBookingFromAction(action, recommendations, userText) {
    const rawCity = action?.city || context?.city;
    const city = resolveCityBilingual(rawCity);
    let checkIn = action?.checkIn || context?.checkIn || null;
    let checkOut = action?.checkOut || context?.checkOut || null;
    const guests = Number(action?.guests || context?.guests || 0);
    if (!checkIn || !checkOut || guests <= 0) {
      throw new Error("Before booking, please provide check-in date, check-out date, and number of guests.");
    }
    if (isIsoOnOrBefore(checkOut, checkIn)) {
      checkOut = addDaysIso(checkIn, 1);
    }

    let hotelId = action?.hotelId || null;
    let hotelName = action?.hotelName || null;

    const pickIndex = parseUserPickIndex(userText);
    if (!hotelId && Array.isArray(recommendations) && recommendations.length && typeof pickIndex === "number") {
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
      } else if (list.length > 1) {
        throw new Error("I found multiple hotels with that name. Please choose the exact hotel from the list.");
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
    // Go directly to selected hotel's details with active filters.
    navigate(`/hotels/${hotelId}?${query.toString()}`);

    const [hotel, rooms] = await Promise.all([
      bookingApi.getHotel(hotelId),
      bookingApi.getRoomTypes(hotelId),
    ]);

    const roomTypeId = Number(action?.roomTypeId || context?.selectedRoomTypeId || 0);
    if (!roomTypeId) {
      throw new Error("Please choose a room type before I prepare the booking.");
    }
    const room = (rooms || [])
      .filter((r) => isValidRoomName(r?.name))
      .find((r) => Number(r.id) === roomTypeId);

    if (!room) {
      throw new Error("I could not find that room type for this hotel. Please choose one of the listed room types.");
    }
    if (Number(room.capacity || 0) < guests) {
      throw new Error(`The selected room type (${room.name}) supports fewer than ${guests} guest(s). Please choose another room type.`);
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
      pushTurn("assistant", "Chat reset. You can start again anytime.", [], {});
      return;
    }
    if (shouldShowGuide(text)) {
      startGuidedFlow();
      setMessage("");
      return;
    }

    const normalizedText = normalizeDateInput(text);
    const userMeansAnyCity = isAnyCityIntent(normalizedText);
    setMessage("");
    inputRef.current?.focus();
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
        saveMemory({ context: nextContext, history: withUser });
        navigateWithContext({ navigate, updateBookingUi, ctx: nextContext, fallbackGuests: 1 });
        pushTurn(
          "assistant",
          `City set to ${nextContext.city}. Tell me your check-in date, check-out date, and number of guests.`,
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
    if (!guideEnabled && isCasualGreetingIntent(normalizedText)) {
      pushTurn("assistant", greetingReply(), withUser, context);
      return;
    }
    setLoading(true);

    try {
      // ── Guided flow (local step-by-step; no backend chat) ─────────────────────
      if (guideEnabled) {
        const hasCity = Boolean(context?.city || context?.anyCity);
        const hasDates = Boolean(context?.checkIn && context?.checkOut);
        const hasGuests = Number(context?.guests || 0) > 0;

        // Step 1: city (or any city)
        if (!hasCity) {
          if (pendingCitySuggestion) {
            if (isAffirmativeIntent(normalizedText)) {
              const resolved = pendingCitySuggestion;
              const nextContext = { ...context, city: resolved, anyCity: false };
              setPendingCitySuggestion(null);
              setContext(nextContext);
              saveMemory({ context: nextContext, history: withUser });
              navigateWithContext({ navigate, updateBookingUi, ctx: nextContext, fallbackGuests: 1 });

              pushTurn(
                "assistant",
                `Step 1 saved. City: ${resolved}. Step 2: what are your check-in and check-out dates? (YYYY-MM-DD)`,
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
          const any = isAnyCityIntent(normalizedText);
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
          const resolved = any ? "" : (cityMatch.city || extractKnownCityFromText(normalizedText) || resolveCityBilingual(normalizedText));
          if (!any && !resolved) {
            setPendingCitySuggestion(null);
            pushTurn("assistant", getGuideQuestion(context, confirmDraft), withUser, context);
            return;
          }

          const nextContext = { ...context, city: resolved || "", anyCity: any };
          setPendingCitySuggestion(null);
          setContext(nextContext);
          saveMemory({ context: nextContext, history: withUser });
          navigateWithContext({ navigate, updateBookingUi, ctx: nextContext, fallbackGuests: 1 });

          pushTurn(
            "assistant",
            `Step 1 saved. ${any ? "Any city is fine." : `City: ${resolved}.`} Step 2: what are your check-in and check-out dates? (YYYY-MM-DD)`,
            withUser,
            nextContext,
          );
          return;
        }

        // Step 2: dates
        if (!hasDates) {
          const dates = extractIsoDates(normalizedText);
          if (dates.length < 2) {
            pushTurn(
              "assistant",
              "Please provide check-in and check-out dates (YYYY-MM-DD). Example: 2026-05-10 to 2026-05-13",
              withUser,
              context,
            );
            return;
          }
          let [checkIn, checkOut] = dates;
          if (new Date(checkOut) <= new Date(checkIn)) {
            const d = new Date(checkIn);
            d.setDate(d.getDate() + 1);
            checkOut = d.toISOString().slice(0, 10);
          }

          const nextContext = { ...context, checkIn, checkOut };
          setContext(nextContext);
          saveMemory({ context: nextContext, history: withUser });
          navigateWithContext({ navigate, updateBookingUi, ctx: nextContext, fallbackGuests: 1 });

          pushTurn("assistant", "Step 2 saved. Step 3: how many guests will stay?", withUser, nextContext);
          return;
        }

        // Step 3: guests
        if (!hasGuests) {
          const guests = extractGuestsCount(normalizedText);
          if (!guests) {
            pushTurn("assistant", "Please tell me the number of guests (e.g. 2).", withUser, context);
            return;
          }
          const nextContext = { ...context, guests };
          setContext(nextContext);
          saveMemory({ context: nextContext, history: withUser });
          navigateWithContext({ navigate, updateBookingUi, ctx: nextContext, fallbackGuests: 1 });

          pushTurn(
            "assistant",
            "Perfect — I opened the results page. Choose a hotel from the UI list (or tell me a specific hotel name).",
            withUser,
            nextContext,
          );
          return;
        }
      }

      if (userMeansAnyCity && !context?.city && !Number(context?.selectedHotelId || 0)) {
        const anyContext = { ...context, anyCity: true };
        const hasDatesGuests =
          Boolean(anyContext?.checkIn) &&
          Boolean(anyContext?.checkOut) &&
          Number(anyContext?.guests || 0) > 0;
        setContext(anyContext);
        saveMemory({ context: anyContext, history: withUser });
        navigateWithContext({ navigate, updateBookingUi, ctx: anyContext, fallbackGuests: 1 });

        if (hasDatesGuests) {
          navigateWithContext({ navigate, updateBookingUi, ctx: anyContext, fallbackGuests: 1 });
          pushTurn(
            "assistant",
            `Perfect. I searched all Palestine hotels for ${anyContext.guests} guest(s), ${anyContext.checkIn} to ${anyContext.checkOut}. Choose a hotel from the list in the UI.`,
            withUser,
          );
          return;
        }

        pushTurn(
          "assistant",
          "Great, any city works. Tell me your check-in date, check-out date, and number of guests.",
          withUser,
        );
        return;
      }

      if (
        isUnsureIntent(normalizedText) &&
        !context?.city &&
        !context?.anyCity &&
        !Number(context?.selectedHotelId || 0)
      ) {
        const anyContext = { ...context, anyCity: true, city: "" };
        setContext(anyContext);
        saveMemory({ context: anyContext, history: withUser });
        navigateWithContext({ navigate, updateBookingUi, ctx: anyContext, fallbackGuests: 1 });
        pushTurn(
          "assistant",
          "No problem — I will search across any city in Palestine. Now tell me your check-in, check-out, and number of guests.",
          withUser,
          anyContext,
        );
        return;
      }

      const response = await bookingApi.assistantChat({
        message: normalizedText,
        context,
        history: withUser,
      });

      const nextContext = response?.context || context;
      const normalizedContextCity = String(nextContext?.city || "")
        .toLowerCase()
        .replace(/\s+/g, "");
      const backendUsedAnyCityAsCity =
        normalizedContextCity === "anycity" || normalizedContextCity === "any" || normalizedContextCity === "anything";
      const effectiveContext = backendUsedAnyCityAsCity
        ? { ...nextContext, city: "", anyCity: true }
        : nextContext;
      setContext(effectiveContext);
      saveMemory({ context: effectiveContext, history: withUser });

      let assistantText = response?.reply || "I processed your request.";
      const citySuggestionMatch = String(assistantText || "").match(/Did you mean\s+([^?]+)\?/i);
      const hasCityValidationReply =
        Boolean(citySuggestionMatch) ||
        /there is no city called|couldn't find ".+" as a city/i.test(String(assistantText || ""));
      if (citySuggestionMatch?.[1]) {
        setPendingCitySuggestion(citySuggestionMatch[1].trim());
      } else if (hasCityValidationReply) {
        setPendingCitySuggestion(null);
      }
      if (Array.isArray(response?.missingFields) && response.missingFields.length > 0 && !hasCityValidationReply) {
        const firstMissing = response.missingFields[0];
        if (firstMissing === "checkIn") {
          assistantText = `I found ${response?.recommendations?.length || 0} option(s) in ${nextContext?.city || "that city"}. What is your check-in date?`;
        } else if (firstMissing === "checkOut") {
          assistantText = "What is your check-out date?";
        } else if (firstMissing === "guests") {
          assistantText = "How many guests will stay?";
        } else if (firstMissing === "city") {
          assistantText = "Which city would you like to stay in?";
        }
      }
      if (response?.action?.type === "NAVIGATE_DISCOVER") {
        const actionContext = {
          ...effectiveContext,
          city: response.action.city ?? effectiveContext.city,
          checkIn: response.action.checkIn ?? effectiveContext.checkIn,
          checkOut: response.action.checkOut ?? effectiveContext.checkOut,
          guests: Number(response.action.guests ?? effectiveContext.guests ?? 1),
        };
        if (userMeansAnyCity) actionContext.anyCity = true;
        navigateWithContext({ navigate, updateBookingUi, ctx: actionContext, fallbackGuests: 1 });
      } else if (response?.action?.type === "ASK_ROOM_SELECTION") {
        const hotelId = Number(response?.action?.hotelId || effectiveContext?.selectedHotelId || 0);
        const hasDatesGuests =
          Boolean(effectiveContext?.checkIn) &&
          Boolean(effectiveContext?.checkOut) &&
          Number(effectiveContext?.guests || 0) > 0;
        if (hotelId > 0) {
          const roomContext = {
            ...effectiveContext,
            selectedHotelId: hotelId,
            selectedHotelName: response?.action?.hotelName || effectiveContext?.selectedHotelName || null,
          };
          setContext(roomContext);
          saveMemory({ context: roomContext, history: withUser });

          if (hasDatesGuests) {
            const q = new URLSearchParams();
            if (roomContext?.city) q.set("city", roomContext.city);
            q.set("from", roomContext.checkIn);
            q.set("to", roomContext.checkOut);
            q.set("guests", String(Number(roomContext.guests || 1)));
            q.set("ai", "1");
            updateBookingUi({
              city: roomContext?.city || "",
              checkInDate: roomContext.checkIn,
              checkOutDate: roomContext.checkOut,
              guests: Number(roomContext.guests || 1),
            });
            navigate(`/hotels/${hotelId}?${q.toString()}#room-types`, {
              state: { intent: { hotelId, fromAssistant: true } },
            });
            const rooms = await bookingApi.getRoomTypes(hotelId);
            const validRooms = (rooms || []).filter((room) => isValidRoomName(room?.name));
            assistantText =
              validRooms.length > 0
                ? `Which room type would you like?\n${validRooms.map((room, idx) => `${idx + 1}) ${room.name} - ${money(room.basePrice)} (capacity ${room.capacity})`).join("\n")}\nReply with room name or number.`
                : "No room types are available for this hotel.";
          } else {
            assistantText = "Great choice. Before room type, please tell me your check-in date, check-out date, and number of guests.";
          }
        }
      } else if (response?.action?.type === "PREPARE_BOOKING") {
        const draft = await prepareBookingFromAction(response.action, response.recommendations, text);
        setConfirmDraft(draft);
        assistantText +=
          `\n\nBooking summary:\n` +
          `Hotel: ${draft.hotel?.name}\n` +
          `Dates: ${draft.checkIn} to ${draft.checkOut}\n` +
          `Guests: ${draft.guests}\n` +
          `Price: ${money(draft.quote?.totalPrice)}\n\n` +
          `Please choose a payment method, then confirm booking.`;
      }

      const hasDatesGuests =
        Boolean(effectiveContext?.checkIn) &&
        Boolean(effectiveContext?.checkOut) &&
        Number(effectiveContext?.guests || 0) > 0;
      if (
        (effectiveContext?.anyCity || userMeansAnyCity) &&
        !effectiveContext?.city &&
        !Number(effectiveContext?.selectedHotelId || 0) &&
        hasDatesGuests &&
        (isCityQuestion(assistantText) || isHotelListPrompt(assistantText) || /provide you with some options|numerous hotels/i.test(assistantText))
      ) {
        const patchedContext = { ...effectiveContext, anyCity: true, city: "" };
        setContext(patchedContext);
        saveMemory({ context: patchedContext, history: withUser });
        navigateWithContext({ navigate, updateBookingUi, ctx: patchedContext, fallbackGuests: 1 });
        assistantText = `Done. I searched across all Palestine hotels for ${patchedContext.guests} guest(s), ${patchedContext.checkIn} to ${patchedContext.checkOut}. Please choose from the UI list.`;
      }
      if (
        !Number(effectiveContext?.selectedHotelId || 0) &&
        hasDatesGuests &&
        isHotelListPrompt(assistantText)
      ) {
        navigateWithContext({
          navigate,
          updateBookingUi,
          ctx: {
            ...effectiveContext,
            anyCity: Boolean(effectiveContext?.anyCity || userMeansAnyCity),
          },
          fallbackGuests: 1,
        });
      }

      // Hard navigation fallback: keep UI in sync every step.
      if (Number(effectiveContext?.selectedHotelId || 0) > 0) {
        navigateWithContext({ navigate, updateBookingUi, ctx: effectiveContext, fallbackGuests: 1 });
      } else if (
        (effectiveContext?.anyCity || effectiveContext?.city) &&
        (effectiveContext?.checkIn || effectiveContext?.checkOut || Number(effectiveContext?.guests || 0) > 0)
      ) {
        navigateWithContext({ navigate, updateBookingUi, ctx: effectiveContext, fallbackGuests: 1 });
      }

      pushTurn("assistant", assistantText, withUser);
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
    setGuideEnabled(false);
    setConfirmDraft(null);
    setPendingCitySuggestion(null);
    saveMemory({ context: {}, history: [] });
    inputRef.current?.focus();
  }

  function clearContext() {
    setContext({});
    setPendingCitySuggestion(null);
    saveMemory({ context: {}, history: chat });
  }

  return (
    <section className="home-ai">
      <div className="home-ai__glow" aria-hidden />

      {/* ── Header ── */}
      <header className="home-ai__head">
        <div className="home-ai__headRow">
          <div className="home-ai__brand" aria-label={t("assistant.brandAria")}>
            <span className="home-ai__logoWrap" aria-hidden>
              <img className="home-ai__logo" src="/ai_assistant_logo.png" alt="" />
              <span className="home-ai__pulse" aria-hidden />
            </span>
            <div className="home-ai__title">
              <div className="home-ai__titleLine">
                <strong>{t("assistant.titleHome")}</strong>
                <span className="home-ai__badge" aria-label={t("assistant.badgeAria")}>
                  {t("assistant.badgeText")}
                </span>
              </div>
            </div>
          </div>
          <div className="home-ai__headActions">
            {/* New Chat button in header (matches "after" design) */}
          <button
            type="button"
            className="home-ai__newChat"
            onClick={resetConversation}
            disabled={loading}
            aria-label={t("assistant.reset")}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M7 1v6m0 0v6m0-6H1m6 0h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {t("assistant.reset")}
          </button>
          </div>
        </div>

        <div className="home-ai__subRow">
          <span className="muted">{bookingContextHint}</span>
          <button
            type="button"
            className="home-ai__newChat"
            onClick={startGuidedFlow}
            disabled={loading}
            aria-label={t("assistant.guideMe")}
            title={t("assistant.guideMe")}
          >
            {t("assistant.guideMe")}
          </button>
        </div>

        {guideEnabled ? (
          <div className="assistant-stepper" aria-label="Booking progress">
            <div className="assistant-stepper__top">
              <span>{`Step ${flowStep.number} of 6`}</span>
              <small>{flowStep.label}</small>
            </div>
            <div className="assistant-stepper__bar" role="presentation">
              <span style={{ width: `${Math.round((flowStep.number / 6) * 100)}%` }} />
            </div>
          </div>
        ) : null}
      </header>

      {/* ── Messages ── */}
      <div className="home-ai__messages" ref={scrollerRef}>
        {chat.length === 0 ? (
          <div className="home-ai__empty">
            <div className="home-ai__emptyHero" aria-hidden>
              <img className="home-ai__emptyLogo" src="/ai_assistant_logo.png" alt="" />
            </div>
            <p className="home-ai__emptyTitle">{t("assistant.emptyTitle")}</p>
            <p className="muted">{t("assistant.emptyBody")}</p>
          </div>
        ) : (
          chat.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={`home-ai__row ${m.role === "assistant" ? "home-ai__row--bot" : "home-ai__row--user"}`}
            >
              {m.role === "assistant" && (
                <div className="home-ai__botAvatar" aria-hidden>
                  <img src="/ai_assistant_logo.png" alt="" />
                </div>
              )}
              <div className={m.role === "assistant" ? "home-ai__msg home-ai__msg--bot" : "home-ai__msg home-ai__msg--user"}>
                {m.content}
              </div>
            </div>
          ))
        )}
        {/* Typing indicator while AI is responding */}
        {loading && <TypingIndicator />}
      </div>

      {/* ── Active context pills ── */}
      <ContextPills context={context} onClear={clearContext} />

      {/* ── Quick prompt chips ── */}
      <div className="home-ai__chips" aria-label={t("assistant.quickPromptsAria")}>
        <button
          type="button"
          className="home-ai__chip"
          onClick={() => sendMessage(t("assistant.prompt1Text"))}
          disabled={loading}
        >
          <span aria-hidden>📍</span> {t("assistant.prompt1Label")}
        </button>

        <button
          type="button"
          className="home-ai__chip"
          onClick={() => sendMessage(t("assistant.prompt2Text"))}
          disabled={loading}
        >
          <span aria-hidden>💰</span> {t("assistant.prompt2Label")}
        </button>

        <button
          type="button"
          className="home-ai__chip"
          onClick={() => sendMessage(t("assistant.prompt3Text"))}
          disabled={loading}
        >
          <span aria-hidden>👨‍👩‍👧</span> {t("assistant.prompt3Label")}
        </button>
      </div>

      {/* ── Input row ── */}
      <div className="home-ai__actions">
        <input
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("assistant.inputPlaceholder")}
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
          className="home-ai__sendBtn"
          onClick={() => sendMessage()}
          disabled={loading || !message.trim()}
          aria-label={t("assistant.send")}
        >
          {loading ? (
            <span className="home-ai__sendSpinner" aria-hidden />
          ) : (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M3 10L17 3l-7 7 7 7-14-7z" fill="currentColor"/>
            </svg>
          )}
        </button>
      </div>

      {/* ── Booking confirmation panel ── */}
      <div className="home-ai__confirm">
        {confirmDraft ? (
          <>
            <button type="button" className="btn btn-primary" onClick={continueToPayment} disabled={loading}>
              Continue to payment
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setConfirmDraft(null)} disabled={loading}>
              {t("assistant.cancel")}
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}

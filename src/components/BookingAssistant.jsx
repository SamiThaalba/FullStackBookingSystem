import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { bookingApi, buildBookingCreatePayload } from "../api/bookingApi";
import { useAuth } from "../auth/AuthContext";
import { useBookingUi } from "../context/BookingUiContext";
import { parseUserPickIndex, resolveCityBilingual } from "../utils/aiAssistant";
import { money } from "../utils/format";
import { tomorrowIso } from "../utils/dates";

const ASSISTANT_MEMORY_KEY = "quickreserve-ai-memory-v2";

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
  const match = value.match(/you['’]ve selected\s+(.+?)\.\s+what are your check-in and check-out dates\?/i);
  return match?.[1]?.trim() || null;
}

function extractCityCorrection(text) {
  const value = String(text || "").trim();
  const match = value.match(/^(?:i mean|no[, ]*i mean)\s+([a-zA-Z\u0600-\u06FF\s-]+)$/i);
  if (!match?.[1]) return "";
  return resolveCityBilingual(match[1].trim());
}

function getStrictCurrentStep(context, confirmDraft) {
  const hasCity = Boolean(context?.city || context?.anyCity);
  const hasDatesGuests = Boolean(context?.checkIn && context?.checkOut && Number(context?.guests || 0) > 0);
  const hasHotel = Number(context?.selectedHotelId || 0) > 0;
  const hasRoom = Number(context?.selectedRoomTypeId || 0) > 0;
  if (!hasCity) return 2;
  if (!hasDatesGuests) return 3;
  if (!hasHotel) return 4;
  if (!hasRoom) return 6;
  return confirmDraft ? 7 : 7;
}

function getFlowStep(context, confirmDraft) {
  const hasCityOrHotel = Boolean(context?.city || context?.selectedHotelId);
  const hasDatesGuests = Boolean(context?.checkIn && context?.checkOut && Number(context?.guests || 0) > 0);
  const hasHotel = Number(context?.selectedHotelId || 0) > 0;
  const hasRoom = Number(context?.selectedRoomTypeId || 0) > 0;

  if (!hasCityOrHotel) return { number: 1, label: "Choose destination" };
  if (!hasDatesGuests) return { number: 2, label: "Choose dates & guests" };
  if (!hasHotel) return { number: 3, label: "Choose hotel" };
  if (!hasRoom) return { number: 4, label: "Choose room type" };
  if (!confirmDraft) return { number: 5, label: "Review booking" };
  return { number: 6, label: "Confirm payment & booking" };
}

function getGuideQuestion(context, confirmDraft) {
  if (!context?.city && !Number(context?.selectedHotelId || 0)) {
    return "Great, let's do this step by step. First question: which city do you want to stay in?";
  }
  if (!context?.checkIn) {
    return "Perfect. What is your check-in date? (YYYY-MM-DD)";
  }
  if (!context?.checkOut) {
    return "Got it. What is your check-out date? (YYYY-MM-DD)";
  }
  if (!Number(context?.guests || 0)) {
    return "How many guests will stay?";
  }
  if (!Number(context?.selectedHotelId || 0)) {
    return "Which hotel would you like to choose from the available options?";
  }
  if (!Number(context?.selectedRoomTypeId || 0)) {
    return "Which room type would you like for this hotel?";
  }
  if (!confirmDraft) {
    return "I can prepare your booking now. Should I continue?";
  }
  if (!confirmDraft?.paymentMethod) {
    return "Please choose a payment method, then press Confirm booking.";
  }
  return "Everything is ready. Press Confirm booking when you are ready.";
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

export default function BookingAssistant({ embedded = false }) {
  const auth = useAuth();
  const { updateBookingUi } = useBookingUi();
  const navigate = useNavigate();
  const location = useLocation();
  const initialMemory = useMemo(() => loadMemory(), []);
  const [open, setOpen] = useState(embedded);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState(() => initialMemory.history);
  const [context, setContext] = useState(() => initialMemory.context);
  const [loading, setLoading] = useState(false);
  const [confirmDraft, setConfirmDraft] = useState(null);
  const [hotelOptions, setHotelOptions] = useState([]);
  const [roomOptions, setRoomOptions] = useState([]);
  const [selectedRoomOptionId, setSelectedRoomOptionId] = useState(null);
  const [guideEnabled, setGuideEnabled] = useState(false);
  const wasAuthenticatedRef = useRef(Boolean(auth.isAuthenticated));
  const scrollerRef = useRef(null);
  const inputRef = useRef(null);

  const canUseAssistant = true;

  const bookingContextHint = location.pathname.startsWith("/hotels")
    ? "Using current discover/booking context."
    : "I can search hotels and complete booking steps for you.";

  if (!canUseAssistant) return null;

  useEffect(() => {
    if (embedded) {
      setOpen(true);
    }
  }, [embedded]);

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
      setGuideEnabled(false);
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
    const shouldSyncWithHotelsPage =
      open &&
      !loading &&
      !confirmDraft &&
      hotelOptions.length > 0 &&
      !Number(context?.selectedHotelId || 0) &&
      location.pathname === "/hotels";
    if (!shouldSyncWithHotelsPage) return;

    let cancelled = false;
    const params = new URLSearchParams(location.search || "");
    const city = params.get("city") || context?.city || undefined;
    const from = params.get("from") || context?.checkIn || undefined;
    const to = params.get("to") || context?.checkOut || undefined;
    const guests = Number(params.get("guests") || context?.guests || 1);
    const page = Number(params.get("page") || 0);
    const size = Number(params.get("size") || 10);

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
    saveMemory({ context: contextOverride || {}, history: updated });
    queueMicrotask(() => {
      scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
    });
    return updated;
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
    if (new Date(checkOut) <= new Date(checkIn)) {
      const d = new Date(checkIn);
      d.setDate(d.getDate() + 1);
      checkOut = d.toISOString().slice(0, 10);
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
    let room = null;
    if (roomTypeId > 0) {
      room = validRooms.find((r) => Number(r.id) === roomTypeId) || null;
    }
    if (!room) {
      room = [...validRooms]
        .filter((r) => Number(r.capacity || 0) >= guests)
        .sort((a, b) => Number(a.basePrice || 0) - Number(b.basePrice || 0))[0] || null;
    }
    if (!room) {
      throw new Error(`I found ${hotelName || hotel?.name || "the hotel"}, but no room can host ${guests} guest(s).`);
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
    if (shouldShowGuide(text)) {
      setGuideEnabled(true);
    }
    const userMeansAnyCity = isAnyCityIntent(text);
    setMessage("");
    const withUser = pushTurn("user", text);
    setLoading(true);

    try {
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

      const response = await bookingApi.assistantChat({
        message: text,
        context,
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
      const correctedCity = extractCityCorrection(text);
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
      setContext(effectiveContext);
      saveMemory({ context: effectiveContext, history: withUser });

      let assistantText = response?.reply || "I processed your request.";
      if (correctedCity) {
        assistantText = `Updated city to ${correctedCity}. Please provide check-in date, check-out date, and number of guests.`;
      }
      setHotelOptions([]);
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
          size: 10,
        });
        const allList = allResp?.content || [];
        setHotelOptions(allList.map(toHotelOption).filter((hotel) => hotel.id > 0 && hotel.name));
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
          const city = response?.action?.city || nextContext?.city;
          const checkIn = response?.action?.checkIn || nextContext?.checkIn;
          const checkOut = response?.action?.checkOut || nextContext?.checkOut;
          const guests = Number(response?.action?.guests || nextContext?.guests || 1);
          const uiHotelsResp = await bookingApi.listHotels({
            city,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            guests,
            page: 0,
            size: 5,
          });
          const uiHotels = uiHotelsResp?.content || [];
          const uiMessage = formatHotelChoicesMessage(uiHotels);
          if (uiHotels.length > 0) {
            setHotelOptions(uiHotels.map(toHotelOption).filter((hotel) => hotel.id > 0 && hotel.name));
          }
          if (uiMessage) {
            assistantText = uiMessage;
          }
        } catch {
          // Keep backend text if synced list fails.
        }
      }
      if (
        !Number(nextContext?.selectedHotelId || 0) &&
        Array.isArray(response?.recommendations) &&
        response.recommendations.length > 0 &&
        hotelOptions.length === 0
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
        if (hotelId > 0 && hasDatesGuests) {
          navigate(`/hotels/${hotelId}?ai=1#room-types`, { state: { intent: { hotelId, fromAssistant: true } } });
          const rooms = await bookingApi.getRoomTypes(hotelId);
          const validRooms = (rooms || []).filter((room) => isValidRoomName(room?.name));
          const options = validRooms.map((room, idx) =>
            `${idx + 1}) ${room.name} - ${money(room.basePrice)} (capacity ${room.capacity})`
          );
          setRoomOptions(validRooms);
          setSelectedRoomOptionId(Number(nextContext?.selectedRoomTypeId || 0) || null);
          if (options.length > 0) {
            assistantText = `${assistantText}\n${options.join("\n")}\nReply with room name or number.`;
          }
        } else if (hotelId > 0 && !hasDatesGuests) {
          setRoomOptions([]);
          assistantText = "Great choice. Before room type, please tell me your check-in date, check-out date, and number of guests.";
        }
      } else if (response?.action?.type === "PREPARE_BOOKING") {
        setRoomOptions([]);
        setSelectedRoomOptionId(Number(nextContext?.selectedRoomTypeId || 0) || null);
        const draft = await prepareBookingFromAction(response.action, response.recommendations, text);
        setConfirmDraft(draft);
        assistantText +=
          `\n\nBooking summary:\n` +
          `Hotel: ${draft.hotel?.name}\n` +
          `Room type: ${draft.room?.name}\n` +
          `Dates: ${draft.checkIn} to ${draft.checkOut}\n` +
          `Guests: ${draft.guests}\n` +
          `Price: ${money(draft.quote?.totalPrice)}\n\n` +
          `Do you want to confirm this booking?\n` +
          `Please choose a payment method, then press Confirm booking.`;
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
          const checkIn = nextContext?.checkIn || tomorrowIso();
          let checkOut = nextContext?.checkOut;
          if (!checkOut || new Date(checkOut) <= new Date(checkIn)) {
            const d = new Date(checkIn);
            d.setDate(d.getDate() + 1);
            checkOut = d.toISOString().slice(0, 10);
          }
          const guests = Number(nextContext?.guests || 1);
          const query = new URLSearchParams();
          query.set("from", checkIn);
          query.set("to", checkOut);
          query.set("guests", String(guests));
          updateBookingUi({
            city: nextContext?.city || "",
            checkInDate: checkIn,
            checkOutDate: checkOut,
            guests,
          });
          navigate(`/hotels/${hotelId}?${query.toString()}`);
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

      const strictStep = getStrictCurrentStep(effectiveContext, confirmDraft);
      if (strictStep === 2) {
        setHotelOptions([]);
        setRoomOptions([]);
        assistantText = "Which city would you like to stay in?";
      } else if (strictStep === 3) {
        setRoomOptions([]);
        assistantText = "Please provide check-in date, check-out date, and number of guests.";
      } else if (strictStep === 4) {
        const hotelsResp = await bookingApi.listHotels({
          city: effectiveContext?.anyCity ? undefined : effectiveContext?.city,
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
      } else if (strictStep === 6) {
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

  async function confirmBooking() {
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
    if (!confirmDraft.paymentMethod) {
      pushTurn("assistant", "Please select a payment method before I complete the booking.");
      return;
    }

    setLoading(true);
    const baseChat = [...chat];
    try {
      try {
        const myBookings = await bookingApi.myBookings();
        const duplicate = (myBookings || []).some(
          (b) =>
            Number(b.hotelId) === Number(confirmDraft.hotel.id) &&
            Number(b.roomTypeId) === Number(confirmDraft.room.id) &&
            b.startDate === confirmDraft.checkIn &&
            b.endDate === confirmDraft.checkOut &&
            b.status !== "CANCELLED",
        );
        if (duplicate) {
          pushTurn("assistant", "I stopped because this booking already exists in your account.", baseChat);
          setConfirmDraft(null);
          return;
        }
      } catch {
        // If duplicate-check endpoint is unavailable for this user, continue with booking attempt.
      }

      const booking = await bookingApi.createBooking(buildBookingCreatePayload(confirmDraft));
      const payment = await bookingApi.createPayment(booking.id);
      await bookingApi.processPayment(payment.id, true);
      const confirmed = await bookingApi.confirmBooking(booking.id);

      pushTurn("assistant", "Your booking is confirmed. Opening your confirmation page.", baseChat);
      navigate(`/confirmation/${booking.id}`, {
        state: { booking: confirmed, hotel: confirmDraft.hotel, room: confirmDraft.room, payment },
      });
      setConfirmDraft(null);
    } catch (err) {
      pushTurn("assistant", humanizeError(err) + " You can retry confirmation or adjust details.", baseChat);
    } finally {
      setLoading(false);
    }
  }

  function resetConversation() {
    setContext({});
    setChat([]);
    setConfirmDraft(null);
    setHotelOptions([]);
    setRoomOptions([]);
    setSelectedRoomOptionId(null);
    setGuideEnabled(false);
    saveMemory({ context: {}, history: [] });
  }

  function chooseHotelOption(hotel) {
    if (!hotel || loading) return;
    setHotelOptions([]);
    setRoomOptions([]);
    setSelectedRoomOptionId(null);
    sendMessage(hotel.name);
  }

  function chooseRoomOption(room) {
    if (!room || loading) return;
    setSelectedRoomOptionId(Number(room.id));
    setRoomOptions([]);
    sendMessage(room.name);
  }

  function startGuidedFlow() {
    setGuideEnabled(true);
    if (loading) return;
    const question = getGuideQuestion(context, confirmDraft);
    if (!question) return;
    const last = chat[chat.length - 1];
    if (last?.role === "assistant" && String(last?.content || "").trim() === question) return;
    pushTurn("assistant", question);
  }

  const hasUnread = !open && chat.length > 0 && chat[chat.length - 1]?.role === "assistant";
  const flowStep = getFlowStep(context, confirmDraft);

  return (
    <div className={`assistant-shell ${embedded ? "assistant-shell--embedded" : ""}`}>
      {/* Floating toggle button */}
      {!embedded && (
        <button
          type="button"
          className={`assistant-toggle ${open ? "assistant-toggle--open" : ""}`}
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        >
          {open ? (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.06L2 22l4.94-1.38A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" fill="currentColor" opacity=".18"/>
                <path d="M8 12h8M8 8h5M8 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <span>AI Assistant</span>
              {hasUnread && <span className="assistant-toggle__dot" aria-hidden />}
            </>
          )}
        </button>
      )}

      {open && (
        <section className={`assistant-panel ${embedded ? "assistant-panel--embedded" : ""}`}>
          {/* Header */}
          <div className="assistant-head">
            <div className="assistant-head__brand">
              <div className="assistant-head__avatar">
                <img src="/ai_assistant_logo.png" alt="" />
              </div>
              <div>
                <strong>{embedded ? "AI Travel Assistant" : "AI Booking Concierge"}</strong>
                <span className="muted">
                  {embedded
                    ? "Ask for city, dates, guests, or a specific hotel name. I will guide each step clearly."
                    : bookingContextHint}
                </span>
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
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {!guideEnabled ? (
                <button
                  type="button"
                  className="assistant-head__newChat"
                  onClick={startGuidedFlow}
                  disabled={loading}
                  aria-label="Guide me"
                  title="Guide me"
                >
                  Guide me
                </button>
              ) : null}
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
                New Chat
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
          <div className="assistant-actions">
            <input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Book me a hotel in Ramallah for tomorrow"
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
            {hotelOptions.length > 0 && !confirmDraft ? (
              <div className="assistant-roomOptions">
                {hotelOptions.map((hotel) => (
                  <button
                    key={hotel.id}
                    type="button"
                    className="assistant-roomOption"
                    onClick={() => chooseHotelOption(hotel)}
                    disabled={loading}
                  >
                    <span>{hotel.name}</span>
                    <small>
                      {hotel.city || "Hotel"}
                      {hotel.price > 0 ? ` | from ${money(hotel.price)}` : ""}
                    </small>
                  </button>
                ))}
              </div>
            ) : null}
            {roomOptions.length > 0 && !confirmDraft ? (
              <div className="assistant-roomOptions">
                {roomOptions.map((room) => {
                  const isSelected = Number(selectedRoomOptionId) === Number(room.id);
                  return (
                    <button
                      key={room.id}
                      type="button"
                      className={`assistant-roomOption ${isSelected ? "assistant-roomOption--selected" : ""}`}
                      onClick={() => chooseRoomOption(room)}
                      disabled={loading}
                    >
                      <span>{room.name}</span>
                      <small>{money(room.basePrice)} | cap {room.capacity}</small>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {confirmDraft ? (
              <>
                <select
                  value={confirmDraft.paymentMethod || ""}
                  onChange={(e) =>
                    setConfirmDraft((current) =>
                      current ? { ...current, paymentMethod: e.target.value } : current,
                    )
                  }
                  disabled={loading}
                >
                  <option value="">Select payment method</option>
                  <option value="mock_card">Card (auto-filled)</option>
                </select>
                <button type="button" className="btn btn-primary btn-small" onClick={confirmBooking} disabled={loading}>
                  Confirm booking
                </button>
                <button type="button" className="btn btn-outline btn-small" onClick={() => setConfirmDraft(null)} disabled={loading}>
                  Cancel
                </button>
              </>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}

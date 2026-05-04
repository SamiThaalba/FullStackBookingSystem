import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { bookingApi } from "../api/bookingApi";
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
  const [confirmDraft, setConfirmDraft] = useState(null);
  const scrollerRef = useRef(null);
  const inputRef = useRef(null);
  const wasAuthenticatedRef = useRef(Boolean(auth.isAuthenticated));

  const bookingContextHint = location.pathname.startsWith("/hotels")
    ? t("assistant.hintHotels")
    : t("assistant.hintHome");

  useEffect(() => {
    const wasAuthenticated = wasAuthenticatedRef.current;
    const isAuthenticated = Boolean(auth.isAuthenticated);
    if (wasAuthenticated && !isAuthenticated) {
      setContext({});
      setChat([]);
      setConfirmDraft(null);
      saveMemory({ context: {}, history: [] });
    }
    wasAuthenticatedRef.current = isAuthenticated;
  }, [auth.isAuthenticated]);

  function scrollToBottom() {
    queueMicrotask(() => {
      scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  function pushTurn(role, content, nextChat = chat) {
    const updated = [...nextChat, { role, content }];
    setChat(updated);
    saveMemory({ context, history: updated });
    scrollToBottom();
    return updated;
  }

  async function prepareBookingFromAction(action, recommendations, userText) {
    const rawCity = action?.city || context?.city;
    const city = resolveCityBilingual(rawCity);
    let checkIn = action?.checkIn || context?.checkIn || tomorrowIso();
    let checkOut = action?.checkOut || context?.checkOut || (() => {
      const d = new Date(checkIn);
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    })();
    const guests = Number(action?.guests || context?.guests || 1);
    if (new Date(checkOut) <= new Date(checkIn)) {
      const d = new Date(checkIn);
      d.setDate(d.getDate() + 1);
      checkOut = d.toISOString().slice(0, 10);
    }

    let hotelId = action?.hotelId || null;
    let hotelName = action?.hotelName || null;

    const pickIndex = parseUserPickIndex(userText);
    if (!hotelId && Array.isArray(recommendations) && recommendations.length) {
      const idx =
        typeof pickIndex === "number" && pickIndex >= 0 && pickIndex < recommendations.length
          ? pickIndex
          : 0;
      hotelId = recommendations[idx].hotelId;
      hotelName = recommendations[idx].hotelName;
    }

    if (!hotelId && hotelName) {
      const resp = await bookingApi.listHotels({ name: hotelName, page: 0, size: 5 });
      const list = resp?.content || [];
      if (list.length) {
        hotelId = list[0].id;
      }
    }

    if (!hotelId && city) {
      const resp = await bookingApi.listHotels({ city, page: 0, size: 5 });
      const list = resp?.content || [];
      if (!list.length) {
        throw new Error(`No hotels found in ${city}. Try another city or dates.`);
      }
      hotelId = list[0].id;
      hotelName = list[0].name;
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
    navigate(`/hotels?${query.toString()}`);

    navigate(
      `/hotels/${hotelId}?from=${encodeURIComponent(checkIn || "")}&to=${encodeURIComponent(checkOut || "")}&guests=${guests}`,
    );

    const [hotel, rooms] = await Promise.all([
      bookingApi.getHotel(hotelId),
      bookingApi.getRoomTypes(hotelId),
    ]);

    const room = [...(rooms || [])]
      .filter((r) => Number(r.capacity || 0) >= guests)
      .sort((a, b) => Number(a.basePrice || 0) - Number(b.basePrice || 0))[0];

    if (!room) {
      throw new Error(
        `I found ${hotelName || hotel?.name || "the hotel"}, but there is no suitable room for ${guests} guest(s).`,
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
    setMessage("");
    inputRef.current?.focus();
    const withUser = pushTurn("user", text);
    setLoading(true);

    try {
      const response = await bookingApi.assistantChat({
        message: text,
        context,
        history: withUser,
      });

      const nextContext = response?.context || context;
      setContext(nextContext);
      saveMemory({ context: nextContext, history: withUser });

      let assistantText = response?.reply || "I processed your request.";
      if (Array.isArray(response?.missingFields) && response.missingFields.length > 0) {
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
        const q = new URLSearchParams();
        if (response.action.city) q.set("city", response.action.city);
        if (response.action.checkIn) q.set("from", response.action.checkIn);
        if (response.action.checkOut) q.set("to", response.action.checkOut);
        if (response.action.guests) q.set("guests", String(response.action.guests));
        updateBookingUi({
          city: response.action.city || "",
          checkInDate: response.action.checkIn,
          checkOutDate: response.action.checkOut,
          guests: Number(response.action.guests || 1),
        });
        navigate(`/hotels?${q.toString()}`);
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

      pushTurn("assistant", assistantText, withUser);
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
      const booking = await bookingApi.createBooking({
        hotelId: Number(confirmDraft.hotel.id),
        roomTypeId: Number(confirmDraft.room.id),
        startDate: confirmDraft.checkIn,
        endDate: confirmDraft.checkOut,
        checkInDate: confirmDraft.checkIn,
        checkOutDate: confirmDraft.checkOut,
      });
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
    saveMemory({ context: {}, history: [] });
    inputRef.current?.focus();
  }

  function clearContext() {
    setContext({});
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
              <span className="muted">{bookingContextHint}</span>
            </div>
          </div>
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
            <select
              value={confirmDraft.paymentMethod || ""}
              onChange={(e) =>
                setConfirmDraft((current) => (current ? { ...current, paymentMethod: e.target.value } : current))
              }
              disabled={loading}
            >
              <option value="">{t("assistant.selectPayment")}</option>
              <option value="mock_card">{t("assistant.paymentCard")}</option>
            </select>
            <button type="button" className="btn btn-primary" onClick={confirmBooking} disabled={loading}>
              {t("assistant.confirmBooking")}
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

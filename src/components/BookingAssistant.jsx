import { useEffect, useMemo, useRef, useState } from "react";
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

export default function BookingAssistant() {
  const auth = useAuth();
  const { updateBookingUi } = useBookingUi();
  const navigate = useNavigate();
  const location = useLocation();
  const initialMemory = useMemo(() => loadMemory(), []);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState(() => initialMemory.history);
  const [context, setContext] = useState(() => initialMemory.context);
  const [loading, setLoading] = useState(false);
  const [confirmDraft, setConfirmDraft] = useState(null);
  const wasAuthenticatedRef = useRef(Boolean(auth.isAuthenticated));
  const scrollerRef = useRef(null);
  const inputRef = useRef(null);

  const canUseAssistant = true;

  const bookingContextHint = location.pathname.startsWith("/hotels")
    ? "Using current discover/booking context."
    : "I can search hotels and complete booking steps for you.";

  if (!canUseAssistant) return null;

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

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
        inputRef.current?.focus();
      });
    }
  }, [open]);

  function pushTurn(role, content, nextChat = chat) {
    const updated = [...nextChat, { role, content }];
    setChat(updated);
    saveMemory({ context, history: updated });
    queueMicrotask(() => {
      scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
    });
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
    console.info("[BookingUi] AI updated dates/city", { city, checkIn, checkOut, guests });
    // Go directly to the selected hotel's details for the booking flow.
    navigate(`/hotels/${hotelId}?${query.toString()}`);

    const [hotel, rooms] = await Promise.all([
      bookingApi.getHotel(hotelId),
      bookingApi.getRoomTypes(hotelId),
    ]);

    const room = [...(rooms || [])]
      .filter((r) => Number(r.capacity || 0) >= guests)
      .sort((a, b) => Number(a.basePrice || 0) - Number(b.basePrice || 0))[0];

    if (!room) {
      throw new Error(`I found ${hotelName || hotel?.name || "the hotel"}, but there is no suitable room for ${guests} guest(s).`);
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
  }

  const hasUnread = !open && chat.length > 0 && chat[chat.length - 1]?.role === "assistant";

  return (
    <div className="assistant-shell">
      {/* Floating toggle button */}
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

      {open && (
        <section className="assistant-panel">
          {/* Header */}
          <div className="assistant-head">
            <div className="assistant-head__brand">
              <div className="assistant-head__avatar">
                <img src="/ai_assistant_logo.png" alt="" />
              </div>
              <div>
                <strong>AI Booking Concierge</strong>
                <span className="muted">{bookingContextHint}</span>
              </div>
            </div>
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

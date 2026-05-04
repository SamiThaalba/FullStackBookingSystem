import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { bookingApi } from "../api/bookingApi";
import { useAuth } from "../auth/AuthContext";
import { useBookingUi } from "../context/BookingUiContext";
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

  function pushTurn(role, content, nextChat = chat) {
    const updated = [...nextChat, { role, content }];
    setChat(updated);
    saveMemory({ context, history: updated });
    return updated;
  }

  async function prepareBookingFromAction(action, recommendations) {
    const city = action?.city || context?.city;
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
    if (!hotelId && Array.isArray(recommendations) && recommendations.length) {
      hotelId = recommendations[0].hotelId;
      hotelName = recommendations[0].hotelName;
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

  async function sendMessage() {
    if (!message.trim() || loading) return;
    const text = message.trim();
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
        console.info("[BookingUi] AI navigate action", response.action);
        navigate(`/hotels?${q.toString()}`);
      } else if (response?.action?.type === "PREPARE_BOOKING") {
        const draft = await prepareBookingFromAction(response.action, response.recommendations);
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

  return (
    <div className="assistant-shell">
      <button type="button" className="assistant-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? "Close Assistant" : "AI Assistant"}
      </button>
      {open ? (
        <section className="assistant-panel">
          <div className="assistant-head">
            <strong>Conversational Booking AI</strong>
            <span className="muted">{bookingContextHint}</span>
          </div>
          <div className="assistant-messages">
            {chat.length === 0 ? (
              <p className="muted">Tell me what you want, and I will handle search, follow-ups, and booking steps.</p>
            ) : (
              chat.map((m, i) => (
                <div key={`${m.role}-${i}`} className={`assistant-row ${m.role === "assistant" ? "assistant-row--bot" : "assistant-row--user"}`}>
                  <div className={m.role === "assistant" ? "assistant-msg" : "user-msg"}>
                    {m.content}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="assistant-actions">
            <input
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
            <button type="button" className="btn btn-teal btn-small" onClick={sendMessage} disabled={loading}>
              {loading ? "Thinking..." : "Send"}
            </button>
          </div>
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
            <button type="button" className="btn btn-outline btn-small" onClick={resetConversation} disabled={loading}>
              Reset context
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

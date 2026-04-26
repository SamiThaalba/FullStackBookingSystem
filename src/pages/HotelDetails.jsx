import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { bookingApi } from "../api/bookingApi";
import Alert from "../components/Alert";
import { nightsBetween, todayIso, tomorrowIso } from "../utils/dates";
import { compactAddress, money } from "../utils/format";

export default function HotelDetails() {
  const { hotelId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [dates, setDates] = useState({
    checkIn: searchParams.get("from") || todayIso(),
    checkOut: searchParams.get("to") || tomorrowIso(),
    guests: Number(searchParams.get("guests") || 1),
  });
  const [quote, setQuote] = useState(null);

  const hotelQuery = useQuery({
    queryKey: ["hotel", hotelId],
    queryFn: () => bookingApi.getHotel(hotelId),
  });

  const roomQuery = useQuery({
    queryKey: ["rooms", hotelId],
    queryFn: () => bookingApi.getRoomTypes(hotelId),
  });

  const quoteMutation = useMutation({
    mutationFn: (room) =>
      bookingApi.checkAvailability({
        roomTypeId: room.id,
        checkIn: dates.checkIn,
        checkOut: dates.checkOut,
        numberOfGuests: Number(dates.guests),
      }),
    onSuccess: (data, room) => {
      setSelectedRoom(room);
      setQuote(data);
    },
  });

  const bookingMutation = useMutation({
    mutationFn: () =>
      bookingApi.createBooking({
        hotelId: Number(hotelId),
        roomTypeId: selectedRoom.id,
        startDate: dates.checkIn,
        endDate: dates.checkOut,
      }),
    onSuccess: async (booking) => {
      try {
        await bookingApi.createPayment(booking.id);
      } finally {
        navigate(`/confirmation/${booking.id}`, { state: { booking, hotel: hotelQuery.data, room: selectedRoom } });
      }
    },
  });

  const hotel = hotelQuery.data;
  const rooms = roomQuery.data || hotel?.roomTypes || [];
  const nights = nightsBetween(dates.checkIn, dates.checkOut);

  if (hotelQuery.isLoading) return <div className="container empty-state">Loading hotel...</div>;

  return (
    <section className="container detail-page">
      <Alert type="error">{hotelQuery.error?.message || roomQuery.error?.message}</Alert>
      {hotel && (
        <>
          <div className="detail-hero">
            <div>
              <p className="eyebrow">{hotel.city}, {hotel.country}</p>
              <h1>{hotel.name}</h1>
              <p>{compactAddress(hotel)}</p>
              <p className="muted">{hotel.description || "Comfortable rooms in a convenient city location."}</p>
            </div>
            <div className="gallery-card">
              {hotel.imageUrl ? <img src={hotel.imageUrl} alt={hotel.name} /> : <span>Hotel gallery</span>}
            </div>
          </div>

          <div className="booking-panel">
            <label>
              Check in
              <input
                type="date"
                value={dates.checkIn}
                onChange={(event) => setDates({ ...dates, checkIn: event.target.value })}
              />
            </label>
            <label>
              Check out
              <input
                type="date"
                value={dates.checkOut}
                onChange={(event) => setDates({ ...dates, checkOut: event.target.value })}
              />
            </label>
            <label>
              Guests
              <input
                type="number"
                min="1"
                value={dates.guests}
                onChange={(event) => setDates({ ...dates, guests: event.target.value })}
              />
            </label>
            <strong>{nights} night stay</strong>
          </div>

          <div className="split-grid">
            <div>
              <h2>Room types</h2>
              <Alert type="error">{quoteMutation.error?.message || bookingMutation.error?.message}</Alert>
              <div className="room-list">
                {rooms.map((room) => (
                  <article className="room-card" key={room.id}>
                    <div>
                      <h3>{room.name}</h3>
                      <p>{room.description || "Flexible room for your trip."}</p>
                      <div className="amenity-row">
                        <span>Sleeps {room.capacity}</span>
                        <span>{room.inventoryCount} rooms</span>
                        {(room.amenities || []).slice(0, 3).map((amenity) => (
                          <span key={amenity}>{amenity}</span>
                        ))}
                      </div>
                    </div>
                    <div className="room-price">
                      <strong>{money(room.basePrice)}</strong>
                      <span>per night</span>
                      <button className="btn btn-teal" onClick={() => quoteMutation.mutate(room)}>
                        Check availability
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="quote-card">
              <h2>Your quote</h2>
              {quote ? (
                <>
                  <p>{quote.message}</p>
                  <div className="price-line">
                    <span>Room</span>
                    <strong>{selectedRoom?.name}</strong>
                  </div>
                  <div className="price-line">
                    <span>Total</span>
                    <strong>{money(quote.totalPrice)}</strong>
                  </div>
                  <button
                    className="btn btn-primary btn-full"
                    disabled={!quote.available || bookingMutation.isPending}
                    onClick={() => bookingMutation.mutate()}
                  >
                    {bookingMutation.isPending ? "Booking..." : "Create booking"}
                  </button>
                </>
              ) : (
                <p className="muted">Choose a room to see availability and price breakdown.</p>
              )}
            </aside>
          </div>
        </>
      )}
    </section>
  );
}

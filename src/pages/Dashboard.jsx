import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { bookingApi } from "../api/bookingApi";
import Alert from "../components/Alert";
import { formatDate, money } from "../utils/format";

const emptyHotel = {
  name: "",
  description: "",
  imageUrl: "",
  address: "",
  city: "",
  country: "UK",
  phone: "",
  email: "",
  managerId: "",
};

const emptyRoom = {
  hotelId: "",
  name: "",
  description: "",
  capacity: 2,
  inventoryCount: 10,
  basePrice: 95,
  amenities: "WiFi, Parking, Restaurant",
};

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [hotelForm, setHotelForm] = useState(emptyHotel);
  const [roomForm, setRoomForm] = useState(emptyRoom);

  const hotelsQuery = useQuery({
    queryKey: ["dashboard-hotels"],
    queryFn: () => bookingApi.listHotels({ page: 0, size: 50 }),
  });

  const upcomingQuery = useQuery({
    queryKey: ["upcoming-bookings"],
    queryFn: () => bookingApi.upcomingBookings(),
  });

  const createHotel = useMutation({
    mutationFn: (payload) => bookingApi.createHotel(normalizeHotel(payload)),
    onSuccess: () => {
      setHotelForm(emptyHotel);
      queryClient.invalidateQueries({ queryKey: ["dashboard-hotels"] });
    },
  });

  const createRoom = useMutation({
    mutationFn: (payload) => bookingApi.createRoomType(normalizeRoom(payload)),
    onSuccess: () => setRoomForm(emptyRoom),
  });

  const deleteHotel = useMutation({
    mutationFn: bookingApi.deleteHotel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard-hotels"] }),
  });

  const hotels = hotelsQuery.data?.content || [];
  const upcoming = upcomingQuery.data || [];

  return (
    <section className="container dashboard-page">
      <div className="section-heading">
        <p className="eyebrow">Business</p>
        <h1>Manager dashboard</h1>
        <p>Manage hotels, add room types, and review upcoming bookings.</p>
      </div>

      <Alert type="error">
        {hotelsQuery.error?.message ||
          upcomingQuery.error?.message ||
          createHotel.error?.message ||
          createRoom.error?.message ||
          deleteHotel.error?.message}
      </Alert>

      <div className="dashboard-grid">
        <form className="panel stack-form" onSubmit={(event) => submitForm(event, hotelForm, createHotel)}>
          <h2>Create hotel</h2>
          {Object.keys(emptyHotel).map((field) => (
            <label key={field}>
              {labelFor(field)}
              <input
                type={field === "email" ? "email" : field === "managerId" ? "number" : "text"}
                value={hotelForm[field]}
                onChange={(event) => setHotelForm({ ...hotelForm, [field]: event.target.value })}
                required={["name", "address", "city", "country", "managerId"].includes(field)}
              />
            </label>
          ))}
          <button className="btn btn-teal" disabled={createHotel.isPending}>
            {createHotel.isPending ? "Creating..." : "Create hotel"}
          </button>
        </form>

        <form className="panel stack-form" onSubmit={(event) => submitForm(event, roomForm, createRoom)}>
          <h2>Add room type</h2>
          {Object.keys(emptyRoom).map((field) => (
            <label key={field}>
              {labelFor(field)}
              <input
                type={["hotelId", "capacity", "inventoryCount", "basePrice"].includes(field) ? "number" : "text"}
                value={roomForm[field]}
                onChange={(event) => setRoomForm({ ...roomForm, [field]: event.target.value })}
                required
              />
            </label>
          ))}
          <button className="btn btn-teal" disabled={createRoom.isPending}>
            {createRoom.isPending ? "Adding..." : "Add room"}
          </button>
        </form>
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <h2>Hotels</h2>
          {hotels.length ? (
            <div className="manager-list">
              {hotels.map((hotel) => (
                <article key={hotel.id} className="manager-row">
                  <div>
                    <strong>{hotel.name}</strong>
                    <span>{hotel.city}, {hotel.country}</span>
                  </div>
                  <button
                    className="btn btn-small btn-outline"
                    disabled={deleteHotel.isPending}
                    onClick={() => deleteHotel.mutate(hotel.id)}
                  >
                    Delete
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">No hotels available yet.</p>
          )}
        </div>

        <div className="panel">
          <h2>Upcoming bookings</h2>
          {upcoming.length ? (
            <div className="manager-list">
              {upcoming.map((booking) => (
                <article key={booking.id} className="manager-row">
                  <div>
                    <strong>Booking #{booking.id}</strong>
                    <span>{formatDate(booking.startDate)} to {formatDate(booking.endDate)}</span>
                  </div>
                  <span className="status-pill">{money(booking.totalPrice)}</span>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">No upcoming bookings.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function submitForm(event, payload, mutation) {
  event.preventDefault();
  mutation.mutate(payload);
}

function normalizeHotel(payload) {
  return {
    ...payload,
    managerId: Number(payload.managerId),
  };
}

function normalizeRoom(payload) {
  return {
    ...payload,
    hotelId: Number(payload.hotelId),
    capacity: Number(payload.capacity),
    inventoryCount: Number(payload.inventoryCount),
    basePrice: Number(payload.basePrice),
    amenities: payload.amenities.split(",").map((item) => item.trim()).filter(Boolean),
  };
}

function labelFor(field) {
  return field.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

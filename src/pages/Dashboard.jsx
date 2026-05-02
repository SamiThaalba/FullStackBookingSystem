import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { bookingApi } from "../api/bookingApi";
import { useAuth } from "../auth/AuthContext";
import Alert from "../components/Alert";
import { formatDate, money } from "../utils/format";

const emptyHotel = {
  name: "",
  description: "",
  imageUrl: "",
  address: "",
  city: "",
  country: "UK",
  latitude: "",
  longitude: "",
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
  const auth = useAuth();
  const [hotelForm, setHotelForm] = useState(emptyHotel);
  const [roomForm, setRoomForm] = useState(emptyRoom);
  const [selectedHotelId, setSelectedHotelId] = useState("");

  const hotelsQuery = useQuery({
    queryKey: ["dashboard-hotels"],
    queryFn: () => bookingApi.listHotels({ page: 0, size: 50 }),
  });

  const upcomingQuery = useQuery({
    queryKey: ["upcoming-bookings", selectedHotelId],
    queryFn: () => bookingApi.upcomingBookings(selectedHotelId ? Number(selectedHotelId) : undefined),
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

  const allHotels = hotelsQuery.data?.content || [];
  const hotels = auth.isAdmin
    ? allHotels
    : allHotels.filter((hotel) => (auth.user?.id ? hotel.managerId === auth.user.id : true));
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
        {auth.hasPermission("hotel:create") ? (
          <form className="panel stack-form" onSubmit={(event) => submitForm(event, hotelForm, createHotel)}>
            <h2>Create hotel</h2>
            {Object.keys(emptyHotel).map((field) => (
              <label key={field}>
                {labelFor(field)}
                <input
                  type={
                    field === "email"
                      ? "email"
                      : field === "managerId" ||
                          field === "latitude" ||
                          field === "longitude"
                        ? "number"
                        : "text"
                  }
                  value={hotelForm[field]}
                  onChange={(event) => setHotelForm({ ...hotelForm, [field]: event.target.value })}
                  required={["name", "address", "city", "country", "managerId"].includes(field)}
                  step={field === "latitude" || field === "longitude" ? "any" : undefined}
                />
              </label>
            ))}
            <button className="btn btn-teal" disabled={createHotel.isPending}>
              {createHotel.isPending ? "Creating..." : "Create hotel"}
            </button>
          </form>
        ) : null}

        <form className="panel stack-form" onSubmit={(event) => submitForm(event, roomForm, createRoom)}>
          <h2>Add room type</h2>
          <label>
            Hotel
            <select
              value={roomForm.hotelId}
              onChange={(event) => setRoomForm({ ...roomForm, hotelId: event.target.value })}
              required
            >
              <option value="">Select hotel</option>
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name} (#{hotel.id})
                </option>
              ))}
            </select>
          </label>
          {Object.keys(emptyRoom)
            .filter((field) => field !== "hotelId")
            .map((field) => (
              <label key={field}>
                {labelFor(field)}
                <input
                  type={["capacity", "inventoryCount", "basePrice"].includes(field) ? "number" : "text"}
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
          {hotels.length ? (
            <label style={{ marginBottom: 12 }}>
              <span>Hotel</span>
              <select value={selectedHotelId} onChange={(event) => setSelectedHotelId(event.target.value)}>
                <option value="">All my hotels</option>
                {hotels.map((hotel) => (
                  <option key={hotel.id} value={hotel.id}>
                    {hotel.name} (#{hotel.id})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
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
  const latitude =
    payload.latitude === "" || payload.latitude == null ? null : Number(payload.latitude);
  const longitude =
    payload.longitude === "" || payload.longitude == null ? null : Number(payload.longitude);
  return {
    ...payload,
    managerId: Number(payload.managerId),
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
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

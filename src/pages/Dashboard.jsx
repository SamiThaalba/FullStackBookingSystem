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
  phone: "",
  email: "",
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
    queryKey: ["my-hotels"],
    queryFn: bookingApi.getMyHotels,
  });

  const hotels = hotelsQuery.data || [];

  const upcomingQuery = useQuery({
    queryKey: ["upcoming-bookings", selectedHotelId],
    queryFn: () =>
        bookingApi.upcomingBookings(
            selectedHotelId ? Number(selectedHotelId) : undefined
        ),
  });

  const analyticsQuery = useQuery({
    queryKey: ["manager-dashboard", auth.user?.id],
    queryFn: () => bookingApi.managerDashboard(auth.user.id),
    enabled: !!auth.user?.id,
  });

  const createHotel = useMutation({
    mutationFn: (payload) =>
        bookingApi.createHotel({
          ...payload,
          managerId: auth.user.id,
        }),
    onSuccess: () => {
      setHotelForm(emptyHotel);
      queryClient.invalidateQueries({ queryKey: ["my-hotels"] });
    },
  });

  const createRoom = useMutation({
    mutationFn: (payload) =>
        bookingApi.createRoomType(normalizeRoom(payload)),
    onSuccess: () => setRoomForm(emptyRoom),
  });

  const deleteHotel = useMutation({
    mutationFn: bookingApi.deleteHotel,
    onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: ["my-hotels"] }),
  });

  const upcoming = upcomingQuery.data || [];

  return (
      <section className="container dashboard-page">
        <h1>Manager dashboard</h1>

        {/* Errors */}
        <Alert type="error">
          {hotelsQuery.error?.message ||
              upcomingQuery.error?.message ||
              createHotel.error?.message}
        </Alert>

        {/* ✅ FIX #13 */}
        {createHotel.isSuccess && (
            <Alert type="success">Hotel created successfully</Alert>
        )}
        {createRoom.isSuccess && (
            <Alert type="success">Room type added</Alert>
        )}

        {/* ✅ FIX #12 Analytics */}
        {analyticsQuery.data && (
            <div className="panel">
              <h2>Analytics</h2>
              <p>Total revenue: {money(analyticsQuery.data.totalRevenue)}</p>
              <p>Pending bookings: {analyticsQuery.data.pendingBookings}</p>
            </div>
        )}

        {/* Create hotel */}
        <form
            onSubmit={(e) => {
              e.preventDefault();
              createHotel.mutate(hotelForm);
            }}
        >
          <h2>Create hotel</h2>

          {Object.keys(emptyHotel).map((field) => (
              <input
                  key={field}
                  placeholder={field}
                  value={hotelForm[field]}
                  onChange={(e) =>
                      setHotelForm({ ...hotelForm, [field]: e.target.value })
                  }
                  required={["name", "address", "city", "country"].includes(field)}
              />
          ))}

          <button>Create</button>
        </form>

        {/* Hotels */}
        <div>
          <h2>Hotels</h2>

          {hotels.map((hotel) => (
              <div key={hotel.id}>
                <strong>{hotel.name}</strong>

                {/* ✅ FIX #11 */}
                <button
                    onClick={() => {
                      if (
                          window.confirm(
                              `Delete "${hotel.name}"? This cannot be undone.`
                          )
                      ) {
                        deleteHotel.mutate(hotel.id);
                      }
                    }}
                >
                  Delete
                </button>
              </div>
          ))}
        </div>

        {/* Upcoming bookings */}
        <div>
          <h2>Upcoming bookings</h2>

          <select
              value={selectedHotelId}
              onChange={(e) => setSelectedHotelId(e.target.value)}
          >
            <option value="">All</option>
            {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
            ))}
          </select>

          {upcoming.map((b) => {
            const hotel = hotels.find((h) => h.id === b.hotelId);

            return (
                <div key={b.id}>
                  <strong>Booking #{b.id}</strong>
                  <div>{hotel?.name}</div>
                  <div>
                    {formatDate(b.startDate)} → {formatDate(b.endDate)}
                  </div>
                  <div>{money(b.totalPrice)}</div>
                </div>
            );
          })}
        </div>
      </section>
  );
}

function normalizeRoom(payload) {
  return {
    ...payload,
    hotelId: Number(payload.hotelId),
    capacity: Number(payload.capacity),
    inventoryCount: Number(payload.inventoryCount),
    basePrice: Number(payload.basePrice),
    amenities: payload.amenities.split(",").map((a) => a.trim()),
  };
}
import { apiRequest } from "./client";

export const bookingApi = {
  login: (payload) =>
    apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  register: (payload) =>
    apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  logout: (refreshToken) =>
    apiRequest("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),

  listHotels: (params) => apiRequest(`/hotels?${toQuery(params)}`),

  getHotel: (id) => apiRequest(`/hotels/${id}`),

  createHotel: (payload) =>
    apiRequest("/hotels", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateHotel: (id, payload) =>
    apiRequest(`/hotels/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteHotel: (id) =>
    apiRequest(`/hotels/${id}`, {
      method: "DELETE",
    }),

  getRoomTypes: (hotelId) => apiRequest(`/room-type/hotel/${hotelId}`),

  createRoomType: (payload) =>
    apiRequest("/room-type", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateRoomType: (id, payload) =>
    apiRequest(`/room-type/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteRoomType: (id) =>
    apiRequest(`/room-type/${id}`, {
      method: "DELETE",
    }),

  checkAvailability: (payload) =>
    apiRequest("/availability/check", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  createBooking: (payload) =>
    apiRequest("/bookings", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  myBookings: () => apiRequest("/bookings/my"),

  upcomingBookings: (hotelId) =>
    apiRequest(`/bookings/upcoming?${toQuery({ hotelId })}`),

  cancelBooking: (id) =>
    apiRequest(`/bookings/${id}/cancel`, {
      method: "PUT",
    }),

  createPayment: (bookingId) =>
    apiRequest("/payments", {
      method: "POST",
      body: JSON.stringify({ bookingId }),
    }),
};

function toQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });

  return query.toString();
}

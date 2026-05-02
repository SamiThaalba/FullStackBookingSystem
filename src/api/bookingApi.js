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

    // ✅ FIX #7
    getMyHotels: () => apiRequest("/hotels/my"),

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

    getRoomType: (roomTypeId) => apiRequest(`/room-type/${roomTypeId}`),

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

    // ✅ FIX #15 (cleaner API call)
    upcomingBookings: (hotelId) =>
        hotelId
            ? apiRequest(`/bookings/upcoming?hotelId=${hotelId}`)
            : apiRequest("/bookings/upcoming"),

    cancelBooking: (id) =>
        apiRequest(`/bookings/${id}/cancel`, {
            method: "PUT",
        }),

    createPayment: (bookingId) =>
        apiRequest("/payments", {
            method: "POST",
            body: JSON.stringify({ bookingId }),
        }),

    processPayment: (paymentId, success = true) =>
        apiRequest(
            `/payments/${paymentId}/process?${toQuery({
                success: success ? "true" : "false",
            })}`,
            {
                method: "POST",
            }
        ),

    confirmBooking: (bookingId) =>
        apiRequest(`/bookings/${bookingId}/confirm`, {
            method: "PUT",
        }),

    // ✅ FIX #12 (analytics)
    managerDashboard: (managerId) =>
        apiRequest(`/managers/${managerId}/dashboard`),

    hotelAnalytics: (hotelId) =>
        apiRequest(`/hotels/${hotelId}/analytics`),

    wishlist: () => apiRequest("/wishlist"),

    addToWishlist: (payload) =>
        apiRequest("/wishlist", {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    removeFromWishlist: ({ itemType, targetId }) =>
        apiRequest(`/wishlist?${toQuery({ itemType, targetId })}`, {
            method: "DELETE",
        }),

    myAlerts: () => apiRequest("/alerts"),

    createAlert: (payload) =>
        apiRequest("/alerts", {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    activateAlert: (id) =>
        apiRequest(`/alerts/${id}/activate`, {
            method: "PATCH",
        }),

    deactivateAlert: (id) =>
        apiRequest(`/alerts/${id}/deactivate`, {
            method: "PATCH",
        }),

    notifications: () => apiRequest("/notifications"),

    markNotificationRead: (id) =>
        apiRequest(`/notifications/${id}/read`, {
            method: "PATCH",
        }),

    markAllNotificationsRead: () =>
        apiRequest("/notifications/read-all", {
            method: "PATCH",
        }),

    unreadNotificationCount: () =>
        apiRequest("/notifications/unread-count"),

    // ── Admin ────────────────────────────────────────────────────────────────

    adminRoles: () => apiRequest("/admin/roles"),

    adminPermissions: () => apiRequest("/admin/permissions"),

    adminCreateRole: (payload) =>
        apiRequest("/admin/roles", {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    adminCreatePermission: (payload) =>
        apiRequest("/admin/permissions", {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    adminReplaceRolePermissions: (roleId, payload) =>
        apiRequest(`/admin/roles/${roleId}/permissions`, {
            method: "PUT",
            body: JSON.stringify(payload),
        }),

    adminAssignRoleToUser: (userId, roleId) =>
        apiRequest(`/admin/users/${userId}/roles/${roleId}`, {
            method: "POST",
        }),

    adminRemoveRoleFromUser: (userId, roleId) =>
        apiRequest(`/admin/users/${userId}/roles/${roleId}`, {
            method: "DELETE",
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

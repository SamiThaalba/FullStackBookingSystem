import { apiRequest } from "./client";

export const bookingApi = {
    login:(payload)=>apiRequest("/auth/login",{method:"POST",body:JSON.stringify(payload)}),
    register:(payload)=>apiRequest("/auth/register",{method:"POST",body:JSON.stringify(payload)}),
    refresh:(refreshToken)=>apiRequest("/auth/refresh",{method:"POST",body:JSON.stringify({refreshToken})}),
    logout:(refreshToken)=>apiRequest("/auth/logout",{method:"POST",body:JSON.stringify({refreshToken})}),
    syncUiLanguage:(language)=>apiRequest("/me/ui-language",{method:"PATCH",body:JSON.stringify({language})}),
    patchAvatar:(payload)=>apiRequest("/me/avatar",{method:"PATCH",body:JSON.stringify(payload)}),
    listHotels:(params)=>apiRequest(`/hotels?${toQuery(params)}`),
    listCountries:()=>apiRequest("/countries"),
    listCities:(params={})=>apiRequest(`/cities?${toQuery(params)}`),
    getHotel:(id)=>apiRequest(`/hotels/${id}`),
    // FIX: dedicated endpoint — returns only the current manager's hotels
    getMyHotels:()=>apiRequest("/hotels/my"),
    createHotel:(payload)=>apiRequest("/hotels",{method:"POST",body:JSON.stringify(payload)}),
    updateHotel:(id,payload)=>apiRequest(`/hotels/${id}`,{method:"PUT",body:JSON.stringify(payload)}),
    // FIX: patch for partial updates (edit hotel form)
    patchHotel:(id,payload)=>apiRequest(`/hotels/${id}`,{method:"PATCH",body:JSON.stringify(payload)}),
    deleteHotel:(id)=>apiRequest(`/hotels/${id}`,{method:"DELETE"}),
    getRoomTypes:(hotelId)=>apiRequest(`/room-type/hotel/${hotelId}`),
    getRoomType:(roomTypeId)=>apiRequest(`/room-type/${roomTypeId}`),
    createRoomType:(payload)=>apiRequest("/room-type",{method:"POST",body:JSON.stringify(payload)}),
    updateRoomType:(id,payload)=>apiRequest(`/room-type/${id}`,{method:"PUT",body:JSON.stringify(payload)}),
    deleteRoomType:(id)=>apiRequest(`/room-type/${id}`,{method:"DELETE"}),
    checkAvailability:(payload)=>apiRequest("/availability/check",{method:"POST",body:JSON.stringify(payload)}),
    createBooking:(payload)=>apiRequest("/bookings",{method:"POST",body:JSON.stringify(payload)}),
    myBookings:()=>apiRequest("/bookings/my"),
    upcomingBookings:(hotelId)=>apiRequest(`/bookings/upcoming?${toQuery({hotelId})}`),
    confirmBooking:(bookingId)=>apiRequest(`/bookings/${bookingId}/confirm`,{method:"PUT"}),
    cancelBooking:(id)=>apiRequest(`/bookings/${id}/cancel`,{method:"PUT"}),
    createPayment:(bookingId)=>apiRequest("/payments",{method:"POST",body:JSON.stringify({bookingId})}),
    processPayment:(paymentId,success=true)=>apiRequest(`/payments/${paymentId}/process?${toQuery({success:success?"true":"false"})}`,{method:"POST"}),
    wishlist:()=>apiRequest("/wishlist"),
    addToWishlist:(payload)=>apiRequest("/wishlist",{method:"POST",body:JSON.stringify(payload)}),
    removeFromWishlist:({itemType,targetId})=>apiRequest(`/wishlist?${toQuery({itemType,targetId})}`,{method:"DELETE"}),
    myAlerts:()=>apiRequest("/alerts"),
    createAlert:(payload)=>apiRequest("/alerts",{method:"POST",body:JSON.stringify(payload)}),
    activateAlert:(id)=>apiRequest(`/alerts/${id}/activate`,{method:"PATCH"}),
    deactivateAlert:(id)=>apiRequest(`/alerts/${id}/deactivate`,{method:"PATCH"}),
    notifications:()=>apiRequest("/notifications"),
    markNotificationRead:(id)=>apiRequest(`/notifications/${id}/read`,{method:"PATCH"}),
    markAllNotificationsRead:()=>apiRequest("/notifications/read-all",{method:"PATCH"}),
    unreadNotificationCount:()=>apiRequest("/notifications/unread-count"),
    adminRoles:()=>apiRequest("/admin/roles"),
    adminPermissions:()=>apiRequest("/admin/permissions"),
    adminCreateRole:(payload)=>apiRequest("/admin/roles",{method:"POST",body:JSON.stringify(payload)}),
    adminCreatePermission:(payload)=>apiRequest("/admin/permissions",{method:"POST",body:JSON.stringify(payload)}),
    adminReplaceRolePermissions:(roleId,payload)=>apiRequest(`/admin/roles/${roleId}/permissions`,{method:"PUT",body:JSON.stringify(payload)}),
    adminAssignRoleToUser:(userId,roleId)=>apiRequest(`/admin/users/${userId}/roles/${roleId}`,{method:"POST"}),
    adminRemoveRoleFromUser:(userId,roleId)=>apiRequest(`/admin/users/${userId}/roles/${roleId}`,{method:"DELETE"}),
    adminUsersSearch:(q)=>apiRequest(`/users/search?${toQuery({ q })}`),
    adminActivityLogs:(params={})=>apiRequest(`/admin/activity-logs?${toQuery(params)}`),
    assistantChat:(payload)=>apiRequest("/chat/assistant",{method:"POST",body:JSON.stringify(payload)}),
};

function toQuery(params={}){
    const q=new URLSearchParams();
    Object.entries(params).forEach(([k,v])=>{ if(v!==undefined&&v!==null&&v!=="") q.set(k,v); });
    return q.toString();
}

/**
 * Build body for POST /bookings — must match backend {@code BookingRequest}
 * (hotelId, roomTypeId, startDate, endDate as yyyy-MM-dd only).
 * @param {{ hotel?: { id?: unknown, hotelId?: unknown }, room?: { id?: unknown, roomTypeId?: unknown }, checkIn?: unknown, checkOut?: unknown }} draft
 */
export function buildBookingCreatePayload(draft) {
    const hotelId = Number(draft?.hotel?.id ?? draft?.hotel?.hotelId);
    const roomTypeId = Number(draft?.room?.id ?? draft?.room?.roomTypeId);
    const startDate = normalizeBookingIsoDate(draft?.checkIn);
    const endDate = normalizeBookingIsoDate(draft?.checkOut);
    if (!Number.isFinite(hotelId) || hotelId <= 0) {
        throw new Error("Missing or invalid hotel for booking.");
    }
    if (!Number.isFinite(roomTypeId) || roomTypeId <= 0) {
        throw new Error("Missing or invalid room type for booking.");
    }
    if (!startDate || !endDate) {
        throw new Error("Check-in and check-out dates are required (YYYY-MM-DD).");
    }
    return { hotelId, roomTypeId, startDate, endDate };
}

function normalizeBookingIsoDate(value) {
    if (value == null || value === "") return null;
    const s = String(value).trim();
    const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
}
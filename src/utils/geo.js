/** Reject placeholder (0,0), NaN, and out-of-range WGS84 for hotel pins. */
export function hasValidHotelLatLng(lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return false;
  if (Math.abs(la) < 1e-5 && Math.abs(lo) < 1e-5) return false;
  return true;
}

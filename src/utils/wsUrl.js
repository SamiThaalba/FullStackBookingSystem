/**
 * SockJS endpoint for Spring STOMP websocket.
 *
 * Priority:
 * - VITE_WS_URL (full URL to SockJS endpoint, e.g. http://localhost:8080/ws)
 * - derive from VITE_API_BASE_URL (strip trailing /api)
 * - dev fallback: http://localhost:8080/ws
 */
export function getSockJsUrl() {
  const explicit = import.meta?.env?.VITE_WS_URL;
  if (explicit && String(explicit).trim()) return String(explicit).trim();

  const apiBase = import.meta?.env?.VITE_API_BASE_URL;
  if (typeof apiBase === "string" && /^https?:\/\//i.test(apiBase)) {
    const u = new URL(apiBase);
    // common case: http://host:8080/api
    if (u.pathname.endsWith("/api")) {
      u.pathname = u.pathname.slice(0, -"/api".length) || "/";
    }
    u.pathname = `${u.pathname.replace(/\/$/, "")}/ws`;
    u.search = "";
    u.hash = "";
    return u.toString();
  }

  // Relative API base in dev usually means separate backend origin.
  return "http://localhost:8080/ws";
}

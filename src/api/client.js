const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const AUTH_STORAGE_KEY = "booking-system-auth";

export function readStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

export function writeStoredAuth(auth) {
  if (!auth) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export async function apiRequest(path, options = {}) {
  const auth = readStoredAuth();
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (auth?.accessToken) {
    headers.set("Authorization", `${auth.tokenType || "Bearer"} ${auth.accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error(extractErrorMessage(payload, response.status));
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function extractErrorMessage(payload, status) {
  if (typeof payload === "string" && payload.trim()) return payload.trim();

  // Spring MethodArgumentNotValidException: { error, messages: { field: "..." } }
  const fromMessages = formatValidationMessagesMap(payload?.messages);
  if (fromMessages) return fromMessages;

  // Standard ErrorResponse.fieldErrors
  if (Array.isArray(payload?.fieldErrors) && payload.fieldErrors.length) {
    const parts = payload.fieldErrors
      .map((fe) => (fe?.field && fe?.message ? `${fe.field}: ${fe.message}` : fe?.message))
      .filter(Boolean);
    if (parts.length) return parts.join(" ");
  }

  if (payload?.message) return payload.message;
  if (payload?.error) return payload.error;
  if (status === 401) return "Please log in to continue.";
  if (status === 403) return "You do not have permission to perform this action.";
  return "Something went wrong. Please try again.";
}

/** @param {Record<string, unknown> | undefined} messages */
function formatValidationMessagesMap(messages) {
  if (!messages || typeof messages !== "object" || Array.isArray(messages)) return null;
  const parts = Object.entries(messages).map(([field, raw]) => {
    const text = Array.isArray(raw) ? raw.join(", ") : raw != null ? String(raw) : "";
    return text ? `${field}: ${text}` : null;
  });
  const filtered = parts.filter(Boolean);
  return filtered.length ? filtered.join(" ") : null;
}

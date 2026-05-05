const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const AUTH_STORAGE_KEY = "booking-system-auth";

const __DEV__ = Boolean(import.meta?.env?.DEV ?? (import.meta?.env?.MODE !== "production"));

function maskAuthHeader(value) {
  if (!value) return value;
  const s = String(value);
  // Keep the scheme + a small prefix/suffix for debugging, mask the rest.
  // Example: "Bearer abcd...wxyz"
  const parts = s.split(/\s+/);
  if (parts.length < 2) return "***";
  const scheme = parts[0];
  const token = parts.slice(1).join(" ");
  if (token.length <= 10) return `${scheme} ***`;
  return `${scheme} ${token.slice(0, 4)}…${token.slice(-4)}`;
}

function safeParseJsonString(value) {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t || (!t.startsWith("{") && !t.startsWith("["))) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function toPlainHeaders(headers) {
  try {
    if (!headers) return {};

    // Fetch Headers instance
    if (typeof headers.forEach === "function") {
      const out = {};
      headers.forEach((v, k) => {
        out[k] = v;
      });
      return out;
    }

    // Plain object / array tuples
    return { ...headers };
  } catch {
    return {};
  }
}

function debugLogRequest({ id, url, options, meta }) {
  if (!__DEV__) return;
  const headers = toPlainHeaders(options?.headers);
  const maskedHeaders = { ...headers };
  if (maskedHeaders.Authorization) maskedHeaders.Authorization = maskAuthHeader(maskedHeaders.Authorization);
  if (maskedHeaders.authorization) maskedHeaders.authorization = maskAuthHeader(maskedHeaders.authorization);

  const body = options?.body;
  const parsedBody = safeParseJsonString(body);

  const title = `[API] → ${options?.method || "GET"} ${url}${meta?._retriedAfterRefresh ? " (retry)" : ""}`;
  // eslint-disable-next-line no-console
  console.groupCollapsed(title);
  // eslint-disable-next-line no-console
  console.log("id:", id);
  // eslint-disable-next-line no-console
  console.log("headers:", maskedHeaders);
  if (body != null) {
    // eslint-disable-next-line no-console
    console.log("body:", parsedBody ?? body);
  }
  // eslint-disable-next-line no-console
  console.groupEnd();
}

function debugLogResponse({ id, url, method, status, elapsedMs, payload }) {
  if (!__DEV__) return;
  const title = `[API] ← ${method || "GET"} ${url} • ${status} • ${elapsedMs}ms`;
  // eslint-disable-next-line no-console
  console.groupCollapsed(title);
  // eslint-disable-next-line no-console
  console.log("id:", id);
  // eslint-disable-next-line no-console
  console.log("payload:", payload);
  // eslint-disable-next-line no-console
  console.groupEnd();
}

function debugLogError({ id, url, method, status, elapsedMs, message, payload, error }) {
  if (!__DEV__) return;
  const title = `[API] ✖ ${method || "GET"} ${url} • ${status ?? "ERR"} • ${elapsedMs}ms`;
  // eslint-disable-next-line no-console
  console.groupCollapsed(title);
  // eslint-disable-next-line no-console
  console.log("id:", id);
  // eslint-disable-next-line no-console
  console.log("message:", message);
  if (payload !== undefined) {
    // eslint-disable-next-line no-console
    console.log("payload:", payload);
  }
  // eslint-disable-next-line no-console
  console.error(error);
  // eslint-disable-next-line no-console
  console.groupEnd();
}

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

let refreshInFlight = null;

function isAuthRoute(path) {
  return (
    path === "/auth/login" ||
    path === "/auth/register" ||
    path === "/auth/refresh" ||
    path === "/auth/logout"
  );
}

async function refreshTokensOrThrow() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const auth = readStoredAuth();
    const refreshToken = auth?.refreshToken;
    if (!refreshToken) {
      const error = new Error("Please log in to continue.");
      error.status = 401;
      throw error;
    }

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (response.status === 204) {
      writeStoredAuth(null);
      const error = new Error("Please log in to continue.");
      error.status = 401;
      throw error;
    }

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      // If refresh fails, tokens are effectively invalid — clear local auth.
      writeStoredAuth(null);
      const error = new Error(extractErrorMessage(payload, response.status));
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    writeStoredAuth(payload);
    return payload;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function apiRequest(path, options = {}, meta = {}) {
  const id = `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
  const startedAt = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  const auth = readStoredAuth();
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (auth?.accessToken) {
    headers.set("Authorization", `${auth.tokenType || "Bearer"} ${auth.accessToken}`);
  }

  const url = `${API_BASE_URL}${path}`;
  debugLogRequest({ id, url, options: { ...options, headers }, meta });

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (error) {
    const elapsedMs = Math.round(
      ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - startedAt,
    );
    debugLogError({
      id,
      url,
      method: options?.method,
      status: null,
      elapsedMs,
      message: error?.message || "Network error",
      payload: undefined,
      error,
    });
    throw error;
  }

  // Access token may have expired. Attempt a one-time refresh then retry.
  if (
    response.status === 401 &&
    !meta?._retriedAfterRefresh &&
    !isAuthRoute(path) &&
    auth?.refreshToken
  ) {
    const newAuth = await refreshTokensOrThrow();
    const retryHeaders = new Headers(options.headers || {});
    if (!retryHeaders.has("Content-Type") && options.body) {
      retryHeaders.set("Content-Type", "application/json");
    }
    if (newAuth?.accessToken) {
      retryHeaders.set(
        "Authorization",
        `${newAuth.tokenType || "Bearer"} ${newAuth.accessToken}`,
      );
    }
    return apiRequest(path, { ...options, headers: retryHeaders }, { _retriedAfterRefresh: true });
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error(extractErrorMessage(payload, response.status));
    error.status = response.status;
    error.payload = payload;
    const elapsedMs = Math.round(
      ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - startedAt,
    );
    debugLogError({
      id,
      url,
      method: options?.method,
      status: response.status,
      elapsedMs,
      message: error.message,
      payload,
      error,
    });
    throw error;
  }

  const elapsedMs = Math.round(
    ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - startedAt,
  );
  debugLogResponse({
    id,
    url,
    method: options?.method,
    status: response.status,
    elapsedMs,
    payload,
  });
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

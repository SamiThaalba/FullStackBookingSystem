import { createContext, useContext, useMemo, useState } from "react";
import { bookingApi } from "../api/bookingApi";
import { readStoredAuth, writeStoredAuth } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => readStoredAuth());

  const user = useMemo(() => decodeUser(auth?.accessToken), [auth?.accessToken]);

  async function signIn(credentials) {
    const response = await bookingApi.login(credentials);
    writeStoredAuth(response);
    setAuth(response);
    return response;
  }

  async function signUp(payload) {
    const response = await bookingApi.register(payload);
    writeStoredAuth(response);
    setAuth(response);
    return response;
  }

  async function signOut() {
    const refreshToken = auth?.refreshToken;
    writeStoredAuth(null);
    setAuth(null);
    if (refreshToken) {
      try {
        await bookingApi.logout(refreshToken);
      } catch {
        // Local logout must succeed even if the token was already revoked.
      }
    }
  }

  const value = {
    auth,
    user,
    isAuthenticated: Boolean(auth?.accessToken),
    // Manager dashboard and hotel ops: MANAGER only (ADMIN uses Admin UI, not Manager dashboard)
    isManager: hasAny(user, ["MANAGER"]),
    isAdmin: hasAny(user, ["ADMIN"]),
    isCustomer: hasAny(user, ["CUSTOMER"]) && !hasAny(user, ["MANAGER", "ADMIN"]),
    hasPermission: (permission) => user?.permissions?.includes(permission),
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

function decodeUser(token) {
  if (!token) return null;
  try {
    const [, payload] = token.split(".");
    const decoded = JSON.parse(window.atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return {
      id: decoded.id ?? null,
      username: decoded.sub,
      email: decoded.email ?? null,
      roles: decoded.roles || [],
      permissions: decoded.permissions || [],
      exp: decoded.exp,
    };
  } catch {
    return null;
  }
}

function hasAny(user, roles) {
  return roles.some((role) => user?.roles?.includes(role));
}

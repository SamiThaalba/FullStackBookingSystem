import { createContext, useContext, useMemo, useState } from "react";
import { bookingApi } from "../api/bookingApi";
import { readStoredAuth, writeStoredAuth } from "../api/client";
import { MANAGER_WORKSPACE_PERMISSIONS, hasAnyPermission } from "./permissions";

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

  /** Persist new tokens from the API (e.g. after PATCH /me/avatar). */
  function applyAuthResponse(response) {
    writeStoredAuth(response);
    setAuth(response);
  }

  const hasPermission = (permission) => Boolean(user?.permissions?.includes(permission));
  const userHasAnyPermission = (permissions) => hasAnyPermission(user, permissions);
  const hasAdminPermissions = hasPermission("user:manage") || hasPermission("role:manage");
  const hasManagerWorkspacePermissions = userHasAnyPermission(MANAGER_WORKSPACE_PERMISSIONS);
  const isManager = hasManagerWorkspacePermissions;

  const value = {
    auth,
    user,
    applyAuthResponse,
    isAuthenticated: Boolean(auth?.accessToken),
    /** Staff workspace access is permission-based, not tied to one role name. */
    isManager,
    /** User administration (JWT must include user:manage). */
    isAdmin: hasAdminPermissions,
    /** Guest-oriented nav: not a hotel operator. */
    isCustomer: !isManager,
    hasPermission,
    hasAnyPermission: userHasAnyPermission,
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
    const rawAvatar = decoded.avatarUrl;
    return {
      id: decoded.id ?? null,
      username: decoded.sub,
      email: decoded.email ?? null,
      avatarUrl:
        typeof rawAvatar === "string" && rawAvatar.trim() !== "" ? rawAvatar.trim() : null,
      roles: decoded.roles || [],
      permissions: decoded.permissions || [],
      exp: decoded.exp,
    };
  } catch {
    return null;
  }
}

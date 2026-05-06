import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function ProtectedRoute({
  children,
  requireManager = false,
  requireAdmin = false,
  requirePermission = null,
  requireCustomer = false,
}) {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.isAuthenticated) {
    const from = `${location.pathname}${location.search || ""}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  if (requireAdmin && !auth.hasPermission("user:manage")) {
    return <Navigate to="/" replace />;
  }

  if (requirePermission && !auth.hasPermission(requirePermission)) {
    return <Navigate to="/" replace />;
  }

  if (requireManager && !auth.isManager) {
    return <Navigate to="/" replace />;
  }

  if (requireCustomer && auth.isManager) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

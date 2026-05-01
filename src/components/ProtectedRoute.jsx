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

  if (requireAdmin && !auth.isAdmin) {
    return <Navigate to="/my-bookings" replace />;
  }

  if (requirePermission && !auth.hasPermission(requirePermission)) {
    return <Navigate to="/my-bookings" replace />;
  }

  if (requireManager && !auth.isManager) {
    return <Navigate to={auth.isAdmin ? "/admin/roles" : "/my-bookings"} replace />;
  }

  if (requireCustomer && !auth.isCustomer) {
    return <Navigate to={auth.isAdmin ? "/admin/roles" : "/dashboard"} replace />;
  }

  return children;
}

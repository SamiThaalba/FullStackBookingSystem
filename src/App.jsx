import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import BookingConfirmation from "./pages/BookingConfirmation";
import Dashboard from "./pages/Dashboard";
import HotelDetails from "./pages/HotelDetails";
import HotelsMap from "./pages/HotelsMap";
import Hotels from "./pages/Hotels";
import Home from "./pages/Home";
import AuthCallback from "./pages/AuthCallback";
import Login from "./pages/Login";
import MyBookings from "./pages/MyBookings";
import NotFound from "./pages/NotFound";
import Register from "./pages/Register";
import Wishlist from "./pages/Wishlist";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import AdminRoles from "./pages/AdminRoles";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="hotels/map" element={<HotelsMap />} />
        <Route path="hotels" element={<Hotels />} />
        <Route path="hotels/:hotelId" element={<HotelDetails />} />
        <Route
          path="confirmation/:bookingId"
          element={
            <ProtectedRoute>
              <BookingConfirmation />
            </ProtectedRoute>
          }
        />
        <Route
          path="my-bookings"
          element={
            <ProtectedRoute requireCustomer>
              <MyBookings />
            </ProtectedRoute>
          }
        />
        <Route
          path="wishlist"
          element={
            <ProtectedRoute requireCustomer>
              <Wishlist />
            </ProtectedRoute>
          }
        />
        <Route
          path="notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/roles"
          element={
            <ProtectedRoute requirePermission="role:manage">
              <AdminRoles />
            </ProtectedRoute>
          }
        />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute requireManager>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="auth/callback" element={<AuthCallback />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

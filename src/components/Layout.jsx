import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Layout() {
  const auth = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await auth.signOut();
    navigate("/");
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <nav className="nav container">
          <NavLink to="/" className="brand" aria-label="QuickReserve home">
            <span>QuickReserve</span>
            <span className="moon">crescent</span>
          </NavLink>

          <div className="nav-links">
            {!auth.isAuthenticated || auth.isCustomer ? <NavLink to="/hotels">Discover</NavLink> : null}
            {auth.isAuthenticated && auth.isCustomer ? <NavLink to="/my-bookings">My bookings</NavLink> : null}
            {auth.isManager && <NavLink to="/dashboard">Manager</NavLink>}
            {auth.hasPermission("role:manage") && <NavLink to="/admin/roles">Admin</NavLink>}
          </div>

          <div className="nav-actions">
            {auth.isAuthenticated ? (
              <>
                <NavLink className="user-pill" to="/profile">
                  {auth.user?.username}
                </NavLink>
                {auth.hasPermission("notification:view") && (
                  <NavLink className="btn btn-small btn-outline" to="/notifications">
                    Notifications
                  </NavLink>
                )}
                <button className="btn btn-small btn-outline" onClick={handleLogout}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink className="btn btn-small btn-primary" to="/login">
                  Log in
                </NavLink>
                <NavLink className="btn btn-small btn-teal" to="/register">
                  Sign up
                </NavLink>
              </>
            )}
          </div>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <div className="brand footer-brand">
              <span>QuickReserve</span>
              <span className="moon">crescent</span>
            </div>
            <p>Book stays with confidence, with fast search and secure booking.</p>
          </div>
          <div>
            <h3>Follow us</h3>
            <p>Instagram / Facebook / X / LinkedIn</p>
          </div>
          <div>
            <h3>Project team</h3>
            <p>No Mercy No Doubt tourism booking platform.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

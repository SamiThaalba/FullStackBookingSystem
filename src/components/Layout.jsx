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
          <NavLink to="/" className="brand" aria-label="Premier Inn home">
            <span>Premier Inn</span>
            <span className="moon">crescent</span>
          </NavLink>

          <div className="nav-links">
            <NavLink to="/hotels">Discover Premier Inn</NavLink>
            {auth.isManager && <NavLink to="/dashboard">Business</NavLink>}
            <NavLink to="/my-bookings">Manage booking</NavLink>
          </div>

          <div className="nav-actions">
            {auth.isAuthenticated ? (
              <>
                <span className="user-pill">{auth.user?.username}</span>
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
              <span>Premier Inn</span>
              <span className="moon">crescent</span>
            </div>
            <p>Sleep easy in trusted hotels, with fast search and secure booking.</p>
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

import { useAuth } from "../auth/AuthContext";
import { Link } from "react-router-dom";

export default function Profile() {
  const auth = useAuth();
  const user = auth.user;

  return (
    <section className="container section">
      <div className="section-heading">
        <p className="eyebrow">Account</p>
        <h1>Profile</h1>
      </div>

      {auth.isCustomer ? (
        <div className="panel">
          <div className="summary-grid">
            <div>
              <span>Name</span>
              <strong>{user?.username || "—"}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{user?.email || "—"}</strong>
            </div>
          </div>

          <div style={{ marginTop: 18 }} className="hero-actions">
            <Link className="btn btn-outline" to="/wishlist">
              Wishlist & alerts
            </Link>
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="summary-grid">
            <div>
              <span>Username</span>
              <strong>{user?.username || "—"}</strong>
            </div>
            <div>
              <span>Role</span>
              <strong>{auth.isAdmin ? "ADMIN" : "MANAGER"}</strong>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


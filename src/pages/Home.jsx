import { Link } from "react-router-dom";
import SearchPanel from "../components/SearchPanel";
import { useAuth } from "../auth/AuthContext";

export default function Home() {
  const auth = useAuth();

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">QuickReserve</p>
            <h1>Find your next stay in Palestine, fast.</h1>
            <p>
              Search trusted stays, compare room types, check live availability, and book in minutes with a smooth,
              mobile-first experience.
            </p>
            <div className="hero-actions">
              {auth.isAuthenticated ? (
                <Link className="btn btn-teal" to="/hotels">
                  Start searching
                </Link>
              ) : (
                <Link className="btn btn-teal" to="/register">
                  Create account
                </Link>
              )}
              <a className="btn btn-outline" href="#about">
                About the project
              </a>
            </div>
          </div>
          <div className="hero-card">
            <SearchPanel />
          </div>
        </div>
      </section>

      <section className="container section" id="about">
        <div className="section-heading">
          <p className="eyebrow">Built for real journeys</p>
          <h2>Everything you need to book with confidence</h2>
        </div>
        <div className="feature-grid">
          <article className="feature-card">
            <h3>Guest search</h3>
            <p>Search by city, dates, and guests. Compare hotels and room types with clear details.</p>
          </article>
          <article className="feature-card">
            <h3>Secure booking</h3>
            <p>Instant booking flow with availability checks and a smooth mock payment experience.</p>
          </article>
          <article className="feature-card">
            <h3>Manager tools</h3>
            <p>Manage your own hotels and room types, and review upcoming bookings in one dashboard.</p>
          </article>
        </div>
      </section>

      <section className="promo-band">
        <div className="container promo-grid">
          <div>
            <h2>Why guests choose QuickReserve</h2>
            <p>Simple search, transparent pricing, and fast booking — built for a great local travel experience.</p>
          </div>
          <div className="stat-card">
            <strong>Fast</strong>
            <span>search to booking</span>
          </div>
          <div className="stat-card">
            <strong>Smart</strong>
            <span>price & availability alerts</span>
          </div>
        </div>
      </section>
    </>
  );
}

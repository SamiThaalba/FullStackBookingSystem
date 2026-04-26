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
            <p className="eyebrow">UK hotel search and booking</p>
            <h1>Find your perfect stay with Premier comfort.</h1>
            <p>
              Browse hotels, compare room types, check availability, and manage bookings
              from one responsive web app aligned with the Spring booking backend.
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
          <p className="eyebrow">Built for SWER354</p>
          <h2>Guest and manager journeys in one app</h2>
        </div>
        <div className="feature-grid">
          <article className="feature-card">
            <h3>Guest search</h3>
            <p>Search by city, dates, and guests with clean hotel cards and booking details.</p>
          </article>
          <article className="feature-card">
            <h3>Secure booking</h3>
            <p>JWT authentication, availability checks, booking creation, and mock payment handoff.</p>
          </article>
          <article className="feature-card">
            <h3>Manager tools</h3>
            <p>Protected dashboard screens for hotel and room type management plus upcoming bookings.</p>
          </article>
        </div>
      </section>

      <section className="promo-band">
        <div className="container promo-grid">
          <div>
            <h2>Why customers choose us</h2>
            <p>Central locations, simple prices, family-friendly rooms, and quick booking management.</p>
          </div>
          <div className="stat-card">
            <strong>24/7</strong>
            <span>booking access</span>
          </div>
          <div className="stat-card">
            <strong>JWT</strong>
            <span>secure API integration</span>
          </div>
        </div>
      </section>
    </>
  );
}

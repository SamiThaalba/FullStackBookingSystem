import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Alert from "../components/Alert";
import { useAuth } from "../auth/AuthContext";
import { clearBookingIntent, readBookingIntent } from "../auth/bookingIntent";

export default function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const googleOAuthUrl = import.meta.env.VITE_GOOGLE_OAUTH_URL;

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await auth.signIn(form);
      const resumeFrom = location.state?.from || "/hotels";
      const intent = location.state?.intent || readBookingIntent();
      clearBookingIntent();
      navigate(resumeFrom, { replace: true, state: intent ? { intent } : null });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-page container">
      <div className="auth-card">
        <p className="eyebrow">Welcome back</p>
        <h1>Log in</h1>
        <p className="muted">Use your backend username and password to access protected catalog APIs.</p>
        <Alert type="error">{error}</Alert>
        <form className="stack-form" onSubmit={submit}>
          <label>
            Username
            <input
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
              required
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
              autoComplete="current-password"
            />
          </label>
          <button className="btn btn-teal btn-full" disabled={loading}>
            {loading ? "Signing in..." : "Log in"}
          </button>
        </form>
        {googleOAuthUrl ? (
          <button
            type="button"
            className="btn btn-outline btn-full"
            onClick={() => {
              const from = location.state?.from || "/hotels";
              const url = new URL(googleOAuthUrl, window.location.origin);
              url.searchParams.set("from", from);
              window.location.assign(url.toString());
            }}
          >
            Continue with Google
          </button>
        ) : (
          <p className="muted">
            Google login is not configured yet. Set <strong>VITE_GOOGLE_OAUTH_URL</strong> to enable it.
          </p>
        )}
        <p>
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </section>
  );
}

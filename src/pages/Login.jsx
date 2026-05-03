import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Alert from "../components/Alert";
import GoogleGIcon from "../components/GoogleGIcon";
import { useAuth } from "../auth/AuthContext";
import { clearBookingIntent, readBookingIntent } from "../auth/bookingIntent";

export default function Login() {
  const { t } = useTranslation();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const googleOAuthUrl = String(import.meta.env.VITE_GOOGLE_OAUTH_URL ?? "").trim();

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await auth.signIn(form);
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
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
        <p className="eyebrow">{t("login.eyebrow")}</p>
        <h1>{t("login.title")}</h1>
        <Alert type="error">{error}</Alert>
        <form className="stack-form" onSubmit={submit}>
          <label>
            {t("login.username")}
            <input
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
              required
              autoComplete="username"
            />
          </label>
          <label>
            {t("login.password")}
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
              autoComplete="current-password"
            />
          </label>
          <button className="btn btn-teal btn-full" disabled={loading}>
            {loading ? t("login.submitting") : t("login.submit")}
          </button>
        </form>

        <button
          type="button"
          className="btn btn-outline btn-full btn-google"
          onClick={() => {
            const from = location.state?.from || "/hotels";
            const url = new URL(googleOAuthUrl, window.location.origin);
            url.searchParams.set("from", from);
            window.location.assign(url.toString());
          }}
        >
          <span>{t("login.continueGoogle")}</span>
          <GoogleGIcon width={22} height={22} />
        </button>

        <p>
          {t("login.newHere")} <Link to="/register" style={{ color:"#007AFF" }}>
            {t("login.createAccount")}
          </Link>
        </p>
      </div>
    </section>
  );
}

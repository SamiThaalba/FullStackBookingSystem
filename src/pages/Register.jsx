import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import Alert from "../components/Alert";
import { useAuth } from "../auth/AuthContext";

export default function Register() {
  const { t } = useTranslation();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await auth.signUp(form);
      queryClient.setQueryData(["notifications"], []);
      navigate("/hotels", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function update(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  return (
    <section className="auth-page container">
      <div className="auth-card">
        <p className="eyebrow">{t("register.eyebrow")}</p>
        <h1>{t("register.title")}</h1>
        <Alert type="error">{error}</Alert>
        <form className="stack-form" onSubmit={submit}>
          <label>
            {t("register.username")}
            <input value={form.username} onChange={update("username")} required autoComplete="username" />
          </label>
          <label>
            {t("register.email")}
            <input type="email" value={form.email} onChange={update("email")} required autoComplete="email" />
          </label>
          <label>
            {t("register.password")}
            <input
              type="password"
              minLength="8"
              value={form.password}
              onChange={update("password")}
              required
              autoComplete="new-password"
            />
          </label>
          <button className="btn btn-teal btn-full" disabled={loading}>
            {loading ? t("register.submitting") : t("register.submit")}
          </button>
        </form>
        <p>
          {t("register.haveAccount")} <Link to="/login" style={{color:"#007AFF"}}>{t("register.logIn")}</Link>
        </p>
      </div>
    </section>
  );
}

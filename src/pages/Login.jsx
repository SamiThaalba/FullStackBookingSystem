import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Alert from "../components/Alert";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await auth.signIn(form);
      navigate(location.state?.from || "/hotels", { replace: true });
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
        <p>
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </section>
  );
}

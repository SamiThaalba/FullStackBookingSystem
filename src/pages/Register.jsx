import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Alert from "../components/Alert";
import { useAuth } from "../auth/AuthContext";

export default function Register() {
  const auth = useAuth();
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
        <p className="eyebrow">Join QuickReserve</p>
        <h1>Create account</h1>
        <p className="muted">Registration creates a customer account when the backend CUSTOMER role is seeded.</p>
        <Alert type="error">{error}</Alert>
        <form className="stack-form" onSubmit={submit}>
          <label>
            Username
            <input value={form.username} onChange={update("username")} required autoComplete="username" />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={update("email")} required autoComplete="email" />
          </label>
          <label>
            Password
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
            {loading ? "Creating..." : "Sign up"}
          </button>
        </form>
        <p>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </section>
  );
}

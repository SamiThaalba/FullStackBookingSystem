import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Alert from "../components/Alert";
import { writeStoredAuth } from "../api/client";

export default function AuthCallback() {
  const [params] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.get("token");
    const refreshToken = params.get("refreshToken");
    const tokenType = params.get("tokenType") || "Bearer";
    const expiresInSeconds = Number(params.get("expiresInSeconds") || 0);
    const from = params.get("from") || "/hotels";

    if (!token) {
      setError("OAuth login is not configured yet. Missing token in callback URL.");
      return;
    }

    const response = {
      accessToken: token,
      refreshToken: refreshToken || null,
      tokenType,
      expiresInSeconds,
    };

    // Write directly, then force a reload so AuthProvider re-hydrates.
    writeStoredAuth(response);
    window.location.replace(from);
  }, [params]);

  return (
    <section className="auth-page container">
      <div className="auth-card">
        <p className="eyebrow">QuickReserve</p>
        <h1>Signing you in...</h1>
        <p className="muted">Completing authentication. You can close this page once finished.</p>
        <Alert type="error">{error}</Alert>
      </div>
    </section>
  );
}


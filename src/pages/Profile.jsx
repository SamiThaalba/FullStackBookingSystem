import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { bookingApi } from "../api/bookingApi";
import { getAvatarsBucket, getSupabase } from "../lib/supabase";
import { removeSupabaseObjectByPublicUrl, uploadUserProfileImage } from "../lib/supabaseStorage";
import { safeImageExtension, validateImageFile } from "../lib/imageUpload";

function initialsFrom(user) {
  const s = (user?.username || user?.email || "?").trim();
  return s.charAt(0).toUpperCase();
}

export default function Profile() {
  const { t } = useTranslation();
  const { user, applyAuthResponse, hasPermission } = useAuth();
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const isManager = hasPermission("hotel:update");

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user?.id) return;

    setError(null);
    setMessage(null);

    const invalid = validateImageFile(file, t);
    if (invalid) {
      setError(invalid);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setError(t("profile.errorSupabaseConfig"));
      return;
    }

    const bucket = getAvatarsBucket();
    const previousUrl = user?.avatarUrl || null;
    let newPublicUrl = null;
    setBusy(true);
    try {
      const ext = safeImageExtension(file);
      newPublicUrl = await uploadUserProfileImage(supabase, bucket, user.id, file, ext);
      const authResp = await bookingApi.patchAvatar({ avatarUrl: newPublicUrl });
      applyAuthResponse(authResp);
      if (previousUrl && previousUrl !== newPublicUrl) {
        await removeSupabaseObjectByPublicUrl(supabase, previousUrl, bucket);
      }
      setMessage(t("profile.photoUpdated"));
    } catch (err) {
      if (newPublicUrl) {
        await removeSupabaseObjectByPublicUrl(supabase, newPublicUrl, bucket);
      }
      const raw = String(err?.message || "").toLowerCase();
      if (raw.includes("bucket not found")) {
        setError(t("profile.errorBucketNotFound", { bucket }));
      } else {
        setError(err?.message || t("profile.errorGeneric"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function clearPhoto() {
    setError(null);
    setMessage(null);
    const previousUrl = user?.avatarUrl || null;
    const supabase = getSupabase();
    const bucket = getAvatarsBucket();
    setBusy(true);
    try {
      const authResp = await bookingApi.patchAvatar({ avatarUrl: null });
      applyAuthResponse(authResp);
      if (previousUrl && supabase) {
        await removeSupabaseObjectByPublicUrl(supabase, previousUrl, bucket);
      }
      setMessage(t("profile.photoCleared"));
    } catch (err) {
      setError(err?.message || t("profile.errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="container section profile-page">
      <div className="section-heading">
        <p className="eyebrow">{t("profile.eyebrow")}</p>
        <h1>{t("profile.title")}</h1>
        <p className="profile-page__lead">{t("profile.lead")}</p>
      </div>

      <div className="profile-layout">
        <div className="panel profile-card profile-card--hero">
          <div className="profile-hero">
            <div className="profile-avatar-ring" aria-hidden>
              {user?.avatarUrl ? (
                <img className="profile-avatar-img" src={user.avatarUrl} alt="" />
              ) : (
                <span className="profile-avatar-fallback">{initialsFrom(user)}</span>
              )}
            </div>
            <div className="profile-hero__body">
              <h2 className="profile-hero__name">{user?.username || "—"}</h2>
              <p className="profile-hero__email">{user?.email || "—"}</p>
              {isManager && (
                <p className="profile-hero__roles">
                  <span className="profile-hero__roles-label">{t("profile.rolesLabel")}</span>
                  {(user?.roles ?? []).length ? user.roles.join(", ") : "—"}
                </p>
              )}
            </div>
          </div>

          <div className="profile-photo-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="visually-hidden"
              onChange={handleFileChange}
              disabled={busy}
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              {busy ? t("profile.uploading") : t("profile.changePhoto")}
            </button>
            {user?.avatarUrl ? (
              <button type="button" className="btn btn-outline" disabled={busy} onClick={clearPhoto}>
                {t("profile.removePhoto")}
              </button>
            ) : null}
          </div>

          {message ? <p className="profile-alert profile-alert--ok">{message}</p> : null}
          {error ? <p className="profile-alert profile-alert--err">{error}</p> : null}
        </div>

        <div className="panel profile-card">
          <h3 className="profile-card__title">{t("profile.accountTitle")}</h3>
          <dl className="profile-dl">
            <div>
              <dt>{t("profile.fieldUsername")}</dt>
              <dd>{user?.username || "—"}</dd>
            </div>
            <div>
              <dt>{t("profile.fieldEmail")}</dt>
              <dd>{user?.email || "—"}</dd>
            </div>
          </dl>

          {!isManager ? (
            <div className="profile-card__footer">
              <Link className="btn btn-outline" to="/wishlist">
                {t("profile.wishlistCta")}
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

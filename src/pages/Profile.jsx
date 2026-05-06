import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaCreditCard, FaExchangeAlt, FaPencilAlt, FaPlus, FaSave, FaTimes, FaTrashAlt } from "react-icons/fa";
import { useAuth } from "../auth/AuthContext";
import { bookingApi } from "../api/bookingApi";
import { getAvatarsBucket, getSupabase } from "../lib/supabase";
import { removeSupabaseObjectByPublicUrl, uploadUserProfileImage } from "../lib/supabaseStorage";
import { safeImageExtension, validateImageFile } from "../lib/imageUpload";
import { getCardBrand, loadSavedCards, maskCardNumber, saveSavedCards } from "../utils/paymentCards";

const EMPTY_PAYMENT_FORM = {
  fullName: "",
  cardNumber: "",
  expiry: "",
  cvv: "",
};

function initialsFrom(user) {
  const s = (user?.username || user?.email || "?").trim();
  return s.charAt(0).toUpperCase();
}

function formatCardNumberInput(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatExpiryInput(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export default function Profile() {
  const { t } = useTranslation();
  const { user, applyAuthResponse, isManager } = useAuth();
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [savedCards, setSavedCards] = useState([]);
  const [activeSavedCardIndex, setActiveSavedCardIndex] = useState(0);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [editingCardIndex, setEditingCardIndex] = useState(null);
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT_FORM);
  const [paymentError, setPaymentError] = useState(null);
  const [paymentMessage, setPaymentMessage] = useState(null);

  useEffect(() => {
    setSavedCards(loadSavedCards());
  }, []);

  useEffect(() => {
    setActiveSavedCardIndex((current) => {
      if (!savedCards.length) return 0;
      return Math.min(current, savedCards.length - 1);
    });
  }, [savedCards.length]);

  function cancelPaymentForm() {
    setPaymentFormOpen(false);
    setEditingCardIndex(null);
    setPaymentForm(EMPTY_PAYMENT_FORM);
    setPaymentError(null);
  }

  function removeSavedCard(indexToRemove) {
    const next = saveSavedCards(savedCards.filter((_, index) => index !== indexToRemove));
    setSavedCards(next);
    setActiveSavedCardIndex((current) => {
      if (!next.length) return 0;
      if (current === indexToRemove) return Math.min(current, next.length - 1);
      if (current > indexToRemove) return current - 1;
      return current;
    });
    setPaymentMessage("Payment method removed.");
    if (editingCardIndex === indexToRemove) cancelPaymentForm();
    if (editingCardIndex != null && editingCardIndex > indexToRemove) {
      setEditingCardIndex(editingCardIndex - 1);
    }
  }

  function openAddPaymentForm() {
    setEditingCardIndex(null);
    setPaymentForm({
      ...EMPTY_PAYMENT_FORM,
      fullName: user?.username || "",
    });
    setPaymentError(null);
    setPaymentMessage(null);
    setPaymentFormOpen(true);
  }

  function openEditPaymentForm(card, index) {
    setActiveSavedCardIndex(index);
    setEditingCardIndex(index);
    setPaymentForm({
      fullName: card.fullName || "",
      cardNumber: formatCardNumberInput(card.cardNumber),
      expiry: formatExpiryInput(card.expiry),
      cvv: card.cvv || "",
    });
    setPaymentError(null);
    setPaymentMessage(null);
    setPaymentFormOpen(true);
  }

  function fillTestCard() {
    setPaymentForm({
      fullName: user?.username || "Guest",
      cardNumber: "4242 4242 4242 4242",
      expiry: "12/30",
      cvv: "123",
    });
  }

  function savePaymentMethod(e) {
    e.preventDefault();
    setPaymentError(null);
    setPaymentMessage(null);

    const cardNumberDigits = String(paymentForm.cardNumber || "").replace(/\D/g, "");
    const cvvDigits = String(paymentForm.cvv || "").replace(/\D/g, "");
    const normalized = {
      fullName: paymentForm.fullName.trim(),
      cardNumber: formatCardNumberInput(paymentForm.cardNumber),
      expiry: formatExpiryInput(paymentForm.expiry),
      cvv: cvvDigits,
    };

    if (!normalized.fullName) {
      setPaymentError("Card holder name is required.");
      return;
    }
    if (cardNumberDigits.length < 12) {
      setPaymentError("Enter a valid card number.");
      return;
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(normalized.expiry)) {
      setPaymentError("Expiry must be MM/YY.");
      return;
    }
    if (!/^\d{3,4}$/.test(cvvDigits)) {
      setPaymentError("CVV must be 3 or 4 digits.");
      return;
    }

    const duplicate = savedCards.some((card, index) => {
      if (editingCardIndex === index) return false;
      return (
        String(card.cardNumber || "").replace(/\D/g, "") === cardNumberDigits &&
        String(card.expiry || "") === normalized.expiry
      );
    });
    if (duplicate) {
      setPaymentError("This card is already saved.");
      return;
    }

    const next = [...savedCards];
    if (editingCardIndex != null) {
      next[editingCardIndex] = normalized;
    } else {
      next.unshift(normalized);
    }
    setSavedCards(saveSavedCards(next));
    setActiveSavedCardIndex(editingCardIndex != null ? editingCardIndex : 0);
    setPaymentMessage(editingCardIndex != null ? "Payment method updated." : "Payment method added.");
    cancelPaymentForm();
  }

  function swapSavedCard() {
    setActiveSavedCardIndex((current) => {
      if (savedCards.length < 2) return current;
      return (current + 1) % savedCards.length;
    });
  }

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

  const activeSavedCard = savedCards.length ? savedCards[activeSavedCardIndex] : null;
  const stackedSavedCards = savedCards
    .map((card, index) => ({
      card,
      index,
      stackIndex: (index - activeSavedCardIndex + savedCards.length) % savedCards.length,
    }))
    .filter(({ stackIndex }) => stackIndex < Math.min(savedCards.length, 3));

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
              <h2 className="profile-hero__name">{user?.username || "-"}</h2>
              <p className="profile-hero__email">{user?.email || "-"}</p>
              {isManager && (
                <p className="profile-hero__roles">
                  <span className="profile-hero__roles-label">{t("profile.rolesLabel")}</span>
                  {(user?.roles ?? []).length ? user.roles.join(", ") : "-"}
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
              <dd>{user?.username || "-"}</dd>
            </div>
            <div>
              <dt>{t("profile.fieldEmail")}</dt>
              <dd>{user?.email || "-"}</dd>
            </div>
          </dl>

          <div className="profile-card__footer">
            <Link className="btn btn-outline" to="/wishlist">
              {t("profile.wishlistCta")}
            </Link>
          </div>
        </div>

        <div className="panel profile-card profile-card--payments">
          <div className="profile-card__header">
            <div>
              <h3 className="profile-card__title">Payment methods</h3>
              <p className="muted">Manage the cards used by quick checkout.</p>
            </div>
            <div className="profile-payment-actions">
              <button type="button" className="btn btn-small btn-primary" onClick={openAddPaymentForm}>
                <FaPlus aria-hidden />
                Add card
              </button>
            </div>
          </div>

          {paymentMessage ? <p className="profile-alert profile-alert--ok">{paymentMessage}</p> : null}
          {paymentError ? <p className="profile-alert profile-alert--err">{paymentError}</p> : null}

          <div className="profile-payment-wallet">
            <div className="profile-payment-methods">
              <label className="profile-payment-method-select">
                Payment method
                <select value="card" disabled>
                  <option value="card">Credit card</option>
                </select>
              </label>
              <p className="profile-payment-section-title">Saved cards</p>
              {savedCards.length ? (
                <div className="profile-saved-card-stack">
                  <div className="profile-saved-card-toolbar">
                    <span>
                      Card {activeSavedCardIndex + 1} of {savedCards.length}
                    </span>
                    {savedCards.length > 1 ? (
                      <button type="button" className="btn btn-small btn-outline" onClick={swapSavedCard}>
                        <FaExchangeAlt aria-hidden />
                        Swap card
                      </button>
                    ) : null}
                  </div>

                  <div className="profile-saved-card-stage" aria-live="polite">
                    {stackedSavedCards.map(({ card, index, stackIndex }) => {
                    const brand = getCardBrand(card.cardNumber);
                    const stackX = stackIndex * 10;
                    const stackY = 34 - stackIndex * 14;
                    return (
                      <article
                        className={`profile-saved-card profile-saved-card--stacked${stackIndex === 0 ? " is-active" : ""}`}
                        key={`${card.cardNumber}-${card.expiry}-${index}`}
                        aria-hidden={stackIndex !== 0}
                        aria-label={stackIndex === 0 ? `Saved card ${activeSavedCardIndex + 1} of ${savedCards.length}` : undefined}
                        style={{
                          "--stack-x": `${stackX}px`,
                          "--stack-y": `${stackY}px`,
                          "--stack-scale": `${1 - stackIndex * 0.025}`,
                          "--stack-opacity": `${1 - stackIndex * 0.14}`,
                          "--stack-z": `${10 - stackIndex}`,
                        }}
                      >
                        <div className="profile-saved-card__preview">
                          <div className="profile-saved-card__top">
                            <span className="profile-saved-card__chip" aria-hidden />
                            <strong>{brand}</strong>
                          </div>
                          <div className="profile-saved-card__number">{maskCardNumber(card.cardNumber)}</div>
                          <div className="profile-saved-card__meta">
                            <span>
                              <small>Card holder</small>
                              {card.fullName || user?.username || "Guest"}
                            </span>
                            <span>
                              <small>Expires</small>
                              {card.expiry || "--"}
                            </span>
                          </div>
                          <small className="profile-saved-card__type">{brand} debit</small>
                        </div>
                      </article>
                    );
                  })}
                  </div>

                  {activeSavedCard ? (
                    <div className="profile-payment-method__actions profile-saved-card-stack__actions">
                      <button
                        type="button"
                        className="btn btn-small btn-outline"
                        onClick={() => openEditPaymentForm(activeSavedCard, activeSavedCardIndex)}
                      >
                        <FaPencilAlt aria-hidden />
                        Edit
                      </button>
                      <button type="button" className="btn btn-small btn-outline" onClick={() => removeSavedCard(activeSavedCardIndex)}>
                        <FaTrashAlt aria-hidden />
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="profile-payment-empty">
                  <strong>No saved cards yet</strong>
                  <span>Add a card here or save one during checkout.</span>
                </div>
              )}
            </div>

            {paymentFormOpen ? (
              <form className="profile-payment-form" onSubmit={savePaymentMethod}>
                <div className="profile-payment-form__head">
                  <strong>{editingCardIndex != null ? "Edit card" : "Add new card"}</strong>
                  <button type="button" className="btn btn-small btn-outline" onClick={cancelPaymentForm}>
                    <FaTimes aria-hidden />
                    Cancel
                  </button>
                </div>
                <label>
                  Full name
                  <input
                    value={paymentForm.fullName}
                    onChange={(e) => setPaymentForm((current) => ({ ...current, fullName: e.target.value }))}
                    placeholder="Name on card"
                    required
                  />
                </label>
                <label>
                  Card number
                  <input
                    value={paymentForm.cardNumber}
                    onChange={(e) => setPaymentForm((current) => ({ ...current, cardNumber: formatCardNumberInput(e.target.value) }))}
                    inputMode="numeric"
                    placeholder="4242 4242 4242 4242"
                    required
                  />
                </label>
                <div className="profile-payment-form__grid">
                  <label>
                    Expiry
                    <input
                      value={paymentForm.expiry}
                      onChange={(e) => setPaymentForm((current) => ({ ...current, expiry: formatExpiryInput(e.target.value) }))}
                      inputMode="numeric"
                      placeholder="MM/YY"
                      required
                    />
                  </label>
                  <label>
                    CVV
                    <input
                      value={paymentForm.cvv}
                      onChange={(e) => setPaymentForm((current) => ({ ...current, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                      inputMode="numeric"
                      placeholder="123"
                      required
                    />
                  </label>
                </div>
                <div className="profile-payment-form__actions">
                  <button type="button" className="btn btn-outline" onClick={fillTestCard}>
                    <FaCreditCard aria-hidden />
                    Fill test card
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <FaSave aria-hidden />
                    {editingCardIndex != null ? "Save changes" : "Save card"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="profile-payment-side">
                <FaCreditCard className="profile-payment-side__icon" aria-hidden />
                <strong>Quick checkout</strong>
                <p className="muted">Saved cards stay on this device and can be selected from the booking payment form.</p>
                <button type="button" className="btn btn-outline" onClick={openAddPaymentForm}>
                  <FaPlus aria-hidden />
                  Add payment method
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

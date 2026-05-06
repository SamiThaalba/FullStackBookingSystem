import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { notificationRealtimeEventName } from "../hooks/useNotificationRealtime";

/**
 * Slide-down toast when a new in-app notification arrives (WebSocket push).
 * Skips the first fetch after login and does not show while on /notifications.
 */
export default function NotificationSlideIn({ enabled }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const dismissedIdsRef = useRef(new Set());
  const [toast, setToast] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const dismissToast = useCallback((id) => {
    dismissedIdsRef.current.add(id);
    setIsOpen(false);
    window.setTimeout(() => {
      setToast((c) => (c?.id === id ? null : c));
    }, 420);
  }, []);

  useEffect(() => {
    if (!enabled) {
      dismissedIdsRef.current.clear();
      setToast(null);
      setIsOpen(false);
      return;
    }
    if (location.pathname === "/notifications") return;

    function onNewNotification(e) {
      const n = e?.detail;
      if (!n || location.pathname === "/notifications") return;
      if (n.read) return;
      if (dismissedIdsRef.current.has(n.id)) return;
      setToast(n);
    }

    window.addEventListener(notificationRealtimeEventName, onNewNotification);
    return () => window.removeEventListener(notificationRealtimeEventName, onNewNotification);
  }, [enabled, location.pathname]);

  useEffect(() => {
    if (!toast) {
      setIsOpen(false);
      return undefined;
    }
    const frame = requestAnimationFrame(() => setIsOpen(true));
    const toastId = toast.id;
    const autoClose = window.setTimeout(() => dismissToast(toastId), 10_000);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(autoClose);
    };
  }, [toast?.id, dismissToast]);

  const handleClose = useCallback(() => {
    if (toast) dismissToast(toast.id);
  }, [toast, dismissToast]);

  if (!enabled || !toast) return null;

  const dateStr =
    toast.createdAt &&
    new Intl.DateTimeFormat(i18n.language?.startsWith("ar") ? "ar" : "en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(toast.createdAt));

  return (
    <div
      className="notif-slide-host"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={`notif-slide ${isOpen ? "notif-slide--open" : ""}`}>
        <div className="notif-slide__card">
          <div className="notif-slide__head">
            <p className="notif-slide__eyebrow">{t("layout.notificationToastEyebrow")}</p>
            <button
              type="button"
              className="notif-slide__close"
              onClick={handleClose}
              aria-label={t("layout.notificationToastDismiss")}
            >
              ×
            </button>
          </div>
          <h2 className="notif-slide__title" dir="auto">
            {toast.title || t("layout.notifications")}
          </h2>
          <p className="notif-slide__body" dir="auto">
            {toast.message || "—"}
          </p>
          {dateStr ? <p className="notif-slide__meta muted">{dateStr}</p> : null}
          <div className="notif-slide__actions">
            <Link className="btn btn-small btn-teal" to="/notifications" onClick={handleClose}>
              {t("layout.notificationToastView")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

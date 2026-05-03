import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { bookingApi } from "../api/bookingApi";

/**
 * Slide-down toast when a new in-app notification appears (poll-driven).
 * Skips the first fetch after login and does not show while on /notifications.
 */
export default function NotificationSlideIn({ enabled }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const lastMaxIdRef = useRef(0);
  const dismissedIdsRef = useRef(new Set());
  const [toast, setToast] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: bookingApi.notifications,
    enabled,
    refetchInterval: 8_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 4_000,
  });

  const dismissToast = useCallback((id) => {
    dismissedIdsRef.current.add(id);
    setIsOpen(false);
    window.setTimeout(() => {
      setToast((c) => (c?.id === id ? null : c));
    }, 420);
  }, []);

  useEffect(() => {
    if (!enabled) {
      lastMaxIdRef.current = 0;
      dismissedIdsRef.current.clear();
      setToast(null);
      setIsOpen(false);
      return;
    }
    if (!notificationsQuery.isSuccess || location.pathname === "/notifications") {
      return;
    }

    const list = notificationsQuery.data ?? [];
    const ids = list.map((n) => n.id).filter((id) => id != null);
    if (!ids.length) return;

    const maxId = Math.max(...ids);
    if (lastMaxIdRef.current === 0) {
      lastMaxIdRef.current = maxId;
      return;
    }

    if (maxId > lastMaxIdRef.current) {
      const newbie = list.find((n) => n.id === maxId);
      lastMaxIdRef.current = maxId;
      if (
        newbie &&
        !newbie.read &&
        !dismissedIdsRef.current.has(newbie.id)
      ) {
        setToast(newbie);
      }
    }
  }, [enabled, notificationsQuery.data, location.pathname, notificationsQuery.isSuccess]);

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

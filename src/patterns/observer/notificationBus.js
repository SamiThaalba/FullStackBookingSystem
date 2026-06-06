/**
 * Observer — in-process subscribers + DOM CustomEvent bridge for UI.
 * Used by: `src/hooks/useNotificationRealtime.js` (publish),
 *          `src/components/NotificationSlideIn.jsx` (subscribe)
 */
export const NOTIFICATION_NEW_EVENT = "qr:new-notification";

const subscribers = new Set();

export function subscribeNewNotification(handler) {
  subscribers.add(handler);
  return () => subscribers.delete(handler);
}

export function publishNewNotification(detail) {
  subscribers.forEach((fn) => {
    try {
      fn(detail);
    } catch {
      /* ignore subscriber errors */
    }
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(NOTIFICATION_NEW_EVENT, { detail }));
  }
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookingApi } from "../api/bookingApi";
import Alert from "../components/Alert";
import { formatDate } from "../utils/format";

function iconFor(notification) {
  const text = `${notification?.message || ""} ${notification?.title || ""}`.toLowerCase();
  if (text.includes("price")) return "₪";
  if (text.includes("available")) return "✓";
  if (text.includes("booking")) return "B";
  return "!";
}

export default function Notifications() {
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: bookingApi.notifications,
  });

  const unreadCountQuery = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: bookingApi.unreadNotificationCount,
  });

  const markReadMutation = useMutation({
    mutationFn: bookingApi.markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: bookingApi.markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const notifications = notificationsQuery.data || [];
  const unreadCount = unreadCountQuery.data?.unreadCount ?? 0;

  return (
    <section className="container section">
      <div className="section-heading">
        <p className="eyebrow">Updates</p>
        <h1>Notifications</h1>
      </div>

      <Alert type="error">
        {notificationsQuery.error?.message ||
          unreadCountQuery.error?.message ||
          markReadMutation.error?.message ||
          markAllReadMutation.error?.message}
      </Alert>

      <div className="hero-actions" style={{ justifyContent: "space-between" }}>
        <span className="muted">Unread: {unreadCount}</span>
        <button className="btn btn-small btn-outline" disabled={markAllReadMutation.isPending} onClick={() => markAllReadMutation.mutate()}>
          {markAllReadMutation.isPending ? "Marking..." : "Mark all as read"}
        </button>
      </div>

      {notificationsQuery.isLoading ? (
        <div className="empty-state">Loading notifications...</div>
      ) : notifications.length ? (
        <div className="manager-list">
          {notifications.map((n) => (
            <div key={n.id} className="notif-row">
              {!n.read ? <span className="notif-dot" aria-label="Unread" /> : <span />}
              <div>
                <strong>{n.title || "Notification"}</strong>
                <p style={{ margin: "6px 0 0" }}>{n.message || <span className="muted">—</span>}</p>
                <p className="muted" style={{ margin: "6px 0 0" }}>
                  {n.createdAt ? formatDate(n.createdAt) : "—"}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No notifications yet</h2>
          <p>When your alerts trigger, you’ll see them here.</p>
        </div>
      )}
    </section>
  );
}


import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bookingApi } from "../api/bookingApi";
import Alert from "../components/Alert";
import { formatDate } from "../utils/format";

export default function Notifications() {
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: bookingApi.notifications,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const markReadMutation = useMutation({
    mutationFn: bookingApi.markNotificationRead,
    onSuccess: (_, id) => {
      queryClient.setQueryData(["notifications"], (prev) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((n) =>
          Number(n?.id) === Number(id) ? { ...n, read: true } : n,
        );
      });
    },
  });

  const notifications = notificationsQuery.data || [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <section className="container section">
      <div className="section-heading">
        <p className="eyebrow">Updates</p>
        <h1>Notifications</h1>
      </div>

      <Alert type="error">
        {notificationsQuery.error?.message || markReadMutation.error?.message}
      </Alert>

      <p className="muted" style={{ marginBottom: "16px" }}>
        Unread: {unreadCount}
        {unreadCount > 0 ? <span> · Select a notification to mark it read</span> : null}
      </p>

      {notificationsQuery.isLoading ? (
        <div className="empty-state">Loading notifications...</div>
      ) : notifications.length ? (
        <div className="manager-list">
          {notifications.map((n) => {
            const markingThis =
              markReadMutation.isPending && markReadMutation.variables === n.id;
            const inner = (
              <>
                {!n.read ? <span className="notif-dot" aria-hidden /> : <span aria-hidden />}
                <div className="notif-row__body">
                  <strong dir="auto">{n.title || "Notification"}</strong>
                  <p style={{ margin: "6px 0 0", whiteSpace: "pre-line" }} dir="auto">
                    {n.message || <span className="muted">—</span>}
                  </p>
                  <p className="muted" style={{ margin: "6px 0 0" }}>
                    {n.createdAt ? formatDate(n.createdAt) : "—"}
                  </p>
                </div>
              </>
            );
            if (n.read) {
              return (
                <div key={n.id} className="notif-row notif-row--read">
                  {inner}
                </div>
              );
            }
            return (
              <button
                key={n.id}
                type="button"
                className="notif-row notif-row--btn"
                onClick={() => markReadMutation.mutate(n.id)}
                disabled={markingThis}
                aria-label="Mark notification as read"
              >
                {inner}
              </button>
            );
          })}
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


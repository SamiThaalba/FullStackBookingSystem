import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client/dist/sockjs";
import { readStoredAuth } from "../api/client";
import { getSockJsUrl } from "../utils/wsUrl";

const EVENT_NAME = "qr:new-notification";

/**
 * Connects to backend websocket and receives per-user notifications.
 * - Updates react-query cache for the notifications list (prepend)
 * - Emits window event so NotificationSlideIn can show toast instantly
 */
export function useNotificationRealtime(enabled) {
  const queryClient = useQueryClient();
  const clientRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;

    const auth = readStoredAuth();
    const token = auth?.accessToken;
    if (!token) return undefined;

    const wsUrl = getSockJsUrl();

    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        if (import.meta.env.DEV) {
          console.info("[notifications-ws] connected", getSockJsUrl());
        }
        client.subscribe("/user/queue/notifications", (message) => {
          let payload = null;
          try {
            payload = JSON.parse(message.body);
          } catch {
            return;
          }

          // 1) Update notifications cache: prepend new notification
          queryClient.setQueryData(["notifications"], (prev) => {
            const list = Array.isArray(prev) ? prev : [];
            if (payload?.id != null && list.some((n) => Number(n?.id) === Number(payload.id))) return list;
            return [payload, ...list];
          });

          // 2) Notify UI toast
          window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
        });
      },
      onStompError: (frame) => {
        if (import.meta.env.DEV) {
          console.warn("[notifications-ws] STOMP error", frame?.headers?.message, frame?.body);
        }
      },
      onWebSocketClose: () => {
        if (import.meta.env.DEV) {
          console.info("[notifications-ws] socket closed");
        }
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      try {
        client.deactivate();
      } catch {
        // ignore
      }
      clientRef.current = null;
    };
  }, [enabled, queryClient]);
}

export const notificationRealtimeEventName = EVENT_NAME;


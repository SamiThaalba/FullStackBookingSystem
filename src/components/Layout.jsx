import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { bookingApi } from "../api/bookingApi";
import I18nHtmlAttributes from "./I18nHtmlAttributes";
import LanguageSwitcher from "./LanguageSwitcher";
import NotificationBellIcon from "./NotificationBellIcon";
import NotificationSlideIn from "./NotificationSlideIn";
import ThemeToggle from "./ThemeToggle";
import BookingAssistant from "./BookingAssistant";

export default function Layout() {
  const { t, i18n } = useTranslation();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const notificationsNavEnabled =
    auth.isAuthenticated && auth.hasPermission("notification:view");

  const unreadNotificationsQuery = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: bookingApi.unreadNotificationCount,
    enabled: notificationsNavEnabled,
    refetchInterval: 8_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 4_000,
  });

  const unreadCount = Number(unreadNotificationsQuery.data?.unreadCount ?? 0) || 0;
  const showUnreadDot = notificationsNavEnabled && unreadCount > 0;

  useEffect(() => {
    if (!auth.isAuthenticated || !i18n.isInitialized) return;
    const code =
      typeof i18n.language === "string"
        ? i18n.language.split("-")[0]
        : "en";
    bookingApi.syncUiLanguage(code || "en").catch(() => { });
  }, [auth.isAuthenticated, i18n.isInitialized, i18n.language]);

  async function handleLogout() {
    await auth.signOut();
    navigate("/");
  }

  return (
    <div className="app-shell">
      <I18nHtmlAttributes />
      <NotificationSlideIn enabled={notificationsNavEnabled} />
      <header className="site-header">
        <nav className="nav container">
          <NavLink to="/" className="brand" aria-label={t("layout.brandAria")}>
            <span>QuickReserve</span>
            <span className="moon">crescent</span>
          </NavLink>

          <div className="nav-links">
            <NavLink to="/hotels">{t("layout.discover")}</NavLink>
            {auth.isAuthenticated && auth.hasPermission("booking:view") && !auth.hasPermission("hotel:update") ? (
              <NavLink to="/my-bookings">{t("layout.myBookings")}</NavLink>
            ) : null}
            {auth.hasPermission("hotel:update") && <NavLink to="/dashboard">{t("layout.manager")}</NavLink>}
            {auth.hasPermission("role:manage") && <NavLink to="/admin/roles">{t("layout.admin")}</NavLink>}
          </div>

          <div className="nav-actions">
            <ThemeToggle />
            <LanguageSwitcher />
            {auth.isAuthenticated ? (
              <>
                {auth.hasPermission("notification:view") && (
                  <span className="nav-badge-wrap">
                    <NavLink
                      className="btn btn-small btn-outline nav-notifications-btn"
                      to="/notifications"
                      aria-label={
                        showUnreadDot
                          ? t("layout.notificationsAriaUnread", { count: unreadCount })
                          : t("layout.notifications")
                      }
                    >
                      <NotificationBellIcon size={20} />
                    </NavLink>
                    {showUnreadDot ? (
                      <span
                        className="nav-badge-dot"
                        title={t("layout.notificationsUnreadTitle", { count: unreadCount })}
                        aria-hidden
                      />
                    ) : null}
                  </span>
                )}
                    <NavLink className="user-pill" to="/profile">
                      <span className="user-pill__text">
                        <span className="user-pill__name">{auth.user?.username ?? auth.user?.email ?? "—"}</span>
                        <span className="user-pill__sub">{t("layout.myProfile")}</span>
                      </span>
                      <span className="user-pill__avatar" aria-hidden>
                        {auth.user?.avatarUrl ? (
                          <img className="user-pill__avatar-img" src={auth.user.avatarUrl} alt="" />
                        ) : (
                          (auth.user?.username || auth.user?.email || "?").trim().charAt(0).toUpperCase()
                        )}
                      </span>
                    </NavLink>
                <button className="btn btn-small btn-outline" onClick={handleLogout}>
                  {t("layout.logOut")}
                </button>
              </>
            ) : (
              <>
                <NavLink className="btn btn-small btn-primary" to="/login">
                  {t("layout.logIn")}
                </NavLink>
                <NavLink className="btn btn-small btn-teal" to="/register">
                  {t("layout.signUp")}
                </NavLink>
              </>
            )}
          </div>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>
      {location.pathname === "/" ? null : <BookingAssistant />}

      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <div className="brand footer-brand">
              <span>QuickReserve</span>
              <span className="moon">crescent</span>
            </div>
            <p>{t("layout.footerTagline")}</p>
          </div>
          <div>
            <h3>{t("layout.followUs")}</h3>
            <p>{t("layout.socialPlaceholder")}</p>
          </div>
          <div>
            <h3>{t("layout.projectTeam")}</h3>
            <p>Malik Alhurani, Sami Thalbah, Nicola Rabee</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

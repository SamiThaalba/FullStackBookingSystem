import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import I18nHtmlAttributes from "./I18nHtmlAttributes";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Layout() {
  const { t } = useTranslation();
  const auth = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await auth.signOut();
    navigate("/");
  }

  return (
    <div className="app-shell">
      <I18nHtmlAttributes />
      <header className="site-header">
        <nav className="nav container">
          <NavLink to="/" className="brand" aria-label={t("layout.brandAria")}>
            <span>QuickReserve</span>
            <span className="moon">crescent</span>
          </NavLink>

          <div className="nav-links">
            {!auth.isAuthenticated || auth.isCustomer ? <NavLink to="/hotels">{t("layout.discover")}</NavLink> : null}
            {auth.isAuthenticated && auth.isCustomer ? <NavLink to="/my-bookings">{t("layout.myBookings")}</NavLink> : null}
            {auth.isManager && <NavLink to="/dashboard">{t("layout.manager")}</NavLink>}
            {auth.hasPermission("role:manage") && <NavLink to="/admin/roles">{t("layout.admin")}</NavLink>}
          </div>

          <div className="nav-actions">
            <LanguageSwitcher />
            {auth.isAuthenticated ? (
              <>
                <NavLink className="user-pill" to="/profile">
                  {auth.user?.username}
                </NavLink>
                {auth.hasPermission("notification:view") && (
                  <NavLink className="btn btn-small btn-outline" to="/notifications">
                    {t("layout.notifications")}
                  </NavLink>
                )}
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
            <p>{t("layout.teamTagline")}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

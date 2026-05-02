import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <section className="container empty-state">
      <h1>{t("notFound.title")}</h1>
      <p>{t("notFound.body")}</p>
      <Link className="btn btn-teal" to="/">
        {t("notFound.backHome")}
      </Link>
    </section>
  );
}

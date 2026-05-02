import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { todayIso, tomorrowIso } from "../utils/dates";

export default function SearchPanel({
  compact = false,
  initialValues = {},
  cityOptions = [],
  navigateTo = "/hotels",
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cityListId = useMemo(
    () => `city-options-${Math.random().toString(16).slice(2)}`,
    [],
  );
  const [form, setForm] = useState({
    city: initialValues.city || "Bethlehem",
    from: initialValues.from || todayIso(),
    to: initialValues.to || tomorrowIso(),
    adults: Number(initialValues.adults || 2),
    children: Number(initialValues.children || 0),
    rooms: Number(initialValues.rooms || 1),
    work: Boolean(initialValues.work || false),
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  const guestsTotal = Math.max(1, Number(form.adults) + Number(form.children));
  const roomLabel = Number(form.rooms) === 1 ? t("search.roomSingular") : t("search.roomPlural");
  const guestsSummary = t("search.guestsSummary", {
    adults: form.adults,
    children: form.children,
    rooms: form.rooms,
    roomLabel,
  });

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  function submit(event) {
    event.preventDefault();
    const query = new URLSearchParams(searchParams);
    query.set("city", form.city);
    query.set("from", form.from);
    query.set("to", form.to);
    query.set("guests", String(guestsTotal));
    query.set("adults", String(form.adults));
    query.set("children", String(form.children));
    query.set("rooms", String(form.rooms));
    if (form.work) query.set("work", "1");
    else query.delete("work");
    query.delete("page");
    navigate(`${navigateTo}?${query.toString()}`);
  }

  return (
    <form
      className={`search-panel search-panel-bar ${compact ? "search-panel-compact search-panel-bar-compact" : ""}`}
      onSubmit={submit}
    >
      <div className="search-segment">
        <label>
          <span>{t("search.whereGoing")}</span>
          <input
            name="city"
            value={form.city}
            onChange={updateField}
            placeholder={t("search.cityPlaceholder")}
            list={cityOptions.length ? cityListId : undefined}
            autoComplete="off"
          />
          {cityOptions.length ? (
            <datalist id={cityListId}>
              {cityOptions.map((city) => (
                <option value={city} key={city} />
              ))}
            </datalist>
          ) : null}
        </label>
      </div>

      <div className="search-segment">
        <label>
          <span>{t("search.checkIn")}</span>
          <input name="from" type="date" value={form.from} onChange={updateField} required />
        </label>
      </div>

      <div className="search-segment">
        <label>
          <span>{t("search.checkOut")}</span>
          <input name="to" type="date" value={form.to} onChange={updateField} required />
        </label>
      </div>

      <div className="search-segment search-segment-picker">
        <label>
          <span>{t("search.guestsRooms")}</span>
          <button
            type="button"
            className="picker-button"
            onClick={() => setPickerOpen((open) => !open)}
            aria-expanded={pickerOpen}
          >
            {guestsSummary}
          </button>
        </label>
        {pickerOpen ? (
          <div className="picker-popover" role="dialog" aria-label={t("search.guestsRoomsDialog")}>
            <PickerRow
              label={t("search.adults")}
              value={Number(form.adults)}
              min={1}
              onChange={(next) => setForm((current) => ({ ...current, adults: next }))}
            />
            <PickerRow
              label={t("search.children")}
              value={Number(form.children)}
              min={0}
              onChange={(next) => setForm((current) => ({ ...current, children: next }))}
            />
            <PickerRow
              label={t("search.rooms")}
              value={Number(form.rooms)}
              min={1}
              onChange={(next) => setForm((current) => ({ ...current, rooms: next }))}
            />
            <button type="button" className="btn btn-small btn-outline" onClick={() => setPickerOpen(false)}>
              {t("search.done")}
            </button>
          </div>
        ) : null}
      </div>

      <button className="btn btn-search" type="submit">
        {t("search.search")}
      </button>

      {!compact ? (
        <label className="work-row">
          <input name="work" type="checkbox" checked={form.work} onChange={updateField} />
          <span>{t("search.workTrip")}</span>
        </label>
      ) : null}
    </form>
  );
}

function PickerRow({ label, value, min, onChange }) {
  const { t } = useTranslation();
  return (
    <div className="picker-row">
      <span className="picker-label">{label}</span>
      <div className="picker-controls">
        <button
          type="button"
          className="picker-step"
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={t("search.decrease", { label })}
          disabled={value <= min}
        >
          –
        </button>
        <strong className="picker-value">{value}</strong>
        <button
          type="button"
          className="picker-step"
          onClick={() => onChange(value + 1)}
          aria-label={t("search.increase", { label })}
        >
          +
        </button>
      </div>
    </div>
  );
}

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { todayIso, tomorrowIso } from "../utils/dates";

/**
 * @typedef {{ name: string, countryName: string }} CityRow
 */

export default function SearchPanel({
  compact = false,
  initialValues = {},
  /** Prefer this: cities with country for grouped search. */
  cities,
  /** @deprecated use {@link cities} with `{ name, countryName }`; kept for callers that only pass names. */
  cityOptions = [],
  navigateTo = "/hotels",
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cityListboxId = useId();
  const [form, setForm] = useState({
    city: initialValues.city ?? "",
    from: initialValues.from || todayIso(),
    to: initialValues.to || tomorrowIso(),
    adults: Number(initialValues.adults || 2),
    children: Number(initialValues.children || 0),
    rooms: Number(initialValues.rooms || 1),
    work: Boolean(initialValues.work || false),
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cityMenuOpen, setCityMenuOpen] = useState(false);
  const cityComboboxRef = useRef(null);

  const cityRows = useMemo(
    () => normalizeCityRows(cities, cityOptions),
    [cities, cityOptions],
  );

  const countryGroups = useMemo(() => buildCountryGroups(cityRows), [cityRows]);

  const filteredCountryGroups = useMemo(
    () => filterCountryGroups(countryGroups, form.city),
    [countryGroups, form.city],
  );

  useEffect(() => {
    function handlePointerDown(event) {
      if (!cityComboboxRef.current?.contains(event.target)) {
        setCityMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, []);

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

  function selectCityOption(name) {
    setForm((current) => ({ ...current, city: name }));
    setCityMenuOpen(false);
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

  const hasCombobox = cityRows.length > 0;

  return (
    <form
      className={`search-panel search-panel-bar ${compact ? "search-panel-compact search-panel-bar-compact" : ""}`}
      onSubmit={submit}
    >
      <div className="search-segment search-segment-city">
        <label>
          <span>{t("search.whereGoing")}</span>
          {hasCombobox ? (
            <div className="city-combobox" ref={cityComboboxRef}>
              <input
                name="city"
                type="text"
                role="combobox"
                aria-expanded={cityMenuOpen}
                aria-controls={cityListboxId}
                aria-autocomplete="list"
                value={form.city}
                onChange={(e) => {
                  updateField(e);
                  setCityMenuOpen(true);
                }}
                onFocus={() => setCityMenuOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setCityMenuOpen(false);
                }}
                placeholder={t("search.cityPlaceholder")}
                autoComplete="off"
              />
              {cityMenuOpen ? (
                <ul
                  id={cityListboxId}
                  className="city-combobox__list"
                  role="listbox"
                  aria-label={t("search.whereGoing")}
                >
                  {filteredCountryGroups.length ? (
                    filteredCountryGroups.map((group, groupIndex) => (
                      <Fragment key={group.countryKey}>
                        <li className="city-combobox__group-title" role="presentation">
                          {group.countryKey === "__other__" ? t("search.otherRegion") : group.countryKey}
                        </li>
                        {group.cities.map((city) => (
                          <li key={`${group.countryKey}-${city}-${groupIndex}`} role="presentation">
                            <button
                              type="button"
                              role="option"
                              className="city-combobox__option"
                              aria-selected={form.city === city}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                selectCityOption(city);
                              }}
                            >
                              {city}
                            </button>
                          </li>
                        ))}
                      </Fragment>
                    ))
                  ) : (
                    <li className="city-combobox__empty" role="presentation">
                      {t("search.noCityMatch")}
                    </li>
                  )}
                </ul>
              ) : null}
            </div>
          ) : (
            <input
              name="city"
              value={form.city}
              onChange={updateField}
              placeholder={t("search.cityPlaceholder")}
              autoComplete="off"
            />
          )}
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

/** @param {unknown} cities @param {string[]} cityOptions @returns {CityRow[]} */
function normalizeCityRows(cities, cityOptions) {
  if (Array.isArray(cities) && cities.length > 0) {
    return cities
      .map((c) => {
        if (typeof c === "string") {
          return { name: c.trim(), countryName: "" };
        }
        return {
          name: (c?.name ?? "").trim(),
          countryName: (c?.countryName ?? "").trim(),
        };
      })
      .filter((r) => r.name);
  }
  return (cityOptions ?? [])
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .map((name) => ({ name, countryName: "" }));
}

/** @param {CityRow[]} rows */
function buildCountryGroups(rows) {
  const map = new Map();
  for (const { name, countryName } of rows) {
    const key = countryName || "__other__";
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(name);
  }
  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === "__other__") return 1;
      if (b === "__other__") return -1;
      return a.localeCompare(b);
    })
    .map(([countryKey, names]) => ({
      countryKey,
      cities: [...names].sort((x, y) => x.localeCompare(y)),
    }));
}

/**
 * If query matches a country name, show that whole country block.
 * If query matches city names only, show those cities under their country headings.
 * @param {{ countryKey: string, cities: string[] }[]} groups
 */
function filterCountryGroups(groups, searchText) {
  const q = (searchText ?? "").trim().toLowerCase();
  if (!q) return groups;
  const out = [];
  for (const g of groups) {
    const isOther = g.countryKey === "__other__";
    const countryMatch = !isOther && g.countryKey.toLowerCase().includes(q);
    if (countryMatch) {
      out.push({ countryKey: g.countryKey, cities: [...g.cities] });
      continue;
    }
    const cityMatches = g.cities.filter((city) => city.toLowerCase().includes(q));
    if (cityMatches.length) {
      out.push({ countryKey: g.countryKey, cities: cityMatches });
    }
  }
  return out;
}

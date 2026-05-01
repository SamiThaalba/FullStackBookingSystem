import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { todayIso, tomorrowIso } from "../utils/dates";

export default function SearchPanel({ compact = false, initialValues = {}, cityOptions = [] }) {
  const navigate = useNavigate();
  const cityListId = useMemo(
    () => `city-options-${Math.random().toString(16).slice(2)}`,
    [],
  );
  const [form, setForm] = useState({
    city: initialValues.city || "",
    from: initialValues.from || todayIso(),
    to: initialValues.to || tomorrowIso(),
    adults: Number(initialValues.adults || 2),
    children: Number(initialValues.children || 0),
    rooms: Number(initialValues.rooms || 1),
    work: Boolean(initialValues.work || false),
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  const guestsTotal = Math.max(1, Number(form.adults) + Number(form.children));

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  function submit(event) {
    event.preventDefault();
    const query = new URLSearchParams({
      city: form.city,
      from: form.from,
      to: form.to,
      guests: String(guestsTotal),
      adults: String(form.adults),
      children: String(form.children),
      rooms: String(form.rooms),
      work: form.work ? "1" : "",
    }).toString();
    navigate(`/hotels?${query}`);
  }

  return (
    <form
      className={`search-panel search-panel-bar ${compact ? "search-panel-compact search-panel-bar-compact" : ""}`}
      onSubmit={submit}
    >
      <div className="search-segment">
        <label>
          <span>Where are you going?</span>
          <input
            name="city"
            value={form.city}
            onChange={updateField}
            placeholder="Select a city"
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
          <span>Check-in date</span>
          <input name="from" type="date" value={form.from} onChange={updateField} required />
        </label>
      </div>

      <div className="search-segment">
        <label>
          <span>Check-out date</span>
          <input name="to" type="date" value={form.to} onChange={updateField} required />
        </label>
      </div>

      <div className="search-segment search-segment-picker">
        <label>
          <span>Guests & rooms</span>
          <button
            type="button"
            className="picker-button"
            onClick={() => setPickerOpen((open) => !open)}
            aria-expanded={pickerOpen}
          >
            {form.adults} adults · {form.children} children · {form.rooms} room{Number(form.rooms) === 1 ? "" : "s"}
          </button>
        </label>
        {pickerOpen ? (
          <div className="picker-popover" role="dialog" aria-label="Guests and rooms">
            <PickerRow
              label="Adults"
              value={Number(form.adults)}
              min={1}
              onChange={(next) => setForm((current) => ({ ...current, adults: next }))}
            />
            <PickerRow
              label="Children"
              value={Number(form.children)}
              min={0}
              onChange={(next) => setForm((current) => ({ ...current, children: next }))}
            />
            <PickerRow
              label="Rooms"
              value={Number(form.rooms)}
              min={1}
              onChange={(next) => setForm((current) => ({ ...current, rooms: next }))}
            />
            <button type="button" className="btn btn-small btn-outline" onClick={() => setPickerOpen(false)}>
              Done
            </button>
          </div>
        ) : null}
      </div>

      <button className="btn btn-search" type="submit">
        Search
      </button>

      {!compact ? (
        <label className="work-row">
          <input name="work" type="checkbox" checked={form.work} onChange={updateField} />
          <span>I'm travelling for work</span>
        </label>
      ) : null}
    </form>
  );
}

function PickerRow({ label, value, min, onChange }) {
  return (
    <div className="picker-row">
      <span className="picker-label">{label}</span>
      <div className="picker-controls">
        <button
          type="button"
          className="picker-step"
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
        >
          –
        </button>
        <strong className="picker-value">{value}</strong>
        <button
          type="button"
          className="picker-step"
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

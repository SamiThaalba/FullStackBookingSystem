import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { todayIso, tomorrowIso } from "../utils/dates";

export default function SearchPanel({ compact = false, initialValues = {} }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    city: initialValues.city || "Aston",
    from: initialValues.from || todayIso(),
    to: initialValues.to || tomorrowIso(),
    guests: initialValues.guests || 1,
  });

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function submit(event) {
    event.preventDefault();
    const query = new URLSearchParams(form).toString();
    navigate(`/hotels?${query}`);
  }

  return (
    <form className={`search-panel ${compact ? "search-panel-compact" : ""}`} onSubmit={submit}>
      <label>
        <span>Destination</span>
        <input name="city" value={form.city} onChange={updateField} placeholder="City or hotel" />
      </label>
      <label>
        <span>Check in</span>
        <input name="from" type="date" value={form.from} onChange={updateField} required />
      </label>
      <label>
        <span>Check out</span>
        <input name="to" type="date" value={form.to} onChange={updateField} required />
      </label>
      <label>
        <span>Guests</span>
        <input
          name="guests"
          type="number"
          min="1"
          value={form.guests}
          onChange={updateField}
          required
        />
      </label>
      <button className="btn btn-search" type="submit">
        Search
      </button>
    </form>
  );
}

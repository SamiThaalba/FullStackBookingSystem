/**
 * Rows for SearchPanel: API cities plus hotel fallbacks, deduped by name+country.
 * @param {Array<{ name?: string, countryName?: string }>} cityDtos
 * @param {Array<{ city?: string, country?: string }>} hotels
 * @returns {{ name: string, countryName: string }[]}
 */
import { extendBilingualCityRows } from "./aiAssistant";

export function buildSearchCityRows(cityDtos = [], hotels = []) {
  const rows = [];
  const seen = new Set();

  for (const c of cityDtos) {
    const name = (c?.name ?? "").trim();
    if (!name) continue;
    const countryName = (c?.countryName ?? "").trim();
    const key = `${name.toLowerCase()}|${countryName.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ name, countryName });
  }

  for (const h of hotels) {
    const name = (h?.city ?? "").trim();
    if (!name) continue;
    const countryName = (h?.country ?? "").trim();
    const key = `${name.toLowerCase()}|${countryName.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ name, countryName });
  }

  return extendBilingualCityRows(rows);
}

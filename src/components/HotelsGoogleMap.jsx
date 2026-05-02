import { useMemo } from "react";
import { GoogleMap, useJsApiLoader, OverlayViewF, OVERLAY_MOUSE_TARGET } from "@react-google-maps/api";
import { useTranslation } from "react-i18next";
import { hasValidHotelLatLng } from "../utils/geo";
import { HotelMapLabel, hotelMapLabelPixelOffset } from "./HotelMapLabel";

/** Approx. center of Bethlehem — when nothing valid is plotted yet */
const FALLBACK_CENTER = { lat: 31.7054, lng: 35.2024 };

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
};

export default function HotelsGoogleMap({ hotels, variant = "default" }) {
  const apiKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "").trim();
  const { t } = useTranslation();

  if (!apiKey) {
    return (
      <div className="map-panel map-panel--placeholder">
        <p className="muted">{t("hotels.mapsApiKeyMissing")}</p>
      </div>
    );
  }

  return <HotelsGoogleMapLoaded hotels={hotels} apiKey={apiKey} variant={variant} />;
}

function HotelsGoogleMapLoaded({ hotels, apiKey, variant }) {
  const { t } = useTranslation();

  const { isLoaded, loadError } = useJsApiLoader({
    id: "hotels-discovery-map-script",
    googleMapsApiKey: apiKey,
    version: "weekly",
    language: typeof navigator !== "undefined" ? navigator.language : undefined,
  });

  const mapContainerStyle = useMemo(
    () => ({
      width: "100%",
      height:
        variant === "page"
          ? "min(620px, 72vh)"
          : variant === "detail"
            ? "min(300px, 45vh)"
            : "min(420px, 55vh)",
      borderRadius: "16px",
    }),
    [variant],
  );

  const withCoords = useMemo(() => {
    return hotels.filter((h) => hasValidHotelLatLng(h?.latitude, h?.longitude));
  }, [hotels]);

  /** Hotels that had numeric pairs but fell back to ocean / placeholders */
  const hasInvalidOrPlaceholderCoords = useMemo(() => {
    return hotels.some((h) => {
      const la = Number(h?.latitude);
      const lo = Number(h?.longitude);
      return Number.isFinite(la) && Number.isFinite(lo) && !hasValidHotelLatLng(la, lo);
    });
  }, [hotels]);

  const center = useMemo(() => {
    if (!withCoords.length) return FALLBACK_CENTER;
    let lat = 0;
    let lng = 0;
    withCoords.forEach((h) => {
      lat += Number(h.latitude);
      lng += Number(h.longitude);
    });
    return { lat: lat / withCoords.length, lng: lng / withCoords.length };
  }, [withCoords]);

  if (loadError) {
    return (
      <div className="map-panel map-panel--placeholder">
        <p className="muted">{t("hotels.mapsLoadError")}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="map-panel map-panel--placeholder">
        <p className="muted">{t("hotels.mapsLoading")}</p>
      </div>
    );
  }

  const zoom = withCoords.length <= 1 ? 14 : Math.min(12, 13 - Math.floor(withCoords.length / 4));


  return (
    <div
      className={`map-panel${variant === "page" ? " map-panel--page" : ""}${variant === "detail" ? " map-panel--detail" : ""}`}
    >

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        mapContainerClassName="maps-surface-ltr"
        center={center}
        zoom={withCoords.length ? zoom : 11}
        options={mapOptions}
      >
        {withCoords.map((hotel) => (
          <OverlayViewF
            key={hotel.id}
            position={{ lat: Number(hotel.latitude), lng: Number(hotel.longitude) }}
            mapPaneName={OVERLAY_MOUSE_TARGET}
            getPixelPositionOffset={hotelMapLabelPixelOffset}
          >
            <HotelMapLabel hotel={hotel} />
          </OverlayViewF>
        ))}
      </GoogleMap>
      {hasInvalidOrPlaceholderCoords ? (
        <p className="map-panel-hint muted">{t("hotels.mapSomeCoordsSkipped")}</p>
      ) : null}
    </div>
  );
}

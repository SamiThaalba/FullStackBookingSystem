import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader, OverlayViewF, OVERLAY_MOUSE_TARGET } from "@react-google-maps/api";
import { useTranslation } from "react-i18next";
import { FaCompress, FaExpand } from "react-icons/fa";
import { useTheme } from "../theme/ThemeContext";
import { hasValidHotelLatLng } from "../utils/geo";
import HotelMapInfoCard from "./HotelMapInfoCard";
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

/** Soft styling so the home map matches QuickReserve purple / teal / cream UI */
const HOME_MAP_STYLES_LIGHT = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { elementType: "geometry", stylers: [{ color: "#ebe8f0" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#4d4754" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f8f6fc" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#dcd7e5" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c8e8ee" }] },
];

const HOME_MAP_STYLES_DARK = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { elementType: "geometry", stylers: [{ color: "#1e1a24" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#c9c2d4" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#15101c" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2433" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#3d3548" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f2430" }] },
];

export default function HotelsGoogleMap({ hotels, variant = "default", detailBookingQuery = "" }) {
  const apiKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "").trim();
  const { t } = useTranslation();

  if (!apiKey) {
    return (
      <div
        className={`map-panel map-panel--placeholder${variant === "home" ? " map-panel--home" : ""}`}
      >
        <p className="muted">{t("hotels.mapsApiKeyMissing")}</p>
      </div>
    );
  }

  return (
    <HotelsGoogleMapLoaded
      hotels={hotels}
      apiKey={apiKey}
      variant={variant}
      detailBookingQuery={detailBookingQuery}
    />
  );
}

function getFullscreenElement() {
  return document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
}

function requestPanelFullscreen(el) {
  if (!el) return Promise.reject(new Error("no element"));
  if (el.requestFullscreen) return el.requestFullscreen();
  if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
  return Promise.reject(new Error("fullscreen unsupported"));
}

function exitPanelFullscreen() {
  if (document.exitFullscreen) return document.exitFullscreen();
  if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
  return Promise.resolve();
}

function HotelsGoogleMapLoaded({ hotels, apiKey, variant, detailBookingQuery }) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const mapPanelRef = useRef(null);
  const [previewHotel, setPreviewHotel] = useState(null);
  const [isPanelFullscreen, setIsPanelFullscreen] = useState(false);
  const useMapPreview = variant === "page" || variant === "home";

  const hotelIdsKey = useMemo(() => hotels.map((h) => h.id).join(","), [hotels]);
  useEffect(() => {
    setPreviewHotel(null);
  }, [hotelIdsKey]);

  useEffect(() => {
    if (!previewHotel) return;
    function onKey(e) {
      if (e.key === "Escape") setPreviewHotel(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewHotel]);

  useEffect(() => {
    function syncFs() {
      const el = mapPanelRef.current;
      setIsPanelFullscreen(Boolean(el && getFullscreenElement() === el));
    }
    document.addEventListener("fullscreenchange", syncFs);
    document.addEventListener("webkitfullscreenchange", syncFs);
    return () => {
      document.removeEventListener("fullscreenchange", syncFs);
      document.removeEventListener("webkitfullscreenchange", syncFs);
    };
  }, []);

  const togglePanelFullscreen = useCallback(() => {
    const el = mapPanelRef.current;
    if (!el) return;
    if (getFullscreenElement() === el) {
      void exitPanelFullscreen();
    } else {
      void requestPanelFullscreen(el).catch(() => {});
    }
  }, []);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "hotels-discovery-map-script",
    googleMapsApiKey: apiKey,
    version: "weekly",
    language: typeof navigator !== "undefined" ? navigator.language : undefined,
  });

  const mapContainerStyle = useMemo(() => {
    if (isPanelFullscreen) {
      return {
        width: "100%",
        height: "100%",
        minHeight: 0,
        flex: "1 1 auto",
        borderRadius: 0,
      };
    }
    return {
      width: "100%",
      height:
        variant === "home"
          ? "min(520px, 56vh)"
          : variant === "page"
            ? "min(620px, 72vh)"
            : variant === "detail"
              ? "min(300px, 45vh)"
              : "min(420px, 55vh)",
      borderRadius: variant === "home" ? "20px" : "16px",
    };
  }, [variant, isPanelFullscreen]);

  const resolvedMapOptions = useMemo(() => {
    const base =
      variant === "home"
        ? {
            ...mapOptions,
            styles: isDark ? HOME_MAP_STYLES_DARK : HOME_MAP_STYLES_LIGHT,
          }
        : mapOptions;
    return {
      ...base,
      /** Browser fullscreen must wrap this panel so the info card stays visible; Google only fullscreens the canvas. */
      fullscreenControl: !useMapPreview,
    };
  }, [variant, isDark, useMapPreview]);

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
      <div
        className={`map-panel map-panel--placeholder${variant === "home" ? " map-panel--home" : ""}`}
      >
        <p className="muted">{t("hotels.mapsLoadError")}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className={`map-panel map-panel--placeholder${variant === "home" ? " map-panel--home" : ""}`}
      >
        <p className="muted">{t("hotels.mapsLoading")}</p>
      </div>
    );
  }

  const zoom = withCoords.length <= 1 ? 14 : Math.min(12, 13 - Math.floor(withCoords.length / 4));


  return (
    <div
      ref={mapPanelRef}
      className={`map-panel${variant === "page" ? " map-panel--page" : ""}${variant === "detail" ? " map-panel--detail" : ""}${variant === "home" ? " map-panel--home" : ""}${useMapPreview ? " map-panel--with-preview" : ""}${isPanelFullscreen ? " map-panel--native-fs" : ""}`}
    >
      {useMapPreview ? (
        <button
          type="button"
          className="hotel-map-panel-fs-btn"
          onClick={(e) => {
            e.stopPropagation();
            togglePanelFullscreen();
          }}
          aria-pressed={isPanelFullscreen}
          aria-label={isPanelFullscreen ? t("hotels.mapExitFullscreen") : t("hotels.mapFullscreen")}
        >
          {isPanelFullscreen ? <FaCompress size={18} /> : <FaExpand size={18} />}
        </button>
      ) : null}

      <div className={isPanelFullscreen ? "maps-surface-wrap maps-surface-wrap--fill" : "maps-surface-wrap"}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          mapContainerClassName="maps-surface-ltr"
          center={center}
          zoom={withCoords.length ? zoom : 11}
          options={resolvedMapOptions}
          onClick={() => {
            if (useMapPreview) setPreviewHotel(null);
          }}
        >
          {withCoords.map((hotel) => (
            <OverlayViewF
              key={hotel.id}
              position={{ lat: Number(hotel.latitude), lng: Number(hotel.longitude) }}
              mapPaneName={OVERLAY_MOUSE_TARGET}
              getPixelPositionOffset={hotelMapLabelPixelOffset}
            >
              <HotelMapLabel
                hotel={hotel}
                usePreview={useMapPreview}
                onPreview={useMapPreview ? setPreviewHotel : undefined}
              />
            </OverlayViewF>
          ))}
        </GoogleMap>
      </div>

      {useMapPreview && previewHotel ? (
        <HotelMapInfoCard
          hotel={previewHotel}
          onClose={() => setPreviewHotel(null)}
          detailBookingQuery={detailBookingQuery}
        />
      ) : null}
    </div>
  );
}

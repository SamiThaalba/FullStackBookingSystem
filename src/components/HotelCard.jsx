import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { bookingApi } from "../api/bookingApi";
import { useAuth } from "../auth/AuthContext";
import { compactAddress } from "../utils/format";

export default function HotelCard({ hotel }) {
  const { t } = useTranslation();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const canSave = auth.isAuthenticated && auth.isCustomer;
  const saveMutation = useMutation({
    mutationFn: () => bookingApi.addToWishlist({ itemType: "HOTEL", targetId: hotel.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }),
  });

  return (
    <article className="hotel-card">
      <div className="hotel-image" aria-hidden="true">
        {hotel.imageUrl ? (
          <img src={hotel.imageUrl} alt="" />
        ) : (
          <span>{hotel?.city?.slice(0, 2)?.toUpperCase() || "PI"}</span>
        )}
      </div>
      <div className="hotel-summary">
        <h3>{hotel.name}</h3>
        <p>{compactAddress(hotel) || t("hotelCard.premierLocation")}</p>
        {hotel.description && <p className="muted clamp">{hotel.description}</p>}
        <div className="amenity-row" aria-label={t("hotelCard.amenitiesAria")}>
          <span>{t("hotelCard.wifi")}</span>
          <span>{t("hotelCard.parking")}</span>
          <span>{t("hotelCard.restaurant")}</span>
        </div>
      </div>
      <div className="hotel-action">
        <div style={{ display: "grid", gap: 10 }}>
          <Link className="btn btn-teal" to={`/hotels/${hotel.id}`}>
            {t("hotelCard.viewDetails")}
          </Link>
          {canSave ? (
            <button
              className="btn btn-small btn-outline"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? t("hotelCard.saving") : t("hotelCard.save")}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

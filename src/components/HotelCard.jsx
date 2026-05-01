import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { bookingApi } from "../api/bookingApi";
import { useAuth } from "../auth/AuthContext";
import { compactAddress } from "../utils/format";

export default function HotelCard({ hotel }) {
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
        <p>{compactAddress(hotel) || "Premier city location"}</p>
        {hotel.description && <p className="muted clamp">{hotel.description}</p>}
        <div className="amenity-row" aria-label="Featured amenities">
          <span>WiFi</span>
          <span>Parking</span>
          <span>Restaurant</span>
        </div>
      </div>
      <div className="hotel-action">
        <div style={{ display: "grid", gap: 10 }}>
          <Link className="btn btn-teal" to={`/hotels/${hotel.id}`}>
            View details
          </Link>
          {canSave ? (
            <button
              className="btn btn-small btn-outline"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { bookingApi } from "../api/bookingApi";
import { money } from "../utils/format";

export default function RoomTypeCard({ roomType, onRemove }) {
  const queryClient = useQueryClient();
  const removeMutation = useMutation({
    mutationFn: () => bookingApi.removeFromWishlist({ itemType: "ROOM_TYPE", targetId: roomType.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      onRemove?.();
    },
  });

  return (
    <article className="room-card" style={{ alignItems: "center" }}>
      <div>
        <h3>{roomType.name}</h3>
        <p className="muted">{roomType.description || "Room type"}</p>
        <div className="amenity-row">
          <span>Sleeps {roomType.capacity}</span>
          <span>{roomType.inventoryCount} rooms</span>
          {(roomType.amenities || []).slice(0, 3).map((amenity) => (
            <span key={amenity}>{amenity}</span>
          ))}
        </div>
      </div>
      <div className="room-price">
        <strong>{money(roomType.basePrice)}</strong>
        <span>per night</span>
        {roomType.hotelId ? (
          <Link className="btn btn-small btn-outline" to={`/hotels/${roomType.hotelId}`}>
            View hotel
          </Link>
        ) : null}
        <button className="btn btn-small btn-outline" disabled={removeMutation.isPending} onClick={() => removeMutation.mutate()}>
          {removeMutation.isPending ? "Removing..." : "Remove"}
        </button>
      </div>
    </article>
  );
}


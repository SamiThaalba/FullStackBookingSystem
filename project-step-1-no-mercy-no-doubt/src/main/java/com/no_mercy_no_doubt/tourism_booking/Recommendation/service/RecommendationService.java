package com.no_mercy_no_doubt.tourism_booking.Recommendation.service;

import com.no_mercy_no_doubt.tourism_booking.Recommendation.dto.RoomTypeRecommendationResponse;
import com.no_mercy_no_doubt.tourism_booking.Recommendation.dto.HotelRecommendationResponse;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.Hotel;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.HotelRepository;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomType;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomTypeRepository;
import com.no_mercy_no_doubt.tourism_booking.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class RecommendationService {

    private static final int DEFAULT_FETCH_SIZE = 1000;
    private static final int MAX_TOP_N = 50;

    private final HotelRepository hotelRepository;
    private final RoomTypeRepository roomTypeRepository;

    public List<HotelRecommendationResponse> recommendHotels(
            String city,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            Integer capacity,
            List<String> amenities,
            Integer topN
    ) {
        validateHotelFilters(minPrice, maxPrice, capacity);
        validateTopN(topN);

        Set<String> requestedAmenities = normalizeAmenities(amenities);

        List<Hotel> hotels = hotelRepository
                .findByFilters(city, null, null, PageRequest.of(0, DEFAULT_FETCH_SIZE))
                .getContent();

        List<HotelRecommendationResponse> rankedResults = hotels.stream()
                .map(hotel -> buildHotelRecommendation(hotel, city, minPrice, maxPrice, capacity, requestedAmenities))
                .filter(Objects::nonNull)
                .sorted(
                        Comparator.comparingInt(HotelRecommendationResponse::getScore).reversed()
                                .thenComparing(
                                        HotelRecommendationResponse::getStartingPrice,
                                        Comparator.nullsLast(BigDecimal::compareTo)
                                )
                                .thenComparing(HotelRecommendationResponse::getHotelName, String.CASE_INSENSITIVE_ORDER)
                )
                .limit(topN)
                .toList();

        return addHotelRanks(rankedResults);
    }

    public List<RoomTypeRecommendationResponse> recommendRoomTypes(
            Integer guestCount,
            BigDecimal budget,
            List<String> amenities,
            Integer topN
    ) {
        validateRoomFilters(guestCount, budget);
        validateTopN(topN);

        Set<String> requestedAmenities = normalizeAmenities(amenities);

        List<RoomTypeRecommendationResponse> rankedResults = roomTypeRepository.findAll().stream()
                .filter(roomType -> roomType.getCapacity() >= guestCount)
                .map(roomType -> buildRoomTypeRecommendation(roomType, guestCount, budget, requestedAmenities))
                .filter(Objects::nonNull)
                .sorted(
                        Comparator.comparingInt(RoomTypeRecommendationResponse::getScore).reversed()
                                .thenComparing(RoomTypeRecommendationResponse::getBasePrice)
                                .thenComparing(RoomTypeRecommendationResponse::getName, String.CASE_INSENSITIVE_ORDER)
                )
                .limit(topN)
                .toList();

        return addRoomTypeRanks(rankedResults);
    }

    private List<HotelRecommendationResponse> addHotelRanks(List<HotelRecommendationResponse> results) {
        return IntStream.range(0, results.size())
                .mapToObj(i -> {
                    HotelRecommendationResponse item = results.get(i);
                    item.setRank(i + 1);
                    return item;
                })
                .toList();
    }

    private List<RoomTypeRecommendationResponse> addRoomTypeRanks(List<RoomTypeRecommendationResponse> results) {
        return IntStream.range(0, results.size())
                .mapToObj(i -> {
                    RoomTypeRecommendationResponse item = results.get(i);
                    item.setRank(i + 1);
                    return item;
                })
                .toList();
    }

    private HotelRecommendationResponse buildHotelRecommendation(
            Hotel hotel,
            String city,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            Integer capacity,
            Set<String> requestedAmenities
    ) {
        List<RoomType> roomTypes = hotel.getRoomTypes() != null
                ? hotel.getRoomTypes()
                : Collections.emptyList();

        List<RoomType> matchingRooms = roomTypes.stream()
                .filter(room -> capacity == null || room.getCapacity() >= capacity)
                .filter(room -> matchesPrice(room.getBasePrice(), minPrice, maxPrice))
                .filter(room -> matchesAmenities(room.getAmenities(), requestedAmenities))
                .toList();

        if (matchingRooms.isEmpty()) {
            return null;
        }

        BigDecimal startingPrice = matchingRooms.stream()
                .map(RoomType::getBasePrice)
                .filter(Objects::nonNull)
                .min(BigDecimal::compareTo)
                .orElse(null);

        int maxCapacity = matchingRooms.stream()
                .map(RoomType::getCapacity)
                .filter(Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(0);

        Set<String> matchedAmenities = matchingRooms.stream()
                .flatMap(room -> {
                    List<String> roomAmenities = room.getAmenities() != null
                            ? room.getAmenities()
                            : Collections.emptyList();
                    return roomAmenities.stream();
                })
                .filter(Objects::nonNull)
                .map(this::normalize)
                .filter(a -> requestedAmenities.isEmpty() || requestedAmenities.contains(a))
                .collect(Collectors.toSet());

        int score = calculateHotelScore(hotel, city, startingPrice, matchingRooms.size(), matchedAmenities.size());

        return HotelRecommendationResponse.builder()
                .hotelId(hotel.getId())
                .hotelName(hotel.getName())
                .city(hotel.getCity())
                .country(hotel.getCountry())
                .score(score)
                .matchingRoomCount(matchingRooms.size())
                .maxCapacity(maxCapacity)
                .startingPrice(startingPrice)
                .matchedAmenities(matchedAmenities.stream().sorted().toList())
                .recommendationReason(
                        buildHotelReason(hotel, city, startingPrice, matchingRooms.size(), matchedAmenities.size())
                )
                .build();
    }

    private RoomTypeRecommendationResponse buildRoomTypeRecommendation(
            RoomType roomType,
            Integer guestCount,
            BigDecimal budget,
            Set<String> requestedAmenities
    ) {
        if (budget != null && roomType.getBasePrice() != null && roomType.getBasePrice().compareTo(budget) > 0) {
            return null;
        }

        Set<String> roomAmenities = roomType.getAmenities() == null
                ? Collections.emptySet()
                : roomType.getAmenities().stream()
                .filter(a -> a != null && !a.isBlank())
                .map(this::normalize)
                .collect(Collectors.toSet());

        long matchedAmenityCount = requestedAmenities.stream()
                .filter(roomAmenities::contains)
                .count();

        int score = calculateRoomTypeScore(roomType, guestCount, budget, matchedAmenityCount);

        return RoomTypeRecommendationResponse.builder()
                .id(roomType.getId())
                .name(roomType.getName())
                .description(roomType.getDescription())
                .capacity(roomType.getCapacity())
                .inventoryCount(roomType.getInventoryCount())
                .basePrice(roomType.getBasePrice())
                .amenities(roomType.getAmenities())
                .hotelId(roomType.getHotel() != null ? roomType.getHotel().getId() : null)
                .score(score)
                .matchedAmenitiesCount((int) matchedAmenityCount)
                .recommendationReason(buildRoomReason(roomType, guestCount, budget, matchedAmenityCount))
                .build();
    }

    private int calculateHotelScore(
            Hotel hotel,
            String city,
            BigDecimal startingPrice,
            int matchingRoomCount,
            int matchedAmenityCount
    ) {
        int score = 0;

        if (city != null && hotel.getCity() != null && hotel.getCity().equalsIgnoreCase(city)) {
            score += 40;
        }

        score += matchingRoomCount * 10;

        if (startingPrice != null) {
            if (startingPrice.compareTo(BigDecimal.valueOf(100)) <= 0) {
                score += 30;
            } else if (startingPrice.compareTo(BigDecimal.valueOf(200)) <= 0) {
                score += 20;
            } else {
                score += 10;
            }
        }

        score += matchedAmenityCount * 8;

        return score;
    }

    private int calculateRoomTypeScore(
            RoomType roomType,
            Integer guestCount,
            BigDecimal budget,
            long matchedAmenityCount
    ) {
        int score = 0;

        int extraCapacity = roomType.getCapacity() - guestCount;
        if (extraCapacity == 0) {
            score += 40;
        } else if (extraCapacity == 1) {
            score += 30;
        } else {
            score += 20;
        }

        if (budget != null) {
            BigDecimal difference = budget.subtract(roomType.getBasePrice());
            if (difference.compareTo(BigDecimal.ZERO) >= 0) {
                if (difference.compareTo(BigDecimal.valueOf(20)) <= 0) {
                    score += 25;
                } else if (difference.compareTo(BigDecimal.valueOf(50)) <= 0) {
                    score += 18;
                } else {
                    score += 10;
                }
            }
        } else {
            if (roomType.getBasePrice().compareTo(BigDecimal.valueOf(100)) <= 0) {
                score += 25;
            } else if (roomType.getBasePrice().compareTo(BigDecimal.valueOf(200)) <= 0) {
                score += 18;
            } else {
                score += 10;
            }
        }

        score += (int) matchedAmenityCount * 10;

        return score;
    }

    private boolean matchesPrice(BigDecimal price, BigDecimal minPrice, BigDecimal maxPrice) {
        if (price == null) {
            return false;
        }

        boolean minOk = minPrice == null || price.compareTo(minPrice) >= 0;
        boolean maxOk = maxPrice == null || price.compareTo(maxPrice) <= 0;
        return minOk && maxOk;
    }

    private boolean matchesAmenities(List<String> roomAmenities, Set<String> requestedAmenities) {
        if (requestedAmenities.isEmpty()) {
            return true;
        }

        Set<String> normalizedRoomAmenities = roomAmenities == null
                ? Collections.emptySet()
                : roomAmenities.stream()
                .filter(a -> a != null && !a.isBlank())
                .map(this::normalize)
                .collect(Collectors.toSet());

        return requestedAmenities.stream().allMatch(normalizedRoomAmenities::contains);
    }

    private Set<String> normalizeAmenities(List<String> amenities) {
        if (amenities == null) {
            return Collections.emptySet();
        }

        return amenities.stream()
                .filter(a -> a != null && !a.isBlank())
                .map(this::normalize)
                .collect(Collectors.toSet());
    }

    private String normalize(String value) {
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private void validateHotelFilters(BigDecimal minPrice, BigDecimal maxPrice, Integer capacity) {
        if (minPrice != null && minPrice.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("Minimum price must be zero or higher.");
        }
        if (maxPrice != null && maxPrice.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("Maximum price must be zero or higher.");
        }
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0) {
            throw new BusinessException("Minimum price cannot be greater than maximum price.");
        }
        if (capacity != null && capacity < 1) {
            throw new BusinessException("Capacity must be at least 1.");
        }
    }

    private void validateRoomFilters(Integer guestCount, BigDecimal budget) {
        if (guestCount == null || guestCount < 1) {
            throw new BusinessException("Guest count must be at least 1.");
        }
        if (budget != null && budget.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("Budget must be zero or higher.");
        }
    }

    private void validateTopN(Integer topN) {
        if (topN == null || topN < 1) {
            throw new BusinessException("topN must be at least 1.");
        }
        if (topN > MAX_TOP_N) {
            throw new BusinessException("topN cannot be greater than " + MAX_TOP_N + ".");
        }
    }

    private String buildHotelReason(
            Hotel hotel,
            String city,
            BigDecimal startingPrice,
            int roomCount,
            int amenityMatchCount
    ) {
        StringBuilder reason = new StringBuilder("Recommended because ");
        boolean added = false;

        if (city != null && hotel.getCity() != null && hotel.getCity().equalsIgnoreCase(city)) {
            reason.append("it matches the requested city");
            added = true;
        }
        if (startingPrice != null) {
            if (added) {
                reason.append(", ");
            }
            reason.append("its starting price is ").append(startingPrice);
            added = true;
        }
        if (roomCount > 0) {
            if (added) {
                reason.append(", ");
            }
            reason.append("it has ").append(roomCount).append(" matching room type(s)");
            added = true;
        }
        if (amenityMatchCount > 0) {
            if (added) {
                reason.append(", ");
            }
            reason.append("it matches ").append(amenityMatchCount).append(" requested amenit");
            reason.append(amenityMatchCount > 1 ? "ies" : "y");
            added = true;
        }

        if (!added) {
            reason.append("it fits the request");
        }

        return reason.toString();
    }

    private String buildRoomReason(
            RoomType roomType,
            Integer guestCount,
            BigDecimal budget,
            long matchedAmenityCount
    ) {
        StringBuilder reason = new StringBuilder("Recommended because ");
        boolean added = false;

        if (roomType.getCapacity() == guestCount) {
            reason.append("it is an exact fit for the guest count");
        } else {
            reason.append("it fits the guest count comfortably");
        }
        added = true;

        if (budget != null) {
            if (added) {
                reason.append(", ");
            }
            reason.append("it is within the requested budget");
            added = true;
        }

        if (matchedAmenityCount > 0) {
            if (added) {
                reason.append(", ");
            }
            reason.append("it matches ").append(matchedAmenityCount).append(" requested amenit");
            reason.append(matchedAmenityCount > 1 ? "ies" : "y");
        }

        return reason.toString();
    }
}
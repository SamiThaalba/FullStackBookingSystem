package com.no_mercy_no_doubt.tourism_booking.catalog.geography;

import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.Hotel;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.HotelRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Seeds {@link Country} and {@link City} when empty, then sets {@code hotels.city_id} from legacy
 * {@code hotels.city} / {@code hotels.country} columns (read via JDBC) or a default city.
 */
@Component
@Order(5)
@RequiredArgsConstructor
@Slf4j
public class GeographyDataInitializer implements CommandLineRunner {

    private final CountryRepository countryRepository;
    private final CityRepository cityRepository;
    private final HotelRepository hotelRepository;
    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        if (countryRepository.count() == 0) {
            seedReferenceData();
        }
        City fallback = resolveFallbackCity();
        if (fallback == null) {
            return;
        }
        try {
            backfillFromLegacyColumns(fallback);
        } catch (Exception e) {
            log.warn("Skipping legacy hotel city backfill (fresh DB or columns absent): {}", e.getMessage());
        }
        assignFallbackToRemaining(fallback);
    }

    @Transactional
    protected void seedReferenceData() {
        Map<String, List<String>> data = new LinkedHashMap<>();
        data.put("Palestine", List.of(
                "Bethlehem", "Jerusalem", "Ramallah", "Hebron", "Nablus",
                "Jenin", "Tulkarm", "Jericho", "Gaza City", "Rafah", "Qalqilya"
        ));
        data.put("Jordan", List.of("Amman", "Aqaba", "Petra", "Irbid", "Zarqa"));

        for (Map.Entry<String, List<String>> e : data.entrySet()) {
            Country country = countryRepository.save(Country.builder().name(e.getKey()).build());
            for (String cityName : e.getValue()) {
                cityRepository.save(City.builder().name(cityName).country(country).build());
            }
        }
        log.info("Seeded {} country groups from GeographyDataInitializer", data.size());
    }

    private City resolveFallbackCity() {
        Optional<City> fallbackOpt = cityRepository
                .findByNameIgnoreCaseAndCountry_NameIgnoreCase("Bethlehem", "Palestine");
        if (fallbackOpt.isEmpty()) {
            fallbackOpt = cityRepository.findFirstByNameIgnoreCase("Bethlehem");
        }
        if (fallbackOpt.isEmpty()) {
            fallbackOpt = cityRepository.findAll().stream().findFirst();
        }
        return fallbackOpt.orElse(null);
    }

    protected void backfillFromLegacyColumns(City fallback) {
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    "SELECT id, city, country FROM hotels WHERE city_id IS NULL");
            for (Map<String, Object> row : rows) {
                Long id = ((Number) row.get("id")).longValue();
                String rawCity = decodeLegacyText(row.get("city"));
                String rawCountry = decodeLegacyText(row.get("country"));
                Optional<City> matched = resolveCityFromStrings(rawCity, rawCountry);
                City chosen = matched.orElse(fallback);
                hotelRepository.findById(id).ifPresent(hotel -> {
                    if (hotel.getLocatedCity() == null) {
                        hotel.setLocatedCity(chosen);
                        hotelRepository.save(hotel);
                    }
                });
            }
        } catch (DataAccessException ex) {
            log.debug("Skipping JDBC legacy hotel city backfill: {}", ex.getMessage());
            throw ex; // rethrow so run() catch block logs the warning
        }
    }

    @Transactional
    protected void assignFallbackToRemaining(City fallback) {
        for (Hotel hotel : hotelRepository.findAll()) {
            if (hotel.getLocatedCity() == null) {
                hotel.setLocatedCity(fallback);
                hotelRepository.save(hotel);
            }
        }
    }

    private static String decodeLegacyText(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof String s) {
            return s.isBlank() ? null : s.trim();
        }
        if (value instanceof byte[] bytes) {
            String s = new String(bytes, StandardCharsets.UTF_8).trim();
            return s.isEmpty() ? null : s;
        }
        String s = value.toString().trim();
        return s.isEmpty() ? null : s;
    }

    private Optional<City> resolveCityFromStrings(String rawCity, String rawCountry) {
        if (rawCity == null || rawCity.isBlank()) {
            return Optional.empty();
        }
        if (rawCountry != null && !rawCountry.isBlank()) {
            Optional<City> byBoth = cityRepository.findByNameIgnoreCaseAndCountry_NameIgnoreCase(
                    rawCity, rawCountry);
            if (byBoth.isPresent()) {
                return byBoth;
            }
        }
        return cityRepository.findFirstByNameIgnoreCase(rawCity);
    }
}
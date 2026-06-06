package com.no_mercy_no_doubt.tourism_booking.catalog.geography;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Geography", description = "Countries and cities for hotel location and search")
public class GeographyController {

    private final CountryRepository countryRepository;
    private final CityRepository cityRepository;

    @GetMapping("/countries")
    @Operation(summary = "List all countries")
    public List<CountryResponse> listCountries() {
        return countryRepository.findAll(Sort.by("name")).stream()
                .map(c -> new CountryResponse(c.getId(), c.getName()))
                .toList();
    }

    @GetMapping("/cities")
    @Operation(summary = "List cities, optionally filtered by country")
    public List<CityResponse> listCities(@RequestParam(required = false) Long countryId) {
        List<City> cities = countryId != null
                ? cityRepository.findByCountry_IdOrderByNameAsc(countryId)
                : cityRepository.findAllOrderByCountryAndName();
        return cities.stream()
                .map(c -> new CityResponse(
                        c.getId(),
                        c.getName(),
                        c.getCountry().getId(),
                        c.getCountry().getName()))
                .toList();
    }
}

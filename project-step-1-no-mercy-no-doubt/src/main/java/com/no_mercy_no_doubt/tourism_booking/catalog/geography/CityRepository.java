package com.no_mercy_no_doubt.tourism_booking.catalog.geography;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface CityRepository extends JpaRepository<City, Long> {

    @Query("SELECT c FROM City c JOIN FETCH c.country ORDER BY c.country.name ASC, c.name ASC")
    List<City> findAllOrderByCountryAndName();

    List<City> findByCountry_IdOrderByNameAsc(Long countryId);

    Optional<City> findFirstByNameIgnoreCase(String name);

    Optional<City> findFirstByCountry_IdAndNameIgnoreCase(Long countryId, String name);

    Optional<City> findByNameIgnoreCaseAndCountry_NameIgnoreCase(String cityName, String countryName);
}

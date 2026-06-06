package com.no_mercy_no_doubt.tourism_booking.auth.repository;

import com.no_mercy_no_doubt.tourism_booking.auth.entity.Permission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PermissionRepository extends JpaRepository<Permission, Long> {
    Optional<Permission> findByName(String name);
    boolean existsByName(String name);
    List<Permission> findByNameIn(Collection<String> names);
}
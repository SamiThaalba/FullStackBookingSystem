package com.no_mercy_no_doubt.tourism_booking.analytics.repository;

import com.no_mercy_no_doubt.tourism_booking.analytics.entity.UserActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface UserActivityLogRepository extends JpaRepository<UserActivityLog, Long>, JpaSpecificationExecutor<UserActivityLog> {
}

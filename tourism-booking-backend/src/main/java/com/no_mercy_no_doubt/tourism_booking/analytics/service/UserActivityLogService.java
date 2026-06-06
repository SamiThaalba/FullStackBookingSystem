package com.no_mercy_no_doubt.tourism_booking.analytics.service;

import com.no_mercy_no_doubt.tourism_booking.analytics.dto.UserActivityLogResponse;
import com.no_mercy_no_doubt.tourism_booking.analytics.entity.UserActivityLog;
import com.no_mercy_no_doubt.tourism_booking.analytics.repository.UserActivityLogRepository;
import com.no_mercy_no_doubt.tourism_booking.auth.entity.AppUser;
import com.no_mercy_no_doubt.tourism_booking.auth.service.RoleManagementService;
import com.no_mercy_no_doubt.tourism_booking.common.dto.PageResponse;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserActivityLogService {

    private final UserActivityLogRepository logRepository;
    private final RoleManagementService roleManagementService;

    @Transactional
    public void logRequest(AppUser user, String actionType, String method, String endpoint, String resourceType, String resourceId) {
        if (user == null || !roleManagementService.userHasManagerPermissions(user)) {
            return;
        }

        UserActivityLog entry = UserActivityLog.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .actionType(actionType)
                .httpMethod(method)
                .endpoint(endpoint)
                .resourceType(resourceType)
                .resourceId(resourceId)
                .build();

        logRepository.save(entry);
    }

    @Transactional(readOnly = true)
    public PageResponse<UserActivityLogResponse> getLogs(Long userId, String actionType, LocalDate fromDate, LocalDate toDate,
                                                         int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<UserActivityLog> result = logRepository.findAll((root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (userId != null) {
                predicates.add(cb.equal(root.get("userId"), userId));
            }
            if (actionType != null && !actionType.isBlank()) {
                predicates.add(cb.equal(cb.upper(root.get("actionType")), actionType.trim().toUpperCase()));
            }
            if (fromDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), fromDate.atStartOfDay()));
            }
            if (toDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), LocalDateTime.of(toDate, LocalTime.MAX)));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        }, pageable);

        List<UserActivityLogResponse> content = result.getContent().stream()
                .map(this::toResponse)
                .toList();

        return PageResponse.<UserActivityLogResponse>builder()
                .content(content)
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .first(result.isFirst())
                .last(result.isLast())
                .build();
    }

    private UserActivityLogResponse toResponse(UserActivityLog log) {
        return UserActivityLogResponse.builder()
                .id(log.getId())
                .userId(log.getUserId())
                .username(log.getUsername())
                .actionType(log.getActionType())
                .httpMethod(log.getHttpMethod())
                .endpoint(log.getEndpoint())
                .resourceType(log.getResourceType())
                .resourceId(log.getResourceId())
                .createdAt(log.getCreatedAt())
                .build();
    }
}

package com.no_mercy_no_doubt.tourism_booking.wishlist.controller;

import com.no_mercy_no_doubt.tourism_booking.wishlist.dto.AlertResponse;
import com.no_mercy_no_doubt.tourism_booking.wishlist.dto.CreateAlertRequest;
import com.no_mercy_no_doubt.tourism_booking.wishlist.service.AlertService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
@Tag(name = "Alerts", description = "Price and availability alerts on room types")
public class AlertController {

    private final AlertService alertService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a price or availability alert")
    public AlertResponse create(@Valid @RequestBody CreateAlertRequest request) {
        return alertService.create(request);
    }

    @GetMapping
    @Operation(summary = "List current user's alerts")
    public List<AlertResponse> myAlerts() {
        return alertService.myAlerts();
    }

    @PatchMapping("/{id}/activate")
    @Operation(summary = "Re-enable an alert and clear triggered state")
    public AlertResponse activate(@PathVariable Long id) {
        return alertService.activate(id);
    }

    @PatchMapping("/{id}/deactivate")
    @Operation(summary = "Stop an alert from firing")
    public AlertResponse deactivate(@PathVariable Long id) {
        return alertService.deactivate(id);
    }
}
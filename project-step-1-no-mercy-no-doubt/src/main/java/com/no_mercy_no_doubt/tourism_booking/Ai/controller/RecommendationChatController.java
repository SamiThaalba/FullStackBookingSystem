package com.no_mercy_no_doubt.tourism_booking.Ai.controller;

import com.no_mercy_no_doubt.tourism_booking.Ai.dto.RecommendationChatRequest;
import com.no_mercy_no_doubt.tourism_booking.Ai.dto.RecommendationChatResponse;
import com.no_mercy_no_doubt.tourism_booking.Ai.dto.RecommendationChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('recommendation:view')")
public class RecommendationChatController {

    private final RecommendationChatService recommendationChatService;

    @PostMapping("/recommendation-bot")
    public ResponseEntity<RecommendationChatResponse> recommendationBot(
            @Valid @RequestBody RecommendationChatRequest request
    ) {
        return ResponseEntity.ok(recommendationChatService.chat(request));
    }
}
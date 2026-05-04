package com.no_mercy_no_doubt.tourism_booking.Ai.controller;

import com.no_mercy_no_doubt.tourism_booking.Ai.dto.RecommendationChatRequest;
import com.no_mercy_no_doubt.tourism_booking.Ai.dto.RecommendationChatResponse;
import com.no_mercy_no_doubt.tourism_booking.Ai.dto.RecommendationChatService;
import com.no_mercy_no_doubt.tourism_booking.Ai.dto.AssistantChatRequest;
import com.no_mercy_no_doubt.tourism_booking.Ai.dto.AssistantChatResponse;
import com.no_mercy_no_doubt.tourism_booking.Ai.service.ConversationalAssistantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class RecommendationChatController {

    private final RecommendationChatService recommendationChatService;
    private final ConversationalAssistantService conversationalAssistantService;

    @PostMapping("/recommendation-bot")
    public ResponseEntity<RecommendationChatResponse> recommendationBot(
            @Valid @RequestBody RecommendationChatRequest request
    ) {
        return ResponseEntity.ok(recommendationChatService.chat(request));
    }

    @PostMapping("/assistant")
    public ResponseEntity<AssistantChatResponse> assistant(
            @Valid @RequestBody AssistantChatRequest request
    ) {
        return ResponseEntity.ok(conversationalAssistantService.chat(request));
    }
}
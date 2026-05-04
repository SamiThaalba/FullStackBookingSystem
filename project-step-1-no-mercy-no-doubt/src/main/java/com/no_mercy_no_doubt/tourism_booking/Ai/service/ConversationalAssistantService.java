package com.no_mercy_no_doubt.tourism_booking.Ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.no_mercy_no_doubt.tourism_booking.Ai.dto.*;
import com.no_mercy_no_doubt.tourism_booking.Recommendation.dto.HotelRecommendationResponse;
import com.no_mercy_no_doubt.tourism_booking.Recommendation.service.RecommendationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class ConversationalAssistantService {
    private static final Pattern GUEST_COUNT_PATTERN =
            Pattern.compile("\\b(\\d{1,2})\\s*(guest|guests|people|person)?\\b", Pattern.CASE_INSENSITIVE);

    private final GroqClientService groqClientService;
    private final RecommendationService recommendationService;
    private final ObjectMapper objectMapper;

    public AssistantChatResponse chat(AssistantChatRequest request) {
        AssistantContext context = request.getContext() == null ? new AssistantContext() : request.getContext();

        JsonNode llmJson = parseAssistantJson(callAssistantLlm(request, context));
        String intent = textNode(llmJson, "intent", "other");
        if (boolNode(llmJson, "reset", false)) {
            context = new AssistantContext();
        }

        JsonNode slots = llmJson.path("slots");
        context.setCity(firstNonBlank(textNode(slots, "city", null), context.getCity()));
        context.setCheckIn(firstNonBlank(textNode(slots, "checkIn", null), context.getCheckIn()));
        context.setCheckOut(firstNonBlank(textNode(slots, "checkOut", null), context.getCheckOut()));
        context.setGuests(firstNonNull(intNode(slots, "guests"), context.getGuests()));
        context.setSelectedHotelName(firstNonBlank(textNode(slots, "selectedHotelName", null), context.getSelectedHotelName()));
        applyNaturalDateFallback(request.getMessage(), context);
        boolean hasGuestToken = applyHeuristicGuestFallback(request.getMessage(), context);

        if (("other".equals(intent) || "follow_up".equals(intent))
                && "booking".equalsIgnoreCase(context.getMode())) {
            intent = "booking";
        }
        if ("other".equals(intent) && context.getCity() != null && hasGuestToken) {
            intent = "booking";
        }
        if ("other".equals(intent) && context.getCity() != null
                && (context.getCheckIn() != null || context.getCheckOut() != null || context.getGuests() != null)) {
            intent = "booking";
        }

        String mode = "booking".equals(intent) ? "booking" : ("search".equals(intent) || "filter".equals(intent) ? "search" : context.getMode());
        context.setMode(mode);
        log.info("AI parsed slots -> city={}, checkIn={}, checkOut={}, guests={}, intent={}",
                context.getCity(), context.getCheckIn(), context.getCheckOut(), context.getGuests(), intent);

        List<String> missing = missingFieldsForIntent(intent, context);

        List<HotelRecommendationResponse> recommendations = List.of();
        if (context.getCity() != null && !context.getCity().isBlank()) {
            try {
                recommendations = recommendationService.recommendHotels(
                        context.getCity(),
                        null,
                        null,
                        context.getGuests(),
                        List.of(),
                        5
                );
            } catch (Exception ignored) {
                recommendations = List.of();
            }
        }

        if (context.getSelectedHotelId() == null && !recommendations.isEmpty()) {
            context.setSelectedHotelId(recommendations.get(0).getHotelId());
            context.setSelectedHotelName(recommendations.get(0).getHotelName());
        }

        AssistantActionPlan action = buildAction(intent, context, missing, recommendations);
        String reply = textNode(llmJson, "reply", "");
        if ("booking".equals(intent) && !missing.isEmpty()) {
            // Deterministic follow-up question so short user replies always progress flow.
            reply = missingPrompt(missing.get(0), context);
        }
        if (reply.isBlank()) {
            reply = fallbackReply(intent, context, missing, recommendations);
        }
        if ("booking".equals(intent) && recommendations.isEmpty() && context.getCity() != null) {
            reply = "I could not find available matches in " + context.getCity() + ". Try another city or different dates.";
        }

        return AssistantChatResponse.builder()
                .reply(reply)
                .intent(intent)
                .context(context)
                .missingFields(missing)
                .action(action)
                .recommendations(recommendations)
                .build();
    }

    private String callAssistantLlm(AssistantChatRequest request, AssistantContext context) {
        String systemPrompt = """
                You are a conversational hotel assistant.
                Return ONLY valid JSON.
                No markdown, no explanation outside JSON.
                You must use previous context and history.
                Detect intent and extract slots from the user's latest message.
                Supported intents: search, booking, filter, follow_up, reset, other.
                JSON schema:
                {
                  "intent":"search|booking|filter|follow_up|reset|other",
                  "reset":true|false,
                  "reply":"string",
                  "slots":{
                    "city":"string|null",
                    "checkIn":"YYYY-MM-DD|null",
                    "checkOut":"YYYY-MM-DD|null",
                    "guests":number|null,
                    "selectedHotelName":"string|null"
                  }
                }
                """;

        StringBuilder userPrompt = new StringBuilder();
        userPrompt.append("Current context:\n")
                .append("city=").append(context.getCity()).append("\n")
                .append("checkIn=").append(context.getCheckIn()).append("\n")
                .append("checkOut=").append(context.getCheckOut()).append("\n")
                .append("guests=").append(context.getGuests()).append("\n")
                .append("selectedHotelName=").append(context.getSelectedHotelName()).append("\n")
                .append("mode=").append(context.getMode()).append("\n\n");
        userPrompt.append("Recent conversation turns:\n");
        for (AssistantTurn turn : trimHistory(request.getHistory(), 8)) {
            userPrompt.append(turn.getRole()).append(": ").append(turn.getContent()).append("\n");
        }
        userPrompt.append("\nLatest user message:\n").append(request.getMessage());
        return groqClientService.chat(systemPrompt, userPrompt.toString());
    }

    private List<AssistantTurn> trimHistory(List<AssistantTurn> history, int max) {
        if (history == null || history.isEmpty()) return List.of();
        int start = Math.max(0, history.size() - max);
        return history.subList(start, history.size());
    }

    private AssistantActionPlan buildAction(String intent, AssistantContext context, List<String> missing,
                                            List<HotelRecommendationResponse> recommendations) {
        if ("search".equals(intent) || "filter".equals(intent) || "follow_up".equals(intent)) {
            if (context.getCity() != null && !context.getCity().isBlank()) {
                return AssistantActionPlan.builder()
                        .type("NAVIGATE_DISCOVER")
                        .city(context.getCity())
                        .checkIn(context.getCheckIn())
                        .checkOut(context.getCheckOut())
                        .guests(context.getGuests())
                        .build();
            }
            return AssistantActionPlan.builder().type("ASK_MISSING").build();
        }
        if ("booking".equals(intent)) {
            if (!missing.isEmpty() && missing.contains("city")) {
                return AssistantActionPlan.builder().type("ASK_MISSING").build();
            }
            if (!missing.isEmpty()) {
                return AssistantActionPlan.builder()
                        .type("NAVIGATE_DISCOVER")
                        .city(context.getCity())
                        .checkIn(context.getCheckIn())
                        .checkOut(context.getCheckOut())
                        .guests(context.getGuests())
                        .build();
            }
            Long hotelId = context.getSelectedHotelId();
            String hotelName = context.getSelectedHotelName();
            if ((hotelId == null || hotelName == null) && !recommendations.isEmpty()) {
                hotelId = recommendations.get(0).getHotelId();
                hotelName = recommendations.get(0).getHotelName();
            }
            return AssistantActionPlan.builder()
                    .type("PREPARE_BOOKING")
                    .city(context.getCity())
                    .checkIn(context.getCheckIn())
                    .checkOut(context.getCheckOut())
                    .guests(context.getGuests())
                    .hotelId(hotelId)
                    .hotelName(hotelName)
                    .build();
        }
        return AssistantActionPlan.builder().type("NONE").build();
    }

    private List<String> missingFieldsForIntent(String intent, AssistantContext context) {
        List<String> missing = new ArrayList<>();
        if ("booking".equals(intent)) {
            if (isBlank(context.getCity())) missing.add("city");
            if (isBlank(context.getCheckIn())) missing.add("checkIn");
            if (isBlank(context.getCheckOut())) missing.add("checkOut");
            if (context.getGuests() == null || context.getGuests() < 1) missing.add("guests");
        } else if ("search".equals(intent) || "filter".equals(intent)) {
            if (isBlank(context.getCity())) missing.add("city");
        }
        return missing;
    }

    private JsonNode parseAssistantJson(String raw) {
        try {
            return objectMapper.readTree(raw);
        } catch (Exception ex) {
            throw new IllegalStateException("AI response format is invalid.");
        }
    }

    private String fallbackReply(String intent, AssistantContext context, List<String> missing,
                                 List<HotelRecommendationResponse> recommendations) {
        if ("booking".equals(intent) && !missing.isEmpty()) {
            return missingPrompt(missing.get(0), context);
        }
        if (("search".equals(intent) || "filter".equals(intent)) && context.getCity() != null) {
            return recommendations.isEmpty()
                    ? "I could not find good matches in " + context.getCity() + "."
                    : "I found options in " + context.getCity() + ".";
        }
        return "I understood your request and updated the conversation context.";
    }

    private String missingPrompt(String missingField, AssistantContext context) {
        return switch (missingField) {
            case "checkIn" -> "Great, I can help with " + context.getCity() + ". What is your check-in date?";
            case "checkOut" -> "Got it. What is your check-out date?";
            case "guests" -> "Perfect. How many guests will stay?";
            case "city" -> "Sure, which city would you like to stay in?";
            default -> "Please share the missing booking details so I can continue.";
        };
    }

    private static String textNode(JsonNode node, String key, String fallback) {
        if (node == null || node.path(key).isMissingNode() || node.path(key).isNull()) return fallback;
        String s = node.path(key).asText();
        return s == null || s.isBlank() ? fallback : s.trim();
    }

    private static Integer intNode(JsonNode node, String key) {
        if (node == null || node.path(key).isMissingNode() || node.path(key).isNull()) return null;
        int v = node.path(key).asInt(-1);
        return v > 0 ? v : null;
    }

    private static boolean boolNode(JsonNode node, String key, boolean fallback) {
        if (node == null || node.path(key).isMissingNode() || node.path(key).isNull()) return fallback;
        return node.path(key).asBoolean(fallback);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String firstNonBlank(String first, String second) {
        return !isBlank(first) ? first : second;
    }

    private static Integer firstNonNull(Integer first, Integer second) {
        return first != null ? first : second;
    }

    private void applyNaturalDateFallback(String message, AssistantContext context) {
        if (message == null || message.isBlank()) {
            return;
        }

        LocalDate today = LocalDate.now();
        LocalDate parsedCheckIn = parseDateIsoSafe(context.getCheckIn());
        LocalDate parsedCheckOut = parseDateIsoSafe(context.getCheckOut());

        String normalized = message.trim().toLowerCase(Locale.ROOT);

        // Handles phrases like "tomorrow to sunday" / "today to friday".
        if (normalized.contains(" to ")) {
            String[] parts = normalized.split("\\s+to\\s+", 2);
            LocalDate start = resolveTokenToDate(parts[0], today);
            LocalDate end = resolveTokenToDate(parts[1], start != null ? start : today);

            if (start != null && parsedCheckIn == null) {
                parsedCheckIn = start;
            }
            if (end != null && parsedCheckOut == null) {
                parsedCheckOut = end;
            }
        }

        if (parsedCheckIn == null) {
            parsedCheckIn = resolveTokenToDate(normalized, today);
        }
        if (parsedCheckOut == null && parsedCheckIn != null) {
            parsedCheckOut = parsedCheckIn.plusDays(1);
        }

        if (parsedCheckIn != null && parsedCheckOut != null && !parsedCheckOut.isAfter(parsedCheckIn)) {
            parsedCheckOut = parsedCheckIn.plusDays(1);
        }

        if (parsedCheckIn != null) {
            context.setCheckIn(parsedCheckIn.toString());
        }
        if (parsedCheckOut != null) {
            context.setCheckOut(parsedCheckOut.toString());
        }
        log.debug("AI date fallback applied from message='{}' => checkIn={}, checkOut={}",
                message, context.getCheckIn(), context.getCheckOut());
    }

    private boolean applyHeuristicGuestFallback(String message, AssistantContext context) {
        if (message == null || message.isBlank()) {
            return false;
        }
        Matcher matcher = GUEST_COUNT_PATTERN.matcher(message.trim());
        if (!matcher.find()) {
            return false;
        }
        try {
            int guests = Integer.parseInt(matcher.group(1));
            if (guests > 0 && guests <= 20) {
                context.setGuests(guests);
                return true;
            }
        } catch (NumberFormatException ignored) {
            // ignore malformed number and keep existing context value
        }
        return false;
    }

    private LocalDate parseDateIsoSafe(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private LocalDate resolveTokenToDate(String token, LocalDate reference) {
        if (token == null) return null;
        String t = token.trim().toLowerCase(Locale.ROOT);
        if (t.isEmpty()) return null;

        if (t.contains("today")) return LocalDate.now();
        if (t.contains("tomorrow")) return LocalDate.now().plusDays(1);

        Map<String, DayOfWeek> weekdays = Map.of(
                "monday", DayOfWeek.MONDAY,
                "tuesday", DayOfWeek.TUESDAY,
                "wednesday", DayOfWeek.WEDNESDAY,
                "thursday", DayOfWeek.THURSDAY,
                "friday", DayOfWeek.FRIDAY,
                "saturday", DayOfWeek.SATURDAY,
                "sunday", DayOfWeek.SUNDAY
        );

        for (Map.Entry<String, DayOfWeek> entry : weekdays.entrySet()) {
            if (t.contains(entry.getKey())) {
                LocalDate candidate = reference.with(TemporalAdjusters.nextOrSame(entry.getValue()));
                if (!candidate.isAfter(reference)) {
                    candidate = candidate.plusWeeks(1);
                }
                return candidate;
            }
        }

        try {
            return LocalDate.parse(t);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }
}

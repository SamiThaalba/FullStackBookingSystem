package com.no_mercy_no_doubt.tourism_booking.Ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.no_mercy_no_doubt.tourism_booking.Ai.dto.*;
import com.no_mercy_no_doubt.tourism_booking.Recommendation.dto.HotelRecommendationResponse;
import com.no_mercy_no_doubt.tourism_booking.Recommendation.service.RecommendationService;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.Hotel;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.HotelRepository;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.HotelResponse;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.HotelService;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomType;
import com.no_mercy_no_doubt.tourism_booking.catalog.RoomType.RoomTypeRepository;
import com.no_mercy_no_doubt.tourism_booking.catalog.geography.City;
import com.no_mercy_no_doubt.tourism_booking.catalog.geography.CityRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.MonthDay;
import java.time.format.DateTimeParseException;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class ConversationalAssistantService {
    /**
     * Must include an explicit guest-related word — otherwise "5" in "5/5/2026" is mistaken for 5 guests.
     */
    private static final Pattern GUEST_COUNT_PATTERN = Pattern.compile(
            "\\b(\\d{1,2})\\s*(?:guests?|people|persons?|travelers?|pax|of\\s+us|in\\s+our\\s+group)\\b",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern ORDINAL_PICK_PATTERN =
            Pattern.compile("\\b(\\d{1,2})(?:st|nd|rd|th)?\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern PURE_GREETING_PATTERN = Pattern.compile(
            "^(hi|hello|hey|hey there|hello there|yo|good morning|good afternoon|good evening|salam)[.!?]*$",
            Pattern.CASE_INSENSITIVE);
    private static final List<String> KNOWN_CITY_NAMES = List.of(
            "ramallah",
            "jerusalem",
            "bethlehem",
            "hebron",
            "nablus",
            "jericho",
            "jenin",
            "tulkarm",
            "qalqilya",
            "salfit",
            "tubas",
            "gaza",
            "khan yunis",
            "rafah"
    );
    private static final List<String> UNSURE_CITY_TOKENS = List.of(
            "idk", "i dont know", "i don't know", "not sure", "unsure", "whatever"
    );

    private final GroqClientService groqClientService;
    private final RecommendationService recommendationService;
    private final HotelRepository hotelRepository;
    private final HotelService hotelService;
    private final RoomTypeRepository roomTypeRepository;
    private final CityRepository cityRepository;
    private final ObjectMapper objectMapper;

    public AssistantChatResponse chat(AssistantChatRequest request) {
        String userText = normalizeUserMessageForNlp(request.getMessage());
        AssistantContext context = request.getContext() == null ? new AssistantContext() : request.getContext();
        String previousCity = context.getCity();
        String previousCheckIn = context.getCheckIn();
        String previousCheckOut = context.getCheckOut();
        Integer previousGuests = context.getGuests();
        Boolean previousAnyCity = context.getAnyCity();
        String invalidCityInput = null;
        String suggestedCityName = null;

        if (isPureGreeting(userText) && isEmptyBookingContext(context)) {
            return AssistantChatResponse.builder()
                    .reply("Hi, I'm here. Tell me what you're looking for, or tap Guide me and I'll walk you through it.")
                    .intent("other")
                    .context(context)
                    .missingFields(List.of())
                    .action(AssistantActionPlan.builder().type("NONE").build())
                    .recommendations(List.of())
                    .build();
        }

        if (userMeansAnyCity(userText)) {
            context.setAnyCity(true);
            context.setCity(null);
        }
        if (userWantsHotelCatalog(userText)) {
            context.setAnyCity(true);
            context.setCity(null);
            context.setSelectedHotelId(null);
            context.setSelectedHotelName(null);
            context.setPendingHotelName(null);
            context.setSelectedRoomTypeId(null);
            context.setSelectedRoomTypeName(null);
            context.setMode("searching");
            List<HotelRecommendationResponse> recommendations = buildRecommendations(context, null);
            return AssistantChatResponse.builder()
                    .reply("Sure. I will show available hotels instead of treating that as a hotel name.")
                    .intent("search")
                    .context(context)
                    .missingFields(List.of())
                    .action(AssistantActionPlan.builder()
                            .type("NAVIGATE_DISCOVER")
                            .city(context.getCity())
                            .checkIn(context.getCheckIn())
                            .checkOut(context.getCheckOut())
                            .guests(context.getGuests())
                            .build())
                    .recommendations(recommendations)
                    .build();
        }
        if (userIsUnsureAboutCity(userText) && isBlank(context.getCity()) && context.getSelectedHotelId() == null) {
            return AssistantChatResponse.builder()
                    .reply("No problem. If city does not matter, say: any city. Or tell me one city in Palestine, like Bethlehem or Ramallah.")
                    .intent("booking")
                    .context(context)
                    .missingFields(List.of("city"))
                    .action(AssistantActionPlan.builder().type("ASK_MISSING").build())
                    .recommendations(List.of())
                    .build();
        }

        JsonNode llmJson = parseAssistantJson(callAssistantLlm(request, context, userText));
        String intent = textNode(llmJson, "intent", "other");
        if (boolNode(llmJson, "reset", false)) {
            context = new AssistantContext();
        }

        JsonNode slots = llmJson.path("slots");
        String extractedCity = textNode(slots, "city", null);
        if (userMeansAnyCity(extractedCity)) {
            context.setAnyCity(true);
            context.setCity(null);
        } else if (!isBlank(extractedCity)) {
            CityResolution cityResolution = resolveCityInput(extractedCity);
            if (cityResolution.status() == CityResolutionStatus.EXACT) {
                context.setAnyCity(false);
                context.setCity(cityResolution.canonicalCity());
            } else if (cityResolution.status() == CityResolutionStatus.SUGGESTED) {
                context.setAnyCity(false);
                context.setCity(null);
                invalidCityInput = extractedCity.trim();
                suggestedCityName = cityResolution.canonicalCity();
            } else {
                context.setAnyCity(false);
                context.setCity(null);
                invalidCityInput = extractedCity.trim();
            }
        } else if (!Boolean.TRUE.equals(context.getAnyCity())) {
            context.setCity(firstNonBlank(extractedCity, context.getCity()));
        }
        context.setCheckIn(firstNonBlank(normalizeDateSlot(textNode(slots, "checkIn", null)), context.getCheckIn()));
        context.setCheckOut(firstNonBlank(normalizeDateSlot(textNode(slots, "checkOut", null)), context.getCheckOut()));
        context.setGuests(firstNonNull(intNode(slots, "guests"), context.getGuests()));
        String requestedHotelName = resolveRequestedHotelName(
                request.getMessage(),
                textNode(slots, "selectedHotelName", null),
                context
        );
        if (!isBlank(requestedHotelName) && context.getSelectedHotelId() == null) {
            context.setPendingHotelName(requestedHotelName.trim());
        }
        String requestedRoomTypeName = resolveRequestedRoomTypeName(
                request.getMessage(),
                textNode(slots, "selectedRoomTypeName", null),
                context
        );
        context.setSelectedRoomTypeName(firstNonBlank(requestedRoomTypeName, context.getSelectedRoomTypeName()));
        if (primaryBookingFieldsChanged(previousCity, previousCheckIn, previousCheckOut, previousGuests, context)
                || !Objects.equals(Boolean.TRUE.equals(previousAnyCity), Boolean.TRUE.equals(context.getAnyCity()))) {
            context.setSelectedHotelId(null);
            context.setSelectedHotelName(null);
            context.setSelectedRoomTypeId(null);
            context.setSelectedRoomTypeName(null);
        }
        applyNaturalDateFallback(userText, context);
        boolean hasGuestToken = applyHeuristicGuestFallback(userText, context);
        sanitizeGuestsIfDateDigitNoise(userText, context);

        if (("other".equals(intent) || "follow_up".equals(intent))
                && "booking".equalsIgnoreCase(context.getMode())) {
            intent = "booking";
        }
        if ("other".equals(intent) && (context.getCity() != null || Boolean.TRUE.equals(context.getAnyCity())) && hasGuestToken) {
            intent = "booking";
        }
        if ("other".equals(intent) && (context.getCity() != null || Boolean.TRUE.equals(context.getAnyCity()))
                && (context.getCheckIn() != null || context.getCheckOut() != null || context.getGuests() != null)) {
            intent = "booking";
        }

        String mode = context.getMode();
        if ("booking".equals(intent)) {
            mode = "booking";
        } else if ("search".equals(intent) || "filter".equals(intent)) {
            mode = "searching";
        }
        context.setMode(mode);
        log.info("AI parsed slots -> city={}, checkIn={}, checkOut={}, guests={}, intent={}",
                context.getCity(), context.getCheckIn(), context.getCheckOut(), context.getGuests(), intent);

        List<HotelRecommendationResponse> recommendations = buildRecommendations(context, requestedHotelName);

        HotelSelectionResult selectionResult = resolveHotelSelection(
                request.getMessage(),
                userText,
                requestedHotelName,
                recommendations,
                context
        );
        if (selectionResult.selected() != null) {
            context.setSelectedHotelId(selectionResult.selected().getHotelId());
            context.setSelectedHotelName(selectionResult.selected().getHotelName());
            context.setPendingHotelName(null);
            context.setSelectedRoomTypeId(null);
            context.setSelectedRoomTypeName(null);
            context.setMode("selecting_room");
        }

        List<RoomType> roomTypes = loadRoomTypes(context.getSelectedHotelId());
        RoomSelectionResult roomSelectionResult = resolveRoomSelection(
                request.getMessage(),
                userText,
                requestedRoomTypeName,
                roomTypes,
                context
        );
        if (roomSelectionResult.selected() != null) {
            context.setSelectedRoomTypeId(roomSelectionResult.selected().getId());
            context.setSelectedRoomTypeName(roomSelectionResult.selected().getName());
            context.setMode("booking");
        } else if (context.getSelectedHotelId() != null && context.getSelectedRoomTypeId() == null && !roomTypes.isEmpty()) {
            context.setMode("selecting_room");
        }

        List<String> missing = missingFieldsForIntent(intent, context, recommendations);
        if (!isBlank(invalidCityInput) && !missing.contains("city")) {
            missing.add(0, "city");
        }
        if (missing.contains("hotelSelection")) {
            context.setMode("selecting_hotel");
        } else if (missing.contains("roomSelection")) {
            context.setMode("selecting_room");
        } else if ("booking".equals(intent) && missing.isEmpty() && context.getSelectedRoomTypeId() != null) {
            context.setMode("confirming");
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
        if ("booking".equals(intent) && !recommendations.isEmpty() && context.getSelectedHotelId() == null) {
            if (selectionResult.noNameMatch()) {
                List<HotelRecommendationResponse> similarOptions =
                        selectionResult.candidates().isEmpty() ? recommendations : selectionResult.candidates();
                reply = "I couldn't find a hotel with that name. Here are some similar options:\n"
                        + renderHotelOptions(similarOptions)
                        + "\nWhich hotel would you like to book?";
            } else if (selectionResult.multipleMatches()) {
                reply = "I found multiple hotels matching that name:\n"
                        + renderHotelOptions(selectionResult.candidates())
                        + "\nWhich hotel would you like to book?";
            } else if (missing.contains("hotelSelection")) {
                reply = "Here are available hotels:\n"
                        + renderHotelOptions(recommendations)
                        + "\nWhich hotel would you like to book?";
            }
        }
        if ("booking".equals(intent) && context.getSelectedHotelId() != null && context.getSelectedRoomTypeId() == null) {
            if (roomSelectionResult.noNameMatch()) {
                List<RoomType> similarRooms = roomSelectionResult.candidates().isEmpty() ? roomTypes : roomSelectionResult.candidates();
                reply = "I couldn't find that room type. Here are similar options:\n"
                        + renderRoomTypeOptions(similarRooms)
                        + "\nWhich room type would you like?";
            } else if (roomSelectionResult.multipleMatches()) {
                reply = "I found multiple matching room types:\n"
                        + renderRoomTypeOptions(roomSelectionResult.candidates())
                        + "\nWhich room type would you like?";
            } else {
                reply = "Which room type would you like?\n" + renderRoomTypeOptions(roomTypes);
            }
        }
        if (!isBlank(suggestedCityName)) {
            reply = "I couldn't find \"" + invalidCityInput + "\" as a city in Palestine. Did you mean " + suggestedCityName + "?";
        } else if (!isBlank(invalidCityInput)) {
            reply = "There is no city called \"" + invalidCityInput + "\" in Palestine. Please enter a valid city, or say: any city.";
        }

        context.setCurrentStep(resolveCurrentStep(intent, context, missing));

        return AssistantChatResponse.builder()
                .reply(reply)
                .intent(intent)
                .context(context)
                .missingFields(missing)
                .action(action)
                .recommendations(recommendations)
                .build();
    }

    private String resolveCurrentStep(String intent, AssistantContext context, List<String> missing) {
        if (!"booking".equals(intent) && !"search".equals(intent) && !"filter".equals(intent)) {
            return context.getCurrentStep();
        }
        boolean anyCity = Boolean.TRUE.equals(context.getAnyCity());
        boolean hasCityOrAll = anyCity || (!isBlank(context.getCity()));
        boolean hasDates = !isBlank(context.getCheckIn()) && !isBlank(context.getCheckOut());
        boolean hasGuests = context.getGuests() != null && context.getGuests() > 0;
        boolean hasHotel = context.getSelectedHotelId() != null;
        boolean hasRoom = context.getSelectedRoomTypeId() != null;

        if (!hasCityOrAll && !hasHotel && missing.contains("city")) return "CITY";
        if (!hasDates && (missing.contains("checkIn") || missing.contains("checkOut"))) return "DATES";
        if (!hasGuests && missing.contains("guests")) return "GUESTS";
        if (!hasHotel) return "SHOW_HOTELS";
        if (!hasRoom) return "SHOW_ROOMS";
        if ("confirming".equalsIgnoreCase(context.getMode())) return "CONFIRM";
        return "PAYMENT";
    }

    private String callAssistantLlm(AssistantChatRequest request, AssistantContext context, String normalizedMessage) {
        String systemPrompt = """
                You are a conversational hotel assistant.
                Return ONLY valid JSON.
                No markdown, no explanation outside JSON.
                You must use previous context and history.
                Be typo-tolerant and intent-tolerant:
                - Understand misspellings like "tomorro", "tmrw", "behlehem", "ramala".
                - If user is unsure (idk/not sure), ask a helpful follow-up instead of failing.
                - If user gives a partial hotel name, treat it as a hotel-search/selection intent.
                Detect intent and extract slots from the user's latest message.
                Supported intents: search, booking, filter, follow_up, reset, other.
                Awareness rules:
                - "show/list/view all hotels" means browse hotel listings, not a hotel named "show me all".
                - If the assistant just asked for a city, a short place name is city, not hotel.
                - If the assistant just asked for guests, a number means guests, not option selection.
                - Use selectedHotelName only when the user clearly names a hotel or chooses from visible hotel options.
                - Use selectedRoomTypeName only when a hotel is already selected and the user is choosing a room type.
                JSON schema:
                {
                  "intent":"search|booking|filter|follow_up|reset|other",
                  "reset":true|false,
                  "reply":"string",
                  "slots":{
                    "city":"string|null",
                    "anyCity":true|false|null,
                    "checkIn":"YYYY-MM-DD|null",
                    "checkOut":"YYYY-MM-DD|null",
                    "guests":number|null,
                    "selectedHotelName":"string|null",
                    "selectedRoomTypeName":"string|null"
                  }
                }
                """;

        StringBuilder userPrompt = new StringBuilder();
        userPrompt.append("Current context:\n")
                .append("city=").append(context.getCity()).append("\n")
                .append("anyCity=").append(context.getAnyCity()).append("\n")
                .append("checkIn=").append(context.getCheckIn()).append("\n")
                .append("checkOut=").append(context.getCheckOut()).append("\n")
                .append("guests=").append(context.getGuests()).append("\n")
                .append("selectedHotelName=").append(context.getSelectedHotelName()).append("\n")
                .append("pendingHotelName=").append(context.getPendingHotelName()).append("\n")
                .append("selectedRoomTypeName=").append(context.getSelectedRoomTypeName()).append("\n")
                .append("mode=").append(context.getMode()).append("\n")
                .append("currentStep=").append(context.getCurrentStep()).append("\n\n");
        userPrompt.append("Recent conversation turns:\n");
        for (AssistantTurn turn : trimHistory(request.getHistory(), 8)) {
            userPrompt.append(turn.getRole()).append(": ").append(turn.getContent()).append("\n");
        }
        userPrompt.append("\nLatest user message (normalized for typos):\n").append(normalizedMessage);
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
            if (Boolean.TRUE.equals(context.getAnyCity()) || (context.getCity() != null && !context.getCity().isBlank())) {
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
            if (missing.contains("hotelSelection")) {
                return AssistantActionPlan.builder()
                        .type("ASK_HOTEL_SELECTION")
                        .city(context.getCity())
                        .checkIn(context.getCheckIn())
                        .checkOut(context.getCheckOut())
                        .guests(context.getGuests())
                        .build();
            }
            if (missing.contains("roomSelection")) {
                return AssistantActionPlan.builder()
                        .type("ASK_ROOM_SELECTION")
                        .hotelId(context.getSelectedHotelId())
                        .hotelName(context.getSelectedHotelName())
                        .build();
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
            return AssistantActionPlan.builder()
                    .type("PREPARE_BOOKING")
                    .city(context.getCity())
                    .checkIn(context.getCheckIn())
                    .checkOut(context.getCheckOut())
                    .guests(context.getGuests())
                    .hotelId(hotelId)
                    .hotelName(hotelName)
                    .roomTypeId(context.getSelectedRoomTypeId())
                    .roomTypeName(context.getSelectedRoomTypeName())
                    .build();
        }
        return AssistantActionPlan.builder().type("NONE").build();
    }

    private List<String> missingFieldsForIntent(String intent, AssistantContext context,
                                                List<HotelRecommendationResponse> recommendations) {
        List<String> missing = new ArrayList<>();
        if ("booking".equals(intent)) {
            boolean anyCity = Boolean.TRUE.equals(context.getAnyCity());
            boolean namedHotelPending = !isBlank(context.getPendingHotelName()) && context.getSelectedHotelId() == null;
            if (!anyCity && isBlank(context.getCity()) && context.getSelectedHotelId() == null && !namedHotelPending) {
                missing.add("city");
            }
            boolean datesOrGuestsMissing = isBlank(context.getCheckIn())
                    || isBlank(context.getCheckOut())
                    || context.getGuests() == null
                    || context.getGuests() < 1;
            boolean explicitHotelRequest = (!isBlank(context.getSelectedHotelName()) && context.getSelectedHotelId() == null)
                    || namedHotelPending;

            // Normal flow: city -> dates/guests -> hotel -> room.
            // Direct hotel flow: if user explicitly gave a hotel name, allow hotel selection earlier.
            if (!explicitHotelRequest) {
                if (isBlank(context.getCheckIn())) missing.add("checkIn");
                if (isBlank(context.getCheckOut())) missing.add("checkOut");
                if (context.getGuests() == null || context.getGuests() < 1) missing.add("guests");
            }

            if (missing.isEmpty() && context.getSelectedHotelId() == null && !recommendations.isEmpty()) {
                missing.add("hotelSelection");
            }
            if (missing.isEmpty() && context.getSelectedHotelId() != null && context.getSelectedRoomTypeId() == null) {
                missing.add("roomSelection");
            }

            if (explicitHotelRequest && datesOrGuestsMissing) {
                if (isBlank(context.getCheckIn())) missing.add("checkIn");
                if (isBlank(context.getCheckOut())) missing.add("checkOut");
                if (context.getGuests() == null || context.getGuests() < 1) missing.add("guests");
            }
        } else if ("search".equals(intent) || "filter".equals(intent)) {
            if (!Boolean.TRUE.equals(context.getAnyCity()) && isBlank(context.getCity())) missing.add("city");
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
        String place = Boolean.TRUE.equals(context.getAnyCity()) || isBlank(context.getCity()) ? "any city" : context.getCity();
        return switch (missingField) {
            case "checkIn" -> "Great, I can help with " + place + ". What is your check-in date?";
            case "checkOut" -> "Got it. What is your check-out date?";
            case "guests" -> "Perfect. How many guests will stay?";
            case "hotelSelection" -> "Which hotel would you like to book?";
            case "roomSelection" -> "Which room type would you like?";
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

    private boolean isPureGreeting(String text) {
        if (text == null || text.isBlank()) return false;
        return PURE_GREETING_PATTERN.matcher(text.trim().replaceAll("\\s+", " ")).matches();
    }

    private boolean isEmptyBookingContext(AssistantContext context) {
        if (context == null) return true;
        return isBlank(context.getCity())
                && !Boolean.TRUE.equals(context.getAnyCity())
                && isBlank(context.getCheckIn())
                && isBlank(context.getCheckOut())
                && context.getGuests() == null
                && context.getSelectedHotelId() == null
                && context.getSelectedRoomTypeId() == null
                && isBlank(context.getPendingHotelName())
                && isBlank(context.getSelectedHotelName())
                && isBlank(context.getSelectedRoomTypeName());
    }

    private boolean userMeansAnyCity(String text) {
        String value = String.valueOf(text == null ? "" : text).toLowerCase(Locale.ROOT).trim();
        if (value.isEmpty()) return false;
        String compact = value.replaceAll("\\s+", "");
        return value.contains("any city")
                || compact.contains("anycity")
                || value.contains("all cities")
                || value.contains("all hotels")
                || value.contains("all hotel")
                || value.contains("anywhere")
                || value.equals("any")
                || value.contains("doesn't matter")
                || value.contains("doesnt matter")
                || value.contains("don't care")
                || value.contains("dont care");
    }

    private boolean userWantsHotelCatalog(String text) {
        String value = String.valueOf(text == null ? "" : text)
                .toLowerCase(Locale.ROOT)
                .trim()
                .replaceAll("[.!?]+$", "")
                .replaceAll("\\s+", " ");
        if (value.isBlank() || !value.matches(".*\\bhotels?\\b.*")) {
            return false;
        }
        if (value.matches(".*\\b(called|named|name is)\\b.*")) {
            return false;
        }
        if (value.matches("^(all\\s+)?hotels?$")) {
            return true;
        }
        boolean browseVerb = value.matches(".*\\b(show|list|see|view|browse|display|give|get|find|search)\\b.*");
        boolean collection = value.matches(".*\\b(all|available|options|every|any)\\b.*")
                || value.matches(".*\\bhotels?\\s*(please)?$");
        return browseVerb && collection;
    }

    private String resolveRequestedHotelName(String message, String slotHotelName, AssistantContext context) {
        String explicitHotelName = cleanHotelCandidate(firstNonBlank(
                extractRequestedHotelName(message),
                extractHotelNameWantPatterns(message)
        ));
        if (!isBlank(explicitHotelName)) {
            return explicitHotelName;
        }

        String trustedSlot = cleanHotelCandidate(slotHotelName);
        if (!isBlank(trustedSlot) && shouldInterpretAsHotelChoice(message, context)) {
            return trustedSlot;
        }

        String pendingHotelName = cleanHotelCandidate(context.getPendingHotelName());
        if (!isBlank(pendingHotelName)) {
            return pendingHotelName;
        }

        if (!shouldInterpretAsHotelChoice(message, context)) {
            return null;
        }
        return cleanHotelCandidate(inferHotelNameFromMessage(message));
    }

    private String resolveRequestedRoomTypeName(String message, String slotRoomTypeName, AssistantContext context) {
        if (!shouldInterpretAsRoomChoice(message, context)) {
            return null;
        }
        String trustedSlot = cleanChoiceCandidate(slotRoomTypeName);
        if (!isBlank(trustedSlot)) {
            return trustedSlot;
        }
        return cleanChoiceCandidate(inferRoomNameFromMessage(message));
    }

    private String cleanHotelCandidate(String value) {
        String cleaned = cleanChoiceCandidate(value);
        if (isBlank(cleaned)
                || looksLikeKnownCity(cleaned)
                || userMeansAnyCity(cleaned)
                || userWantsHotelCatalog(cleaned)
                || looksLikeGuestsOrDateMessage(cleaned)) {
            return null;
        }
        return cleaned;
    }

    private String cleanChoiceCandidate(String value) {
        if (value == null) {
            return null;
        }
        String cleaned = value.trim().replaceAll("\\s+", " ");
        if (cleaned.isBlank()) {
            return null;
        }
        return cleaned;
    }

    private boolean shouldInterpretAsHotelChoice(String message, AssistantContext context) {
        if (context == null || context.getSelectedHotelId() != null) {
            return false;
        }
        if (userMeansAnyCity(message) || looksLikeGuestsOrDateMessage(message) || looksLikeKnownCity(message)) {
            return false;
        }
        String mode = normalizeText(context.getMode());
        String currentStep = normalizeText(context.getCurrentStep());
        if ("selecting_hotel".equals(mode) || "show_hotels".equals(currentStep)) {
            return true;
        }
        boolean hasPlace = Boolean.TRUE.equals(context.getAnyCity()) || !isBlank(context.getCity());
        boolean hasDates = !isBlank(context.getCheckIn()) && !isBlank(context.getCheckOut());
        boolean hasGuests = context.getGuests() != null && context.getGuests() > 0;
        return hasPlace && hasDates && hasGuests;
    }

    private boolean shouldInterpretAsRoomChoice(String message, AssistantContext context) {
        if (context == null || context.getSelectedHotelId() == null) {
            return false;
        }
        if (userMeansAnyCity(message) || looksLikeGuestsOrDateMessage(message) || looksLikeKnownCity(message)) {
            return false;
        }
        String mode = normalizeText(context.getMode());
        String currentStep = normalizeText(context.getCurrentStep());
        return "selecting_room".equals(mode) || "show_rooms".equals(currentStep) || context.getSelectedRoomTypeId() == null;
    }

    private boolean looksLikeKnownCity(String value) {
        String normalized = normalizeText(value);
        return KNOWN_CITY_NAMES.stream().anyMatch(city -> city.equals(normalized));
    }

    private List<HotelRecommendationResponse> buildRecommendations(AssistantContext context, String requestedHotelName) {
        // Direct hotel-name flow: find by name even without city.
        if (!isBlank(requestedHotelName)) {
            List<HotelRecommendationResponse> byName = findHotelsByName(requestedHotelName);
            if (byName != null && !byName.isEmpty()) return byName;
        }

        boolean anyCity = Boolean.TRUE.equals(context.getAnyCity());
        String city = anyCity ? null : (isBlank(context.getCity()) ? null : context.getCity().trim());
        LocalDate from = parseDateIsoSafe(context.getCheckIn());
        LocalDate to = parseDateIsoSafe(context.getCheckOut());
        Integer guests = context.getGuests();

        // Only show hotel options once we have enough data to filter correctly.
        if ((anyCity || city != null) && from != null && to != null && guests != null && guests > 0) {
            try {
                var page = hotelService.listHotelsWithFilters(
                        city,
                        null,
                        null,
                        guests,
                        null,
                        null,
                        from,
                        to,
                        0,
                        5
                );
                return (page.getContent() == null ? List.<HotelResponse>of() : page.getContent())
                        .stream()
                        .map(h -> HotelRecommendationResponse.builder()
                                .hotelId(h.getId())
                                .hotelName(h.getName())
                                .city(h.getCity())
                                .country(h.getCountry())
                                .build())
                        .toList();
            } catch (Exception ex) {
                return List.of();
            }
        }

        // Legacy fallback: city-only recommendation if we have city but not full filters yet.
        if (city != null) {
            try {
                return recommendationService.recommendHotels(
                        city,
                        null,
                        null,
                        guests,
                        List.of(),
                        5
                );
            } catch (Exception ignored) {
                return List.of();
            }
        }

        return List.of();
    }

    private static String firstNonBlank(String... parts) {
        if (parts == null) {
            return null;
        }
        for (String p : parts) {
            if (!isBlank(p)) {
                return p.trim();
            }
        }
        return null;
    }

    private static Integer firstNonNull(Integer first, Integer second) {
        return first != null ? first : second;
    }

    private boolean primaryBookingFieldsChanged(String previousCity, String previousCheckIn,
                                                String previousCheckOut, Integer previousGuests,
                                                AssistantContext currentContext) {
        return !Objects.equals(normalizeText(previousCity), normalizeText(currentContext.getCity()))
                || !Objects.equals(normalizeText(previousCheckIn), normalizeText(currentContext.getCheckIn()))
                || !Objects.equals(normalizeText(previousCheckOut), normalizeText(currentContext.getCheckOut()))
                || !Objects.equals(previousGuests, currentContext.getGuests());
    }

    private HotelSelectionResult resolveHotelSelection(String message,
                                                       String normalizedMessage,
                                                       String requestedHotelNameFromSlot,
                                                       List<HotelRecommendationResponse> recommendations,
                                                       AssistantContext context) {
        if (recommendations == null || recommendations.isEmpty()) {
            context.setSelectedHotelId(null);
            context.setSelectedHotelName(null);
            return HotelSelectionResult.none(false, false, List.of());
        }

        if (context.getSelectedHotelId() != null) {
            boolean stillAvailable = recommendations.stream()
                    .anyMatch(h -> Objects.equals(h.getHotelId(), context.getSelectedHotelId()));
            if (!stillAvailable) {
                context.setSelectedHotelId(null);
                context.setSelectedHotelName(null);
            }
        }

        Integer pickedIndex = parsePickIndex(normalizedMessage);
        if (!looksLikeGuestsOrDateMessage(message)
                && shouldInterpretAsHotelChoice(message, context)
                && pickedIndex != null
                && pickedIndex >= 0
                && pickedIndex < recommendations.size()) {
            return HotelSelectionResult.selected(recommendations.get(pickedIndex));
        }

        String requestedHotelName = resolveRequestedHotelName(message, requestedHotelNameFromSlot, context);
        if (isBlank(requestedHotelName)) {
            return HotelSelectionResult.none(false, false, List.of());
        }

        String target = normalizeText(requestedHotelName);
        List<HotelRecommendationResponse> exactMatches = recommendations.stream()
                .filter(h -> normalizeText(h.getHotelName()).equals(target))
                .toList();
        if (exactMatches.size() == 1) {
            return HotelSelectionResult.selected(exactMatches.get(0));
        }
        if (exactMatches.size() > 1) {
            return HotelSelectionResult.none(false, true, exactMatches);
        }

        List<HotelRecommendationResponse> fuzzyMatches = recommendations.stream()
                .filter(h -> {
                    String candidate = normalizeText(h.getHotelName());
                    return candidate.contains(target) || target.contains(candidate);
                })
                .toList();
        if (fuzzyMatches.size() == 1) {
            return HotelSelectionResult.selected(fuzzyMatches.get(0));
        }
        if (fuzzyMatches.size() > 1) {
            return HotelSelectionResult.none(false, true, fuzzyMatches);
        }

        return HotelSelectionResult.none(true, false, bestSimilarOptions(target, recommendations, 3));
    }

    private List<HotelRecommendationResponse> bestSimilarOptions(String target,
                                                                 List<HotelRecommendationResponse> recommendations,
                                                                 int limit) {
        return recommendations.stream()
                .sorted(Comparator.comparingInt(h -> similarityDistance(target, normalizeText(h.getHotelName()))))
                .limit(limit)
                .toList();
    }

    private int similarityDistance(String target, String candidate) {
        if (candidate.contains(target) || target.contains(candidate)) {
            return 0;
        }
        List<String> targetTokens = Arrays.stream(target.split("\\s+")).filter(s -> !s.isBlank()).toList();
        List<String> candidateTokens = Arrays.stream(candidate.split("\\s+")).filter(s -> !s.isBlank()).toList();
        long overlap = targetTokens.stream().filter(candidateTokens::contains).count();
        return (int) (Math.max(targetTokens.size(), candidateTokens.size()) - overlap);
    }

    private Integer parsePickIndex(String message) {
        String normalized = normalizeText(message);
        if (normalized.isBlank()) {
            return null;
        }
        Map<String, Integer> named = Map.of(
                "first", 1,
                "one", 1,
                "second", 2,
                "two", 2,
                "third", 3,
                "three", 3,
                "fourth", 4,
                "four", 4,
                "fifth", 5
        );
        for (Map.Entry<String, Integer> entry : named.entrySet()) {
            if (normalized.matches(".*\\b" + entry.getKey() + "\\b.*")) {
                return entry.getValue() - 1;
            }
        }
        Matcher matcher = ORDINAL_PICK_PATTERN.matcher(normalized);
        if (matcher.find()) {
            int number = Integer.parseInt(matcher.group(1));
            if (number > 0) {
                return number - 1;
            }
        }
        return null;
    }

    private String extractRequestedHotelName(String message) {
        if (message == null || message.isBlank()) {
            return null;
        }
        String normalized = message.trim();
        Pattern pattern = Pattern.compile(
                "(?i)(?:hotel\\s+(?:called|named)?\\s*|book\\s+)([\\p{L}\\p{N}&'\\-\\s]{2,})"
        );
        Matcher matcher = pattern.matcher(normalized);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }
        return null;
    }

    /**
     * Phrases like "I want this hotel I want Patch Name Only22" (no "hotel called X" pattern).
     */
    private String extractHotelNameWantPatterns(String message) {
        if (message == null || message.isBlank()) {
            return null;
        }
        String t = message.trim();
        List<Pattern> patterns = List.of(
                Pattern.compile("(?i)\\bi\\s+want\\s+this\\s+hotel\\s+i\\s+want\\s+(.{2,200})$"),
                Pattern.compile("(?i)\\bthis\\s+hotel\\s+i\\s+want\\s+(.{2,200})$"),
                Pattern.compile("(?i)\\bhotel\\s+i\\s+want\\s+(.{2,200})$"),
                Pattern.compile("(?i)\\bi\\s+want\\s+(?:this\\s+)?hotel\\s+(.{2,120})$"),
                Pattern.compile("(?i)\\b(?:stay|staying|book|booking)\\s+(?:at|in)\\s+([\\p{L}\\p{N}&'\\-\\s]{2,120})$")
        );
        for (Pattern p : patterns) {
            Matcher m = p.matcher(t);
            if (m.find()) {
                String name = m.group(1).trim().replaceAll("\\s+", " ");
                if (name.length() >= 2) {
                    return name;
                }
            }
        }
        return null;
    }

    private String inferHotelNameFromMessage(String message) {
        if (message == null || message.isBlank()) {
            return null;
        }
        String normalized = message.trim();
        if (normalized.split("\\s+").length > 6) {
            return null;
        }
        String lowered = normalizeText(normalized);
        if (lowered.matches(".*\\b(today|tomorrow|guest|guests|people|person|city|check\\s*in|check\\s*out)\\b.*")) {
            return null;
        }
        if (looksLikeKnownCity(normalized) || userMeansAnyCity(normalized)) {
            return null;
        }
        if (parsePickIndex(normalized) != null) {
            return null;
        }
        return normalized;
    }

    private String renderHotelOptions(List<HotelRecommendationResponse> hotels) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < hotels.size(); i++) {
            HotelRecommendationResponse h = hotels.get(i);
            sb.append(i + 1).append(") ").append(h.getHotelName());
            if (h.getStartingPrice() != null) {
                sb.append(" - from ").append(h.getStartingPrice());
            }
            if (h.getScore() != null) {
                sb.append(" (score ").append(h.getScore()).append(")");
            }
            if (i < hotels.size() - 1) {
                sb.append("\n");
            }
        }
        return sb.toString();
    }

    private String normalizeText(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    private record HotelSelectionResult(HotelRecommendationResponse selected,
                                        boolean noNameMatch,
                                        boolean multipleMatches,
                                        List<HotelRecommendationResponse> candidates) {
        static HotelSelectionResult selected(HotelRecommendationResponse selected) {
            return new HotelSelectionResult(selected, false, false, List.of());
        }

        static HotelSelectionResult none(boolean noNameMatch, boolean multipleMatches,
                                         List<HotelRecommendationResponse> candidates) {
            return new HotelSelectionResult(null, noNameMatch, multipleMatches, candidates);
        }
    }

    private List<RoomType> loadRoomTypes(Long hotelId) {
        if (hotelId == null) {
            return List.of();
        }
        try {
            Map<Long, RoomType> byId = new LinkedHashMap<>();
            for (RoomType rt : roomTypeRepository.findByHotelId(hotelId)) {
                if (!isValidRoomType(rt)) {
                    continue;
                }
                byId.putIfAbsent(rt.getId(), rt);
            }
            return new ArrayList<>(byId.values());
        } catch (Exception ex) {
            return List.of();
        }
    }

    private List<HotelRecommendationResponse> findHotelsByName(String hotelName) {
        if (isBlank(hotelName)) {
            return List.of();
        }
        String pattern = "%" + hotelName.trim() + "%";
        try {
            return hotelRepository.findByFilters(null, null, pattern, PageRequest.of(0, 5))
                    .stream()
                    .map(this::toRecommendationResponse)
                    .toList();
        } catch (Exception ex) {
            return List.of();
        }
    }

    private HotelRecommendationResponse toRecommendationResponse(Hotel hotel) {
        return HotelRecommendationResponse.builder()
                .hotelId(hotel.getId())
                .hotelName(hotel.getName())
                .city(hotel.getDisplayCity())
                .country(hotel.getDisplayCountry())
                .build();
    }

    private RoomSelectionResult resolveRoomSelection(String message,
                                                     String normalizedMessage,
                                                     String requestedRoomTypeFromSlot,
                                                     List<RoomType> roomTypes,
                                                     AssistantContext context) {
        if (context.getSelectedHotelId() == null || roomTypes == null || roomTypes.isEmpty()) {
            context.setSelectedRoomTypeId(null);
            context.setSelectedRoomTypeName(null);
            return RoomSelectionResult.none(false, false, List.of());
        }

        if (context.getSelectedRoomTypeId() != null) {
            boolean stillExists = roomTypes.stream().anyMatch(r -> Objects.equals(r.getId(), context.getSelectedRoomTypeId()));
            if (!stillExists) {
                context.setSelectedRoomTypeId(null);
                context.setSelectedRoomTypeName(null);
            }
        }

        Integer pickedIndex = parsePickIndex(normalizedMessage);
        if (!looksLikeGuestsOrDateMessage(normalizedMessage) && pickedIndex != null && pickedIndex >= 0 && pickedIndex < roomTypes.size()) {
            return RoomSelectionResult.selected(roomTypes.get(pickedIndex));
        }

        String requestedRoomName = resolveRequestedRoomTypeName(message, requestedRoomTypeFromSlot, context);
        if (isBlank(requestedRoomName)) {
            return RoomSelectionResult.none(false, false, List.of());
        }

        String target = normalizeText(requestedRoomName);
        List<RoomType> exact = roomTypes.stream()
                .filter(r -> normalizeText(r.getName()).equals(target))
                .toList();
        if (exact.size() == 1) {
            return RoomSelectionResult.selected(exact.get(0));
        }
        if (exact.size() > 1) {
            return RoomSelectionResult.none(false, true, exact);
        }

        List<RoomType> fuzzy = roomTypes.stream()
                .filter(r -> {
                    String n = normalizeText(r.getName());
                    return n.contains(target) || target.contains(n);
                })
                .toList();
        if (fuzzy.size() == 1) {
            return RoomSelectionResult.selected(fuzzy.get(0));
        }
        if (fuzzy.size() > 1) {
            return RoomSelectionResult.none(false, true, fuzzy);
        }

        return RoomSelectionResult.none(true, false, bestSimilarRooms(target, roomTypes, 3));
    }

    private List<RoomType> bestSimilarRooms(String target, List<RoomType> roomTypes, int limit) {
        return roomTypes.stream()
                .sorted(Comparator.comparingInt(r -> similarityDistance(target, normalizeText(r.getName()))))
                .limit(limit)
                .toList();
    }

    private String inferRoomNameFromMessage(String message) {
        if (message == null || message.isBlank()) {
            return null;
        }
        String normalized = message.trim();
        String lowered = normalizeText(normalized);
        if (lowered.matches(".*\\b(today|tomorrow|guest|guests|people|person|city|hotel|check\\s*in|check\\s*out)\\b.*")) {
            return null;
        }
        if (looksLikeKnownCity(normalized) || userMeansAnyCity(normalized)) {
            return null;
        }
        if (parsePickIndex(normalized) != null) {
            return null;
        }
        if (normalized.split("\\s+").length > 5) {
            return null;
        }
        return normalized;
    }

    private boolean looksLikeGuestsOrDateMessage(String message) {
        String lowered = normalizeText(message);
        return lowered.matches(".*\\b(guest|guests|people|person|persons|traveler|travelers|pax|today|tomorrow|check in|check out|night|nights|date|dates)\\b.*")
                || lowered.matches(".*\\b\\d{4}-\\d{2}-\\d{2}\\b.*")
                || lowered.matches(".*\\b\\d{1,2}/\\d{1,2}(/\\d{2,4})?\\b.*")
                || lowered.matches(".*\\b\\d{1,2}\\.\\d{1,2}(\\.\\d{2,4})?\\b.*");
    }

    private String renderRoomTypeOptions(List<RoomType> roomTypes) {
        if (roomTypes == null || roomTypes.isEmpty()) {
            return "No room types are currently available.";
        }
        StringBuilder sb = new StringBuilder();
        List<RoomType> validRooms = roomTypes.stream().filter(this::isValidRoomType).toList();
        for (int i = 0; i < validRooms.size(); i++) {
            RoomType room = validRooms.get(i);
            sb.append(i + 1).append(") ").append(room.getName());
            if (room.getBasePrice() != null) {
                sb.append(" - ").append(room.getBasePrice());
            }
            sb.append(" (capacity ").append(room.getCapacity()).append(")");
            if (i < validRooms.size() - 1) {
                sb.append("\n");
            }
        }
        return sb.toString();
    }

    private boolean isValidRoomType(RoomType roomType) {
        if (roomType == null || roomType.getName() == null) {
            return false;
        }
        String name = roomType.getName().trim();
        return !name.isBlank() && !"room type name is required.".equalsIgnoreCase(name);
    }

    private record RoomSelectionResult(RoomType selected,
                                       boolean noNameMatch,
                                       boolean multipleMatches,
                                       List<RoomType> candidates) {
        static RoomSelectionResult selected(RoomType selected) {
            return new RoomSelectionResult(selected, false, false, List.of());
        }

        static RoomSelectionResult none(boolean noNameMatch, boolean multipleMatches, List<RoomType> candidates) {
            return new RoomSelectionResult(null, noNameMatch, multipleMatches, candidates);
        }
    }

    private void applyNaturalDateFallback(String message, AssistantContext context) {
        if (message == null || message.isBlank()) {
            return;
        }

        LocalDate today = LocalDate.now();
        LocalDate parsedCheckIn = parseDateIsoSafe(context.getCheckIn());
        LocalDate parsedCheckOut = parseDateIsoSafe(context.getCheckOut());

        String normalized = normalizeCommonTypos(message.trim().toLowerCase(Locale.ROOT));
        boolean messageHasDateSignal = hasDateSignal(normalized);

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
        if (parsedCheckOut == null && parsedCheckIn != null && messageHasDateSignal) {
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

    /**
     * If the model inferred a guest count that only appears as a day/month in slash dates (e.g. 5 in 5/5/2026), drop it.
     */
    private void sanitizeGuestsIfDateDigitNoise(String message, AssistantContext context) {
        if (message == null || context.getGuests() == null) {
            return;
        }
        String lower = message.toLowerCase(Locale.ROOT);
        if (lower.matches("(?s).*\\b(guest|guests|people|persons?|travelers?|pax)\\b.*")) {
            return;
        }
        int g = context.getGuests();
        Matcher slash = Pattern.compile("\\b\\d{1,2}/\\d{1,2}/\\d{2,4}\\b").matcher(message);
        while (slash.find()) {
            for (String part : slash.group().split("/")) {
                if (part.length() >= 4) {
                    continue;
                }
                try {
                    if (Integer.parseInt(part) == g) {
                        context.setGuests(null);
                        return;
                    }
                } catch (NumberFormatException ignored) {
                    // continue
                }
            }
        }
        Matcher iso = Pattern.compile("\\b\\d{4}-\\d{2}-\\d{2}\\b").matcher(message);
        while (iso.find()) {
            for (String part : iso.group().split("-")) {
                if (part.length() == 4) {
                    continue;
                }
                try {
                    int n = Integer.parseInt(part);
                    if (n == g) {
                        context.setGuests(null);
                        return;
                    }
                } catch (NumberFormatException ignored) {
                    // continue
                }
            }
        }
    }

    private LocalDate parseDateIsoSafe(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private boolean hasDateSignal(String value) {
        String t = normalizeText(value);
        return t.matches(".*\\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|check in|check out|date|dates)\\b.*")
                || t.matches(".*\\b\\d{4}-\\d{2}-\\d{2}\\b.*")
                || t.matches(".*\\b\\d{1,2}/\\d{1,2}(/\\d{2,4})?\\b.*")
                || t.matches(".*\\b\\d{1,2}\\.\\d{1,2}(\\.\\d{2,4})?\\b.*");
    }

    private String normalizeDateSlot(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        LocalDate parsed = parseFlexibleDate(value);
        return parsed != null ? parsed.toString() : value.trim();
    }

    private LocalDate parseFlexibleDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String t = value.trim();
        try {
            return LocalDate.parse(t);
        } catch (DateTimeParseException ignored) {
            // continue with flexible parsing
        }
        try {
            String[] parts = t.split("/");
            if (parts.length == 2) {
                int first = Integer.parseInt(parts[0].trim());
                int second = Integer.parseInt(parts[1].trim());
                MonthDay md = resolveDayMonth(first, second);
                LocalDate now = LocalDate.now();
                LocalDate candidate = md.atYear(now.getYear());
                if (candidate.isBefore(now)) {
                    candidate = candidate.plusYears(1);
                }
                return candidate;
            }
            if (parts.length == 3) {
                int first = Integer.parseInt(parts[0].trim());
                int second = Integer.parseInt(parts[1].trim());
                int year = Integer.parseInt(parts[2].trim());
                if (year < 100) {
                    year += 2000;
                }
                MonthDay md = resolveDayMonth(first, second);
                return LocalDate.of(year, md.getMonthValue(), md.getDayOfMonth());
            }
        } catch (RuntimeException ignored) {
            // unsupported slash format
        }
        return null;
    }

    private MonthDay resolveDayMonth(int first, int second) {
        if (first > 12 && second <= 12) {
            return MonthDay.of(second, first);
        }
        if (second > 12 && first <= 12) {
            return MonthDay.of(first, second);
        }
        return MonthDay.of(second, first);
    }

    private LocalDate resolveTokenToDate(String token, LocalDate reference) {
        if (token == null) return null;
        String t = normalizeCommonTypos(token.trim().toLowerCase(Locale.ROOT));
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

    private String normalizeUserMessageForNlp(String raw) {
        String text = raw == null ? "" : raw.trim();
        if (text.isEmpty()) return text;
        text = normalizeCommonTypos(text.toLowerCase(Locale.ROOT));
        text = text
                .replaceAll("\\bpls\\b", "please")
                .replaceAll("\\bthx\\b", "thanks")
                .replaceAll("\\bcuz\\b", "because")
                .replaceAll("\\bnd\\b", "and")
                .replaceAll("\\btil\\b", "until")
                .replaceAll("\\btill\\b", "until");
        return text.replaceAll("\\s+", " ").trim();
    }

    private boolean userIsUnsureAboutCity(String text) {
        String value = normalizeText(text).replaceAll("\\s+", " ").trim();
        if (value.isEmpty()) return false;
        return UNSURE_CITY_TOKENS.stream().anyMatch(value::contains);
    }

    private CityResolution resolveCityInput(String rawInput) {
        String normalizedInput = normalizeCompact(rawInput);
        if (normalizedInput.isBlank()) {
            return CityResolution.none();
        }

        List<City> allCities;
        try {
            allCities = cityRepository.findAllOrderByCountryAndName();
        } catch (Exception ignored) {
            return CityResolution.none();
        }
        if (allCities.isEmpty()) return CityResolution.none();

        List<City> palestineCities = allCities.stream()
                .filter(c -> c.getCountry() != null && "palestine".equalsIgnoreCase(String.valueOf(c.getCountry().getName())))
                .toList();
        List<City> scope = palestineCities.isEmpty() ? allCities : palestineCities;

        for (City city : scope) {
            if (normalizeCompact(city.getName()).equals(normalizedInput)) {
                return CityResolution.exact(city.getName());
            }
        }

        City best = null;
        int bestDistance = Integer.MAX_VALUE;
        double bestRatio = 1.0;
        for (City city : scope) {
            String candidate = normalizeCompact(city.getName());
            if (candidate.isBlank()) continue;
            if (candidate.charAt(0) != normalizedInput.charAt(0)) continue;
            int distance = levenshteinDistance(normalizedInput, candidate);
            double ratio = (double) distance / Math.max(normalizedInput.length(), candidate.length());
            if (distance < bestDistance || (distance == bestDistance && ratio < bestRatio)) {
                bestDistance = distance;
                bestRatio = ratio;
                best = city;
            }
        }
        if (best == null) return CityResolution.none();

        int threshold = Math.max(2, (int) Math.floor(normalizedInput.length() * 0.34));
        if (bestDistance <= threshold && bestRatio <= 0.34) {
            return CityResolution.suggested(best.getName());
        }
        return CityResolution.none();
    }

    private String normalizeCompact(String value) {
        if (value == null) return "";
        return value
                .trim()
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}]", "");
    }

    private int levenshteinDistance(String a, String b) {
        if (Objects.equals(a, b)) return 0;
        if (a == null || a.isBlank()) return b == null ? 0 : b.length();
        if (b == null || b.isBlank()) return a.length();

        int[][] dp = new int[a.length() + 1][b.length() + 1];
        for (int i = 0; i <= a.length(); i++) dp[i][0] = i;
        for (int j = 0; j <= b.length(); j++) dp[0][j] = j;
        for (int i = 1; i <= a.length(); i++) {
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                dp[i][j] = Math.min(
                        Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1),
                        dp[i - 1][j - 1] + cost
                );
            }
        }
        return dp[a.length()][b.length()];
    }

    private String normalizeCommonTypos(String value) {
        if (value == null || value.isBlank()) return "";
        return value
                .replaceAll("\\btomorow\\b", "tomorrow")
                .replaceAll("\\btommorow\\b", "tomorrow")
                .replaceAll("\\btomorroww\\b", "tomorrow")
                .replaceAll("\\btmrw\\b", "tomorrow");
    }

    private enum CityResolutionStatus {
        EXACT,
        SUGGESTED,
        NONE
    }

    private record CityResolution(CityResolutionStatus status, String canonicalCity) {
        static CityResolution exact(String city) {
            return new CityResolution(CityResolutionStatus.EXACT, city);
        }

        static CityResolution suggested(String city) {
            return new CityResolution(CityResolutionStatus.SUGGESTED, city);
        }

        static CityResolution none() {
            return new CityResolution(CityResolutionStatus.NONE, null);
        }
    }
}

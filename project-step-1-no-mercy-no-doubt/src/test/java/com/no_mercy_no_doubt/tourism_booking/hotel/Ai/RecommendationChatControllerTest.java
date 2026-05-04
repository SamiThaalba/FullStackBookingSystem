// package com.no_mercy_no_doubt.tourism_booking.hotel.Ai;

// import com.fasterxml.jackson.databind.ObjectMapper;
// import com.no_mercy_no_doubt.tourism_booking.Ai.controller.RecommendationChatController;
// import com.no_mercy_no_doubt.tourism_booking.Ai.dto.RecommendationChatRequest;
// import com.no_mercy_no_doubt.tourism_booking.Ai.dto.RecommendationChatResponse;
// import com.no_mercy_no_doubt.tourism_booking.Ai.dto.RecommendationChatService;
// import org.junit.jupiter.api.BeforeEach;
// import org.junit.jupiter.api.Test;
// import org.mockito.Mockito;
// import org.springframework.http.MediaType;
// import org.springframework.test.web.servlet.MockMvc;
// import org.springframework.test.web.servlet.setup.MockMvcBuilders;
// import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

// import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
// import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
// import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// class RecommendationChatControllerTest {

//     private MockMvc mockMvc;
//     private RecommendationChatService recommendationChatService;
//     private ObjectMapper objectMapper;

//     @BeforeEach
//     void setUp() {
//         recommendationChatService = Mockito.mock(RecommendationChatService.class);
//         objectMapper = new ObjectMapper().findAndRegisterModules();

//         LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
//         validator.afterPropertiesSet();

//         mockMvc = MockMvcBuilders.standaloneSetup(new RecommendationChatController(recommendationChatService))
//                 .setValidator(validator)
//                 .build();
//     }

//     @Test
//     void recommendationBot_returnsReply() throws Exception {
//         RecommendationChatRequest request = new RecommendationChatRequest();
//         request.setMessage("recommend me a hotel in Bethlehem");

//         RecommendationChatResponse response = RecommendationChatResponse.builder()
//                 .reply("Try Grand Hotel")
//                 .resultCount(1)
//                 .build();

//         Mockito.when(recommendationChatService.chat(Mockito.any(RecommendationChatRequest.class))).thenReturn(response);

//         mockMvc.perform(post("/api/chat/recommendation-bot")
//                         .contentType(MediaType.APPLICATION_JSON)
//                         .content(objectMapper.writeValueAsString(request)))
//                 .andExpect(status().isOk())
//                 .andExpect(jsonPath("$.reply").value("Try Grand Hotel"))
//                 .andExpect(jsonPath("$.resultCount").value(1));
//     }

//     @Test
//     void recommendationBot_returnsBadRequest_whenMessageMissing() throws Exception {
//         mockMvc.perform(post("/api/chat/recommendation-bot")
//                         .contentType(MediaType.APPLICATION_JSON)
//                         .content("{}"))
//                 .andExpect(status().isBadRequest());
//     }
// }

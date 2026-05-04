package com.no_mercy_no_doubt.tourism_booking.common.config;

import com.no_mercy_no_doubt.tourism_booking.analytics.web.UserActivityLogInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    private final UserActivityLogInterceptor userActivityLogInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(userActivityLogInterceptor)
                .addPathPatterns("/api/**");
    }
}

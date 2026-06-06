package com.no_mercy_no_doubt.tourism_booking;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class TourismBookingApplication {

	public static void main(String[] args) {
		SpringApplication.run(TourismBookingApplication.class, args);
	}

}

package com.no_mercy_no_doubt.tourism_booking.notification.service;

import com.no_mercy_no_doubt.tourism_booking.auth.entity.AppUser;
import com.no_mercy_no_doubt.tourism_booking.catalog.Booking.Booking;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.Hotel;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class BookingConfirmationEmailService {

    private final ObjectProvider<JavaMailSender> mailSender;

    @Value("${app.booking.email.enabled:true}")
    private boolean emailEnabled;

    @Value("${app.mail.from:QuickReserve <noreply@quickreserve.local>}")
    private String mailFrom;

    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${spring.mail.port:0}")
    private int mailPort;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    public void sendBookingConfirmation(AppUser user, Hotel hotel, Booking booking, Integer guests) {
        if (!emailEnabled || user == null || booking == null) {
            log.info("Booking email skipped (disabled or missing data) for booking {}", booking != null ? booking.getId() : null);
            return;
        }
        String to = user.getEmail();
        if (to == null || to.isBlank()) {
            log.warn("Booking email skipped: guest {} has no email", user.getUsername());
            return;
        }
        JavaMailSender sender = mailSender.getIfAvailable();
        if (sender == null) {
            log.warn("Booking email skipped: JavaMailSender not configured (host={}, port={}, user={})",
                    mailHost, mailPort, mailUsername);
            return;
        }

        String hotelName = hotel != null ? hotel.getName() : ("Hotel #" + booking.getHotelId());
        String subject = "Your booking is confirmed - " + hotelName;
        String body = """
                Hi %s,

                Your booking has been confirmed.

                Hotel: %s
                Dates: %s to %s
                Guests: %d
                Total price: %s

                Booking ID: %d

                Thank you for choosing QuickReserve.
                """.formatted(
                user.getUsername(),
                hotelName,
                booking.getStartDate(),
                booking.getEndDate(),
                guests != null && guests > 0 ? guests : 1,
                booking.getTotalPrice(),
                booking.getId()
        );

        try {
            log.info("Triggering booking confirmation email for booking {} to {}", booking.getId(), to);
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setTo(to);
            helper.setFrom(mailFrom);
            helper.setSubject(subject);
            helper.setText(body, false);
            sender.send(message);
            log.info("Booking confirmation email sent for booking {} to {}", booking.getId(), to);
        } catch (Exception ex) {
            // Booking success must not depend on email delivery.
            log.warn("Booking confirmation email failed for booking {}", booking.getId(), ex);
        }
    }
}

package com.no_mercy_no_doubt.tourism_booking.notification.service;

import com.no_mercy_no_doubt.tourism_booking.auth.entity.AppUser;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

/**
 * When a wishlist alert fires: persists an in-app notification for the user, then sends a
 * plain-text email when {@link JavaMailSender} is available ({@code spring.mail.host} configured)
 * and {@code app.alert.email.enabled} is true (default). Email is best-effort; in-app is always
 * written first so the system shows the alert immediately.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AlertEmailNotifier {

    private final NotificationService notificationService;
    private final ObjectProvider<JavaMailSender> mailSender;

    @Value("${app.alert.email.enabled:true}")
    private boolean emailEnabled;

    @Value("${app.mail.from:QuickReserve <noreply@quickreserve.local>}")
    private String mailFrom;

    /**
     * Saves the in-app notification, then attempts email delivery (skipped if mail is disabled
     * or not configured).
     */
    public void notifyWishlistAlertTriggered(
            AppUser user,
            String inAppTitle,
            String inAppMessage,
            String emailSubject,
            String plainEmailBody) {
        notificationService.create(user, inAppTitle, inAppMessage);
        sendTriggeredAlert(user, emailSubject, plainEmailBody);
    }

    public void sendTriggeredAlert(AppUser user, String subject, String plainBody) {
        if (!emailEnabled) {
            log.debug("Alert email skipped (app.alert.email.enabled=false)");
            return;
        }
        if (user == null) {
            return;
        }
        String to = user.getEmail();
        if (to == null || to.isBlank()) {
            log.warn("Alert email skipped: user {} has no email address", user.getUsername());
            return;
        }

        JavaMailSender sender = mailSender.getIfAvailable();
        if (sender == null) {
            log.debug("Alert email skipped: mail not configured (set spring.mail.host and credentials)");
            return;
        }

        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setTo(to);
            helper.setFrom(mailFrom);
            helper.setSubject(subject);
            helper.setText(plainBody + "\n\n— QuickReserve", false);
            sender.send(message);
            log.info("Alert email sent to {}", to);
        } catch (Exception ex) {
            log.warn("Failed to send alert email to {}", to, ex);
        }
    }
}

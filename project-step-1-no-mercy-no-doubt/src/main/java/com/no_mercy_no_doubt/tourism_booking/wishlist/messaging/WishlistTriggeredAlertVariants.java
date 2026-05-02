package com.no_mercy_no_doubt.tourism_booking.wishlist.messaging;

import com.no_mercy_no_doubt.tourism_booking.auth.entity.AppUser;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Produces EN+AR email copy and a single-locale pair for in-app notifications from {@link AppUser#getPreferredUiLanguage()}.
 */
public record WishlistTriggeredAlertVariants(
        String titleEn,
        String detailEn,
        String titleAr,
        String detailAr,
        String emailSubject
) {

    private static final Locale LOCALE_EN = Locale.UK;
    private static final Locale LOCALE_AR = Locale.forLanguageTag("ar");
    private static final String EMAIL_DIVIDER = "\n\n——\n\n";

    private static final String FALLBACK_HOTEL_EN = "Unknown hotel";
    private static final String FALLBACK_HOTEL_AR = "فندق غير معروف";

    private static final String MID = "\u2022";
    private static final String CONFETTI = "\uD83C\uDF89";

    public record NotificationPair(String title, String message) {}

    public NotificationPair notificationFor(AppUser user) {
        if (preferArabic(user)) {
            return new NotificationPair(titleAr, detailAr);
        }
        return new NotificationPair(titleEn, detailEn);
    }

    public static boolean preferArabic(AppUser user) {
        if (user == null) {
            return false;
        }
        String code = user.getPreferredUiLanguage();
        if (code == null || code.isBlank()) {
            return false;
        }
        return code.trim().toLowerCase(Locale.ROOT).startsWith("ar");
    }

    /**
     * Bilingual body for email (emoji-first titles; EN block, rule, AR block).
     */
    public String emailBody() {
        return titleEn + "\n" + detailEn + EMAIL_DIVIDER + titleAr + "\n" + detailAr;
    }

    public static WishlistTriggeredAlertVariants forAvailability(String roomTypeName, String hotelName,
            LocalDate checkIn, LocalDate checkOut, int guestCount) {
        roomTypeName = safeRoom(roomTypeName);
        HotelDisplay hotel = hotelParts(hotelName);

        String titleLineEn = "%s %s is now available".formatted(CONFETTI, roomTypeName);
        String detailEn = joinedDetailEnglish(hotel.en(), checkIn, checkOut, guestCount);
        String titleLineAr = "%s متاح الآن — %s".formatted(CONFETTI, roomTypeName);
        String detailAr = joinedDetailArabic(hotel.ar(), checkIn, checkOut, guestCount);

        String subject = "%s · Now available".formatted(roomTypeName);
        return new WishlistTriggeredAlertVariants(titleLineEn, detailEn, titleLineAr, detailAr, subject);
    }

    public static WishlistTriggeredAlertVariants forPriceBelow(String roomTypeName, String hotelName,
            BigDecimal targetPrice) {
        roomTypeName = safeRoom(roomTypeName);
        HotelDisplay hotel = hotelParts(hotelName);

        NumberFormat gbEn = NumberFormat.getCurrencyInstance(LOCALE_EN);
        String priceEn = targetPrice != null ? gbEn.format(targetPrice) : "[target]";
        NumberFormat gbAr = NumberFormat.getCurrencyInstance(LOCALE_AR);
        String priceAr = targetPrice != null ? gbAr.format(targetPrice) : "[الهدف]";

        String titleLineEn = "%s %s hit your price target".formatted(CONFETTI, roomTypeName);
        String detailEn = "%s %s At or below %s (your alert target)".formatted(hotel.en(), MID, priceEn);

        String titleLineAr = "%s %s — وصل لهدف السعر".formatted(CONFETTI, roomTypeName);
        String detailAr = "%s %s السعر ضمن هدف تنبيهك أو أقل (%s)".formatted(hotel.ar(), MID, priceAr);

        String subject = "%s · Price alert".formatted(roomTypeName);
        return new WishlistTriggeredAlertVariants(titleLineEn, detailEn, titleLineAr, detailAr, subject);
    }

    private static String safeRoom(String roomTypeName) {
        return roomTypeName != null && !roomTypeName.isBlank() ? roomTypeName : "Room";
    }

    private static HotelDisplay hotelParts(String rawHotelName) {
        boolean missing = rawHotelName == null || rawHotelName.isBlank();
        if (missing) {
            return new HotelDisplay(FALLBACK_HOTEL_EN, FALLBACK_HOTEL_AR);
        }
        return new HotelDisplay(rawHotelName, rawHotelName);
    }

    private record HotelDisplay(String en, String ar) {}

    private static String joinedDetailEnglish(String hotel, LocalDate checkIn, LocalDate checkOut, int guests) {
        return "%s %s %s %s %s".formatted(hotel, MID, compactDateRangeEn(checkIn, checkOut), MID, guestsPhraseEn(guests));
    }

    private static String joinedDetailArabic(String hotel, LocalDate checkIn, LocalDate checkOut, int guests) {
        return "%s %s %s %s %s".formatted(hotel, MID, compactDateRangeAr(checkIn, checkOut), MID, guestsPhraseAr(guests));
    }

    private static String guestsPhraseEn(int n) {
        return n == 1 ? "1 guest" : n + " guests";
    }

    private static String guestsPhraseAr(int n) {
        if (n == 1) return "ضيف واحد";
        if (n == 2) return "ضيفان";
        String num = NumberFormat.getInstance(LOCALE_AR).format(n);
        return num + " ضيوف";
    }

    private static String compactDateRangeEn(LocalDate checkIn, LocalDate checkOut) {
        if (checkIn == null || checkOut == null) return "Dates TBC";
        DateTimeFormatter m = DateTimeFormatter.ofPattern("MMM d", LOCALE_EN);
        if (checkIn.getYear() == checkOut.getYear()) {
            String left = capitalizeMonth(checkIn.format(m));
            String right = capitalizeMonth(checkOut.format(m));
            return left + " \u2192 " + right;
        }
        DateTimeFormatter full = DateTimeFormatter.ofPattern("MMM d, yyyy", LOCALE_EN);
        return capitalizeMonth(checkIn.format(full)) + " \u2192 " + capitalizeMonth(checkOut.format(full));
    }

    private static String compactDateRangeAr(LocalDate checkIn, LocalDate checkOut) {
        if (checkIn == null || checkOut == null) return "التواريخ قيد التأكيد";
        DateTimeFormatter m = DateTimeFormatter.ofPattern("d MMM", LOCALE_AR);
        if (checkIn.getYear() == checkOut.getYear()) {
            return checkIn.format(m) + " \u2192 " + checkOut.format(m);
        }
        DateTimeFormatter full = DateTimeFormatter.ofPattern("d MMM yyyy", LOCALE_AR);
        return checkIn.format(full) + " \u2192 " + checkOut.format(full);
    }

    private static String capitalizeMonth(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}

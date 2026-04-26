package com.no_mercy_no_doubt.tourism_booking.catalog.Payment;

import com.no_mercy_no_doubt.tourism_booking.auth.entity.AppUser;
import com.no_mercy_no_doubt.tourism_booking.auth.service.RoleManagementService;
import com.no_mercy_no_doubt.tourism_booking.catalog.Booking.Booking;
import com.no_mercy_no_doubt.tourism_booking.catalog.Booking.BookingRepository;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.Hotel;
import com.no_mercy_no_doubt.tourism_booking.catalog.Hotel.HotelRepository;
import com.no_mercy_no_doubt.tourism_booking.common.exception.BusinessException;
import com.no_mercy_no_doubt.tourism_booking.common.exception.ResourceNotFoundException;
import com.no_mercy_no_doubt.tourism_booking.common.utils.CurrentUserProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final HotelRepository hotelRepository;
    private final PaymentMapper paymentMapper;
    private final CurrentUserProvider currentUserProvider;
    private final RoleManagementService roleManagementService;

    public PaymentResponse createPayment(PaymentRequest request) {
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new ResourceNotFoundException("Booking", request.getBookingId()));

        ensureCanManagePaymentForBooking(booking);

        if (paymentRepository.existsByBookingId(booking.getId())) {
            throw new BusinessException("A payment already exists for this booking.");
        }

        Payment payment = new Payment();
        payment.setBooking(booking);
        payment.setAmount(booking.getTotalPrice());
        payment.setStatus(PaymentStatus.PENDING);

        booking.setPayment(payment);
        Payment saved = paymentRepository.save(payment);

        return paymentMapper.ToDto(saved);
    }

    public PaymentResponse processPayment(Long paymentId, boolean success) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment", paymentId));

        ensureCanManagePaymentForBooking(payment.getBooking());

        if (payment.getStatus() == PaymentStatus.SUCCESS) {
            throw new BusinessException("Payment has already been processed successfully.");
        }

        payment.setStatus(success ? PaymentStatus.SUCCESS : PaymentStatus.FAILED);
        return paymentMapper.ToDto(paymentRepository.save(payment));
    }

    private void ensureCanManagePaymentForBooking(Booking booking) {
        AppUser currentUser = currentUserProvider.getCurrentUser();

        if (isAdmin(currentUser)) {
            return;
        }

        if (booking.getGuestId() != null && booking.getGuestId().equals(currentUser.getId())) {
            return;
        }

        Hotel hotel = hotelRepository.findById(booking.getHotelId()).orElse(null);
        if (isManager(currentUser)
                && hotel != null
                && hotel.getManagerId() != null
                && hotel.getManagerId().equals(currentUser.getId())) {
            return;
        }

        throw new AccessDeniedException("You are not allowed to manage this booking payment.");
    }

    private boolean isAdmin(AppUser user) {
        return roleManagementService.userHasRole(user, "ADMIN");
    }

    private boolean isManager(AppUser user) {
        return roleManagementService.userHasRole(user, "MANAGER");
    }
}
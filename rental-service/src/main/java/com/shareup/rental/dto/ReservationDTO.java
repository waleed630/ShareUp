package com.shareup.rental.dto;

import java.time.LocalDate;

/**
 * An item held by a PENDING rental request.
 * Deliberately carries no borrower details — it is shown to every user.
 */
public record ReservationDTO(
        String itemId,
        LocalDate startDate,
        LocalDate endDate,
        boolean mine
) {}

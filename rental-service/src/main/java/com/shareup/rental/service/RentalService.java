package com.shareup.rental.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.shareup.rental.dto.BorrowRequestDTO;
import com.shareup.rental.dto.ItemResponse;
import com.shareup.rental.dto.RatingRequestDTO;
import com.shareup.rental.dto.ReservationDTO;
import com.shareup.rental.model.Rating;
import com.shareup.rental.model.RentalRequest;
import com.shareup.rental.model.RentalStatus;
import com.shareup.rental.repository.RatingRepository;
import com.shareup.rental.repository.RentalRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class RentalService {

    private static final Logger log = LoggerFactory.getLogger(RentalService.class);

    private final RentalRepository rentalRepository;
    private final EmailService emailService;
    private final RatingRepository ratingRepository;
    private final Cloudinary cloudinary;
    private final RestTemplate restTemplate;

    @Value("${auth.service.url}")
    private String authServiceUrl;

    @Value("${item.service.url}")
    private String itemServiceUrl;

    public RentalService(RentalRepository rentalRepository,
                         EmailService emailService,
                         RatingRepository ratingRepository,
                         RestTemplate restTemplate,
                         Cloudinary cloudinary) {
        this.rentalRepository = rentalRepository;
        this.emailService     = emailService;
        this.ratingRepository = ratingRepository;
        this.restTemplate     = restTemplate;
        this.cloudinary       = cloudinary;
    }

    // ============================================================
    // ================= BORROW REQUEST ===========================
    // ============================================================

    /**
     * borrowerEmail and borrowerPhone come directly from the JWT (via RentalController)
     * — no call to auth-service needed for borrower info.
     */
    public RentalRequest createBorrowRequest(Long borrowerId,
                                             String borrowerEmail,
                                             String borrowerPhone,
                                             BorrowRequestDTO dto) {

        // Validate dates
        if (dto.getEndDate() != null && dto.getStartDate() != null
                && !dto.getEndDate().isAfter(dto.getStartDate())) {
            throw new RuntimeException("endDate must be after startDate");
        }

        // An item with a pending request is reserved until the owner approves or rejects it
        boolean reserved = false;
        for (RentalRequest pending : rentalRepository.findByItemIdAndStatus(dto.getItemId(), RentalStatus.PENDING)) {
            if (!isActiveReservation(pending)) continue;
            if (borrowerId.equals(pending.getBorrowerId())) {
                throw new RuntimeException("You have already requested this item");
            }
            reserved = true;
        }
        if (reserved) {
            throw new RuntimeException("This item is already reserved by another request");
        }

        // ✅ Fetch borrower address from auth-service (not in JWT)
        String borrowerAddress = null;
        Map borrowerUser = fetchUser(borrowerId);
        if (borrowerUser != null) {
            borrowerAddress = (String) borrowerUser.get("address");
        }

        RentalRequest request = new RentalRequest();
        request.setItemId(dto.getItemId());
        request.setOwnerId(dto.getOwnerId());
        request.setBorrowerId(borrowerId);
        request.setStartDate(dto.getStartDate());
        request.setEndDate(dto.getEndDate());
        request.setBorrowerEmail(borrowerEmail);
        request.setBorrowerPhone(borrowerPhone);
        request.setBorrowerAddress(borrowerAddress); // ✅ now set

        request.setStatus(RentalStatus.PENDING);
        request.setCreatedAt(LocalDateTime.now());

        RentalRequest saved = rentalRepository.save(request);
        log.info("Borrow request created id={} itemId={} borrowerId={}", saved.getId(), dto.getItemId(), borrowerId);

        // Notify owner
        try {
            sendOwnerNewRequestEmail(saved);
        } catch (Exception e) {
            log.warn("Failed to send new-request email rentalId={}: {}", saved.getId(), e.getMessage());
        }

        return saved;
    }

    // ============================================================
    // ================= APPROVE REQUEST ==========================
    // ============================================================

   public RentalRequest approveRequest(String rentalId,
                                    Long ownerId,
                                    String ignoredPhone,
                                    String ignoredPickupAddress) {

    RentalRequest req = rentalRepository.findById(rentalId)
            .orElseThrow(() -> new RuntimeException("Rental not found: " + rentalId));

    if (!ownerId.equals(req.getOwnerId())) {
        throw new RuntimeException("Unauthorized");
    }

    ItemResponse item = fetchItem(req.getItemId());
    Map owner = fetchUser(ownerId);

    if (item != null) req.setPickupAddress(item.getPickupAddress());
    if (owner != null) req.setOwnerPhone((String) owner.get("phone"));

    req.setStatus(RentalStatus.APPROVED);
    req.setApprovedAt(LocalDateTime.now());

    RentalRequest approved = rentalRepository.save(req);
    // Auto reject other pending requests for the same item
    List<RentalRequest> otherRequests =
        rentalRepository.findByItemIdAndStatus(req.getItemId(), RentalStatus.PENDING);

    for (RentalRequest other : otherRequests) {
         if (!other.getId().equals(req.getId())) {

        other.setStatus(RentalStatus.REJECTED);
        rentalRepository.save(other);

        log.info("Auto rejected competing request id={} itemId={}", other.getId(), req.getItemId());

        try {
            sendBorrowerRejectedEmail(other);
        } catch (Exception e) {
            log.warn("Failed to send rejection email rentalId={}", other.getId());
        }
    }
}
    // 🔹 UPDATE ITEM STATUS
    try {
        restTemplate.put(
            itemServiceUrl + "/api/items/" + req.getItemId() + "/rented",
            null
        );
    } catch (Exception e) {
        log.warn("Failed to update item status to RENTED itemId={}", req.getItemId());
    }

    return approved;
}
    // ============================================================
    // ================= REJECT REQUEST ===========================
    // ============================================================

    public RentalRequest rejectRequest(String rentalId, Long ownerId) {

        RentalRequest req = rentalRepository.findById(rentalId)
                .orElseThrow(() -> new RuntimeException("Rental not found: " + rentalId));

        if (!ownerId.equals(req.getOwnerId())) {
            throw new RuntimeException("Unauthorized");
        }

        req.setStatus(RentalStatus.REJECTED);
        RentalRequest rejected = rentalRepository.save(req);
        log.info("Rental rejected id={} ownerId={}", rentalId, ownerId);

        try {
            sendBorrowerRejectedEmail(rejected);
        } catch (Exception e) {
            log.warn("Failed to send rejection email rentalId={}: {}", rentalId, e.getMessage());
        }

        return rejected;
    }

    // ============================================================
    // ================= CANCEL (borrower) ========================
    // ============================================================

    public RentalRequest cancelRequest(String rentalId, Long borrowerId) {

        RentalRequest req = rentalRepository.findById(rentalId)
                .orElseThrow(() -> new RuntimeException("Rental not found: " + rentalId));

        if (!borrowerId.equals(req.getBorrowerId())) {
            throw new RuntimeException("Unauthorized");
        }

        if (req.getStatus() != RentalStatus.PENDING) {
            throw new RuntimeException("Cannot cancel a rental that is already " + req.getStatus());
        }

        req.setStatus(RentalStatus.CANCELLED);
        req.setCancelledAt(LocalDateTime.now());

        log.info("Rental cancelled id={} borrowerId={}", rentalId, borrowerId);
        return rentalRepository.save(req);
    }

    // ============================================================
    // ================= RETURN REQUEST ===========================
    // ============================================================

    public RentalRequest requestReturn(String rentalId,
                                       Long borrowerId,
                                       MultipartFile image) {

        RentalRequest req = rentalRepository.findById(rentalId)
                .orElseThrow(() -> new RuntimeException("Rental not found: " + rentalId));

        if (!borrowerId.equals(req.getBorrowerId())) {
            throw new RuntimeException("Unauthorized");
        }

        if (req.getStatus() != RentalStatus.APPROVED) {
            throw new RuntimeException("Cannot return a rental that is not APPROVED");
        }

        String imageUrl = uploadToCloudinary(image);
        req.setReturnImageUrl(imageUrl);
        req.setReturnRequestedAt(LocalDateTime.now());
        req.setStatus(RentalStatus.RETURN_REQUESTED);

        log.info("Return requested id={} borrowerId={}", rentalId, borrowerId);
        return rentalRepository.save(req);
    }

    // ============================================================
    // ================= APPROVE RETURN ===========================
    // ============================================================

    public RentalRequest approveReturn(String rentalId, Long ownerId) {

    RentalRequest req = rentalRepository.findById(rentalId)
            .orElseThrow(() -> new RuntimeException("Rental not found: " + rentalId));

    if (!ownerId.equals(req.getOwnerId())) {
        throw new RuntimeException("Unauthorized");
    }

    req.setStatus(RentalStatus.RETURN_APPROVED);
    req.setReturnApprovedAt(LocalDateTime.now());

    RentalRequest saved = rentalRepository.save(req);

    // 🔹 UPDATE ITEM STATUS BACK TO AVAILABLE
    try {
        restTemplate.put(
            itemServiceUrl + "/api/items/" + req.getItemId() + "/available",
            null
        );
    } catch (Exception e) {
        log.warn("Failed to update item status to AVAILABLE itemId={}", req.getItemId());
    }

    return saved;
}

    // ============================================================
    // ================= INTERNAL HELPERS =========================
    // ============================================================

    private Map fetchUser(Long userId) {
        try {
            return restTemplate.getForObject(
                    authServiceUrl + "/api/users/" + userId, Map.class);
        } catch (Exception e) {
            log.warn("Auth service unreachable userId={}: {}", userId, e.getMessage());
            return null;
        }
    }

    private ItemResponse fetchItem(String itemId) {
        try {
            return restTemplate.getForObject(
                    itemServiceUrl + "/api/items/" + itemId, ItemResponse.class);
        } catch (Exception e) {
            log.warn("Item service unreachable itemId={}: {}", itemId, e.getMessage());
            return null;
        }
    }

    // ============================================================
    // ================= CLOUDINARY ===============================
    // ============================================================

    private String uploadToCloudinary(MultipartFile file) {
        try {
            Map uploadResult = cloudinary.uploader().upload(
                    file.getBytes(),
                    ObjectUtils.asMap("folder", "shareup/returns")
            );
            return uploadResult.get("secure_url").toString();
        } catch (Exception e) {
            log.error("Cloudinary upload failed: {}", e.getMessage(), e);
            throw new RuntimeException("Image upload failed", e);
        }
    }

    // ============================================================
    // ================= EMAILS ===================================
    // ============================================================

    private void sendOwnerNewRequestEmail(RentalRequest req) {
        Map owner         = fetchUser(req.getOwnerId());
        ItemResponse item = fetchItem(req.getItemId());
        if (owner == null || item == null) return;

        String body = String.format(
            "Hi,\n\nYou have a new rental request on ShareUp!\n\n" +
            "Item     : %s\n" +
            "Borrower : %s\n" +
            "Phone    : %s\n" +
            "Dates    : %s to %s\n\n" +
            "Please log in to approve or reject this request.",
            item.getName(),
            req.getBorrowerEmail() != null ? req.getBorrowerEmail() : "—",
            req.getBorrowerPhone() != null ? req.getBorrowerPhone() : "—",
            req.getStartDate()     != null ? req.getStartDate()     : "—",
            req.getEndDate()       != null ? req.getEndDate()       : "—"
        );

        emailService.sendEmail((String) owner.get("email"), "New Rental Request — ShareUp", body);
    }

    private void sendBorrowerApprovedEmail(RentalRequest req, ItemResponse item) {
        if (req.getBorrowerEmail() == null) return;
        String itemName = item != null ? item.getName() : "your item";

        String body = String.format(
            "Hi,\n\nGreat news! Your rental request has been approved.\n\n" +
            "Item           : %s\n" +
            "Dates          : %s to %s\n" +
            "Pickup Address : %s\n" +
            "Owner Phone    : %s\n\n" +
            "Please coordinate with the owner for pickup.",
            itemName,
            req.getStartDate()     != null ? req.getStartDate()     : "—",
            req.getEndDate()       != null ? req.getEndDate()       : "—",
            req.getPickupAddress() != null ? req.getPickupAddress() : "—",
            req.getOwnerPhone()    != null ? req.getOwnerPhone()    : "—"
        );

        emailService.sendEmail(req.getBorrowerEmail(), "Rental Approved — ShareUp", body);
    }

    private void sendBorrowerRejectedEmail(RentalRequest req) {
        if (req.getBorrowerEmail() == null) return;

        String body = "Hi,\n\nUnfortunately your rental request was not approved by the owner.\n\n" +
                      "Please browse other available items on ShareUp.\n\nWe hope you find what you need!";

        emailService.sendEmail(req.getBorrowerEmail(), "Rental Request Update — ShareUp", body);
    }

    // ============================================================
    // ================= DASHBOARD ================================
    // ============================================================

    public List<RentalRequest> getRequestsForOwner(Long ownerId) {
        return rentalRepository.findByOwnerId(ownerId);
    }

    public List<RentalRequest> getRentalsForBorrower(Long borrowerId) {
        return rentalRepository.findByBorrowerId(borrowerId);
    }

    public List<RentalRequest> getPendingReturnsForOwner(Long ownerId) {
        return rentalRepository.findByOwnerIdAndStatus(ownerId, RentalStatus.RETURN_REQUESTED);
    }

    /**
     * Items currently held by a pending request, one entry per item.
     * The caller's own request wins over someone else's for the same item.
     */
    public List<ReservationDTO> getReservations(Long userId) {
        Map<String, ReservationDTO> byItem = new LinkedHashMap<>();

        for (RentalRequest r : rentalRepository.findByStatus(RentalStatus.PENDING)) {
            if (!isActiveReservation(r)) continue;

            boolean mine = userId.equals(r.getBorrowerId());
            ReservationDTO current = byItem.get(r.getItemId());
            if (current == null || (mine && !current.mine())) {
                byItem.put(r.getItemId(),
                        new ReservationDTO(r.getItemId(), r.getStartDate(), r.getEndDate(), mine));
            }
        }

        return new ArrayList<>(byItem.values());
    }

    // A pending request stops holding the item once its end date has passed
    private boolean isActiveReservation(RentalRequest r) {
        return r.getEndDate() == null || !r.getEndDate().isBefore(LocalDate.now());
    }

    public RentalRequest getById(String id) {
        return rentalRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Rental not found: " + id));
    }

    // ============================================================
    // ================= RATINGS ==================================
    // ============================================================

    /**
     * Borrower rates the owner of a completed rental.
     * The owner id is taken from the rental record, never from the client.
     */
    public RentalRequest rateRental(String rentalId, Long borrowerId, RatingRequestDTO dto) {

        RentalRequest req = rentalRepository.findById(rentalId)
                .orElseThrow(() -> new RuntimeException("Rental not found: " + rentalId));

        if (!borrowerId.equals(req.getBorrowerId())) {
            throw new RuntimeException("Unauthorized");
        }

        if (req.getStatus() != RentalStatus.RETURN_APPROVED) {
            throw new RuntimeException("Cannot rate a rental that is not completed");
        }

        if (dto.getStars() == null || dto.getStars() < 1 || dto.getStars() > 10) {
            throw new RuntimeException("Invalid stars: must be between 1 and 10");
        }

        if (req.getRating() != null
                || ratingRepository.findByRentalIdAndFromUserId(rentalId, borrowerId.toString()).isPresent()) {
            throw new RuntimeException("You have already rated this rental");
        }

        String review = dto.getReview() != null && !dto.getReview().isBlank()
                ? dto.getReview().trim()
                : null;

        Rating rating = new Rating();
        rating.setRentalId(rentalId);
        rating.setFromUserId(borrowerId.toString());
        rating.setToUserId(req.getOwnerId().toString());
        rating.setStars(dto.getStars());
        rating.setReview(review);
        rating.setCreatedAt(LocalDateTime.now());
        ratingRepository.save(rating);

        req.setRating(dto.getStars());
        req.setFeedback(review);

        log.info("Rental rated id={} borrowerId={} ownerId={} stars={}",
                rentalId, borrowerId, req.getOwnerId(), dto.getStars());
        return rentalRepository.save(req);
    }

    public List<Rating> getRatingsForUser(Long userId) {
        return ratingRepository.findByToUserId(userId.toString());
    }
}

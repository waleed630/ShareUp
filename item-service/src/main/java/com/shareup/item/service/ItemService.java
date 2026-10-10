package com.shareup.item.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.shareup.item.dto.ItemRequestDTO;
import com.shareup.item.model.Item;
import com.shareup.item.model.ItemStatus;
import com.shareup.item.repository.ItemRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@Service
public class ItemService {

    private final ItemRepository itemRepository;
    private final Cloudinary cloudinary;

    public ItemService(ItemRepository itemRepository, Cloudinary cloudinary) {
        this.itemRepository = itemRepository;
        this.cloudinary = cloudinary;
    }

    // ---------- CREATE ITEM (OWNER ONLY) ----------
    public Item createItem(Long ownerId, ItemRequestDTO dto) {

        if (isBlank(dto.getName())) {
            throw new RuntimeException("Invalid item: name is required");
        }
        if (isBlank(dto.getCategory())) {
            throw new RuntimeException("Invalid item: category is required");
        }
        if (isBlank(dto.getPickupAddress())) {
            throw new RuntimeException("Invalid item: pickup address is required");
        }
        if (Double.isNaN(dto.getPrice()) || Double.isInfinite(dto.getPrice()) || dto.getPrice() <= 0) {
            throw new RuntimeException("Invalid item: price must be greater than 0");
        }

        Item item = new Item();
        item.setName(dto.getName().trim());
        item.setDescription(dto.getDescription() != null ? dto.getDescription().trim() : null);
        item.setCategory(dto.getCategory().trim());
        item.setPrice(dto.getPrice());
        item.setOwnerId(ownerId);
        item.setPickupAddress(dto.getPickupAddress().trim());
        item.setStatus(ItemStatus.AVAILABLE);

        return itemRepository.save(item);
    }

    // ---------- UPLOAD IMAGE (OWNER ONLY) ----------
    public String uploadImage(String itemId, MultipartFile file, Long ownerId) {

        Item item = itemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Item not found"));

        // ownership validation
        if (!ownerId.equals(item.getOwnerId())) {
            throw new AccessDeniedException("You are not the owner of this item");
        }

        if (file == null || file.isEmpty()) {
            throw new RuntimeException("Invalid image: the file is empty");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase().startsWith("image/")) {
            throw new RuntimeException("Invalid image: only image files are allowed");
        }

        String imageUrl;
        try {
            // Upload to Cloudinary
            Map uploadResult = cloudinary.uploader().upload(
                    file.getBytes(),
                    ObjectUtils.asMap(
                            "folder", "shareup-items"
                    )
            );
            imageUrl = uploadResult.get("secure_url").toString();
        } catch (Exception e) {
            throw new RuntimeException("Image upload failed", e);
        }

        item.setImageUrl(imageUrl);
        itemRepository.save(item);

        return imageUrl;
    }

    // ---------- PUBLIC BROWSE ----------
    public List<Item> getAvailableItems(String category) {

        if (category == null || category.isEmpty()) {
            return itemRepository.findByStatus(ItemStatus.AVAILABLE);
        }

        return itemRepository.findByCategoryAndStatus(category, ItemStatus.AVAILABLE);
    }

    // ---------- RENTAL SYNC ----------
    public Item setItemRented(String itemId) {

        Item item = itemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Item not found"));

        item.setStatus(ItemStatus.RENTED);
        return itemRepository.save(item);
    }

    public Item setItemAvailable(String itemId) {

        Item item = itemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Item not found"));

        item.setStatus(ItemStatus.AVAILABLE);
        return itemRepository.save(item);
    }

    // ---------- OWNER INVENTORY ----------
    public List<Item> getItemsByOwner(Long ownerId) {
        return itemRepository.findByOwnerId(ownerId);
    }

    public Item getItemById(String id) {

        Item item = itemRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Item not found"));

        if (item.getStatus() == null) {
            item.setStatus(ItemStatus.AVAILABLE);
            itemRepository.save(item);
        }

        if (item.getOwnerId() == null) {
            throw new RuntimeException("Invalid item data (owner missing)");
        }

        return item;
    }

    // ---------- DELETE ITEM (OWNER ONLY) ----------
    public void deleteItem(String itemId, Long ownerId) {

        Item item = itemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Item not found"));

        if (!ownerId.equals(item.getOwnerId())) {
            throw new AccessDeniedException("You are not allowed to delete this item");
        }

        // The borrower still has it — the rental has to be completed first
        if (item.getStatus() == ItemStatus.RENTED) {
            throw new RuntimeException("Cannot delete an item that is currently rented");
        }

        itemRepository.delete(item);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}

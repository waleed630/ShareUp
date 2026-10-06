package com.shareup.rental.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import lombok.Data;
import lombok.Getter;
import lombok.Setter;

@Data
@Getter
@Setter
public class RatingRequestDTO {

    @NotNull(message = "stars is required")
    @Min(value = 1, message = "stars must be at least 1")
    @Max(value = 10, message = "stars must be at most 10")
    private Integer stars;

    @Size(max = 1000, message = "review must be at most 1000 characters")
    private String review;
}

package com.example.thesisrepo.web.dto;

import org.springframework.data.domain.Page;

import java.util.List;

public record PagedResponse<T>(
  List<T> items,
  int page,
  int size,
  long totalElements,
  int totalPages,
  boolean hasNext,
  boolean hasPrevious
) {

  public static <T> PagedResponse<T> from(Page<?> source, List<T> items) {
    return new PagedResponse<>(
      items,
      source.getNumber(),
      source.getSize(),
      source.getTotalElements(),
      source.getTotalPages(),
      source.hasNext(),
      source.hasPrevious()
    );
  }
}

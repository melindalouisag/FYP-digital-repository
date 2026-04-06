package com.example.thesisrepo.web.dto;

public record AdminUserDirectoryItemDto(
  Long userId,
  String fullName,
  String email,
  String faculty,
  String studyProgram,
  String role
) {
}

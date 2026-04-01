package com.example.thesisrepo.web.dto;

public record StudentSupervisorResponse(
  Long id,
  String email,
  String name,
  String faculty,
  String department
) {
}

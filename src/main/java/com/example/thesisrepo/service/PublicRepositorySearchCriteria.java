package com.example.thesisrepo.service;

public record PublicRepositorySearchCriteria(
  String title,
  String author,
  String faculty,
  String program,
  Integer year,
  String keyword
) {
}

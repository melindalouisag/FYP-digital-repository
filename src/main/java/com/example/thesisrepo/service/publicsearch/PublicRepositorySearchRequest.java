package com.example.thesisrepo.service.publicsearch;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

public record PublicRepositorySearchRequest(
  String title,
  List<String> titleTerms,
  String author,
  List<String> authorTerms,
  String faculty,
  String program,
  Integer year,
  List<String> keywordTokens
) {

  public static PublicRepositorySearchRequest fromFilters(
    String title,
    String author,
    String faculty,
    String program,
    Integer year,
    String keyword
  ) {
    String normalizedTitle = normalize(title);
    String normalizedAuthor = normalize(author);
    String normalizedFaculty = normalize(faculty);
    String normalizedProgram = normalize(program);
    List<String> normalizedKeywordTokens = splitKeywordTokens(keyword);
    return new PublicRepositorySearchRequest(
      normalizedTitle,
      splitTerms(normalizedTitle),
      normalizedAuthor,
      splitTerms(normalizedAuthor),
      normalizedFaculty,
      normalizedProgram,
      year,
      normalizedKeywordTokens
    );
  }

  public boolean hasTitle() {
    return hasText(title);
  }

  public boolean hasAuthor() {
    return hasText(author);
  }

  public boolean hasFaculty() {
    return hasText(faculty);
  }

  public boolean hasProgram() {
    return hasText(program);
  }

  public boolean hasKeyword() {
    return !keywordTokens.isEmpty();
  }

  public String keywordQuery() {
    return String.join(" ", keywordTokens);
  }

  public static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }

  public static String like(String value) {
    return "%" + value + "%";
  }

  public static List<String> splitTerms(String value) {
    if (!hasText(value)) {
      return List.of();
    }
    return Arrays.stream(normalize(value).split("\\s+"))
      .filter(token -> !token.isBlank())
      .distinct()
      .toList();
  }

  private static String normalize(String value) {
    if (value == null) {
      return "";
    }
    return value.toLowerCase(Locale.ROOT)
      .replaceAll("\\s+", " ")
      .trim();
  }

  private static List<String> splitKeywordTokens(String value) {
    if (!hasText(value)) {
      return List.of();
    }
    return Arrays.stream(value.split("[,\\n]"))
      .map(PublicRepositorySearchRequest::normalize)
      .filter(token -> !token.isBlank())
      .distinct()
      .toList();
  }
}

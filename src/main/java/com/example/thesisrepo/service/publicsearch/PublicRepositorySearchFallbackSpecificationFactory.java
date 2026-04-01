package com.example.thesisrepo.service.publicsearch;

import com.example.thesisrepo.publication.PublishedItem;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

public final class PublicRepositorySearchFallbackSpecificationFactory {

  private PublicRepositorySearchFallbackSpecificationFactory() {
  }

  public static Specification<PublishedItem> build(PublicRepositorySearchRequest request) {
    return (root, query, builder) -> {
      List<Predicate> predicates = new ArrayList<>();

      if (request.hasFaculty()) {
        predicates.add(builder.equal(lowerField(builder, root, "faculty"), request.faculty()));
      }
      if (request.hasProgram()) {
        predicates.add(builder.equal(lowerField(builder, root, "program"), request.program()));
      }
      if (request.year() != null) {
        predicates.add(builder.equal(root.get("year"), request.year()));
      }
      if (request.hasTitle()) {
        predicates.add(matchesNormalizedText(
          builder,
          lowerField(builder, root, "title"),
          request.title(),
          request.titleTerms()
        ));
      }
      if (request.hasAuthor()) {
        predicates.add(matchesNormalizedText(
          builder,
          combinedLowerFields(builder, root, "authors", "authorName"),
          request.author(),
          request.authorTerms()
        ));
      }
      if (request.hasKeyword()) {
        Expression<String> discoveryDocument = combinedLowerFields(builder, root, "title", "keywords", "abstractText");
        for (String token : request.keywordTokens()) {
          predicates.add(matchesNormalizedText(
            builder,
            discoveryDocument,
            token,
            PublicRepositorySearchRequest.splitTerms(token)
          ));
        }
      }

      return builder.and(predicates.toArray(Predicate[]::new));
    };
  }

  private static Predicate matchesNormalizedText(
    jakarta.persistence.criteria.CriteriaBuilder builder,
    Expression<String> document,
    String query,
    List<String> queryTerms
  ) {
    List<Predicate> matches = new ArrayList<>();
    matches.add(builder.like(document, PublicRepositorySearchRequest.like(query)));

    if (!queryTerms.isEmpty()) {
      List<Predicate> tokenPredicates = queryTerms.stream()
        .map(term -> builder.like(document, PublicRepositorySearchRequest.like(term)))
        .toList();
      matches.add(builder.and(tokenPredicates.toArray(Predicate[]::new)));
    }

    return builder.or(matches.toArray(Predicate[]::new));
  }

  private static Expression<String> lowerField(
    jakarta.persistence.criteria.CriteriaBuilder builder,
    Root<PublishedItem> root,
    String field
  ) {
    return builder.lower(builder.coalesce(root.get(field).as(String.class), ""));
  }

  private static Expression<String> combinedLowerFields(
    jakarta.persistence.criteria.CriteriaBuilder builder,
    Root<PublishedItem> root,
    String... fields
  ) {
    Expression<String> combined = builder.literal("");
    for (String field : fields) {
      combined = builder.concat(
        builder.concat(combined, " "),
        lowerField(builder, root, field)
      );
    }
    return combined;
  }
}

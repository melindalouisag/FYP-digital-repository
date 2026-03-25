package com.example.thesisrepo.service;

import com.example.thesisrepo.publication.PublishedItem;
import com.example.thesisrepo.publication.repo.PublishedItemRepository;
import com.example.thesisrepo.web.dto.PagedResponse;
import com.example.thesisrepo.web.dto.PublicRepositoryItemDto;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import lombok.RequiredArgsConstructor;
import org.springframework.core.env.Environment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class PublicRepositorySearchService {

  private static final String TITLE_VECTOR_SQL =
    "to_tsvector('simple', coalesce(pi.title, ''))";
  private static final String AUTHOR_VECTOR_SQL =
    "to_tsvector('simple', coalesce(pi.authors, '') || ' ' || coalesce(pi.author_name, ''))";
  private static final String DISCOVERY_VECTOR_SQL =
    "setweight(to_tsvector('simple', coalesce(pi.title, '')), 'A') || " +
      "setweight(to_tsvector('simple', coalesce(pi.keywords, '')), 'A') || " +
      "setweight(to_tsvector('simple', coalesce(pi.abstract_text, '')), 'B')";

  private final PublishedItemRepository publishedItems;
  private final NamedParameterJdbcTemplate jdbc;
  private final Environment environment;

  @Transactional(readOnly = true)
  public PagedResponse<PublicRepositoryItemDto> search(PublicRepositorySearchCriteria criteria, Pageable pageable) {
    SearchRequest request = SearchRequest.from(criteria);
    return usesPostgresSearch()
      ? searchPostgres(request, pageable)
      : searchFallback(request, pageable);
  }

  private PagedResponse<PublicRepositoryItemDto> searchPostgres(SearchRequest request, Pageable pageable) {
    MapSqlParameterSource params = new MapSqlParameterSource()
      .addValue("limit", pageable.getPageSize())
      .addValue("offset", pageable.getOffset());

    StringBuilder where = new StringBuilder(" WHERE 1 = 1");
    appendPredicates(request, where, params);

    String relevanceSql = buildRelevanceSql(request, params);
    String selectSql = """
      SELECT
        pi.id,
        pi.title,
        pi.authors,
        pi.author_name,
        pi.faculty,
        pi.program,
        pi.publication_year,
        pi.keywords,
        pi.published_at,
        %s AS relevance
      FROM published_item pi
      %s
      ORDER BY relevance DESC, pi.published_at DESC, pi.id DESC
      LIMIT :limit OFFSET :offset
      """.formatted(relevanceSql, where);

    String countSql = "SELECT COUNT(*) FROM published_item pi" + where;

    List<PublicRepositoryItemDto> items = jdbc.query(selectSql, params, (rs, rowNum) ->
      new PublicRepositoryItemDto(
        rs.getLong("id"),
        rs.getString("title"),
        rs.getString("authors"),
        rs.getString("author_name"),
        rs.getString("faculty"),
        rs.getString("program"),
        (Integer) rs.getObject("publication_year"),
        rs.getString("keywords"),
        rs.getTimestamp("published_at") != null ? rs.getTimestamp("published_at").toInstant() : null
      )
    );

    long total = jdbc.queryForObject(countSql, params, Long.class);
    PageImpl<PublicRepositoryItemDto> resultPage = new PageImpl<>(items, pageable, total);
    return PagedResponse.from(resultPage, items);
  }

  private PagedResponse<PublicRepositoryItemDto> searchFallback(SearchRequest request, Pageable pageable) {
    Page<PublishedItem> resultPage = publishedItems.findAll(
      buildFallbackSpecification(request),
      PageRequest.of(
        Math.max(pageable.getPageNumber(), 0),
        pageable.getPageSize(),
        Sort.by(Sort.Order.desc("publishedAt"), Sort.Order.desc("id"))
      )
    );

    List<PublicRepositoryItemDto> items = resultPage.getContent().stream()
      .map(this::toPublicSummary)
      .toList();
    return PagedResponse.from(resultPage, items);
  }

  private Specification<PublishedItem> buildFallbackSpecification(SearchRequest request) {
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
            splitTerms(token)
          ));
        }
      }

      return builder.and(predicates.toArray(Predicate[]::new));
    };
  }

  private void appendPredicates(SearchRequest request, StringBuilder where, MapSqlParameterSource params) {
    if (request.hasFaculty()) {
      where.append(" AND lower(coalesce(pi.faculty, '')) = :faculty");
      params.addValue("faculty", request.faculty());
    }
    if (request.hasProgram()) {
      where.append(" AND lower(coalesce(pi.program, '')) = :program");
      params.addValue("program", request.program());
    }
    if (request.year() != null) {
      where.append(" AND pi.publication_year = :year");
      params.addValue("year", request.year());
    }
    if (request.hasTitle()) {
      where.append("""
         AND (
           lower(coalesce(pi.title, '')) LIKE :titleLike
           OR %s @@ plainto_tsquery('simple', :titleTs)
           OR word_similarity(lower(coalesce(pi.title, '')), :titleNormalized) >= 0.40
         )
        """.formatted(TITLE_VECTOR_SQL));
      params.addValue("titleNormalized", request.title());
      params.addValue("titleLike", like(request.title()));
      params.addValue("titlePrefix", request.title() + "%");
      params.addValue("titleTs", request.title());
    }
    if (request.hasAuthor()) {
      where.append("""
         AND (
           lower(coalesce(pi.authors, '')) LIKE :authorLike
           OR lower(coalesce(pi.author_name, '')) LIKE :authorLike
           OR %s @@ plainto_tsquery('simple', :authorTs)
           OR greatest(
             word_similarity(lower(coalesce(pi.authors, '')), :authorNormalized),
             word_similarity(lower(coalesce(pi.author_name, '')), :authorNormalized)
           ) >= 0.40
         )
        """.formatted(AUTHOR_VECTOR_SQL));
      params.addValue("authorNormalized", request.author());
      params.addValue("authorLike", like(request.author()));
      params.addValue("authorPrefix", request.author() + "%");
      params.addValue("authorTs", request.author());
    }
    for (int index = 0; index < request.keywordTokens().size(); index++) {
      String token = request.keywordTokens().get(index);
      String tokenParam = "keywordToken" + index;
      String likeParam = "keywordLike" + index;
      where.append("""
         AND (
           lower(coalesce(pi.keywords, '')) LIKE :%s
           OR lower(coalesce(pi.title, '')) LIKE :%s
           OR %s @@ plainto_tsquery('simple', :%s)
           OR greatest(
             word_similarity(lower(coalesce(pi.keywords, '')), :%s),
             word_similarity(lower(coalesce(pi.title, '')), :%s)
           ) >= 0.40
         )
        """.formatted(likeParam, likeParam, DISCOVERY_VECTOR_SQL, tokenParam, tokenParam, tokenParam));
      params.addValue(tokenParam, token);
      params.addValue(likeParam, like(token));
    }
  }

  private String buildRelevanceSql(SearchRequest request, MapSqlParameterSource params) {
    List<String> parts = new ArrayList<>();
    if (request.hasTitle()) {
      parts.add("""
        (
          CASE WHEN lower(coalesce(pi.title, '')) = :titleNormalized THEN 120 ELSE 0 END
          + CASE WHEN lower(coalesce(pi.title, '')) LIKE :titlePrefix THEN 45 ELSE 0 END
          + CASE WHEN lower(coalesce(pi.title, '')) LIKE :titleLike THEN 15 ELSE 0 END
          + ts_rank_cd(%s, plainto_tsquery('simple', :titleTs)) * 25
          + word_similarity(lower(coalesce(pi.title, '')), :titleNormalized) * 20
        )
        """.formatted(TITLE_VECTOR_SQL));
    }
    if (request.hasAuthor()) {
      parts.add("""
        (
          CASE
            WHEN lower(coalesce(pi.author_name, '')) = :authorNormalized
              OR lower(coalesce(pi.authors, '')) = :authorNormalized
            THEN 90 ELSE 0
          END
          + CASE
            WHEN lower(coalesce(pi.author_name, '')) LIKE :authorPrefix
              OR lower(coalesce(pi.authors, '')) LIKE :authorPrefix
            THEN 35 ELSE 0
          END
          + CASE
            WHEN lower(coalesce(pi.author_name, '')) LIKE :authorLike
              OR lower(coalesce(pi.authors, '')) LIKE :authorLike
            THEN 12 ELSE 0
          END
          + ts_rank_cd(%s, plainto_tsquery('simple', :authorTs)) * 20
          + greatest(
            word_similarity(lower(coalesce(pi.authors, '')), :authorNormalized),
            word_similarity(lower(coalesce(pi.author_name, '')), :authorNormalized)
          ) * 18
        )
        """.formatted(AUTHOR_VECTOR_SQL));
    }
    if (request.hasKeyword()) {
      params.addValue("keywordNormalized", request.keywordQuery());
      params.addValue("keywordTs", request.keywordQuery());
      StringBuilder keywordScore = new StringBuilder("""
        (
          ts_rank_cd(%s, plainto_tsquery('simple', :keywordTs)) * 18
          + similarity(lower(coalesce(pi.keywords, '')), :keywordNormalized) * 8
          + word_similarity(lower(coalesce(pi.title, '')), :keywordNormalized) * 6
        """.formatted(DISCOVERY_VECTOR_SQL));
      for (int index = 0; index < request.keywordTokens().size(); index++) {
        keywordScore.append("""
            + CASE WHEN lower(coalesce(pi.keywords, '')) LIKE :keywordLike%d THEN 20 ELSE 0 END
            + CASE WHEN lower(coalesce(pi.title, '')) LIKE :keywordLike%d THEN 10 ELSE 0 END
          """.formatted(index, index));
      }
      keywordScore.append(")");
      parts.add(keywordScore.toString());
    }
    return parts.isEmpty() ? "0" : "(" + String.join(" + ", parts) + ")";
  }

  private PublicRepositoryItemDto toPublicSummary(PublishedItem item) {
    return new PublicRepositoryItemDto(
      item.getId(),
      item.getTitle(),
      item.getAuthors(),
      item.getAuthorName(),
      item.getFaculty(),
      item.getProgram(),
      item.getYear(),
      item.getKeywords(),
      item.getPublishedAt()
    );
  }

  private Predicate matchesNormalizedText(
    jakarta.persistence.criteria.CriteriaBuilder builder,
    Expression<String> document,
    String query,
    List<String> queryTerms
  ) {
    List<Predicate> matches = new ArrayList<>();
    matches.add(builder.like(document, like(query)));

    if (!queryTerms.isEmpty()) {
      List<Predicate> tokenPredicates = queryTerms.stream()
        .map(term -> builder.like(document, like(term)))
        .toList();
      matches.add(builder.and(tokenPredicates.toArray(Predicate[]::new)));
    }

    return builder.or(matches.toArray(Predicate[]::new));
  }

  private Expression<String> lowerField(
    jakarta.persistence.criteria.CriteriaBuilder builder,
    Root<PublishedItem> root,
    String field
  ) {
    return builder.lower(builder.coalesce(root.get(field).as(String.class), ""));
  }

  private Expression<String> combinedLowerFields(
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

  private boolean usesPostgresSearch() {
    return environment.getProperty("spring.datasource.url", "")
      .toLowerCase(Locale.ROOT)
      .startsWith("jdbc:postgresql:");
  }

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }

  private static String like(String value) {
    return "%" + value + "%";
  }

  private static String normalize(String value) {
    if (value == null) {
      return "";
    }
    return value.toLowerCase(Locale.ROOT)
      .replaceAll("\\s+", " ")
      .trim();
  }

  private static List<String> splitTerms(String value) {
    if (!hasText(value)) {
      return List.of();
    }
    return Arrays.stream(normalize(value).split("\\s+"))
      .filter(token -> !token.isBlank())
      .distinct()
      .toList();
  }

  private record SearchRequest(
    String title,
    List<String> titleTerms,
    String author,
    List<String> authorTerms,
    String faculty,
    String program,
    Integer year,
    List<String> keywordTokens
  ) {

    static SearchRequest from(PublicRepositorySearchCriteria criteria) {
      String title = normalize(criteria.title());
      String author = normalize(criteria.author());
      String faculty = normalize(criteria.faculty());
      String program = normalize(criteria.program());
      List<String> keywordTokens = splitKeywordTokens(criteria.keyword());
      return new SearchRequest(
        title,
        splitTerms(title),
        author,
        splitTerms(author),
        faculty,
        program,
        criteria.year(),
        keywordTokens
      );
    }

    boolean hasTitle() {
      return hasText(title);
    }

    boolean hasAuthor() {
      return hasText(author);
    }

    boolean hasFaculty() {
      return hasText(faculty);
    }

    boolean hasProgram() {
      return hasText(program);
    }

    boolean hasKeyword() {
      return !keywordTokens.isEmpty();
    }

    String keywordQuery() {
      return String.join(" ", keywordTokens);
    }

    private static List<String> splitKeywordTokens(String value) {
      if (!hasText(value)) {
        return List.of();
      }
      return Arrays.stream(value.split("[,\\n]"))
        .map(PublicRepositorySearchService::normalize)
        .filter(token -> !token.isBlank())
        .distinct()
        .toList();
    }
  }
}

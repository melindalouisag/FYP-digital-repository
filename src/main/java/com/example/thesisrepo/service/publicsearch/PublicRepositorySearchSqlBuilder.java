package com.example.thesisrepo.service.publicsearch;

import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

import java.util.ArrayList;
import java.util.List;

public final class PublicRepositorySearchSqlBuilder {

  private static final String TITLE_VECTOR_SQL =
    "to_tsvector('simple', coalesce(pi.title, ''))";
  private static final String AUTHOR_VECTOR_SQL =
    "to_tsvector('simple', coalesce(pi.authors, '') || ' ' || coalesce(pi.author_name, ''))";
  private static final String DISCOVERY_VECTOR_SQL =
    "setweight(to_tsvector('simple', coalesce(pi.title, '')), 'A') || " +
      "setweight(to_tsvector('simple', coalesce(pi.keywords, '')), 'A') || " +
      "setweight(to_tsvector('simple', coalesce(pi.abstract_text, '')), 'B')";

  private PublicRepositorySearchSqlBuilder() {
  }

  public static SqlQuery build(PublicRepositorySearchRequest request, Pageable pageable) {
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

    return new SqlQuery(
      selectSql,
      "SELECT COUNT(*) FROM published_item pi" + where,
      params
    );
  }

  private static void appendPredicates(
    PublicRepositorySearchRequest request,
    StringBuilder where,
    MapSqlParameterSource params
  ) {
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
      params.addValue("titleLike", PublicRepositorySearchRequest.like(request.title()));
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
      params.addValue("authorLike", PublicRepositorySearchRequest.like(request.author()));
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
      params.addValue(likeParam, PublicRepositorySearchRequest.like(token));
    }
  }

  private static String buildRelevanceSql(PublicRepositorySearchRequest request, MapSqlParameterSource params) {
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

  public record SqlQuery(String selectSql, String countSql, MapSqlParameterSource params) {
  }
}

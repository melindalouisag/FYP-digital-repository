package com.example.thesisrepo.service;

import com.example.thesisrepo.publication.PublishedItem;
import com.example.thesisrepo.publication.repo.PublishedItemRepository;
import com.example.thesisrepo.service.publicsearch.PublicRepositorySearchFallbackSpecificationFactory;
import com.example.thesisrepo.service.publicsearch.PublicRepositorySearchRequest;
import com.example.thesisrepo.service.publicsearch.PublicRepositorySearchSqlBuilder;
import com.example.thesisrepo.web.dto.PagedResponse;
import com.example.thesisrepo.web.dto.PublicRepositoryItemDto;
import lombok.RequiredArgsConstructor;
import org.springframework.core.env.Environment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.sql.ResultSet;
import java.sql.SQLException;

@Service
@RequiredArgsConstructor
public class PublicRepositorySearchService {

  private final PublishedItemRepository publishedItems;
  private final NamedParameterJdbcTemplate jdbc;
  private final Environment environment;

  @Transactional(readOnly = true)
  public PagedResponse<PublicRepositoryItemDto> search(PublicRepositorySearchRequest request, Pageable pageable) {
    return usesPostgresSearch()
      ? searchPostgres(request, pageable)
      : searchFallback(request, pageable);
  }

  private PagedResponse<PublicRepositoryItemDto> searchPostgres(PublicRepositorySearchRequest request, Pageable pageable) {
    PublicRepositorySearchSqlBuilder.SqlQuery query = PublicRepositorySearchSqlBuilder.build(request, pageable);
    List<PublicRepositoryItemDto> items = jdbc.query(
      query.selectSql(),
      query.params(),
      (rs, rowNum) -> toDto(rs)
    );
    long total = jdbc.queryForObject(query.countSql(), query.params(), Long.class);
    PageImpl<PublicRepositoryItemDto> resultPage = new PageImpl<>(items, pageable, total);
    return PagedResponse.from(resultPage, items);
  }

  private PagedResponse<PublicRepositoryItemDto> searchFallback(PublicRepositorySearchRequest request, Pageable pageable) {
    Page<PublishedItem> resultPage = publishedItems.findAll(
      PublicRepositorySearchFallbackSpecificationFactory.build(request),
      PageRequest.of(
        Math.max(pageable.getPageNumber(), 0),
        pageable.getPageSize(),
        Sort.by(Sort.Order.desc("publishedAt"), Sort.Order.desc("id"))
      )
    );

    List<PublicRepositoryItemDto> items = resultPage.getContent().stream()
      .map(this::toDto)
      .toList();
    return PagedResponse.from(resultPage, items);
  }

  private boolean usesPostgresSearch() {
    return environment.getProperty("spring.datasource.url", "")
      .toLowerCase(Locale.ROOT)
      .startsWith("jdbc:postgresql:");
  }

  private PublicRepositoryItemDto toDto(PublishedItem item) {
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

  private PublicRepositoryItemDto toDto(ResultSet resultSet) throws SQLException {
    return new PublicRepositoryItemDto(
      resultSet.getLong("id"),
      resultSet.getString("title"),
      resultSet.getString("authors"),
      resultSet.getString("author_name"),
      resultSet.getString("faculty"),
      resultSet.getString("program"),
      (Integer) resultSet.getObject("publication_year"),
      resultSet.getString("keywords"),
      resultSet.getTimestamp("published_at") != null ? resultSet.getTimestamp("published_at").toInstant() : null
    );
  }
}

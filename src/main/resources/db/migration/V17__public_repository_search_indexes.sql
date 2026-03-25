CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_repo_published_at_id
  ON published_item (published_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_repo_title_trgm
  ON published_item USING GIN (lower(title) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_repo_authors_trgm
  ON published_item USING GIN (lower(authors) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_repo_author_name_trgm
  ON published_item USING GIN (lower(author_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_repo_keywords_trgm
  ON published_item USING GIN (lower(keywords) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_repo_title_fts
  ON published_item USING GIN (to_tsvector('simple', coalesce(title, '')));

CREATE INDEX IF NOT EXISTS idx_repo_author_fts
  ON published_item USING GIN (
    to_tsvector('simple', coalesce(authors, '') || ' ' || coalesce(author_name, ''))
  );

CREATE INDEX IF NOT EXISTS idx_repo_discovery_fts
  ON published_item USING GIN (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(keywords, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(abstract_text, '')), 'B')
  );

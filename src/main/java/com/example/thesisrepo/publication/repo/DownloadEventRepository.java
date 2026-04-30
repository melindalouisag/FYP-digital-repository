package com.example.thesisrepo.publication.repo;

import com.example.thesisrepo.publication.DownloadEvent;
import com.example.thesisrepo.publication.PublishedItem;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DownloadEventRepository extends JpaRepository<DownloadEvent, Long> {
  void deleteByPublishedItem(PublishedItem publishedItem);
}

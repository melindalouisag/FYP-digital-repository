package com.example.thesisrepo.publication.repo;

import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.PublicationRegistration;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PublicationRegistrationRepository extends JpaRepository<PublicationRegistration, Long> {
  Optional<PublicationRegistration> findByPublicationCase(PublicationCase publicationCase);
  List<PublicationRegistration> findByPublicationCaseIn(List<PublicationCase> cases);

  @EntityGraph(attributePaths = {"publicationCase", "publicationCase.student"})
  @Query(
    value = """
      select r from PublicationRegistration r
      join r.publicationCase c
      where c.status = :status
      order by
        case when r.submittedAt is null then 1 else 0 end,
        r.submittedAt desc,
        c.id desc
      """,
    countQuery = """
      select count(r) from PublicationRegistration r
      join r.publicationCase c
      where c.status = :status
      """
  )
  Page<PublicationRegistration> findAdminApprovalQueue(@Param("status") CaseStatus status, Pageable pageable);

  @EntityGraph(attributePaths = {"publicationCase", "publicationCase.student"})
  @Query(
    value = """
      select r from PublicationRegistration r
      join r.publicationCase c
      join CaseSupervisor cs on cs.publicationCase = c
      where cs.lecturer.id = :lecturerUserId
        and c.status = com.example.thesisrepo.publication.CaseStatus.REGISTRATION_PENDING
        and cs.approvedAt is null
        and cs.rejectedAt is null
      order by
        case when r.submittedAt is null then 1 else 0 end,
        r.submittedAt desc,
        c.id desc
      """,
    countQuery = """
      select count(r) from PublicationRegistration r
      join r.publicationCase c
      join CaseSupervisor cs on cs.publicationCase = c
      where cs.lecturer.id = :lecturerUserId
        and c.status = com.example.thesisrepo.publication.CaseStatus.REGISTRATION_PENDING
        and cs.approvedAt is null
        and cs.rejectedAt is null
      """
  )
  Page<PublicationRegistration> findLecturerApprovalQueue(@Param("lecturerUserId") Long lecturerUserId, Pageable pageable);
}

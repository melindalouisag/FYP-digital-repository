package com.example.thesisrepo.publication.repo;

import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationType;
import com.example.thesisrepo.user.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PublicationCaseRepository extends JpaRepository<PublicationCase, Long> {
  List<PublicationCase> findByStudentOrderByUpdatedAtDesc(User student);
  Page<PublicationCase> findByStudent(User student, Pageable pageable);
  List<PublicationCase> findByStudentAndTypeOrderByUpdatedAtDesc(User student, PublicationType type);
  List<PublicationCase> findByStatusInOrderByUpdatedAtDesc(List<CaseStatus> statuses);
  Page<PublicationCase> findByStatusIn(List<CaseStatus> statuses, Pageable pageable);

  @Query(
    value = """
      select c from PublicationCase c
      where c.status in :statuses
        and (:type is null or c.type = :type)
      order by
        case when c.updatedAt is null then 1 else 0 end,
        c.updatedAt desc,
        c.id desc
      """,
    countQuery = """
      select count(c) from PublicationCase c
      where c.status in :statuses
        and (:type is null or c.type = :type)
      """
  )
  Page<PublicationCase> findAdminReviewQueue(
    @Param("statuses") List<CaseStatus> statuses,
    @Param("type") PublicationType type,
    Pageable pageable
  );

  @Query(
    value = """
      select c from PublicationCase c
      join CaseSupervisor cs on cs.publicationCase = c
      where cs.lecturer.id = :lecturerUserId
        and c.status in :statuses
      order by
        case when c.updatedAt is null then 1 else 0 end,
        c.updatedAt desc,
        c.id desc
      """,
    countQuery = """
      select count(c) from PublicationCase c
      join CaseSupervisor cs on cs.publicationCase = c
      where cs.lecturer.id = :lecturerUserId
        and c.status in :statuses
      """
  )
  Page<PublicationCase> findLecturerReviewQueue(
    @Param("lecturerUserId") Long lecturerUserId,
    @Param("statuses") List<CaseStatus> statuses,
    Pageable pageable
  );
}

package com.example.thesisrepo.service.admin;

import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.SubmissionVersion;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.PublicationRegistrationRepository;
import com.example.thesisrepo.publication.repo.SubmissionVersionRepository;
import com.example.thesisrepo.service.libraryreview.LibraryReviewReadService;
import com.example.thesisrepo.web.dto.AdminCaseDetailResponse;
import com.example.thesisrepo.web.dto.AdminCaseQueueDto;
import com.example.thesisrepo.web.dto.AdminStudentTrackingDetailResponse;
import com.example.thesisrepo.web.dto.AdminStudentTrackingGroupDto;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminStudentTrackingService {

  private static final List<String> FACULTY_ORDER = List.of("FET", "FOB", "FOE", "FAS");

  private final PublicationCaseRepository publicationCases;
  private final PublicationRegistrationRepository registrations;
  private final SubmissionVersionRepository submissionVersions;
  private final StudentProfileRepository studentProfiles;
  private final LibraryReviewReadService libraryReviewReadService;

  public List<AdminStudentTrackingGroupDto> listStudents() {
    List<PublicationCase> cases = publicationCases.findAll(
      Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("id"))
    );
    if (cases.isEmpty()) {
      return List.of();
    }

    return buildTrackingGroups(cases);
  }

  public AdminStudentTrackingDetailResponse studentDetail(Long studentUserId, Long requestedCaseId) {
    List<PublicationCase> cases = publicationCases.findByStudent_IdOrderByUpdatedAtDesc(studentUserId);
    if (cases.isEmpty()) {
      StudentProfile profile = studentProfiles.findByUserId(studentUserId).orElse(null);
      if (profile == null) {
        throw new ResponseStatusException(NOT_FOUND, "Student not found");
      }
      return new AdminStudentTrackingDetailResponse(
        studentUserId,
        hasText(profile.getName()) ? profile.getName() : "Student",
        profile.getStudentId(),
        profile.getFaculty(),
        profile.getProgram(),
        List.of(),
        null,
        null
      );
    }

    List<AdminStudentTrackingGroupDto> groups = buildTrackingGroups(cases);
    AdminStudentTrackingGroupDto group = groups.stream().findFirst()
      .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Student not found"));

    Long selectedCaseId = resolveSelectedCaseId(group.cases(), requestedCaseId);
    AdminCaseDetailResponse selectedCase = selectedCaseId != null
      ? libraryReviewReadService.caseDetail(selectedCaseId)
      : null;

    return new AdminStudentTrackingDetailResponse(
      group.studentUserId(),
      group.studentName(),
      group.studentIdNumber(),
      group.faculty(),
      group.program(),
      group.cases(),
      selectedCaseId,
      selectedCase
    );
  }

  private List<AdminStudentTrackingGroupDto> buildTrackingGroups(List<PublicationCase> cases) {
    Map<Long, PublicationRegistration> registrationByCaseId = registrations.findByPublicationCaseIn(cases).stream()
      .collect(Collectors.toMap(
        registration -> registration.getPublicationCase().getId(),
        Function.identity()
      ));
    Map<Long, StudentProfile> profileByUserId = loadProfiles(cases);
    Map<Long, Instant> latestSubmissionByCaseId = loadLatestSubmissionTimes(cases);
    Map<Long, List<AdminCaseQueueDto>> casesByStudentId = new LinkedHashMap<>();

    for (PublicationCase publicationCase : cases) {
      PublicationRegistration registration = registrationByCaseId.get(publicationCase.getId());
      casesByStudentId.computeIfAbsent(publicationCase.getStudent().getId(), ignored -> new ArrayList<>())
        .add(toCaseQueue(publicationCase, registration, latestSubmissionByCaseId.get(publicationCase.getId())));
    }

    return casesByStudentId.entrySet().stream()
      .map((entry) -> toTrackingGroup(entry.getKey(), entry.getValue(), cases, registrationByCaseId, profileByUserId))
      .sorted(
        Comparator.comparingInt((AdminStudentTrackingGroupDto group) -> facultyOrder(group.faculty()))
          .thenComparing(AdminStudentTrackingGroupDto::studentName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
      )
      .toList();
  }

  private AdminStudentTrackingGroupDto toTrackingGroup(
    Long studentUserId,
    List<AdminCaseQueueDto> caseRows,
    List<PublicationCase> cases,
    Map<Long, PublicationRegistration> registrationByCaseId,
    Map<Long, StudentProfile> profileByUserId
  ) {
    StudentProfile profile = profileByUserId.get(studentUserId);
    PublicationCase sampleCase = cases.stream()
      .filter(publicationCase -> Objects.equals(publicationCase.getStudent().getId(), studentUserId))
      .findFirst()
      .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Student case not found"));
    PublicationRegistration sampleRegistration = registrationByCaseId.get(sampleCase.getId());

    String studentName = profile != null && hasText(profile.getName())
      ? profile.getName()
      : sampleCase.getStudent().getEmail();
    String faculty = profile != null && hasText(profile.getFaculty())
      ? profile.getFaculty()
      : (sampleRegistration != null ? sampleRegistration.getFaculty() : null);

    return new AdminStudentTrackingGroupDto(
      studentUserId,
      studentName,
      profile != null ? profile.getStudentId() : (sampleRegistration != null ? sampleRegistration.getStudentIdNumber() : null),
      faculty,
      profile != null ? profile.getProgram() : null,
      caseRows
    );
  }

  private Map<Long, StudentProfile> loadProfiles(List<PublicationCase> cases) {
    List<Long> studentUserIds = cases.stream()
      .map(publicationCase -> publicationCase.getStudent().getId())
      .distinct()
      .toList();

    return studentProfiles.findByUserIdIn(studentUserIds).stream()
      .collect(Collectors.toMap(StudentProfile::getUserId, Function.identity()));
  }

  private Map<Long, Instant> loadLatestSubmissionTimes(List<PublicationCase> cases) {
    if (cases.isEmpty()) {
      return Map.of();
    }

    return submissionVersions.findByPublicationCaseIn(cases).stream()
      .collect(Collectors.toMap(
        submission -> submission.getPublicationCase().getId(),
        SubmissionVersion::getCreatedAt,
        (left, right) -> compareInstants(left, right) >= 0 ? left : right
      ));
  }

  private AdminCaseQueueDto toCaseQueue(
    PublicationCase publicationCase,
    PublicationRegistration registration,
    Instant latestSubmissionAt
  ) {
    return new AdminCaseQueueDto(
      publicationCase.getId(),
      registration != null ? registration.getTitle() : null,
      publicationCase.getType(),
      publicationCase.getStatus(),
      publicationCase.getUpdatedAt(),
      latestSubmissionAt
    );
  }

  private static Long resolveSelectedCaseId(List<AdminCaseQueueDto> cases, Long requestedCaseId) {
    if (cases.isEmpty()) {
      return null;
    }

    if (requestedCaseId != null && cases.stream().anyMatch(item -> Objects.equals(item.caseId(), requestedCaseId))) {
      return requestedCaseId;
    }

    return cases.get(0).caseId();
  }

  private static int facultyOrder(String faculty) {
    String normalized = normalizeFacultyCode(faculty);
    int index = FACULTY_ORDER.indexOf(normalized);
    return index >= 0 ? index : FACULTY_ORDER.size();
  }

  private static int compareInstants(Instant left, Instant right) {
    Instant safeLeft = left != null ? left : Instant.EPOCH;
    Instant safeRight = right != null ? right : Instant.EPOCH;
    return safeLeft.compareTo(safeRight);
  }

  private static String normalizeFacultyCode(String faculty) {
    if (!hasText(faculty)) {
      return "";
    }
    String value = faculty.trim().toUpperCase();
    if (value.contains("FET") || value.contains("ENGINEERING")) {
      return "FET";
    }
    if (value.contains("FOB") || value.contains("FBS") || value.contains("BUSINESS")) {
      return "FOB";
    }
    if (value.contains("FOE") || value.contains("EDUCATION")) {
      return "FOE";
    }
    if (value.contains("FAS") || value.contains("ARTS")) {
      return "FAS";
    }
    return value;
  }

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }
}

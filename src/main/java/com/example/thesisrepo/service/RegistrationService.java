package com.example.thesisrepo.service;

import com.example.thesisrepo.publication.PublicationType;
import com.example.thesisrepo.service.registration.RegistrationDecisionService;
import com.example.thesisrepo.service.registration.RegistrationDraftService;
import com.example.thesisrepo.service.registration.RegistrationSubmissionService;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.AdminRegistrationApprovalDto;
import com.example.thesisrepo.web.dto.CaseStatusResponse;
import com.example.thesisrepo.web.dto.PagedResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RegistrationService {

  private final RegistrationDraftService registrationDraftService;
  private final RegistrationSubmissionService registrationSubmissionService;
  private final RegistrationDecisionService registrationDecisionService;

  public CaseStatusResponse createStudentRegistration(User student, CreateRegistrationCommand command) {
    return registrationDraftService.createStudentRegistration(student, command);
  }

  public CaseStatusResponse updateStudentRegistration(User student, Long caseId, UpdateRegistrationCommand command) {
    return registrationDraftService.updateStudentRegistration(student, caseId, command);
  }

  public CaseStatusResponse submitStudentRegistration(User student, Long caseId, boolean permissionAccepted) {
    return registrationSubmissionService.submitStudentRegistration(student, caseId, permissionAccepted);
  }

  public CaseStatusResponse approveRegistrationByLecturer(User lecturer, Long caseId) {
    return registrationDecisionService.approveRegistrationByLecturer(lecturer, caseId);
  }

  public CaseStatusResponse rejectRegistrationByLecturer(User lecturer, Long caseId, String note) {
    return registrationDecisionService.rejectRegistrationByLecturer(lecturer, caseId, note);
  }

  public CaseStatusResponse approveRegistrationByAdmin(User admin, Long caseId) {
    return registrationDecisionService.approveRegistrationByAdmin(admin, caseId);
  }

  public CaseStatusResponse rejectRegistrationByAdmin(User admin, Long caseId, String reason) {
    return registrationDecisionService.rejectRegistrationByAdmin(admin, caseId, reason);
  }

  public PagedResponse<AdminRegistrationApprovalDto> adminApprovalQueue(Pageable pageable) {
    return registrationDecisionService.adminApprovalQueue(pageable);
  }

  public record CreateRegistrationCommand(
    PublicationType type,
    String title,
    Integer year,
    String articlePublishIn,
    String faculty,
    String studentIdNumber,
    String authorName,
    String supervisorEmail,
    Long supervisorUserId,
    List<Long> supervisorUserIds,
    List<String> supervisorEmails
  ) {
  }

  public record UpdateRegistrationCommand(
    String title,
    Integer year,
    String articlePublishIn,
    String faculty,
    String studentIdNumber,
    String authorName,
    String supervisorEmail,
    Long supervisorUserId,
    List<Long> supervisorUserIds,
    List<String> supervisorEmails
  ) {
  }
}

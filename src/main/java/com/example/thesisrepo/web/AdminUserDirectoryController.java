package com.example.thesisrepo.web;

import com.example.thesisrepo.service.admin.AdminUserDirectoryService;
import com.example.thesisrepo.web.dto.AdminUserDirectoryItemDto;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserDirectoryController {

  private final AdminUserDirectoryService adminUserDirectoryService;

  @GetMapping("/students")
  public List<AdminUserDirectoryItemDto> students(
    @RequestParam(required = false) String q,
    @RequestParam(required = false) String faculty,
    @RequestParam(required = false) String studyProgram
  ) {
    return adminUserDirectoryService.students(q, faculty, studyProgram);
  }

  @GetMapping("/lecturers")
  public List<AdminUserDirectoryItemDto> lecturers(
    @RequestParam(required = false) String q,
    @RequestParam(required = false) String faculty,
    @RequestParam(required = false) String studyProgram
  ) {
    return adminUserDirectoryService.lecturers(q, faculty, studyProgram);
  }
}

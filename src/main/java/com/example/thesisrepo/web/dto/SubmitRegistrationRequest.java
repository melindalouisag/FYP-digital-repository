package com.example.thesisrepo.web.dto;

import jakarta.validation.constraints.AssertTrue;
import lombok.Data;

@Data
public class SubmitRegistrationRequest {
  @AssertTrue(message = "Permission must be accepted.")
  private boolean permissionAccepted;
}

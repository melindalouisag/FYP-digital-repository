import type { AuthConfig, AuthMode } from "./api/auth";

export function resolveAuthMode(config: AuthConfig | null): AuthMode {
  return config?.mode ?? "SSO";
}

export function shouldShowLocalLogin(config: AuthConfig | null): boolean {
  return config?.localEnabled ?? false;
}

export function shouldShowSso(config: AuthConfig | null): boolean {
  return config?.ssoEnabled ?? true;
}

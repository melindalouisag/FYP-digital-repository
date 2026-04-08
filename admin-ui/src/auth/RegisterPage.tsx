import { Link, useNavigate } from "react-router-dom";

// Start OAuth directly. With CSRF enabled, Spring Security expects POST /logout,
// so using GET /logout?redirect=... can fail and bounce users back to /login.
const SSO_URL = "/oauth2/authorization/azure";

function RegisterPage() {
  const navigate = useNavigate();

  return (
    <div className="auth-shell">
      <div className="auth-card text-center">
        <div className="su-logo-circle mx-auto mb-3" style={{ width: "3.5rem", height: "3.5rem", fontSize: "1.1rem" }}>
          SU
        </div>
        <h1 className="h5 su-page-title mb-1">Sampoerna University</h1>
        <h2 className="h4 mb-2 fw-bold">Register</h2>

        <div className="p-3 mb-3" style={{ background: "#f0f6fa", borderRadius: "0.75rem", border: "1px solid #d5e3ed" }}>
          <div className="d-flex align-items-center justify-content-center gap-2 text-muted small mb-2">
            <InfoIcon />
            <strong>Institutional access</strong>
          </div>
          <p className="text-muted small mb-0">
            Register your account using your Sampoerna University email and create your profile before using the repository system.
          </p>
        </div>

        <div className="d-grid gap-2">
          <a className="btn btn-primary" style={{ borderRadius: "0.6rem" }} href={SSO_URL}>
            Register
          </a>

          <button className="btn btn-outline-secondary" style={{ borderRadius: "0.6rem" }} onClick={() => navigate("/login")}>
            Sign in
          </button>

          <Link className="btn btn-link text-muted" to="/" style={{ borderRadius: "0.6rem" }}>
            ← Back to Repository
          </Link>
        </div>
      </div>
    </div>
  );
}

function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      style={{ width: "0.9rem", height: "0.9rem", color: "#5d7387" }}
    >
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7.15v3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="4.8" r="0.8" fill="currentColor" />
    </svg>
  );
}

export default RegisterPage;

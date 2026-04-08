import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const SSO_URL = '/oauth2/authorization/azure';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const error = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const err = params.get("error");
    return err ? decodeURIComponent(err) : '';
  }, [location.search]);

  return (
    <div className="auth-shell">
      <div className="auth-card text-center">
        <div
          className="su-logo-circle mx-auto mb-3"
          style={{ width: "3.5rem", height: "3.5rem", fontSize: "1.1rem" }}
        >
          SU
        </div>
        <h1 className="h5 su-page-title mb-1">Sampoerna University</h1>
        <h2 className="h4 mb-3 fw-bold">Sign in</h2>

        {error && (
          <div className="alert alert-danger py-2" style={{ borderRadius: "0.6rem" }}>
            {error}
          </div>
        )}

        <div className="d-grid gap-2">
          <a
            className="btn btn-primary btn-lg"
            href={SSO_URL}
            style={{ fontSize: "0.95rem", borderRadius: "0.6rem", padding: "0.7rem" }}
          >
            Sign in with your Sampoerna University email
          </a>

          <div className="text-center mt-2">
            <button className="btn btn-link btn-sm text-muted" type="button" onClick={() => navigate("/")}>
              ← Back to repository
            </button>
          </div>
        </div>

        <hr className="my-3" />
        <div className="text-center">
          <small className="text-muted">First time here? </small>
          <button className="btn btn-link btn-sm p-0" type="button" onClick={() => navigate("/register")}>
            Register
          </button>
        </div>
      </div>
    </div>
  );
}

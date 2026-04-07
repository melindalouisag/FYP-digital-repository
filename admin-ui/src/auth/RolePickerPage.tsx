import { Navigate, useNavigate } from 'react-router-dom';
import { defaultPath, type Role } from '../lib/api/auth';
import { ApiError } from '../lib/api/http';
import { useAuth } from '../lib/context/AuthContext';
import { getRoleDisplayLabel } from '../lib/uiLabels';
import { useState } from 'react';

export default function RolePickerPage() {
  const navigate = useNavigate();
  const { user, selectRole } = useAuth();
  const [savingRole, setSavingRole] = useState<Role | null>(null);
  const [error, setError] = useState('');

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.roleSelectionRequired || user.availableRoles.length <= 1) {
    return <Navigate to={defaultPath(user.role)} replace />;
  }

  const chooseRole = async (role: Role) => {
    setSavingRole(role);
    setError('');
    try {
      const nextUser = await selectRole(role);
      navigate(defaultPath(nextUser.role), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to switch role.');
      }
    } finally {
      setSavingRole(null);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card text-center">
        <div
          className="su-logo-circle mx-auto mb-3"
          style={{ width: '3.5rem', height: '3.5rem', fontSize: '1.1rem' }}
        >
          SU
        </div>
        <h1 className="h5 su-page-title mb-1">Choose Role</h1>
        <p className="text-muted small mb-3">
          This account can access more than one area. Choose how you want to enter the repository.
        </p>

        {error && <div className="alert alert-danger py-2">{error}</div>}

        <div className="d-grid gap-2">
          {user.availableRoles.map((role) => (
            <button
              key={role}
              type="button"
              className={`btn ${role === 'ADMIN' ? 'btn-outline-primary' : 'btn-primary'}`}
            style={{ borderRadius: '0.6rem' }}
            onClick={() => void chooseRole(role)}
            disabled={savingRole !== null}
          >
            {savingRole === role ? 'Opening...' : getRoleDisplayLabel(role)}
          </button>
        ))}
      </div>
      </div>
    </div>
  );
}

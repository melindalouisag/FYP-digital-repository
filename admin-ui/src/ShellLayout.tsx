import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { notificationsApi } from './lib/api/notifications';
import ThemeSwitch from './theme/ThemeSwitch';
import type { NotificationItem } from './lib/workflowTypes';
import { useAuth } from './lib/context/AuthContext';
import { formatRoleList, getRoleDisplayLabel } from './lib/uiLabels';
import { useTheme } from './theme/ThemeContext';

interface ShellLayoutProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  sidebarBadges?: Partial<Record<string, number>>;
}

type LinkItem = {
  label: string;
  path: string;
  icon?: string; // path to PNG icon in /public/icons/
};

function roleLinks(role?: string): LinkItem[] {
  if (role === 'STUDENT') {
    return [
      { label: 'Dashboard', path: '/student/dashboard', icon: '/icons/student/dashboard.png' },
      { label: 'Register Publication', path: '/student/registrations', icon: '/icons/student/registration.png' },
      { label: 'Submission', path: '/student/submissions', icon: '/icons/student/submission.png' },
    ];
  }
  if (role === 'LECTURER') {
    return [
      { label: 'Dashboard', path: '/lecturer/dashboard', icon: '/icons/lecturer/dashboard.png' },
      { label: 'Registration Approval', path: '/lecturer/approvals', icon: '/icons/lecturer/maps-and-flags.png' },
      { label: 'Submission Review', path: '/lecturer/review', icon: '/icons/lecturer/submission.png' },
      { label: 'My Students', path: '/lecturer/students', icon: '/icons/lecturer/students.png' },
    ];
  }
  if (role === 'ADMIN') {
    return [
      { label: 'Dashboard', path: '/admin/dashboard', icon: '/icons/admin/dashboard.png' },
      { label: 'Registration', path: '/admin/registration-approvals', icon: '/icons/admin/registration.png' },
      { label: 'Submission Review', path: '/admin/review', icon: '/icons/admin/submission.png' },
      { label: 'Clearance', path: '/admin/clearance', icon: '/icons/admin/clearance.png' },
      { label: 'Publishing', path: '/admin/publish', icon: '/icons/admin/publishing.png' },
      { label: 'Templates', path: '/admin/checklists', icon: '/icons/admin/template.png' },
    ];
  }
  return [];
}

export default function ShellLayout({ title, children, sidebarBadges }: ShellLayoutProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const [, setNotificationStorageVersion] = useState(0);
  const accountRef = useRef<HTMLDivElement | null>(null);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const links = roleLinks(user?.role);
  const roleLabel = getRoleDisplayLabel(user?.role);
  const currentYear = new Date().getFullYear();
  const userId = user?.id ?? null;
  const userRole = user?.role ?? null;
  const initials = user?.fullName
    ? user.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? 'G';
  const availableRoles = user?.availableRoles ?? (user?.role ? [user.role] : []);
  const notificationStorageKey = user ? `su-notifications-last-seen:${user.id}:${user.role}` : null;
  const lastSeenAt = notificationStorageKey ? readLocalStorage(notificationStorageKey) : null;
  const shortDisplayName = useMemo(
    () => shortenDisplayName(user?.fullName, user?.email),
    [user?.email, user?.fullName]
  );
  const unreadCount = useMemo(
    () => countUnreadNotifications(notifications, lastSeenAt),
    [lastSeenAt, notifications]
  );

  useEffect(() => {
    if (!accountOpen && !notificationOpen) {
      return undefined;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (accountRef.current && !accountRef.current.contains(target)) {
        setAccountOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [accountOpen, notificationOpen]);

  useEffect(() => {
    if (!notificationOpen) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNotificationOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [notificationOpen]);

  useEffect(() => {
    if (userId == null || userRole == null) {
      return;
    }

    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) {
        return;
      }
      setNotificationsLoading(true);
      setNotificationsError('');
      try {
        const items = await notificationsApi.list();
        if (!active) {
          return;
        }
        setNotifications(items);
      } catch (error: unknown) {
        if (!active) {
          return;
        }
        setNotifications([]);
        setNotificationsError(error instanceof Error ? error.message : 'Failed to load notifications.');
      } finally {
        if (active) {
          setNotificationsLoading(false);
        }
      }
    });

    return () => {
      active = false;
    };
  }, [userId, userRole]);

  return (
    <div className="min-vh-100 d-flex flex-column">
      <header className="su-app-header sticky-top">
        <div className="container-fluid px-3 px-lg-4 py-2 d-flex flex-wrap align-items-center justify-content-between gap-2">
          <Link
            to="/"
            className="d-flex align-items-center gap-2 text-decoration-none su-repository-brand-link"
            aria-label="Go to Digital Repository home"
          >
            <div className="su-logo-circle">SU</div>
            <div>
              <div className="fw-semibold" style={{ fontSize: '0.95rem' }}>Sampoerna University</div>
              <div className="text-white-50" style={{ fontSize: '0.72rem' }}>Digital Repository</div>
            </div>
          </Link>
          <div className="d-flex align-items-center gap-3">
            <div className="d-flex align-items-center gap-2">
              <span className="small text-white-50">Dark mode</span>
              <ThemeSwitch
                checked={theme === 'dark'}
                onChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
            </div>
            <div className="su-header-menu" ref={notificationRef}>
              <button
                className="su-header-icon-button"
                type="button"
                aria-haspopup="dialog"
                aria-label="Open notifications"
                aria-expanded={notificationOpen}
                aria-controls="su-notification-popover"
                onClick={() => {
                  setAccountOpen(false);
                  setNotificationOpen((current) => {
                    const nextOpen = !current;
                    if (nextOpen && notificationStorageKey) {
                      writeLocalStorage(
                        notificationStorageKey,
                        newestNotificationTimestamp(notifications) ?? new Date().toISOString()
                      );
                      setNotificationStorageVersion((value) => value + 1);
                    }
                    return nextOpen;
                  });
                }}
              >
                <BellIcon />
                {unreadCount > 0 ? (
                  <span className="su-notification-badge">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                ) : null}
              </button>

              {notificationOpen ? (
                <div
                  className="su-header-popover su-notification-popover"
                  id="su-notification-popover"
                  role="dialog"
                  aria-label="Notifications"
                >
                  {notificationsError ? (
                    <div className="alert alert-warning py-2 small mb-0 mx-3 mt-2">{notificationsError}</div>
                  ) : null}

                  {notificationsLoading ? (
                    <div className="su-notification-empty">Loading notifications...</div>
                  ) : notifications.length === 0 ? (
                    <div className="su-notification-empty">No recent activity.</div>
                  ) : (
                    <div className="su-notification-list">
                      {notifications.map((item) => {
                        const unread = isUnreadNotification(item, lastSeenAt);
                        return (
                          <button
                            className="su-notification-item-button"
                            type="button"
                            key={`${item.eventType}-${item.caseId ?? 'general'}-${item.occurredAt ?? item.title}`}
                            onClick={() => {
                              const nextPath = resolveNotificationPath(user?.role, item);
                              setNotificationOpen(false);
                              if (nextPath) {
                                navigate(nextPath);
                              }
                            }}
                          >
                            <div className={`su-notification-item${unread ? ' is-unread' : ''}`}>
                              <div className="su-notification-item-title-row">
                                <div className="su-notification-item-title">{item.title}</div>
                                {unread ? <span className="su-notification-item-dot" aria-hidden="true" /> : null}
                              </div>
                              <div className="su-notification-item-detail" title={item.detail}>
                                {item.detail}
                              </div>
                              <div className="su-notification-item-meta">
                                {item.occurredAt ? new Date(item.occurredAt).toLocaleString() : 'N/A'}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="su-account-menu" ref={accountRef}>
              <button
                className="su-account-button"
                type="button"
                onClick={() => {
                  setNotificationOpen(false);
                  setAccountOpen((current) => !current);
                }}
                aria-expanded={accountOpen}
              >
                <span
                  className="rounded-circle d-inline-flex align-items-center justify-content-center"
                  style={{
                    width: '2rem', height: '2rem',
                    background: 'rgba(255,255,255,0.2)',
                    color: '#fff',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: '1.5px solid rgba(255,255,255,0.3)',
                  }}
                >
                  {initials}
                </span>
                <span className="text-start">
                  <span className="su-account-name">
                    {shortDisplayName}
                  </span>
                </span>
              </button>

              {accountOpen ? (
                <div className="su-header-popover su-account-popover">
                  <div className="su-account-popover-header">
                    <div className="su-account-name text-body">{user?.fullName || user?.email || 'Guest'}</div>
                    <div className="su-account-meta">{user?.email || 'No email available'}</div>
                  </div>
                  <div className="su-account-meta">Current role: {roleLabel}</div>
                  {availableRoles.length > 0 ? (
                    <div className="su-account-meta">
                      Available access: {formatRoleList(availableRoles)}
                    </div>
                  ) : null}
                  <button
                    className="btn btn-outline-secondary btn-sm mt-3"
                    type="button"
                    onClick={() => void logout()}
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="container-fluid flex-grow-1">
        <div className="row min-vh-100">
          <aside className="col-12 col-lg-3 col-xl-2 su-sidebar p-3 p-lg-4">
            <nav className="nav flex-column gap-1">
              {links.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  end={link.path === '/'}
                  className={({ isActive }) => `nav-link text-start d-flex align-items-center gap-2 ${isActive ? 'active' : ''}`}
                >
                  {link.icon ? (
                    <img
                      src={link.icon}
                      alt=""
                      className="su-sidebar-icon-img"
                      style={{
                        width: '20px',
                        height: '20px',
                        objectFit: 'contain',
                        opacity: 0.7,
                        filter: theme === 'dark' ? 'invert(1)' : 'none',
                      }}
                    />
                  ) : (
                    <span className="su-sidebar-link-bullet" aria-hidden="true" />
                  )}
                  <span className="su-sidebar-link-label">{link.label}</span>
                  {(sidebarBadges?.[link.path] ?? 0) > 0 ? (
                    <span className="su-sidebar-count-badge" aria-label={`${sidebarBadges?.[link.path]} pending`}>
                      {sidebarBadges?.[link.path]}
                    </span>
                  ) : null}
                </NavLink>
              ))}
            </nav>
          </aside>

          <main className="col-12 col-lg-9 col-xl-10 p-3 p-lg-4 fade-in">
            <div className="mb-4">
              <h2 className="mb-1 su-page-title" style={{ fontSize: '1.5rem' }}>{title}</h2>
            </div>
            {children}
          </main>
        </div>
      </div>

      <footer className="border-top py-3 text-center text-muted small">
        <div className="fw-semibold">Sampoerna University Library</div>
        <div>For support contact: Library support desk</div>
        <div>© {currentYear}</div>
      </footer>
    </div>
  );
}

function countUnreadNotifications(items: NotificationItem[], lastSeenAt: string | null) {
  if (!lastSeenAt) {
    return items.length;
  }
  const lastSeenValue = Date.parse(lastSeenAt) || 0;
  return items.filter((item) => {
    if (!item.occurredAt) {
      return true;
    }
    return (Date.parse(item.occurredAt) || 0) > lastSeenValue;
  }).length;
}

function newestNotificationTimestamp(items: NotificationItem[]) {
  return items.reduce<string | null>((latest, item) => {
    if (!item.occurredAt) {
      return latest;
    }
    if (!latest) {
      return item.occurredAt;
    }
    return (Date.parse(item.occurredAt) || 0) > (Date.parse(latest) || 0)
      ? item.occurredAt
      : latest;
  }, null);
}

function isUnreadNotification(item: NotificationItem, lastSeenAt: string | null) {
  if (!lastSeenAt || !item.occurredAt) {
    return !lastSeenAt;
  }
  return (Date.parse(item.occurredAt) || 0) > (Date.parse(lastSeenAt) || 0);
}

function readLocalStorage(key: string) {
  try {
    if (typeof window === 'undefined' || typeof window.localStorage?.getItem !== 'function') {
      return null;
    }
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string) {
  try {
    if (typeof window === 'undefined' || typeof window.localStorage?.setItem !== 'function') {
      return;
    }
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage write failures in restricted or test environments.
  }
}

function shortenDisplayName(fullName?: string, email?: string) {
  const source = fullName?.trim() || email?.trim() || 'Guest';
  const words = source.split(/\s+/).filter(Boolean);
  const compact = words.length > 1 ? words.slice(0, 2).join(' ') : source;
  return compact.length <= 18 ? compact : `${compact.slice(0, 15).trimEnd()}...`;
}

function resolveNotificationPath(role: string | undefined, item: NotificationItem) {
  if (role === 'STUDENT' && item.caseId) {
    switch (item.eventType) {
      case 'SUPERVISOR_REJECTED_REGISTRATION':
      case 'LIBRARY_REJECTED_REGISTRATION':
        return `/student/registrations/${item.caseId}/edit`;
      case 'SUPERVISOR_REQUESTED_REVISION':
      case 'LIBRARY_REQUESTED_REVISION':
      case 'UNPUBLISHED_FOR_CORRECTION':
        return `/student/cases/${item.caseId}/submission`;
      case 'CLEARANCE_CORRECTION_REQUESTED':
        return `/student/clearance/${item.caseId}`;
      case 'LIBRARY_APPROVED_REGISTRATION':
        return `/student/cases/${item.caseId}/submission`;
      default:
        return `/student/cases/${item.caseId}`;
    }
  }

  if (role === 'LECTURER') {
    switch (item.eventType) {
      case 'REGISTRATION_SUBMITTED':
        return '/lecturer/approvals';
      case 'SUBMISSION_UPLOADED':
        return '/lecturer/review';
      case 'LIBRARY_REQUESTED_REVISION':
      case 'LIBRARY_APPROVED_FOR_CLEARANCE':
      case 'PUBLISHED':
        return '/lecturer/library';
      default:
        return '/lecturer/dashboard';
    }
  }

  if (role === 'ADMIN') {
    switch (item.eventType) {
      case 'SUPERVISOR_APPROVED_REGISTRATION':
        return '/admin/registration-approvals';
      case 'SUPERVISOR_FORWARDED_TO_LIBRARY':
      case 'SUBMISSION_UPLOADED':
        return item.caseId ? `/admin/review/${item.caseId}` : '/admin/review';
      case 'CLEARANCE_SUBMITTED':
        return '/admin/clearance';
      default:
        return '/admin/dashboard';
    }
  }

  return '/';
}

function BellIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="su-header-icon-svg">
      <path
        d="M10 3.25a3.75 3.75 0 0 0-3.75 3.75v1.2c0 .88-.27 1.74-.78 2.46l-.92 1.31a1.2 1.2 0 0 0 .98 1.88h9.04a1.2 1.2 0 0 0 .98-1.88l-.92-1.31A4.25 4.25 0 0 1 13.75 8.2V7A3.75 3.75 0 0 0 10 3.25Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8.2 15.55a1.95 1.95 0 0 0 3.6 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

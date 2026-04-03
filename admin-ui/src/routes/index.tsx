import { Suspense, lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../lib/context/AuthContext';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleGuard } from './RoleGuard';

const LoginPage = lazy(() => import('../auth/LoginPage'));
const RegisterPage = lazy(() => import('../auth/RegisterPage'));
const OnboardingPage = lazy(() => import('../auth/OnboardingPage'));
const RolePickerPage = lazy(() => import('../auth/RolePickerPage'));
const RepositorySearchPage = lazy(() => import('../repository/pages/RepositorySearch'));
const RepositoryDetailPage = lazy(() => import('../repository/pages/RepositoryDetail'));
const PortalCalendarPage = lazy(() => import('../calendar/pages/PortalCalendarPage'));

const StudentDashboardPage = lazy(() => import('../student/pages/StudentDashboardPage'));
const StudentRegistrationsPage = lazy(() => import('../student/pages/StudentRegistrationsPage'));
const StudentRegistrationNewPage = lazy(() => import('../student/pages/StudentRegistrationNewPage'));
const StudentSubmissionsPage = lazy(() => import('../student/pages/StudentSubmissionsPage'));
const StudentCaseDetailPage = lazy(() => import('../student/pages/StudentCaseDetailPage'));
const StudentCaseSubmissionPage = lazy(() => import('../student/pages/StudentCaseSubmissionPage'));
const StudentSubmissionHistoryPage = lazy(() => import('../student/pages/StudentSubmissionHistoryPage'));
const StudentFeedbackPage = lazy(() => import('../student/pages/StudentFeedbackPage'));
const StudentClearanceDetailPage = lazy(() => import('../student/pages/StudentClearanceDetailPage'));

const LecturerDashboardPage = lazy(() => import('../lecturer/pages/LecturerDashboardPage'));
const LecturerApprovalsPage = lazy(() => import('../lecturer/pages/LecturerApprovalsPage'));
const LecturerReviewPage = lazy(() => import('../lecturer/pages/LecturerReviewPage'));
const LecturerStudentsPage = lazy(() => import('../lecturer/pages/LecturerStudentsPage'));
const LecturerLibraryTrackingPage = lazy(() => import('../lecturer/pages/LecturerLibraryTrackingPage'));
const LecturerStudentDetailPage = lazy(() => import('../lecturer/pages/LecturerStudentDetailPage'));

const AdminDashboardPage = lazy(() => import('../admin/pages/AdminDashboardPage'));
const AdminRegistrationApprovalsPage = lazy(() => import('../admin/pages/AdminRegistrationApprovalsPage'));
const AdminReviewPage = lazy(() => import('../admin/pages/AdminReviewPage'));
const AdminReviewDetailPage = lazy(() => import('../admin/pages/AdminReviewDetailPage'));
const AdminReviewStudentPage = lazy(() => import('../admin/pages/AdminReviewStudentPage'));
const AdminClearancePage = lazy(() => import('../admin/pages/AdminClearancePage'));
const AdminPublishPage = lazy(() => import('../admin/pages/AdminPublishPage'));
const AdminPublishDetailPage = lazy(() => import('../admin/pages/AdminPublishDetailPage'));
const AdminChecklistPage = lazy(() => import('../admin/pages/AdminChecklistPage'));
const AdminChecklistEditorPage = lazy(() => import('../admin/pages/AdminChecklistEditorPage'));

const ROUTE_PATHS = {
  LECTURER_REVIEW: '/lecturer/review',
  LECTURER_STUDENT_DETAIL: '/lecturer/students/:studentId',
} as const;

const REQUIRED_LECTURER_ROUTES = [ROUTE_PATHS.LECTURER_REVIEW, ROUTE_PATHS.LECTURER_STUDENT_DETAIL];
if (REQUIRED_LECTURER_ROUTES.some((path) => !path.startsWith('/lecturer/'))) {
  throw new Error('Lecturer route guard misconfigured');
}

type AppRole = 'STUDENT' | 'LECTURER' | 'ADMIN';

type RouteConfig = {
  path: string;
  element: ReactNode;
};

function RouteLoadingFallback() {
  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '40vh' }}>
      <div className="text-center">
        <div className="su-spinner mx-auto mb-3" />
        <div className="text-muted">Loading page...</div>
      </div>
    </div>
  );
}

function withSuspense(element: ReactNode) {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      {element}
    </Suspense>
  );
}

export function AppRoutes() {
  const { user, loading } = useAuth();

  const protectedElement = (element: ReactNode, allowedRoles?: AppRole[]) => (
    <ProtectedRoute user={user} loading={loading}>
      {allowedRoles ? (
        <RoleGuard user={user} allowedRoles={allowedRoles}>
          {element}
        </RoleGuard>
      ) : (
        element
      )}
    </ProtectedRoute>
  );

  const publicRoutes: RouteConfig[] = [
    { path: '/', element: withSuspense(<RepositorySearchPage />) },
    { path: '/repo/:id', element: withSuspense(<RepositoryDetailPage />) },
    { path: '/login', element: withSuspense(<LoginPage />) },
    { path: '/register', element: withSuspense(<RegisterPage />) },
    { path: '/choose-role', element: withSuspense(protectedElement(<RolePickerPage />)) },
    { path: '/onboarding', element: withSuspense(protectedElement(<OnboardingPage />)) },
  ];

  const studentRoutes: RouteConfig[] = [
    { path: '/student/dashboard', element: withSuspense(protectedElement(<StudentDashboardPage />, ['STUDENT'])) },
    { path: '/student/calendar', element: withSuspense(protectedElement(<PortalCalendarPage />, ['STUDENT'])) },
    { path: '/student/registrations', element: withSuspense(protectedElement(<StudentRegistrationsPage />, ['STUDENT'])) },
    { path: '/student/registrations/new', element: withSuspense(protectedElement(<StudentRegistrationNewPage />, ['STUDENT'])) },
    { path: '/student/registrations/:caseId/edit', element: withSuspense(protectedElement(<StudentRegistrationNewPage />, ['STUDENT'])) },
    { path: '/student/submissions', element: withSuspense(protectedElement(<StudentSubmissionsPage />, ['STUDENT'])) },
    { path: '/student/cases/:caseId', element: withSuspense(protectedElement(<StudentCaseDetailPage />, ['STUDENT'])) },
    { path: '/student/cases/:caseId/submission', element: withSuspense(protectedElement(<StudentCaseSubmissionPage />, ['STUDENT'])) },
    { path: '/student/cases/:caseId/submissions/history', element: withSuspense(protectedElement(<StudentSubmissionHistoryPage />, ['STUDENT'])) },
    { path: '/student/cases/:caseId/feedback', element: withSuspense(protectedElement(<StudentFeedbackPage />, ['STUDENT'])) },
    { path: '/student/clearance/:caseId', element: withSuspense(protectedElement(<StudentClearanceDetailPage />, ['STUDENT'])) },
  ];

  const lecturerRoutes: RouteConfig[] = [
    { path: '/lecturer/dashboard', element: withSuspense(protectedElement(<LecturerDashboardPage />, ['LECTURER'])) },
    { path: '/lecturer/calendar', element: withSuspense(protectedElement(<PortalCalendarPage />, ['LECTURER'])) },
    { path: '/lecturer/approvals', element: withSuspense(protectedElement(<LecturerApprovalsPage />, ['LECTURER'])) },
    { path: ROUTE_PATHS.LECTURER_REVIEW, element: withSuspense(protectedElement(<LecturerReviewPage />, ['LECTURER'])) },
    { path: '/lecturer/library', element: withSuspense(protectedElement(<LecturerLibraryTrackingPage />, ['LECTURER'])) },
    { path: '/lecturer/students', element: withSuspense(protectedElement(<LecturerStudentsPage />, ['LECTURER'])) },
    { path: ROUTE_PATHS.LECTURER_STUDENT_DETAIL, element: withSuspense(protectedElement(<LecturerStudentDetailPage />, ['LECTURER'])) },
  ];

  const adminRoutes: RouteConfig[] = [
    { path: '/admin/dashboard', element: withSuspense(protectedElement(<AdminDashboardPage />, ['ADMIN'])) },
    { path: '/admin/calendar', element: withSuspense(protectedElement(<PortalCalendarPage />, ['ADMIN'])) },
    {
      path: '/admin',
      element: withSuspense(
        protectedElement(<Navigate to="/admin/dashboard" replace />, ['ADMIN'])
      ),
    },
    { path: '/admin/registration-approvals', element: withSuspense(protectedElement(<AdminRegistrationApprovalsPage />, ['ADMIN'])) },
    { path: '/admin/review', element: withSuspense(protectedElement(<AdminReviewPage />, ['ADMIN'])) },
    { path: '/admin/review/students/:studentUserId', element: withSuspense(protectedElement(<AdminReviewStudentPage />, ['ADMIN'])) },
    { path: '/admin/review/:caseId', element: withSuspense(protectedElement(<AdminReviewDetailPage />, ['ADMIN'])) },
    { path: '/admin/clearance', element: withSuspense(protectedElement(<AdminClearancePage />, ['ADMIN'])) },
    { path: '/admin/publish', element: withSuspense(protectedElement(<AdminPublishPage />, ['ADMIN'])) },
    { path: '/admin/publish/:caseId', element: withSuspense(protectedElement(<AdminPublishDetailPage />, ['ADMIN'])) },
    { path: '/admin/checklists', element: withSuspense(protectedElement(<AdminChecklistPage />, ['ADMIN'])) },
    { path: '/admin/checklists/:templateId/edit', element: withSuspense(protectedElement(<AdminChecklistEditorPage />, ['ADMIN'])) },
  ];

  return (
    <Routes>
      {[...publicRoutes, ...studentRoutes, ...lecturerRoutes, ...adminRoutes].map((route) => (
        <Route key={route.path} path={route.path} element={route.element} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

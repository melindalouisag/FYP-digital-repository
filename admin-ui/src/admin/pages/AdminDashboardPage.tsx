import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShellLayout from '../../layout/ShellLayout';
import { adminApi } from '../../lib/api/admin';
import DashboardMetricCard from '../../lib/components/DashboardMetricCard';
import { adminSidebarIcons } from '../../lib/portalIcons';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [registrationCount, setRegistrationCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [clearanceCount, setClearanceCount] = useState(0);
  const [publishCount, setPublishCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [registrations, review, clearance, publish] = await Promise.all([
          adminApi.registrationApprovals(),
          adminApi.reviewQueue({ page: 0, size: 1 }),
          adminApi.clearanceQueue(),
          adminApi.publishQueue({ page: 0, size: 1 }),
        ]);
        setRegistrationCount(registrations.totalElements);
        setReviewCount(review.totalElements);
        setClearanceCount(clearance.totalElements);
        setPublishCount(publish.totalElements);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load admin dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const cards = [
    { label: 'Registration', value: registrationCount, icon: adminSidebarIcons.registration, color: '#e0f2fe', path: '/admin/registration-approvals', desc: 'Pending registration verifications' },
    { label: 'Submission Review', value: reviewCount, icon: adminSidebarIcons.submission, color: '#fff3cd', path: '/admin/review', desc: 'Submissions awaiting checklist review' },
    { label: 'Clearance', value: clearanceCount, icon: adminSidebarIcons.clearance, color: '#ede9fe', path: '/admin/clearance', desc: 'Clearance forms pending approval' },
    { label: 'Publishing', value: publishCount, icon: adminSidebarIcons.publishing, color: '#d1e7dd', path: '/admin/publish', desc: 'Ready to publish to repository' },
  ];

  const totalPending = registrationCount + reviewCount + clearanceCount + publishCount;

  return (
    <ShellLayout title="Admin Dashboard" subtitle="Library administration overview for registration, review, clearance, and publishing">
      {error && <div className="alert alert-danger">{error}</div>}

      {/* Total summary banner */}
      {!loading && totalPending > 0 && (
        <div className="alert d-flex align-items-center gap-2 mb-4 fade-in"
          style={{ background: '#e0f7fa', border: '1px solid #b2ebf2', borderRadius: '0.75rem', color: '#00695c' }}>
          <div>
            <strong>{totalPending} total item{totalPending > 1 ? 's' : ''}</strong> across all queues require your attention.
          </div>
        </div>
      )}

      <div className="row g-3">
        {cards.map((card, index) => (
          <div className="col-md-6 col-xl-3 d-flex" key={card.path}>
            <DashboardMetricCard
              iconSrc={card.icon}
              iconBackground={card.color}
              value={loading ? '—' : card.value}
              label={card.label}
              description={card.desc}
              className="fade-in"
              role="button"
              onClick={() => navigate(card.path)}
              style={{ animationDelay: `${index * 0.08}s` }}
            />
          </div>
        ))}
      </div>
    </ShellLayout>
  );
}

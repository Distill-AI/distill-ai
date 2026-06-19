import { useNavigate, useLocation } from 'react-router-dom';
import { useRole } from '../hooks/useRole';
import type { Role } from '../context/RoleContext';

const ROLES: { value: Role; label: string; description: string }[] = [
  {
    value: 'RevOps',
    label: 'RevOps',
    description: 'Full access — inbox, quotes, catalog, analytics. Demo persona: Avery Reed.',
  },
  {
    value: 'Sales',
    label: 'Sales',
    description: 'Inbox and quotes only — no catalog access or analytics.',
  },
  {
    value: 'Admin',
    label: 'Admin',
    description: 'Full access + future admin controls. Same as RevOps in V1.',
  },
];

const SALES_RESTRICTED = ['/catalog', '/analytics'];

const THRESHOLDS = [
  { label: 'Auto-approve threshold', value: '≥ 95%', env: 'AUTO_THRESHOLD' },
  { label: 'Review threshold', value: '≥ 70%', env: 'MATCH_THRESHOLD' },
  { label: 'Auto-send cap', value: '£3,000', env: 'AUTO_SEND_CAP' },
];

export function Settings() {
  const { role, setRole } = useRole();
  const navigate = useNavigate();
  const location = useLocation();

  function handleRoleChange(next: Role) {
    setRole(next);
    if (next === 'Sales' && SALES_RESTRICTED.includes(location.pathname)) {
      navigate('/');
    }
  }

  return (
    <div className="px-6 py-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Settings</h1>

      {/* Role switcher */}
      <section className="bg-surface border border-border rounded-card p-5 mb-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Demo role</h2>
        <p className="text-sm text-body-text mb-4">
          Switch persona to see which nav items and views are available to each role.
        </p>
        <div className="flex gap-3 mb-4">
          {ROLES.map(({ value, label }) => (
            <label
              key={value}
              className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-900"
            >
              <input
                type="radio"
                name="role"
                value={value}
                checked={role === value}
                onChange={() => handleRoleChange(value)}
                className="accent-indigo-600"
              />
              {label}
            </label>
          ))}
        </div>
        {ROLES.filter((r) => r.value === role).map(({ value, description }) => (
          <p key={value} className="text-sm text-body-text">
            <span className="font-medium text-slate-900">{role}</span> — {description}
          </p>
        ))}
      </section>

      {/* Confidence thresholds — read-only in V1 */}
      <section className="bg-surface border border-border rounded-card p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Confidence thresholds</h2>
        <p className="text-sm text-body-text mb-4">
          These control auto-approval and review routing. Configured via environment variables.
        </p>
        <ul className="space-y-3">
          {THRESHOLDS.map(({ label, value, env }) => (
            <li key={env} className="flex items-center justify-between text-sm">
              <span className="text-body-text">{label}</span>
              <span className="flex items-center gap-3">
                <span className="font-medium text-slate-900">{value}</span>
                <code className="text-xs text-muted font-mono">{env}</code>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

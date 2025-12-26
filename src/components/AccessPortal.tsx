import { useMemo, useState, type FormEvent } from 'react';
import Button from './Button';
import { cn } from '../lib/cn';
import { useEffect } from 'react';

type Role = 'company' | 'pro';
type Mode = 'login' | 'register';

type Field = {
  name: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'email' | 'password' | 'tel';
};

type FormValues = Record<
  Role,
  {
    login: Record<string, string>;
    register: Record<string, string>;
  }
>;

const loginFields: Record<Role, Field[]> = {
  company: [
    { name: 'email', label: 'Email', placeholder: 'firm@example.com', type: 'email' },
    { name: 'password', label: 'Password', placeholder: '********', type: 'password' },
  ],
  pro: [
    { name: 'email', label: 'Email', placeholder: 'pro@example.com', type: 'email' },
    { name: 'password', label: 'Password', placeholder: '********', type: 'password' },
  ],
};

const registerFields: Record<Role, Field[]> = {
  company: [
    { name: 'companyName', label: 'Company name', placeholder: 'Volt Electric' },
    { name: 'email', label: 'Email', placeholder: 'firm@example.com', type: 'email' },
    { name: 'phone', label: 'Phone', placeholder: '+1 555 123 4567', type: 'tel' },
    { name: 'password', label: 'Password', placeholder: '********', type: 'password' },
  ],
  pro: [
    { name: 'fullName', label: 'Full name', placeholder: 'Your full name' },
    { name: 'email', label: 'Email', placeholder: 'pro@example.com', type: 'email' },
    { name: 'phone', label: 'Phone', placeholder: '+1 555 123 4567', type: 'tel' },
    { name: 'password', label: 'Password', placeholder: '********', type: 'password' },
  ],
};

const roleLabels: Record<Role, string> = {
  company: 'Company',
  pro: 'Pro',
};

const buildDefaults = (): FormValues => {
  const reduceToDefaults = (fields: Field[]) =>
    fields.reduce<Record<string, string>>((acc, field) => {
      acc[field.name] = '';
      return acc;
    }, {});

  return {
    company: {
      login: reduceToDefaults(loginFields.company),
      register: reduceToDefaults(registerFields.company),
    },
    pro: {
      login: reduceToDefaults(loginFields.pro),
      register: reduceToDefaults(registerFields.pro),
    },
  };
};

interface AccessPortalProps {
  variant?: 'floating' | 'stacked';
  onClose?: () => void;
  initialRole?: Role;
  initialMode?: Mode;
}

export default function AccessPortal({
  variant = 'floating',
  onClose,
  initialRole = 'company',
  initialMode = 'login',
}: AccessPortalProps) {
  const [activeRole, setActiveRole] = useState<Role>(initialRole);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [formValues, setFormValues] = useState<FormValues>(() => buildDefaults());
  const [status, setStatus] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profileData, setProfileData] = useState({
    services: ['Electrical'],
    regions: ['New York'],
    capacity: 5,
    notifyEmail: true,
    notifySms: false,
    notes: '',
  });

  const serviceOptions = ['Electrical', 'HVAC', 'Plumbing', 'Roofing', 'Remodeling', 'Cleaning', 'Landscaping'];
  const regionOptions = ['New York', 'New Jersey', 'Connecticut', 'Remote'];

  const activeFields = useMemo(
    () => (mode === 'login' ? loginFields[activeRole] : registerFields[activeRole]),
    [activeRole, mode],
  );

  const currentValues = formValues[activeRole][mode];

  const handleInputChange = (name: string, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [activeRole]: {
        ...prev[activeRole],
        [mode]: {
          ...prev[activeRole][mode],
          [name]: value,
        },
      },
    }));
    setStatus(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(mode === 'login' ? 'Sign-in request captured' : 'Signup request captured');
    console.log('[Portal draft]', { role: activeRole, mode, payload: formValues[activeRole][mode] });
    setIsAuthenticated(true);
  };

  useEffect(() => {
    setActiveRole(initialRole);
  }, [initialRole]);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const containerClasses = cn(
    'relative overflow-hidden rounded-2xl border border-slate-200 shadow-[0_16px_50px_rgba(15,23,42,0.12)] max-w-xl w-full mx-auto',
    variant === 'floating' ? 'bg-white/85 backdrop-blur-xl' : 'bg-white',
  );

  return (
    <div className={containerClasses}>
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.06),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.06),transparent_38%)]" />
      <div className="relative space-y-4 p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-slate-500">Pro Portal</p>
            <h3 className="text-lg font-bold text-slate-900">{mode === 'login' ? 'Sign In' : 'Create Account'}</h3>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300 transition"
              aria-label="Close"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-slate-100/80 p-1 border border-slate-200">
          {(['login', 'register'] as Mode[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                'flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all',
                mode === value
                  ? 'bg-white shadow-sm shadow-sky-500/10 text-slate-900 border border-white'
                  : 'text-slate-500',
              )}
            >
              {value === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/90 border border-slate-200 p-1 shadow-sm">
          {(['company', 'pro'] as Role[]).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setActiveRole(role)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all',
                activeRole === role
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/20'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              {roleLabels[role]}
            </button>
          ))}
        </div>

        {!isAuthenticated ? (
          <>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
                {activeFields.map((field) => (
                  <label key={`${mode}-${activeRole}-${field.name}`} className="space-y-1.5 text-sm">
                    <span className="font-semibold text-slate-800">{field.label}</span>
                    <input
                      type={field.type || 'text'}
                      value={currentValues[field.name] || ''}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white/95 px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition"
                      required
                    />
                  </label>
                ))}
              </div>

              <Button type="submit" size="md" className="w-full">
                {mode === 'login' ? 'Sign In' : 'Sign Up'}
              </Button>
            </form>

            {status && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-inner">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>{status}</span>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-inner">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Profile setup</p>
                  <h4 className="text-base font-bold text-slate-900">Complete your profile</h4>
                </div>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-1">
                  Live
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-2">Services</p>
                  <div className="flex flex-wrap gap-2">
                    {serviceOptions.map((svc) => {
                      const active = profileData.services.includes(svc);
                      return (
                        <button
                          key={svc}
                          type="button"
                          onClick={() =>
                            setProfileData((prev) => ({
                              ...prev,
                              services: active
                                ? prev.services.filter((s) => s !== svc)
                                : [...prev.services, svc],
                            }))
                          }
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-semibold border transition',
                            active
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                          )}
                        >
                          {svc}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-2">Regions</p>
                  <div className="flex flex-wrap gap-2">
                    {regionOptions.map((reg) => {
                      const active = profileData.regions.includes(reg);
                      return (
                        <button
                          key={reg}
                          type="button"
                          onClick={() =>
                            setProfileData((prev) => ({
                              ...prev,
                              regions: active
                                ? prev.regions.filter((r) => r !== reg)
                                : [...prev.regions, reg],
                            }))
                          }
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-semibold border transition',
                            active
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                          )}
                        >
                          {reg}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="space-y-1.5 text-sm">
                    <span className="font-semibold text-slate-800">Daily capacity</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={profileData.capacity}
                      onChange={(e) =>
                        setProfileData((prev) => ({ ...prev, capacity: Number(e.target.value) }))
                      }
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white/95 px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition"
                    />
                  </label>

                  <div className="space-y-2 text-sm">
                    <p className="font-semibold text-slate-800">Notifications</p>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={profileData.notifyEmail}
                        onChange={(e) =>
                          setProfileData((prev) => ({ ...prev, notifyEmail: e.target.checked }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                      />
                      <span className="text-slate-700 text-sm">Email alerts</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={profileData.notifySms}
                        onChange={(e) =>
                          setProfileData((prev) => ({ ...prev, notifySms: e.target.checked }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                      />
                      <span className="text-slate-700 text-sm">SMS alerts</span>
                    </label>
                  </div>
                </div>

                <label className="space-y-1.5 text-sm">
                  <span className="font-semibold text-slate-800">Notes</span>
                  <textarea
                    value={profileData.notes}
                    onChange={(e) => setProfileData((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Equipment, certifications, on-call hours..."
                    className="w-full rounded-xl border border-slate-200 bg-white/95 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition"
                    rows={3}
                  />
                </label>

                <Button
                  type="button"
                  size="md"
                  className="w-full"
                  onClick={() => {
                    console.log('[Profile saved]', { role: activeRole, profileData });
                    setStatus('Profile saved. You can start receiving jobs.');
                  }}
                >
                  Save profile
                </Button>
              </div>
            </div>

            {status && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-inner">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>{status}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

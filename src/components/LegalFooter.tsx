import { useMemo, useState, type ReactNode } from 'react';
import LegalModal from './LegalModal';

type ModalKey = 'privacy' | 'terms' | 'donotsell' | 'contact' | 'about' | 'ca' | 'cookies';

const ADDRESS = '34 N Franklin Ave Ste 687 2541, Pinedale, WY 82941';
const EMAIL = 'info@miyomint.com.tr';

const FooterButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="text-xs sm:text-sm font-medium text-slate-600 hover:text-sky-600 transition-colors"
  >
    {label}
  </button>
);

const MODALS: Record<ModalKey, { title: string; body: ReactNode }> = {
  privacy: {
    title: 'Privacy Policy',
    body: (
      <div className="space-y-4 text-sm text-slate-700">
        <p className="font-semibold">Effective date: June 5, 2024</p>
        <p>We collect contact information, project details, ZIP code, and device/usage data to deliver quotes, improve the site, and meet compliance requirements.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>We share information with licensed partners who help fulfill your requests.</li>
          <li>Vetted vendors only receive the minimum data needed.</li>
          <li>We never sell personal information.</li>
        </ul>
        <p>Manage cookies through your browser settings.</p>
      </div>
    ),
  },
  terms: {
    title: 'Terms of Use',
    body: (
      <div className="space-y-3 text-sm text-slate-700">
        <p>By using miyomint.com you agree to provide accurate information and use the platform for legitimate home-service requests.</p>
        <p>The service is provided "as-is" without warranties.</p>
      </div>
    ),
  },
  donotsell: {
    title: 'Do Not Sell My Personal Information',
    body: (
      <div className="space-y-2 text-sm text-slate-700">
        <p>MIYOMINT does not sell personal data.</p>
        <p>Formal requests: <a href={`mailto:${EMAIL}`} className="text-sky-600 hover:underline">{EMAIL}</a></p>
      </div>
    ),
  },
  contact: {
    title: 'Contact Us',
    body: (
      <div className="space-y-2 text-sm text-slate-700">
        <p>Email: {EMAIL}</p>
        <p>Mail: {ADDRESS}</p>
        <p>We respond within one business day.</p>
      </div>
    ),
  },
  about: {
    title: 'About Us',
    body: (
      <div className="space-y-2 text-sm text-slate-700">
        <p>MIYOMINT connects homeowners with licensed contractors nationwide. Free to use, partners may compensate us for successful matches.</p>
      </div>
    ),
  },
  ca: {
    title: 'California Privacy Choices',
    body: (
      <div className="space-y-3 text-sm text-slate-700">
        <ul className="list-disc pl-5 space-y-1">
          <li>Request your data</li>
          <li>Request deletion</li>
          <li>Opt-out of sharing</li>
        </ul>
        <p>Email requests: {EMAIL}</p>
      </div>
    ),
  },
  cookies: {
    title: 'Cookies & Technology',
    body: (
      <div className="space-y-2 text-sm text-slate-700">
        <p>We use essential, functional, and analytics cookies.</p>
        <p>You can disable cookies any time in your browser.</p>
      </div>
    ),
  },
};

export default function LegalFooter() {
  const [openModal, setOpenModal] = useState<ModalKey | null>(null);
  const modalEntries = useMemo(() => Object.entries(MODALS) as [ModalKey, { title: string; body: ReactNode }][], []);

  return (
    <>
      <footer className="relative z-50 mt-auto bg-white border-t border-slate-200 shrink-0">

        {/* ❌ MOBİLDE KAYAN YORUMLAR TAMAMEN KALDIRILDI */}

        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <FooterButton label="Privacy Policy" onClick={() => setOpenModal('privacy')} />
            <span className="text-slate-300">•</span>
            <FooterButton label="Terms" onClick={() => setOpenModal('terms')} />
            <span className="text-slate-300">•</span>
            <FooterButton label="Do Not Sell" onClick={() => setOpenModal('donotsell')} />
            <span className="text-slate-300">•</span>
            <FooterButton label="Contact" onClick={() => setOpenModal('contact')} />
          </div>

          <div className="text-center mt-2 text-[11px] text-slate-500">
            {EMAIL}
          </div>
        </div>
      </footer>

      {modalEntries.map(([key, { title, body }]) => (
        <LegalModal
          key={key}
          title={title}
          open={openModal === key}
          onClose={() => setOpenModal(null)}
        >
          {body}
        </LegalModal>
      ))}
    </>
  );
}

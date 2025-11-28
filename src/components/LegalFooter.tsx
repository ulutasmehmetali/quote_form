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
          <li>Vetted vendors (hosting, analytics, customer support) only receive the minimum data needed.</li>
          <li>We never sell personal information.</li>
        </ul>
        <p>Manage cookies in your browser or visit <a href="http://optout.aboutads.info" className="text-sky-600 hover:underline">optout.aboutads.info</a> to control ad tracking.</p>
        <p>California residents can request access, deletion, or opt-out via <a href={`mailto:${EMAIL}`} className="text-sky-600 hover:underline">{EMAIL}</a>.</p>
      </div>
    ),
  },
  terms: {
    title: 'Terms of Use',
    body: (
      <div className="space-y-3 text-sm text-slate-700">
        <p>By using miyomint.com you agree to provide accurate information, use the platform for legitimate home-service requests, and respect all intellectual property.</p>
        <p>The service is provided "as-is" without warranties. Liability is limited to the maximum extent permitted by law.</p>
      </div>
    ),
  },
  donotsell: {
    title: 'Do Not Sell My Personal Information',
    body: (
      <div className="space-y-2 text-sm text-slate-700">
        <p>MIYOMINT does not sell personal information.</p>
        <p>To record a formal opt-out, email <a href={`mailto:${EMAIL}`} className="text-sky-600 hover:underline">{EMAIL}</a> with the subject "Do Not Sell Request."</p>
      </div>
    ),
  },
  contact: {
    title: 'Contact Us',
    body: (
      <div className="space-y-2 text-sm text-slate-700">
        <p>Email: {EMAIL}</p>
        <p>Mail: {ADDRESS}</p>
        <p>We respond to most inquiries within one business day.</p>
      </div>
    ),
  },
  about: {
    title: 'About Us',
    body: (
      <div className="space-y-2 text-sm text-slate-700">
        <p>MIYOMINT partners with licensed contractors and agency networks across all 50 states to deliver premium home-service quotes. Our service is free to use, and we may be compensated by partners when matches are successful.</p>
      </div>
    ),
  },
  ca: {
    title: 'California Privacy Choices',
    body: (
      <div className="space-y-3 text-sm text-slate-700">
        <p>California residents can:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Request the personal data we maintain about them.</li>
          <li>Request deletion, subject to record-keeping laws.</li>
          <li>Opt out of any sale or sharing of information.</li>
        </ul>
        <p>Submit requests via {EMAIL}. We verify identity before completing any request.</p>
      </div>
    ),
  },
  cookies: {
    title: 'Cookies & Technology',
    body: (
      <div className="space-y-2 text-sm text-slate-700">
        <p>We use essential, functional, and analytics cookies to keep the site secure, remember preferences, and measure performance.</p>
        <p>You can disable cookies through your browser settings at any time.</p>
      </div>
    ),
  },
};

const SCROLLING_TESTIMONIALS = [
  { text: "Amazing service! Found a roofer in hours.", author: "Sarah M." },
  { text: "Licensed pros, great quality work!", author: "Michael R." },
  { text: "Super easy process, highly recommend.", author: "Jennifer L." },
  { text: "Fixed my AC same day! Fantastic!", author: "David K." },
  { text: "Professional electrician, fair prices.", author: "Lisa P." },
  { text: "Best platform for finding contractors.", author: "James T." },
];

export default function LegalFooter() {
  const [openModal, setOpenModal] = useState<ModalKey | null>(null);
  const modalEntries = useMemo(() => Object.entries(MODALS) as [ModalKey, { title: string; body: ReactNode }][], []);

  return (
    <>
      <footer className="relative z-50 mt-auto bg-white border-t border-slate-200 shrink-0">
        <div className="lg:hidden relative overflow-hidden py-2 border-b border-slate-100 bg-slate-50">
          <div className="flex animate-scroll-left">
            {[...SCROLLING_TESTIMONIALS, ...SCROLLING_TESTIMONIALS].map((testimonial, i) => (
              <div key={i} className="flex items-center gap-2 px-4 shrink-0">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} className="w-3 h-3 text-amber-400 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>
                <span className="text-xs text-slate-700">"{testimonial.text}"</span>
                <span className="text-xs text-slate-500">- {testimonial.author}</span>
                <span className="text-slate-300">•</span>
              </div>
            ))}
          </div>
        </div>
        
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

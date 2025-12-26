import { useState, useEffect } from 'react';
import QuoteForm from './components/QuoteForm';
import LegalFooter from './components/LegalFooter';
import FAQ from './components/FAQ';
import Stats from './components/Stats';
import HowItWorks from './components/HowItWorks';
import Testimonials from './components/Testimonials';
import ServiceShowcase from './components/ServiceShowcase';
import TrustBadges from './components/TrustBadges';
import Newsletter from './components/Newsletter';
import { ToastProvider } from './components/Toast';
import AdminApp from './admin/AdminApp';
import ChatWidget from './components/ChatWidget';

type AppMode = 'normal' | 'wizard';

function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>('normal');

  useEffect(() => {
    const checkAdmin = () => {
      setIsAdmin(window.location.pathname.startsWith('/admin'));
    };
    
    checkAdmin();
    window.addEventListener('popstate', checkAdmin);
    
    return () => window.removeEventListener('popstate', checkAdmin);
  }, []);

  if (isAdmin) {
    return <AdminApp />;
  }

  return (
    <ToastProvider>
      <div className="flex flex-col min-h-screen overflow-x-hidden">
        <div className="flex-1">
          <QuoteForm onWizardModeChange={(active) => setAppMode(active ? 'wizard' : 'normal')} />
          {appMode === 'normal' && (
            <>
              <HowItWorks />
              <ServiceShowcase />
              <Stats />
              <Testimonials />
              <TrustBadges />
              <FAQ />
              <Newsletter />
            </>
          )}
        </div>
        {appMode === 'normal' && <LegalFooter />}
        <ChatWidget />
      </div>
    </ToastProvider>
  );
}

export default App;

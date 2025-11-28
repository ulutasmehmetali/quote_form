import QuoteForm from './components/QuoteForm';
import LegalFooter from './components/LegalFooter';

function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1">
        <QuoteForm />
      </div>
      <LegalFooter />
    </div>
  );
}

export default App;

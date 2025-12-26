import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'How does MIYOMINT work?',
    answer: 'Simply describe your project or select a service, enter your ZIP code and contact info. We\'ll connect you with up to 4 verified local professionals who will reach out to provide free quotes within 24 hours.',
  },
  {
    question: 'Is it really free?',
    answer: 'Yes, our service is 100% free for homeowners. You\'ll never pay us anything. You only pay the professional you choose to hire for your project.',
  },
  {
    question: 'How are professionals verified?',
    answer: 'All professionals in our network undergo background checks, license verification (where applicable), and we review their customer feedback. We only partner with contractors who meet our quality standards.',
  },
  {
    question: 'How quickly will I hear from professionals?',
    answer: 'Most homeowners receive their first contact within a few hours. All quotes are typically received within 24 hours of submitting a request.',
  },
  {
    question: 'Am I obligated to hire anyone?',
    answer: 'Absolutely not! You\'re under no obligation to hire any of the professionals who contact you. Compare quotes, ask questions, and only move forward when you\'re ready.',
  },
  {
    question: 'What areas do you serve?',
    answer: 'We have professionals in our network across the United States. Enter your ZIP code to see if we have verified pros in your area.',
  },
];

function AccordionItem({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-4 px-1 text-left group"
      >
        <span className="font-semibold text-slate-800 text-sm sm:text-base group-hover:text-sky-600 transition-colors">
          {item.question}
        </span>
        <div className={`flex-shrink-0 ml-4 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-sky-100 rotate-180' : 'bg-slate-100 group-hover:bg-sky-50'}`}>
          <svg 
            className={`w-4 h-4 transition-colors ${isOpen ? 'text-sky-600' : 'text-slate-500'}`} 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ease-out ${isOpen ? 'max-h-96 opacity-100 pb-4' : 'max-h-0 opacity-0'}`}>
        <p className="text-slate-600 text-sm sm:text-base leading-relaxed px-1">
          {item.answer}
        </p>
      </div>
    </div>
  );
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-12 sm:py-16">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 mb-4">
            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">FAQ</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-800">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-600 mt-3 max-w-lg mx-auto">
            Everything you need to know about getting started with MIYOMINT
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-lg shadow-slate-100 p-4 sm:p-6">
          {FAQ_ITEMS.map((item, index) => (
            <AccordionItem
              key={index}
              item={item}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-slate-600 text-sm">
            Still have questions?{' '}
            <a href="mailto:info@miyomint.com" className="text-sky-600 font-semibold hover:underline">
              Contact our support team
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

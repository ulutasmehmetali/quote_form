import { useEffect, useMemo, useState, useRef, type FormEvent, type ReactNode } from 'react';
import Button from './Button';
import type { ServiceType, QuoteFormData } from '../types/quote';
import { suggestServicesWithAI, type ServiceSuggestion } from '../lib/aiSuggest';

const SERVICES: ServiceType[] = [
  'Air Conditioning', 'Carpentry', 'Cleaning', 'Concrete', 'Drywall', 'Electrician',
  'Fencing', 'Flooring', 'Garage Door Installation', 'Garage Door Repair', 'Handyman',
  'Heating & Furnace', 'HVAC Contractors', 'Landscaping', 'Painting', 'Pest Control',
  'Plumbing', 'Remodeling', 'Roofing', 'Tile',
];

const KEYWORD_MAP: Record<string, ServiceType> = {
  roof: 'Roofing', leak: 'Plumbing', pipe: 'Plumbing', faucet: 'Plumbing',
  paint: 'Painting', wall: 'Drywall', drywall: 'Drywall', fence: 'Fencing',
  electric: 'Electrician', outlet: 'Electrician', breaker: 'Electrician',
  clean: 'Cleaning', pest: 'Pest Control', bug: 'Pest Control', rat: 'Pest Control',
  mouse: 'Pest Control', hvac: 'HVAC Contractors', furnace: 'Heating & Furnace',
  heat: 'Heating & Furnace', ac: 'Air Conditioning', air: 'Air Conditioning',
  carpet: 'Flooring', tile: 'Tile', remodel: 'Remodeling', renovation: 'Remodeling',
  garage: 'Garage Door Repair', door: 'Garage Door Repair', hand: 'Handyman',
  yard: 'Landscaping', lawn: 'Landscaping',
};

const SERVICE_REASONS: Record<ServiceType, string> = {
  'Air Conditioning': 'Cooling issues, AC repair, installations',
  Carpentry: 'Wood repairs, framing, trim, custom builds',
  Cleaning: 'Deep cleans, move-in/out, housekeeping',
  Concrete: 'Driveways, patios, walkways, repairs',
  Drywall: 'Holes, cracks, water damage, new drywall',
  Electrician: 'Electrical faults, panels, outlets, lighting',
  Fencing: 'Fence installation, repairs, gates',
  Flooring: 'Hardwood, laminate, tile, carpet, vinyl',
  'Garage Door Installation': 'New garage doors and openers',
  'Garage Door Repair': 'Springs, tracks, opener issues',
  Handyman: 'Small fixes, mounting, minor repairs',
  'Heating & Furnace': 'Heating problems, furnace installs',
  'HVAC Contractors': 'Full HVAC, maintenance, ducts',
  Landscaping: 'Lawn care, planting, irrigation',
  Painting: 'Interior/exterior painting, prep work',
  'Pest Control': 'Insect, rodent treatment & prevention',
  Plumbing: 'Leaks, clogs, fixtures, water heaters',
  Remodeling: 'Kitchen, bath, whole-home renovation',
  Roofing: 'Leaks, shingles, gutters, replacements',
  Tile: 'Tile installation, grout, backsplashes',
};

const SHORT_NAMES: Record<ServiceType, string> = {
  'Air Conditioning': 'AC',
  Carpentry: 'Carpentry',
  Cleaning: 'Cleaning',
  Concrete: 'Concrete',
  Drywall: 'Drywall',
  Electrician: 'Electrician',
  Fencing: 'Fencing',
  Flooring: 'Flooring',
  'Garage Door Installation': 'Garage Install',
  'Garage Door Repair': 'Garage Repair',
  Handyman: 'Handyman',
  'Heating & Furnace': 'Heating',
  'HVAC Contractors': 'HVAC',
  Landscaping: 'Landscaping',
  Painting: 'Painting',
  'Pest Control': 'Pest Control',
  Plumbing: 'Plumbing',
  Remodeling: 'Remodeling',
  Roofing: 'Roofing',
  Tile: 'Tile',
};

const SERVICE_ICONS: Record<ServiceType, ReactNode> = {
  'Air Conditioning': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  ),
  Carpentry: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
    </svg>
  ),
  Cleaning: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
  Concrete: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  Drywall: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
  Electrician: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
  Fencing: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  ),
  Flooring: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  'Garage Door Installation': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
    </svg>
  ),
  'Garage Door Repair': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852z" />
    </svg>
  ),
  Handyman: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
    </svg>
  ),
  'Heating & Furnace': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
    </svg>
  ),
  'HVAC Contractors': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  ),
  Landscaping: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  ),
  Painting: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
    </svg>
  ),
  'Pest Control': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  Plumbing: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>
  ),
  Remodeling: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ),
  Roofing: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
    </svg>
  ),
  Tile: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
};

interface ServiceSelectionProps {
  onSubmit: (serviceType: ServiceType, zipCode: string) => void;
  initialData: QuoteFormData;
}

const TYPEWRITER_EXAMPLES = [
  "my roof is leaking...",
  "fix sink clog...",
  "repaint living room...",
  "AC not cooling...",
  "install new fence...",
  "electrical outlet not working...",
];

export default function ServiceSelection({ onSubmit, initialData }: ServiceSelectionProps) {
  const [selectedService, setSelectedService] = useState<ServiceType | ''>(initialData.serviceType || '');
  const [zipCode, setZipCode] = useState(initialData.zipCode || '');
  const [error, setError] = useState('');
  
  const isZipValid = /^\d{5}$/.test(zipCode);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<ServiceSuggestion[]>([]);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const zipRef = useRef<HTMLInputElement | null>(null);
  const serviceListRef = useRef<HTMLDivElement | null>(null);
  const lastTouchYRef = useRef<number | null>(null);
  
  const [placeholderText, setPlaceholderText] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [isAutofillingZip, setIsAutofillingZip] = useState(false);

  useEffect(() => {
    if (searchQuery) return;

    const currentExample = TYPEWRITER_EXAMPLES[placeholderIndex];
    
    if (isTyping) {
      if (placeholderText.length < currentExample.length) {
        const timeout = setTimeout(() => {
          setPlaceholderText(currentExample.slice(0, placeholderText.length + 1));
        }, 60);
        return () => clearTimeout(timeout);
      } else {
        const timeout = setTimeout(() => {
          setIsTyping(false);
        }, 1200);
        return () => clearTimeout(timeout);
      }
    } else {
      if (placeholderText.length > 0) {
        const timeout = setTimeout(() => {
          setPlaceholderText(placeholderText.slice(0, -1));
        }, 30);
        return () => clearTimeout(timeout);
      } else {
        setPlaceholderIndex((placeholderIndex + 1) % TYPEWRITER_EXAMPLES.length);
        setIsTyping(true);
      }
    }
  }, [placeholderText, placeholderIndex, isTyping, searchQuery]);

  // Try to prefill ZIP from IP (was auto-detect; now disabled per request)
  useEffect(() => {
    const fillZipFromIP = async () => {
      return; // disabled
      try {
        setIsAutofillingZip(true);
        const res = await fetch('https://ipapi.co/json/');
        if (!res.ok) return;
        const data = await res.json();
        const postal = data?.postal;
        if (typeof postal === 'string' && /^\d{5}$/.test(postal)) {
          setZipCode((prev) => (prev ? prev : postal));
        }
      } catch {
        // ignore
      } finally {
        setIsAutofillingZip(false);
      }
    };
    void fillZipFromIP();
  }, [zipCode, isAutofillingZip]);

  const { fallbackSuggestions, bestFallback } = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return { fallbackSuggestions: [] as ServiceType[], bestFallback: '' as ServiceType | '' };

    const tokens = q.split(' ').filter(Boolean);
    const scoreService = (service: ServiceType) => {
      const name = service.toLowerCase();
      let score = 0;
      if (name === q) score += 10;
      if (name.startsWith(q)) score += 8;
      if (name.includes(q)) score += 6;
      tokens.forEach((tok) => {
        if (name.startsWith(tok)) score += 4;
        if (name.includes(tok)) score += 2;
        if (KEYWORD_MAP[tok] === service) score += 5;
      });
      return score;
    };

    const scored = SERVICES.map((s) => ({ service: s, score: scoreService(s) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    return {
      fallbackSuggestions: scored.slice(0, 4).map((x) => x.service),
      bestFallback: scored[0]?.service || ('' as ServiceType | ''),
    };
  }, [searchQuery]);

  const fallbackCandidates: ServiceType[] = useMemo(() => {
    if (!searchQuery.trim()) return [];
    if (fallbackSuggestions.length > 0) return fallbackSuggestions.slice(0, 2);
    // hiçbir puanlı eşleşme yoksa en popüler iki servisi öner
    return SERVICES.slice(0, 2);
  }, [fallbackSuggestions, searchQuery]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setAiSuggestions([]);
      setAiStatus('idle');
      return;
    }

    setAiStatus('loading');
    const timer = setTimeout(async () => {
      try {
        const result = await suggestServicesWithAI(searchQuery, SERVICES);
        setAiSuggestions(result);
      } catch {
        setAiSuggestions([]);
      } finally {
        setAiStatus('idle');
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const displayedSuggestions = useMemo(() => {
    if (aiSuggestions.length > 0) {
      return aiSuggestions.slice(0, 4).map((s) => ({
        service: s.service,
        reason: s.reason || SERVICE_REASONS[s.service],
      }));
    }
    return [];
  }, [aiSuggestions]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedService) {
      setError('Please select a service type');
      return;
    }

    if (!zipCode || zipCode.length !== 5) {
      setError('Please enter a valid 5-digit ZIP code');
      return;
    }

    onSubmit(selectedService, zipCode);
  };

  const [showServiceWarning, setShowServiceWarning] = useState(false);

  const handleServiceSelect = (service: ServiceType) => {
    if (selectedService === service) {
      setSelectedService('');
      setShowServiceWarning(false);
      return;
    }
    if (selectedService && selectedService !== service) {
      setShowServiceWarning(true);
      setTimeout(() => setShowServiceWarning(false), 3000);
      return;
    }
    setSelectedService(service);
    setError('');
    setShowServiceWarning(false);
    setTimeout(() => {
      zipRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => zipRef.current?.focus(), 400);
    }, 100);
  };

  const handleServiceListWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const el = serviceListRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    const prev = el.scrollTop;
    const next = Math.min(maxScroll, Math.max(0, prev + event.deltaY));
    const used = next - prev;
    const remaining = event.deltaY - used;

    if (next !== prev) {
      el.scrollTop = next;
    }
    if (remaining !== 0) {
      window.scrollBy({ top: remaining, behavior: 'auto' });
    }
  };

  const handleServiceListTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    lastTouchYRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleServiceListTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const el = serviceListRef.current;
    if (!el) return;
    const currentY = event.touches[0]?.clientY ?? null;
    if (currentY === null || lastTouchYRef.current === null) {
      lastTouchYRef.current = currentY;
      return;
    }

    const deltaY = lastTouchYRef.current - currentY;
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    const prev = el.scrollTop;
    const next = Math.min(maxScroll, Math.max(0, prev + deltaY));
    const used = next - prev;
    const remaining = deltaY - used;

    if (next !== prev) {
      el.scrollTop = next;
    }
    if (remaining !== 0) {
      window.scrollBy({ top: remaining, behavior: 'auto' });
    }

    lastTouchYRef.current = currentY;
  };

  return (
    <form
      id="service-step"
      onSubmit={handleSubmit}
      className="space-y-3 sm:space-y-6 lg:space-y-8 animate-fadeIn"
    >
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-sky-50/70 border border-sky-100 shadow-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white text-sm font-bold shadow">
            1
          </span>
          <span className="text-sm font-semibold text-slate-800 tracking-tight">Step 1 of 3 · Choose Service</span>
        </div>
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800">What do you need help with?</h2>
        <p className="text-slate-600 text-sm sm:text-base max-w-lg mx-auto">
          Describe your issue or select a service. Our AI will match you with the right professionals.
        </p>
      </div>

      <div className="space-y-2.5 sm:space-y-3">
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-500">
            <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m16.5 16.5 3.5 3.5" />
            </svg>
          </div>
          <input
            className="w-full pl-9 sm:pl-12 pr-4 py-3 sm:py-3.5 rounded-2xl bg-white text-slate-900 text-sm sm:text-base font-medium placeholder:text-slate-400 border-2 border-slate-200 focus:border-sky-400 focus:outline-none shadow-sm transition-all"
            placeholder={placeholderText || "e.g. my roof is leaking..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setSelectedService(''); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {searchQuery && (
        <div className="min-h-[200px]">
          {aiStatus === 'loading' && (
            <div className="space-y-3 animate-fadeIn">
              <div className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <div className="h-4 w-4 rounded-full border-2 border-sky-200 border-t-sky-500 animate-spin"></div>
                AI is analyzing your request...
              </div>
              <div className="grid grid-cols-1 gap-3">
                {[1, 2].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border-2 border-slate-100 bg-slate-50">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-200"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                        <div className="h-3 bg-slate-200 rounded w-full"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {displayedSuggestions.length > 0 && aiStatus !== 'loading' && (
            <div className="space-y-3 animate-fadeIn">
              <div className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <span className="text-emerald-500">*</span> AI Suggestions
              </div>
              <div className="grid grid-cols-1 gap-3">
                {displayedSuggestions.map(({ service, reason }) => (
                  <button
                    key={service}
                    type="button"
                    onClick={() => handleServiceSelect(service)}
                    className={`group relative flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border-2 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${
                      selectedService === service
                        ? 'border-sky-400 bg-sky-50 shadow-lg shadow-sky-100'
                        : 'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/50'
                    }`}
                  >
                    <div className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-sky-500 transition-transform group-hover:scale-110 ${
                      selectedService === service ? 'bg-sky-100' : 'bg-slate-100'
                    }`}>
                      {SERVICE_ICONS[service]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm sm:text-base">{service}</p>
                      <p className="text-xs sm:text-sm text-slate-500 mt-0.5 whitespace-normal leading-snug">{reason}</p>
                    </div>
                    {selectedService === service && (
                      <div className="absolute top-3 right-3">
                        <div className="w-7 h-7 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors shadow-md">
                          <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {displayedSuggestions.length === 0 && aiStatus !== 'loading' && fallbackCandidates.length > 0 && (
            <div className="space-y-3 animate-fadeIn">
              <div className="text-sm font-semibold text-amber-600 flex items-center gap-2">
                Did you mean?
              </div>
              <div className="grid grid-cols-1 gap-3">
                {fallbackCandidates.map((service) => (
                  <button
                    key={service}
                    type="button"
                    onClick={() => handleServiceSelect(service)}
                    className={`group relative flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border-2 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${
                      selectedService === service
                        ? 'border-emerald-400 bg-emerald-50 shadow-lg shadow-emerald-100'
                        : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50'
                    }`}
                  >
                    <div className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-emerald-500 transition-transform group-hover:scale-110 ${
                      selectedService === service ? 'bg-emerald-100' : 'bg-slate-100'
                    }`}>
                      {SERVICE_ICONS[service]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm sm:text-base">{service}</p>
                      <p className="text-xs sm:text-sm text-slate-500 mt-0.5 whitespace-normal leading-snug">
                        {SERVICE_REASONS[service]}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!searchQuery && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-slate-800">Or browse all services:</div>
          <div
            ref={serviceListRef}
            className="relative max-h-64 overflow-y-scroll pr-3 scrollbar-visible"
            style={{
              overscrollBehaviorY: 'auto',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
            }}
            onWheel={handleServiceListWheel}
            onTouchStart={handleServiceListTouchStart}
            onTouchMove={handleServiceListTouchMove}
          >
            <div className="grid grid-cols-2 gap-2">
              {SERVICES.map((service) => (
                <button
                  key={service}
                  type="button"
                  onClick={() => handleServiceSelect(service)}
                  className={`group relative flex min-w-0 items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-200 ${
                    selectedService === service
                      ? 'bg-sky-500 text-white shadow-lg shadow-sky-200 ring-2 ring-sky-400 ring-offset-1'
                      : 'bg-white text-slate-900 border border-slate-200 hover:bg-sky-50 hover:border-sky-300 hover:shadow-md'
                  }`}
                >
                  <div className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg ${
                    selectedService === service ? 'text-white' : 'text-sky-600'
                  }`}>
                    {SERVICE_ICONS[service]}
                  </div>
                  <span className="text-sm font-semibold leading-tight whitespace-normal break-words text-left">
                    {SHORT_NAMES[service]}
                  </span>
                  {selectedService === service && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors shadow-md border-2 border-white">
                      <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showServiceWarning && (
        <div className="animate-fadeIn rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-center gap-3 shadow-lg" role="alert">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold">You've already selected a service!</p>
            <p className="text-amber-700 text-xs mt-0.5">To change it, first click the <span className="text-rose-600 font-bold">✕</span> on your selected service.</p>
          </div>
        </div>
      )}

      <div className="pt-4 space-y-4">
        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>

        <div className="space-y-3">
          <div className="flex justify-center mb-2">
            <div className="inline-flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-sky-50/70 border border-sky-100 shadow-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white text-sm font-bold shadow">
                2
              </span>
              <span className="text-sm font-semibold text-slate-800 tracking-tight">Step 2 of 3 · Enter ZIP</span>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <svg className="h-4 w-4 text-sky-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Your ZIP Code
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                ref={zipRef}
                type="text"
                inputMode="numeric"
                className={`w-full px-5 py-4 sm:h-14 rounded-2xl bg-white text-slate-900 text-lg font-semibold placeholder:text-slate-400 border-2 transition-all shadow-sm focus:outline-none ${
                  isZipValid
                    ? 'border-emerald-400 focus:border-emerald-500'
                    : zipCode.length > 0
                    ? 'border-amber-400 focus:border-amber-500'
                    : 'border-slate-200 focus:border-sky-400'
                }`}
                placeholder="Enter 5-digit ZIP"
                maxLength={5}
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, ''))}
              />
              {isZipValid && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={!selectedService || !isZipValid}
              className="h-14 px-8 text-lg whitespace-nowrap"
            >
              Continue
              <svg className="h-5 w-5 ml-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Button>
          </div>
          <p className="text-xs text-slate-500">We'll match you with certified pros in your area</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-3" role="alert">
          <svg className="h-5 w-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4m0 4h.01" />
          </svg>
          <p>{error}</p>
        </div>
      )}
    </form>
  );
}





// --- TÜM DOSYA BAŞLANGICI DEĞİŞMEDİ ---
import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../lib/api';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
};

const initialAssistant = 'Hi there! How can I help you?';
const quickPrompts = [
  'I need emergency repair',
  'What services do you offer?',
  'How soon can you schedule?',
  'I need an expert to call me',
  'I have another question',
];

const MAX_CHARS = Number(import.meta.env.VITE_CHAT_MAX_CHARS || 1000);
const SERVICE_MAP = [
  'Air Conditioning',
  'Carpentry',
  'Cleaning',
  'Concrete',
  'Drywall',
  'Electrician',
  'Fencing',
  'Flooring',
  'Garage Door Installation',
  'Garage Door Repair',
  'Handyman',
  'Heating & Furnace',
  'HVAC Contractors',
  'Landscaping',
  'Painting',
  'Pest Control',
  'Plumbing',
  'Remodeling',
  'Roofing',
  'Tile',
];
const SERVICE_KEYWORDS = [
  'plumb', 'electric', 'hvac', 'roof', 'floor', 'fence', 'garage', 'door', 'gate', 'tile', 'drywall',
  'clean', 'remodel', 'paint', 'landscap', 'pest', 'handyman', 'concrete', 'carpentry', 'ac', 'air',
  'tesisat', 'elektrik', 'klima', 'çatı', 'boya', 'temiz', 'tadilat', 'bahçe', 'kapı', 'pencere',
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: initialAssistant },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lead, setLead] = useState({
    name: '',
    phone: '',
    email: '',
    serviceType: '',
    zipCode: '',
    urgency: '',
    description: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showPrompts, setShowPrompts] = useState(true);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const [lang, setLang] = useState<'en' | 'tr' | 'es'>('en');
  const listRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    const navLang = (navigator?.language || 'en').slice(0, 2).toLowerCase();
    if (navLang === 'tr') setLang('tr');
    else if (navLang === 'es') setLang('es');
    else setLang('en');
  }, []);

  const t = (key: string) => {
    const dict: Record<string, Record<string, string>> = {
      en: {
        tooLong: 'Message too long',
        rate: 'Please slow down',
        pii: 'Sensitive info detected',
        newChat: 'New chat',
        placeholder: 'Write your message...',
        send: 'Send',
        selectService: 'Pick a service',
        goForm: 'Go to form',
      },
      tr: {
        tooLong: 'Mesaj çok uzun',
        rate: 'Lütfen yavaş yazın',
        pii: 'Kişisel veri tespit edildi',
        newChat: 'Yeni sohbet',
        placeholder: 'Mesajını yaz...',
        send: 'Gönder',
        selectService: 'Servis Seç',
        goForm: 'Formu doldur',
      },
      es: {
        tooLong: 'Mensaje demasiado largo',
        rate: 'Por favor, más despacio',
        pii: 'Detecté datos sensibles',
        newChat: 'Nuevo chat',
        placeholder: 'Escribe tu mensaje...',
        send: 'Enviar',
        selectService: 'Elegir servicio',
        goForm: 'Ir al formulario',
      },
    };
    return dict[lang]?.[key] || dict.en[key] || key;
  };

  const resetChat = () => {
    setMessages([{ role: 'assistant', content: initialAssistant }]);
    setInput('');
    setError(null);
    setLead({
      name: '',
      phone: '',
      email: '',
      serviceType: '',
      zipCode: '',
      urgency: '',
      description: '',
    });
    setSubmitted(false);
    setSubmitting(false);
    setShowPrompts(true);
  };

  const runChat = async (userText: string) => {
    const trimmed = userText.trim();
    if (!trimmed || loading || rateLimited) return;
    if (trimmed.length > MAX_CHARS) {
      setError(t('tooLong'));
      return;
    }
    setError(null);
    setShowPrompts(false);

    const nextMessages = [...messages, { role: 'user', content: trimmed }].slice(-40);
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          setError(t('rate'));
          setRateLimited(true);
          setTimeout(() => setRateLimited(false), 3000);
          return;
        }
        if (res.status === 413) {
          setError(t('tooLong'));
          return;
        }
        if (res.status === 400) {
          setError(t('pii'));
          return;
        }
        throw new Error(`Request failed (${res.status})`);
      }

      const data = await res.json();
      const reply =
        typeof data?.reply === 'string' && data.reply.trim()
          ? data.reply.trim()
          : "I'm here to help. Can you rephrase that?";

      const allMessages = [...nextMessages, { role: 'assistant', content: reply }];
      setMessages(allMessages);
    } catch (err) {
      setError('I had trouble answering. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runChat(input);
    }
  };

  const [uploadedCountState, setUploadedCountState] = useState(0);

  const handleImageSelect = async (file?: File) => {
    if (!file) return;
    if (uploadedCountState >= 3) {
      setError('You can upload up to 3 images.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image too large (max 10MB).');
      return;
    }

    const toDataUrl = (f: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Could not read image'));
        reader.readAsDataURL(f);
      });

    try {
      setUploadingImage(true);
      const dataUrl = await toDataUrl(file);
      const userNote = 'Uploaded an image for review.';
      setMessages((prev) => [...prev, { role: 'user', content: userNote, image: dataUrl }]);

      const context = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch(apiUrl('/api/chat/image'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, messages: context }),
      });
      const data = await res.json();
      const service = typeof data?.serviceType === 'string' ? data.serviceType : '';
      const summary =
        typeof data?.summary === 'string' && data.summary.trim()
          ? data.summary.trim()
          : 'I could not read this image reliably. If you can, add a short note on what it shows.';
      const suggestion = service ? `Suggested service: ${service}. Tap “Select service” to continue.` : '';
      const replyText = [summary, suggestion].filter(Boolean).join(' ');

      setMessages((prev) => [...prev, { role: 'assistant', content: replyText, image: undefined }]);
      setUploadedCountState((c) => c + 1);
      if (service) {
        setLead((prev) => ({ ...prev, serviceType: prev.serviceType || service }));
      }
    } catch (err) {
      setError('Could not analyze the image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const wrapperClass = open
    ? 'fixed bottom-6 right-6 z-50 w-[22rem] max-w-[22rem] sm:max-w-[23rem]'
    : 'fixed bottom-6 right-6 z-50 w-[4.4rem] h-[4.4rem] sm:w-[4.8rem] sm:h-[4.8rem]';

  const counterColor =
    input.length > MAX_CHARS
      ? 'text-red-600'
      : input.length > 0.9 * MAX_CHARS
      ? 'text-amber-600'
      : 'text-slate-500';

  const scrollToService = () => {
    const el = document.getElementById('service-step') || document.getElementById('quote-form');
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 20;
      window.scrollTo({ top, behavior: 'smooth' });
    }
    setOpen(false);
  };

  const isNonServiceMessage = (txt: string) =>
    txt.toLowerCase().includes('sadece ev hizmetleri') ||
    txt.toLowerCase().includes('only for home services');

  const normalizeService = (txt: string) => {
    const lower = txt.toLowerCase();
    const direct = SERVICE_MAP.find((s) => s.toLowerCase() === lower);
    if (direct) return direct;
    const includes = SERVICE_MAP.find((s) => lower.includes(s.toLowerCase()));
    if (includes) return includes;
    const keywordHit = SERVICE_MAP.find((s) =>
      SERVICE_KEYWORDS.some((k) => lower.includes(k) && s.toLowerCase().includes(k.split(' ')[0] || k))
    );
    return keywordHit || '';
  };

  const isServiceSuggestion = (txt: string) => !!normalizeService(txt);

  const handleSelectService = (serviceHint: string) => {
    const service = normalizeService(serviceHint) || normalizeService(input) || serviceHint;
    if (!service) {
      setError('Service not recognized. Please type the service name.');
      return;
    }
    window.dispatchEvent(new CustomEvent('chat-service-selected', { detail: { serviceType: service } }));
    setMessages((prev) => [...prev, { role: 'assistant', content: `Selected service: ${service}` }]);
    scrollToService();
  };

  return (
    <>
      <div className={wrapperClass}>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="flex flex-col items-center justify-center h-16 w-16 rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-blue-600 text-white shadow-xl shadow-sky-600/30 hover:shadow-sky-500/50 transition-all ring-2 ring-sky-500/30 hover:ring-sky-400/50 text-[12px]"
            aria-label="Open AI assistant"
          >
            <img
              src="/robot-icon.svg"
              alt="AI robot"
              className="h-8 w-8 rounded-full shadow-md shadow-sky-500/30"
              loading="lazy"
            />
            <span className="mt-0.5 leading-none text-white drop-shadow-sm font-bold uppercase tracking-tight">
              Ask AI
            </span>
          </button>
        )}

        {open && (
          <div className="w-full bg-[#f9fafb] rounded-2xl shadow-[0_10px_30px_rgba(15,23,42,0.12)] overflow-hidden border border-slate-200 flex flex-col h-[30rem] max-h-[32rem]">
            <div className="flex items-center justify-between px-3 py-3 bg-white border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <img
                  src="/robot-icon.svg"
                  alt="AI robot"
                  className="h-8 w-8 rounded-full shadow-sm bg-white border border-slate-200"
                  loading="lazy"
                />
                <div>
                  <p className="text-[15px] font-semibold text-slate-900 leading-tight">Customer Service Agent</p>
                  <p className="text-[13px] text-slate-500 leading-tight">How can I help you?</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-slate-800 transition-colors"
                aria-label="Close chat"
              >
                ×
              </button>
            </div>

            {showPrompts && (
              <div className="px-3 py-2 bg-[#f9fafb] border-b border-slate-200">

                {/* 🔥 DÜZELTİLMİŞ QUICK PROMPT ALANI */}
                <div className="flex flex-wrap gap-2 pb-1">

                  {quickPrompts.map((p) => (
                    <button
                      key={p}
                      onClick={() => runChat(p)}
                      disabled={loading}
                      className="text-[12px] px-3 py-2 rounded-lg bg-white text-slate-800 hover:bg-sky-50 transition disabled:opacity-50 whitespace-nowrap shadow-sm border border-slate-200"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-600 text-xs">
                {error}
              </div>
            )}

            <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-[#f9fafb]">
              {messages.map((m, idx) => {
                const showActions =
                  m.role === 'assistant' &&
                  (isNonServiceMessage(m.content) || isServiceSuggestion(m.content));
                const suggestedService = normalizeService(m.content);
              return (
                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`px-3 py-2 rounded-xl text-[14px] max-w-[82%] whitespace-pre-wrap break-words shadow ${
                      m.role === 'user'
                        ? 'bg-teal-600 text-white rounded-br-lg'
                        : 'bg-white text-slate-900 border border-slate-200'
                    }`}
                  >
                    {m.content}
                    {m.image && (
                      <div className="mt-2">
                        <img
                          src={m.image}
                          alt="Uploaded"
                          className="max-w-full max-h-40 rounded-xl border border-slate-200 shadow-sm object-contain"
                        />
                      </div>
                    )}
                    {showActions && (
                      <div className="mt-2 flex gap-2 flex-wrap">
                        <button
                          onClick={() => handleSelectService(suggestedService || m.content)}
                          className="text-[12px] px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm"
                        >
                          {t('selectService')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
              {loading && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-lg text-sm bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping"></span>
                    Thinking...
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-white border-t border-slate-200 space-y-2">
              <div className="flex items-center gap-2 rounded-[16px] bg-white px-3 py-2 shadow-inner shadow-slate-200 border border-slate-200">
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    handleImageSelect(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || uploadingImage}
                  className="p-2 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 shadow-inner shadow-slate-200 disabled:opacity-50"
                  aria-label="Attach image"
                >
                  <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12V7.5a4.5 4.5 0 00-9 0V16a2.5 2.5 0 005 0V8.5a1.5 1.5 0 10-3 0V15M6 8v8a4 4 0 108 0V9.5" />
                  </svg>
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, MAX_CHARS);
                    setInput(val);
                    if (val.length > MAX_CHARS) setError(t('tooLong'));
                    else if (error === t('tooLong')) setError(null);
                  }}
                  onKeyDown={handleKey}
                  placeholder={t('placeholder')}
                  className="flex-1 px-2 py-2 rounded-full bg-transparent text-slate-900 placeholder-slate-500 focus:outline-none"
                />
                <span className={`text-[11px] ${counterColor} min-w-[58px] text-right`}>
                  {input.length}/{MAX_CHARS}
                </span>
                <button
                  onClick={() => runChat(input)}
                  disabled={loading || uploadingImage || !input.trim() || input.length > MAX_CHARS || rateLimited}
                  className="px-3 py-2 rounded-[12px] bg-teal-600 text-white shadow-lg shadow-teal-500/40 disabled:opacity-50 text-sm font-semibold whitespace-nowrap"
                  aria-label="Send message"
                >
                  {t('send')}
                </button>
              </div>

              {rateLimited && (
                <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1 inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                  {t('rate')}
                </div>
              )}

              <div className="flex items-center justify-end text-[11px] text-slate-500">
                <button
                  onClick={resetChat}
                  className="text-slate-500 hover:text-slate-700 transition-colors"
                  disabled={loading}
                >
                  {t('newChat')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

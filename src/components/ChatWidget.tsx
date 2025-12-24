import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../lib/api';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
};

const initialAssistant = 'Hi there! How can I help you?';
const MAX_CHARS = Number(import.meta.env.VITE_CHAT_MAX_CHARS || 1000);

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [lead, setLead] = useState({
    name: '',
    phone: '',
    email: '',
    serviceType: '',
    zipCode: '',
    urgency: '',
    description: '',
  });
  const [leadReady, setLeadReady] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [submittingLead, setSubmittingLead] = useState(false);
  const [lastConsentIndex, setLastConsentIndex] = useState<number>(-1);
  const [lang, setLang] = useState<'en' | 'tr' | 'es'>('en');
  const listRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const navLang = (navigator?.language || 'en').slice(0, 2).toLowerCase();
    if (navLang === 'tr') setLang('tr');
    else if (navLang === 'es') setLang('es');
    else setLang('en');
  }, []);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (open && messages.length === 0 && !typing) {
      addAssistantMessage(initialAssistant);
    }
  }, [open, messages.length, typing]);

  const pushMessage = (msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg].slice(-40));
  };

  const addAssistantMessage = (text: string) => {
    setTyping(true);
    setTimeout(() => {
      pushMessage({ role: 'assistant', content: text });
      setTyping(false);
    }, 1100);
  };

  const t = (key: string) => {
    const dict: Record<string, Record<string, string>> = {
      en: {
        tooLong: 'Message too long',
        rate: 'Please slow down',
        pii: 'Sensitive info detected',
        newChat: 'Start a new conversation',
        placeholder: 'Write your message…',
        send: 'Send',
      },
      tr: {
        tooLong: 'Mesaj çok uzun',
        rate: 'Lütfen yavaş yazın',
        pii: 'Kişisel veri tespit edildi',
        newChat: 'Yeni sohbet başlat',
        placeholder: 'Mesajını yaz…',
        send: 'Gönder',
      },
      es: {
        tooLong: 'Mensaje demasiado largo',
        rate: 'Por favor, más despacio',
        pii: 'Detecté datos sensibles',
        newChat: 'Iniciar nueva conversación',
        placeholder: 'Escribe tu mensaje…',
        send: 'Enviar',
      },
    };
    return dict[lang]?.[key] || dict.en[key] || key;
  };

  const resetChat = () => {
    setMessages([]);
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
    setLeadReady(false);
    setLeadSubmitted(false);
    setSubmittingLead(false);
    setLastConsentIndex(-1);
    addAssistantMessage(initialAssistant);
  };

  const runChat = async (userText: string) => {
    const trimmed = userText.trim();
    if (!trimmed || loading || rateLimited) return;
    if (trimmed.length > MAX_CHARS) {
      setError(t('tooLong'));
      return;
    }
    setError(null);

    const userMsg: ChatMessage = { role: 'user', content: trimmed };
    const nextMessages = [...messages, userMsg].slice(-40);
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

      addAssistantMessage(reply);
    } catch (err) {
      setError('I had trouble answering. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const extractLead = async (history: ChatMessage[]) => {
    try {
      const res = await fetch(apiUrl('/api/chat/extract'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-40) }),
      });
      const data = await res.json();
      if (data?.lead) {
        setLead(data.lead);
        setLeadReady(Boolean(data.ready));
      }
    } catch (err) {
      console.warn('lead extract failed', err);
    }
  };

  const getConsentIndex = (history: ChatMessage[]) => {
    for (let i = history.length - 1; i >= 0; i--) {
      const m = history[i];
      if (m.role !== 'user') continue;
      const txt = (m.content || '').toLowerCase();
      const ok = ['yes', 'sure', 'ok', 'okay', 'go ahead', 'share', 'evet', 'tamam', 'onay'].some((p) =>
        txt.includes(p)
      );
      if (ok) return i;
      break; // stop at last user even if not consent
    }
    return -1;
  };

  const submitLead = async () => {
    if (leadSubmitted || submittingLead) return;
    setSubmittingLead(true);
    try {
      const res = await fetch(apiUrl('/api/chat/submit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          serviceType: lead.serviceType,
          zipCode: lead.zipCode,
          urgency: lead.urgency,
          description: lead.description,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data?.error || `Submit failed (${res.status})`;
        setError(msg);
        addAssistantMessage('Could not share your details with pros right now. Please confirm again.');
        setSubmittingLead(false);
        return;
      }
      setLeadSubmitted(true);
      addAssistantMessage('Thanks! I shared your details with local pros. They will reach out shortly.');
    } catch (err) {
      console.warn('lead submit failed', err);
      setError('Could not submit your details. Please try again.');
      addAssistantMessage('I could not send your details. Please confirm again in a moment.');
    } finally {
      setSubmittingLead(false);
    }
  };

  useEffect(() => {
    if (!messages.length) return;
    void extractLead(messages);
    const consentIdx = getConsentIndex(messages);
    if (leadReady && !leadSubmitted && consentIdx >= 0 && consentIdx !== lastConsentIndex) {
      setLastConsentIndex(consentIdx);
      void submitLead();
    }
  }, [messages, leadReady, leadSubmitted, lastConsentIndex]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runChat(input);
    }
  };

  const handleImageSelect = async (file?: File) => {
    if (!file) return;
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
      setLoading(true);
      const dataUrl = await toDataUrl(file);
      pushMessage({ role: 'user', content: 'Uploaded an image', image: dataUrl });

      const context = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch(apiUrl('/api/chat/image'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, messages: context }),
      });
      const data = await res.json();

      const summary =
        typeof data?.summary === 'string' && data.summary.trim()
          ? data.summary.trim()
          : 'I could not read this image reliably. If you can, add a short note on what it shows.';
      const service = typeof data?.serviceType === 'string' ? data.serviceType : '';
      const suggestion = service ? `Suggested service: ${service}.` : '';
      const replyText = [summary, suggestion].filter(Boolean).join(' ');

      pushMessage({ role: 'assistant', content: replyText });
    } catch {
      setError('Could not analyze the image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const wrapperClass = open
    ? 'fixed bottom-6 right-6 z-50 w-[25rem] max-w-[25rem] sm:max-w-[26rem]'
    : 'fixed bottom-6 right-6 z-50 w-[3.5rem] h-[3.5rem]';
  const counterColor =
    input.length > MAX_CHARS
      ? 'text-red-600'
      : input.length > 0.9 * MAX_CHARS
      ? 'text-amber-600'
      : 'text-[#9CA3AF]';

  return (
    <div className={wrapperClass} style={{ fontFamily: 'Inter, Roboto, sans-serif' }}>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#3A8DFF] text-white shadow-[0_8px_18px_rgba(0,0,0,0.08)]"
          aria-label="Open AI assistant"
        >
          <img src="/robot-icon.svg" alt="AI robot" className="h-7 w-7 rounded-full" loading="lazy" />
        </button>
      )}

      {open && (
        <div className="w-full bg-white rounded-[10px] shadow-[0_12px_30px_rgba(0,0,0,0.08)] overflow-hidden border border-[#E2E2E2] flex flex-col h-[30rem] max-h-[32rem]">

          {/* HEADER */}
          <div className="flex items-center justify-between px-3 py-2 bg-white h-[60px]">
            <div className="flex items-center gap-2.5">
              <img src="/robot-icon.svg" alt="AI robot" className="h-8 w-8 rounded-full" loading="lazy" />
              <div>
                <p className="text-[16px] font-bold text-[#1A1A1A] leading-tight">Customer Service Agent</p>
                <p className="text-[13px] text-[#6F6F6F] leading-tight">How can I help you?</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-[#1A1A1A] hover:text-black transition-colors text-xl"
              aria-label="Close chat"
            >
              ×
            </button>
          </div>

          {/* ERROR MESSAGE */}
          {error && (
            <div className="px-4 py-2 bg-[#F5F7FA] border-b border-[#E2E2E2] text-[#B91C1C] text-xs">
              {error}
            </div>
          )}

          {/* MESSAGES */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-white">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`px-3 py-2 rounded-[10px] text-[14px] max-w-[82%] whitespace-pre-wrap break-words ${
                    m.role === 'user'
                      ? 'bg-[#DFF1FF] text-[#1A1A1A]'
                      : 'bg-[#F5F8FF] text-[#1A1A1A]'
                  }`}
                >
                  {m.content}
                  {m.image && (
                    <div className="mt-2">
                      <img
                        src={m.image}
                        alt="Uploaded"
                        className="max-w-full max-h-40 rounded-[8px] border border-[#E2E2E2] object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {(typing || loading) && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-[8px] text-sm bg-[#F5F7FA] text-[#6F6F6F] border border-[#E2E2E2] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#3A8DFF] animate-ping"></span>
                  Typing...
                </div>
              </div>
            )}
          </div>

          {/* INPUT BAR */}
          <div className="p-3 border-t border-[#E2E2E2] bg-white">
            <div className="flex items-center gap-2 w-full py-2 px-1 bg-white">

              {/* IMAGE INPUT */}
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

              {/* ATTACH BUTTON */}
              <button
                className="h-[36px] w-[36px] flex items-center justify-center rounded-full bg-[#F3F4F6] hover:bg-[#E5E7EB] transition"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                aria-label="Attach image"
              >
                <svg className="h-5 w-5 text-[#6B7280]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12V7a3 3 0 10-6 0v7a5 5 0 1010 0V9" />
                </svg>
              </button>

              {/* TEXT INPUT */}
              <div className="flex-1 flex items-center h-[36px] px-3 rounded-full border border-[#E2E2E2] bg-[#F5F7FA] focus-within:border-[#3A8DFF] transition">
                <input
                  className="flex-1 text-[14px] text-[#1A1A1A] placeholder-[#9CA3AF] bg-transparent outline-none"
                  placeholder={t('placeholder')}
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
                  onKeyDown={handleKey}
                />
                <span className={`text-[11px] ml-2 ${counterColor}`}>
                  {input.length}/{MAX_CHARS}
                </span>
              </div>

              {/* SEND BUTTON */}
              <button
                className="h-[36px] px-4 rounded-full bg-[#3A8DFF] text-white font-semibold text-[14px] shadow-md hover:bg-[#2C7CE8] transition whitespace-nowrap disabled:opacity-50"
                disabled={!input.trim() || loading || rateLimited}
                onClick={() => runChat(input)}
              >
                {t('send')}
              </button>
            </div>

            {/* RATE LIMIT */}
            {rateLimited && (
              <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-[10px] px-3 py-1 inline-flex items-center gap-1 mt-1">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                {t('rate')}
              </div>
            )}

            {/* ERROR BELOW INPUT */}
            {error && (
              <div className="text-[12px] text-[#B91C1C] mt-1">{error}</div>
            )}

            {/* NEW CHAT */}
            <div className="flex items-center justify-end mt-1">
              <button
                onClick={resetChat}
                className="text-[12px] text-[#6F6F6F] hover:text-[#3A8DFF] transition font-medium underline underline-offset-2"
                disabled={loading}
              >
                {t('newChat')}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

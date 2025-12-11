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

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: initialAssistant },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
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

  const t = (key: string) => {
    const dict: Record<string, Record<string, string>> = {
      en: {
        tooLong: 'Message too long',
        rate: 'Please slow down',
        pii: 'Sensitive info detected',
        newChat: 'New chat',
        placeholder: 'Write your message...',
        send: 'Send',
      },
      tr: {
        tooLong: 'Mesaj çok uzun',
        rate: 'Lütfen yavaş yazın',
        pii: 'Kişisel veri tespit edildi',
        newChat: 'Yeni sohbet',
        placeholder: 'Mesajını yaz...',
        send: 'Gönder',
      },
      es: {
        tooLong: 'Mensaje demasiado largo',
        rate: 'Por favor, más despacio',
        pii: 'Detecté datos sensibles',
        newChat: 'Nuevo chat',
        placeholder: 'Escribe tu mensaje...',
        send: 'Enviar',
      },
    };
    return dict[lang]?.[key] || dict.en[key] || key;
  };

  const resetChat = () => {
    setMessages([{ role: 'assistant', content: initialAssistant }]);
    setInput('');
    setError(null);
  };

  const runChat = async (userText: string) => {
    const trimmed = userText.trim();
    if (!trimmed || loading || rateLimited) return;
    if (trimmed.length > MAX_CHARS) {
      setError(t('tooLong'));
      return;
    }
    setError(null);

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
      setMessages((prev) => [...prev, { role: 'user', content: 'Uploaded an image', image: dataUrl }]);

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
      setMessages((prev) => [...prev, { role: 'assistant', content: replyText }]);
    } catch (err) {
      setError('Could not analyze the image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const wrapperClass = open
    ? 'fixed bottom-6 right-6 z-50 w-[22rem] max-w-[22rem] sm:max-w-[23rem]'
    : 'fixed bottom-6 right-6 z-50 w-[3.5rem] h-[3.5rem]';

  const counterColor =
    input.length > MAX_CHARS
      ? 'text-red-600'
      : input.length > 0.9 * MAX_CHARS
      ? 'text-amber-600'
      : 'text-slate-500';

  return (
    <div className={wrapperClass} style={{ fontFamily: 'Inter, Roboto, sans-serif' }}>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#3A8DFF] text-white shadow-lg"
          aria-label="Open AI assistant"
        >
          <img
            src="/robot-icon.svg"
            alt="AI robot"
            className="h-7 w-7 rounded-full"
            loading="lazy"
          />
        </button>
      )}

      {open && (
        <div className="w-full bg-white rounded-[10px] shadow-[0_12px_30px_rgba(0,0,0,0.1)] overflow-hidden border border-[#E2E2E2] flex flex-col h-[30rem] max-h-[32rem]">

          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2" style={{ height: '60px', background: '#FFFFFF' }}>
            <div className="flex items-center gap-2.5">
              <img
                src="/robot-icon.svg"
                alt="AI robot"
                className="h-8 w-8 rounded-full"
                loading="lazy"
              />
              <div>
                <p className="text-[16px] font-bold text-[#2A2A2A] leading-tight">Customer Service Agent</p>
                <p className="text-[13px] text-[#6F6F6F] leading-tight">How can I help you?</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-[#2A2A2A] hover:text-black transition-colors text-xl"
              aria-label="Close chat"
            >
              ×
            </button>
          </div>

          {/* Quick replies */}
          <div className="px-3 py-2 border-b border-[#E2E2E2]">
            
            {/* 🔵 DÜZELTİLMİŞ SATIR: ARTIK SCROLLBAR YOK */}
            <div className="flex flex-wrap gap-2 pb-1">

              {quickPrompts.map((p) => (
                <button
                  key={p}
                  onClick={() => runChat(p)}
                  disabled={loading}
                  className="h-8 px-3 rounded-[8px] bg-[#F1F4F9] text-[#3A3A3A] text-[13px] whitespace-nowrap flex items-center transition disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-600 text-xs">
              {error}
            </div>
          )}

          {/* Messages */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-white">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
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
            {loading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-[8px] text-sm bg-[#F1F4F9] text-slate-700 border border-[#E2E2E2] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#3A8DFF] animate-ping"></span>
                  Thinking...
                </div>
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="p-3 border-t border-[#E2E2E2] bg-white">
            <div className="flex items-center gap-2" style={{ padding: '12px 0' }}>
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
                disabled={loading}
                className="h-12 w-12 rounded-[10px] border border-[#E2E2E2] bg-white flex items-center justify-center"
                aria-label="Attach image"
              >
                <svg className="h-5 w-5 text-[#3A3A3A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12V7.5a4.5 4.5 0 00-9 0V16a2.5 2.5 0 005 0V8.5a1.5 1.5 0 10-3 0V15M6 8v8a4 4 0 108 0V9.5" />
                </svg>
              </button>

              <div className="flex-1 h-12 border border-[#E2E2E2] rounded-[10px] px-3 flex items-center bg-white">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, MAX_CHARS);
                    setInput(val);
                  }}
                  onKeyDown={handleKey}
                  placeholder={t('placeholder')}
                  className="flex-1 text-[14px] text-[#1A1A1A] placeholder-[#9A9A9A] outline-none"
                  style={{ fontFamily: 'Inter,Roboto,sans-serif' }}
                />
                <span className={`text-[11px] ${counterColor}`}>{input.length}/{MAX_CHARS}</span>
              </div>

              <button
                onClick={() => runChat(input)}
                disabled={loading || !input.trim() || rateLimited}
                className="h-12 px-4 rounded-[10px] bg-[#3A8DFF] text-white text-[14px] font-semibold flex items-center justify-center disabled:opacity-50"
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

            {error && (
              <div className="text-[12px] text-red-600 mt-1">{error}</div>
            )}

            <div className="flex items-center justify-end text-[11px] text-slate-500 mt-1">
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
  );
}

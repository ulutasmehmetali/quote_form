import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../lib/api';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const initialAssistant = 'Hi there! How can I help you?';
const quickPrompts = [
  'I need emergency repair',
  'What services do you offer?',
  'How soon can you schedule?',
  'I need an expert to call me',
  'I have another question',
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
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

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
  };

  const saveLead = async (payload = lead) => {
    if (submitting || submitted) return;
    const ready =
      payload.name &&
      payload.phone &&
      payload.email &&
      payload.serviceType &&
      payload.zipCode &&
      payload.description;
    if (!ready) return;

    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/chat/submit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || 'Failed to save');
      setSubmitted(true);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Thanks! I saved your details. A service specialist will contact you shortly.',
        },
      ]);
    } catch (err) {
      setError('Could not save your details, please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const runChat = async (userText: string) => {
    const trimmed = userText.trim();
    if (!trimmed || loading) return;
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
      if (!res.ok) throw new Error(`Request failed (${res.status})`);

      const data = await res.json();
      const reply =
        typeof data?.reply === 'string' && data.reply.trim()
          ? data.reply.trim()
          : "I'm here to help. Can you rephrase that?";

      const allMessages = [...nextMessages, { role: 'assistant', content: reply }];
      setMessages(allMessages);

      // Extract lead fields and auto-save if ready
      try {
        const ex = await fetch(apiUrl('/api/chat/extract'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: allMessages }),
        });
        const exData = await ex.json();
        if (exData?.lead) {
          setLead((prev) => ({ ...prev, ...exData.lead }));
          const ready =
            exData.ready ||
            (exData.lead?.name &&
              exData.lead?.phone &&
              exData.lead?.email &&
              exData.lead?.serviceType &&
              exData.lead?.zipCode &&
              exData.lead?.description);
          if (ready && !submitted) {
            await saveLead({ ...lead, ...exData.lead });
          }
        }
      } catch {
        // ignore extract errors
      }
    } catch (err) {
      setError('I had trouble answering. Please try again.');
      setMessages([
        ...nextMessages,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
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

  const wrapperClass = open
    ? 'fixed bottom-6 right-6 z-50 w-[22rem] max-w-[22rem] sm:max-w-[23rem]'
    : 'fixed bottom-6 right-6 z-50 w-[4rem] h-[4rem] sm:w-[4.5rem] sm:h-[4.5rem]';

  return (
    <>
      <div className={wrapperClass}>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center justify-center h-14 w-14 rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-blue-600 text-white shadow-xl shadow-sky-600/30 hover:shadow-sky-500/50 transition-all ring-2 ring-sky-500/30 hover:ring-sky-400/50 text-sm"
            aria-label="Open AI assistant"
          >
            <img
              src="/robot-icon.svg"
              alt="AI robot"
              className="h-7 w-7 rounded-full shadow-md shadow-sky-500/30"
              loading="lazy"
            />
          </button>
        )}

        {open && (
          <div className="w-full bg-white rounded-3xl shadow-[0_12px_28px_rgba(0,0,0,0.15)] overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-3.5 py-3 bg-teal-600 text-white">
              <div className="flex items-center gap-3">
                <img
                  src="/robot-icon.svg"
                  alt="AI robot"
                  className="h-8 w-8 rounded-full shadow-md shadow-white/30 bg-white"
                  loading="lazy"
                />
                <div>
                  <p className="text-white font-semibold text-sm leading-tight">Customer Service Agent</p>
                  <p className="text-xs text-white/80 leading-tight">How can I help you?</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white hover:text-white transition-colors"
                aria-label="Close chat"
              >
                ×
              </button>
            </div>

            <div className="px-3.5 py-2 bg-white flex flex-wrap gap-2 max-h-24 overflow-y-auto">
              {quickPrompts.map((p) => (
                <button
                  key={p}
                  onClick={() => runChat(p)}
                  disabled={loading}
                  className="text-[12px] px-3 py-1.5 rounded-full bg-teal-600 text-white hover:bg-teal-700 transition disabled:opacity-50 whitespace-nowrap"
                >
                  {p}
                </button>
              ))}
            </div>

            {error && (
              <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 text-red-500 text-xs">
                {error}
              </div>
            )}

            <div
              ref={listRef}
              className="max-h-[22rem] sm:max-h-[24rem] overflow-y-auto px-3 py-3 space-y-2 bg-white"
            >
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`px-3 py-2 rounded-2xl text-sm max-w-[82%] whitespace-pre-wrap shadow ${
                      m.role === 'user'
                        ? 'bg-teal-600 text-white rounded-br-sm'
                        : 'bg-slate-100 text-slate-900 rounded-bl-sm'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-xl text-sm bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping"></span>
                    Thinking...
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-white border-t border-slate-200 space-y-2">
              <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-inner shadow-slate-200 border border-slate-200">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Write your message..."
                  className="flex-1 px-2 py-2 rounded-full bg-transparent text-slate-900 placeholder-slate-500 focus:outline-none"
                />
                <button
                  onClick={() => runChat(input)}
                  disabled={loading || !input.trim()}
                  className="p-2 rounded-full bg-teal-600 text-white shadow-lg shadow-teal-500/40 disabled:opacity-50"
                  aria-label="Send message"
                >
                  &gt;
                </button>
              </div>
              <div className="flex items-center justify-end text-[11px] text-slate-500">
                <button
                  onClick={resetChat}
                  className="text-slate-500 hover:text-slate-700 transition-colors"
                  disabled={loading}
                >
                  New chat
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

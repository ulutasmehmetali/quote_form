import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../lib/api';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const initialAssistant = `Hi there! How can I help you?`;
const quickPrompts = [
  'I need emergency repair',
  'What services do you offer?',
  'How soon can you schedule?',
  'Can I get a quote?',
  'I want to speak to an expert',
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

      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }

      const data = await res.json();
      const reply = typeof data?.reply === 'string' && data.reply.trim()
        ? data.reply.trim()
        : "I'm here to help. Can you rephrase that?";

      setMessages([...nextMessages, { role: 'assistant', content: reply }]);
      // Try to extract structured lead fields after AI reply
      try {
        const ex = await fetch(apiUrl('/api/chat/extract'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [...nextMessages, { role: 'assistant', content: reply }] }),
        });
        const data = await ex.json();
        if (data?.lead) {
          setLead((prev) => ({ ...prev, ...data.lead }));
          const ready =
            data.ready ||
            (data.lead?.name &&
              data.lead?.phone &&
              data.lead?.email &&
              data.lead?.serviceType &&
              data.lead?.zipCode &&
              data.lead?.description);
          if (ready && !submitted) {
            await saveLead({ ...lead, ...data.lead });
          }
        }
      } catch {
        // ignore extraction errors
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

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 w-full max-w-[14rem] sm:max-w-[16rem]">
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-blue-600 text-white shadow-xl shadow-sky-600/30 hover:shadow-sky-500/50 transition-all ring-2 ring-sky-500/30 hover:ring-sky-400/50 w-full justify-between text-sm"
            aria-label="Open AI assistant"
          >
            <img
              src="/robot-icon.svg"
              alt="AI robot"
              className="h-6 w-6 rounded-full shadow-md shadow-sky-500/30"
              loading="lazy"
            />
            <div className="text-left leading-tight flex-1 ml-1">
              <p className="font-semibold">Ask AI</p>
              <p className="text-[10px] text-white/80">24/7 guided help</p>
            </div>
          </button>
        )}

        {open && (
          <div className="w-full max-w-[19rem] sm:max-w-[20rem] bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 rounded-3xl shadow-[0_15px_45px_rgba(0,0,0,0.35)] overflow-hidden border border-slate-800/70">
            <div className="flex items-center justify-between px-3 py-2.5 bg-slate-900/90 border-b border-slate-800/70">
              <div className="flex items-center gap-3">
                <img
                  src="/robot-icon.svg"
                  alt="AI robot"
                  className="h-8 w-8 rounded-full shadow-md shadow-sky-500/30 bg-white"
                  loading="lazy"
                />
                <div>
                  <p className="text-white font-semibold text-sm leading-tight">AI Assistant</p>
                  <p className="text-xs text-slate-300 leading-tight">How can I help you?</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-300 hover:text-white transition-colors"
                aria-label="Close chat"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 text-red-200 text-xs">
                {error}
              </div>
            )}

            <div
              ref={listRef}
              className="max-h-[22rem] sm:max-h-[24rem] overflow-y-auto px-3 py-3 space-y-2 bg-slate-900/40"
            >
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`px-3 py-2 rounded-2xl text-sm max-w-[82%] whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-slate-900 text-white shadow-lg shadow-black/40 rounded-br-sm'
                        : 'bg-slate-100 text-slate-900 border border-slate-200 shadow-md shadow-slate-200/80 rounded-bl-sm'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-xl text-sm bg-slate-800 text-slate-100 border border-white/10 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping"></span>
                    Thinking...
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-900/90 border-t border-slate-800/70 space-y-2">
              <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-inner shadow-slate-400/40">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Write..."
                  className="flex-1 px-2 py-2 rounded-full bg-transparent text-slate-900 placeholder-slate-500 focus:outline-none"
                />
                <button
                  onClick={() => runChat(input)}
                  disabled={loading || !input.trim()}
                  className="p-2 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-500/40 disabled:opacity-50"
                  aria-label="Send message"
                >
                  ➤
                </button>
              </div>
              <div className="flex items-center justify-end text-[11px] text-slate-400">
                <button
                  onClick={resetChat}
                  className="text-slate-300 hover:text-white transition-colors"
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

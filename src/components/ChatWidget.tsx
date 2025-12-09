import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../lib/api';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const initialAssistant = `Hi there! How can I help you?`;

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
  const [savingLead, setSavingLead] = useState(false);
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

  const saveLead = async () => {
    if (!lead.name || !lead.phone || !lead.email || !lead.serviceType || !lead.zipCode || !lead.description) {
      setError('Please fill all required fields.');
      return;
    }
    setSavingLead(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/chat/submit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error || `Failed: ${res.status}`);
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Saved! We received your details.' }]);
      setLead({
        name: '',
        phone: '',
        email: '',
        serviceType: '',
        zipCode: '',
        urgency: '',
        description: '',
      });
    } catch (err: any) {
      setError('Failed to save. Please try again.');
    } finally {
      setSavingLead(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 w-full max-w-sm sm:max-w-md">
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-3 px-4 py-3 rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-blue-600 text-white shadow-2xl shadow-sky-600/40 hover:shadow-sky-500/60 transition-all ring-2 ring-sky-500/30 hover:ring-sky-400/50 w-full justify-between"
            aria-label="Open AI assistant"
          >
            <img
              src="/robot-icon.svg"
              alt="AI robot"
              className="h-7 w-7 rounded-full shadow-md shadow-sky-500/30"
              loading="lazy"
            />
            <div className="text-left leading-tight">
              <p className="font-semibold">Ask AI</p>
              <p className="text-[11px] text-white/80">24/7 guided help</p>
            </div>
          </button>
        )}

        {open && (
          <div className="w-full max-w-md sm:max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 rounded-3xl shadow-[0_15px_45px_rgba(0,0,0,0.35)] overflow-hidden border border-slate-800/70">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800/70">
              <div className="flex items-center gap-3">
                <img
                  src="/robot-icon.svg"
                  alt="AI robot"
                  className="h-10 w-10 rounded-full shadow-md shadow-sky-500/30 bg-white"
                  loading="lazy"
                />
                <div>
                  <p className="text-white font-semibold text-sm">AI Assistant</p>
                  <p className="text-xs text-slate-300">How can I help you?</p>
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
              className="max-h-[26rem] sm:max-h-[28rem] overflow-y-auto px-4 py-3 space-y-3 bg-slate-900/40"
            >
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`px-3 py-2 rounded-2xl text-sm max-w-[85%] whitespace-pre-wrap ${
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

            <div className="px-4 pb-2 space-y-2 bg-slate-900/60 text-slate-200 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} placeholder="Name *" className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50" />
                <input value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} placeholder="Phone *" className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50" />
                <input value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} placeholder="Email *" className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50" />
                <input value={lead.serviceType} onChange={(e) => setLead({ ...lead, serviceType: e.target.value })} placeholder="Service *" className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50" />
                <input value={lead.zipCode} onChange={(e) => setLead({ ...lead, zipCode: e.target.value })} placeholder="City/ZIP *" className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50" />
                <input value={lead.urgency} onChange={(e) => setLead({ ...lead, urgency: e.target.value })} placeholder="Urgency" className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50" />
              </div>
              <textarea value={lead.description} onChange={(e) => setLead({ ...lead, description: e.target.value })} placeholder="Short description *" className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50" rows={2}></textarea>
              <button onClick={saveLead} disabled={savingLead} className="w-full py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-semibold shadow-lg shadow-sky-600/40 disabled:opacity-50">
                {savingLead ? 'Saving...' : 'Save to submissions'}
              </button>
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

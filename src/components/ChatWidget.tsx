import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../lib/api';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const initialAssistant = `Hi there! I can guide you. What service do you need, which city, and how urgent is it? I won't ask for passwords or card numbers.`;
const quickPrompts = [
  'Help me choose the right service',
  'Ask me the key questions to debug my issue',
  'Draft a response to a customer',
  'Explain this error in plain English',
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: initialAssistant },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-3 px-4 py-3 rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-blue-600 text-white shadow-2xl shadow-sky-600/40 hover:shadow-sky-500/60 transition-all ring-2 ring-sky-500/30 hover:ring-sky-400/50"
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
          <div className="w-full max-w-md sm:max-w-lg bg-gradient-to-br from-white via-slate-50 to-white border border-slate-200 rounded-2xl shadow-2xl shadow-sky-200/50 overflow-hidden backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 py-3 bg-white/90 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <img
                  src="/robot-icon.svg"
                  alt="AI robot"
                  className="h-8 w-8 rounded-full shadow-md shadow-sky-500/30 bg-white"
                  loading="lazy"
                />
                <div>
                  <p className="text-slate-900 font-semibold text-sm">AI Assistant</p>
                  <p className="text-xs text-slate-500">Fast answers, safe guidance</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 text-[11px] px-2 py-1 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Online
                </span>
                <button
                  onClick={() => setOpen(false)}
                  className="text-slate-500 hover:text-slate-900 transition-colors"
                  aria-label="Close chat"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="px-4 py-2 bg-white/85 border-b border-slate-200 flex flex-wrap gap-2 items-center">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => runChat(prompt)}
                  disabled={loading}
                  className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 hover:border-sky-400 hover:text-slate-900 transition disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
              <span className="text-[11px] text-slate-500 ml-auto">Safety: never share passwords or card numbers.</span>
            </div>

            {error && (
              <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 text-red-200 text-xs">
                {error}
              </div>
            )}

            <div
              ref={listRef}
              className="max-h-[26rem] sm:max-h-[28rem] overflow-y-auto px-4 py-3 space-y-3 bg-white/80"
            >
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`px-3 py-2 rounded-xl text-sm max-w-[85%] whitespace-pre-wrap border ${
                      m.role === 'user'
                        ? 'bg-sky-50 text-sky-900 border-sky-200 shadow-md shadow-sky-100/70'
                        : 'bg-slate-100 text-slate-900 border-slate-200 shadow-md shadow-slate-200/80'
                    }`}
                  >
                    <div className="text-[11px] uppercase tracking-wide opacity-70 mb-1">
                      {m.role === 'user' ? 'You' : 'AI'}
                    </div>
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

            <div className="p-3 bg-slate-800/80 border-t border-white/10 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Describe your issue or paste an error..."
                  className="flex-1 px-3 py-2 rounded-2xl bg-white border border-slate-200 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/30"
                />
                <button
                  onClick={() => runChat(input)}
                  disabled={loading || !input.trim()}
                  className="px-3 py-2 rounded-2xl bg-gradient-to-r from-sky-500 via-indigo-500 to-blue-600 text-white font-medium shadow-lg shadow-sky-500/30 disabled:opacity-50"
                >
                  Send
                </button>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>AI may be imperfect. Avoid sharing sensitive data.</span>
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

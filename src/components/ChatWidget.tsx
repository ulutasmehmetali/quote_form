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
            className="flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-xl shadow-sky-500/30 hover:shadow-sky-500/50 transition-all"
            aria-label="Open AI assistant"
          >
            <span className="text-lg" aria-hidden="true">💬</span>
            <span className="font-semibold">Ask AI</span>
          </button>
        )}

        {open && (
          <div className="w-80 sm:w-96 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-lg" aria-hidden="true">💬</span>
                <div>
                  <p className="text-white font-semibold text-sm">AI Assistant</p>
                  <p className="text-xs text-slate-400">Fast answers, safe guidance</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] px-2 py-1 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Online
                </span>
                <button
                  onClick={() => setOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                  aria-label="Close chat"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="px-4 py-2 bg-slate-900/80 border-b border-white/10 flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => runChat(prompt)}
                  disabled={loading}
                  className="text-xs px-3 py-1.5 rounded-full bg-slate-800 text-slate-200 border border-white/10 hover:border-sky-500/50 hover:text-white transition disabled:opacity-50"
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
              className="max-h-80 overflow-y-auto px-4 py-3 space-y-3 bg-slate-900/80"
            >
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`px-3 py-2 rounded-xl text-sm max-w-[85%] whitespace-pre-wrap border ${
                      m.role === 'user'
                        ? 'bg-sky-500/15 text-sky-50 border-sky-500/30'
                        : 'bg-slate-800 text-slate-100 border-white/10'
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
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
                />
                <button
                  onClick={() => runChat(input)}
                  disabled={loading || !input.trim()}
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium shadow-lg shadow-sky-500/25 disabled:opacity-50"
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

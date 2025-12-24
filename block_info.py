from pathlib import Path
text = Path('src/admin/pages/AdminDashboard.tsx').read_text(encoding='utf-8')
start_marker = '            <div className="h-64 flex items-end gap-1 relative">'
end_marker = '          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">'
start = text.index(start_marker)
end = text.index(end_marker, start)
print(start, end)
print(repr(text[start:end]))

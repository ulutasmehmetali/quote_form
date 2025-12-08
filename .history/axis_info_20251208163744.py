from pathlib import Path
text = Path('src/admin/pages/AdminDashboard.tsx').read_text(encoding='utf-8')
marker = '              <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-slate-500 pr-2">'
start = text.index(marker)
end = start + len(text[start:].split('              </div>', 1)[0]) + len('              </div>\n')
print(repr(text[start:end]))

from pathlib import Path
text = Path('src/admin/pages/AdminDashboard.tsx').read_text(encoding='utf-8')
marker_h3 = '            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">'
pos = text.index(marker_h3)
start = text.find('<div className="relative">', pos)
print(start)
print(repr(text[start:start+200]))

from pathlib import Path
path = Path('src/admin/pages/AdminDashboard.tsx')
text = path.read_text(encoding='utf-8')
old = '            <div className="relative">\n\n\n\n              {Array.from({ length: 24 }, (_, hour) => {'
new = """            <div className=\"relative\">\n\n\n\n              <div className=\"absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-slate-500 pr-2\">\n\n\n\n                {hourlyAxisLabels.map((val, idx) => (\n\n\n\n                  <span key={`${val}-${idx}`}>{val}</span>\n\n\n\n                ))}\n\n\n\n              </div>\n\n\n\n              <div className=\"h-48 flex items-end gap-0.5 ml-8\">\n\n\n\n                {Array.from({ length: 24 }, (_, hour) => {\n"""
if old not in text:
    raise SystemExit('old relative block not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')

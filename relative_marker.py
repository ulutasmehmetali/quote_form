from pathlib import Path
text = Path('src/admin/pages/AdminDashboard.tsx').read_text(encoding='utf-8')
marker = '            <div className="relative">\r\n\r\n\r\n\r\n              {Array.from({ length: 24 }, (_, hour) => {'
pos = text.index(marker)
print(pos)
print(repr(text[pos:pos+120]))

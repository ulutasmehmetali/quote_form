from pathlib import Path
text = Path('src/admin/pages/AdminDashboard.tsx').read_text(encoding='utf-8')
marker = '            <div className="h-64 flex items-end gap-1 relative">'
index = 0
while True:
    pos = text.find(marker, index)
    if pos == -1:
        break
    print('pos', pos)
    print(text[pos-100:pos+200])
    index = pos + 1

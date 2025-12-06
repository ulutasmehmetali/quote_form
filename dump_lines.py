from pathlib import Path
path = Path('src/admin/pages/AdminAutomations.tsx')
lines = path.read_text().splitlines()
for i in range(220, 330):
    print(f"{i+1}: {lines[i]}" if i < len(lines) else '')

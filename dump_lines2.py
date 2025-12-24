from pathlib import Path
path = Path('src/admin/pages/AdminAutomations.tsx')
lines = path.read_text().splitlines()
for i in range(540, 580):
    if i < len(lines):
        print(f"{i+1}: {lines[i]}")

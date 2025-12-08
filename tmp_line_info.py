from pathlib import Path
path = Path('server/adminRoutes.js')
lines = path.read_text().splitlines()
for i, line in enumerate(lines, 1):
    if 'const sessionUser' in line:
        print('login session block starts at line', i)
        break
for i, line in enumerate(lines, 1):
    if "SELECT \n      au.id" in line:
        print('admin select at line', i)
        break

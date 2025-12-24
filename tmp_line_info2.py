from pathlib import Path
path = Path('server/adminRoutes.js')
lines = path.read_text().splitlines()
for i, line in enumerate(lines, 1):
    if 'FROM admin_users au' in line:
        print('admin list at line', i)
        break
for i, line in enumerate(lines, 1):
    if 'SELECT pd.*' in line and 'distribution-logs' in lines[i-7]:
        print('distribution logs block around line', i)
        break

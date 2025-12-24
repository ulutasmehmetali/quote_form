from pathlib import Path
for fname in ['shared/schema.ts','shared/schema.js']:
    lines = Path(fname).read_text().splitlines()
    for i,line in enumerate(lines,1):
        if 'partner_api_id' in line and 'admin_users' in ''.join(lines[max(0,i-5):i+5]):
            print(f"{fname} partner line at {i}: {line.strip()}")
            break

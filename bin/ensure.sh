#!/bin/bash
# Start the school app and Cloudflare tunnel, then keep one daily database backup.
set -u
ROOT=/root/sdit-baiturrahman
DB="$ROOT/data/sdit.db"
BACKUP_DIR="$ROOT/backups"
SDCARD_DIR=/sdcard/Documents/SDIT-Baiturrahman
LOG=/var/log/sdit.log
mkdir -p /run "$BACKUP_DIR" /var/log

exec 9>/run/sdit-ensure.lock
flock -n 9 || exit 0

if ! pgrep -x cloudflared >/dev/null 2>&1; then
  if [ -x /etc/init.d/cloudflared ]; then
    /etc/init.d/cloudflared start >>/var/log/cloudflared.log 2>&1 || true
  fi
  if ! pgrep -x cloudflared >/dev/null 2>&1 && [ -f /etc/cloudflared/token ]; then
    setsid /usr/bin/cloudflared --pidfile /run/cloudflared.pid --autoupdate-freq 24h0m0s tunnel run --token-file /etc/cloudflared/token >>/var/log/cloudflared.log 2>>/var/log/cloudflared.err < /dev/null &
  fi
fi

if [ -x /etc/init.d/sdit ]; then
  /etc/init.d/sdit start >>"$LOG" 2>&1 || true
elif ! python3 -c 'import socket; s=socket.socket(); raise SystemExit(0 if s.connect_ex(("127.0.0.1",5432))==0 else 1)'; then
  setsid python3 -u "$ROOT/server.py" >>"$LOG" 2>&1 < /dev/null &
  echo "$(date -Is) server started" >>"$LOG"
fi

python3 - "$DB" "$BACKUP_DIR" "$SDCARD_DIR" << 'PY'
import sqlite3, sys
from datetime import date
from pathlib import Path

src_path, backup_dir, sdcard_dir = sys.argv[1:]
today = date.today().isoformat()
dest_dir = Path(backup_dir)
dest_dir.mkdir(parents=True, exist_ok=True)
dest = dest_dir / f"sdit-{today}.db"
if not dest.exists():
    src = sqlite3.connect(src_path)
    out = sqlite3.connect(dest)
    src.backup(out)
    out.close()
    src.close()
    print(f"backup {dest}")
copies = sorted(dest_dir.glob("sdit-*.db"))
for old in copies[:-7]:
    old.unlink()
try:
    card = Path(sdcard_dir)
    card.mkdir(parents=True, exist_ok=True)
    target = card / dest.name
    if dest.exists() and not target.exists():
        target.write_bytes(dest.read_bytes())
    card_copies = sorted(card.glob("sdit-*.db"))
    for old in card_copies[:-7]:
        old.unlink()
except OSError as exc:
    print(f"sdcard backup skipped: {exc}")
PY

if [ "${1:-}" != "--no-watchdog" ] && ! pgrep -f '/root/sdit-baiturrahman/bin/watchdog.sh' >/dev/null 2>&1; then
  nohup setsid "$ROOT/bin/watchdog.sh" >>/var/log/sdit-watchdog.log 2>&1 < /dev/null &
  disown || true
fi

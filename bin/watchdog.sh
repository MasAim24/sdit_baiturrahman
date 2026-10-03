#!/bin/bash
# sdit-watchdog: bring the app and tunnel back if either stops.
echo "$(date -Is) watchdog started" >>/var/log/sdit-watchdog.log
while true; do
  /root/sdit-baiturrahman/bin/ensure.sh --no-watchdog
  sleep 900
done

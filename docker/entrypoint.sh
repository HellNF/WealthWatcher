#!/bin/sh
# docker/entrypoint.sh — Avvia crond (busybox) in background per i job
# schedulati (bank-sync, snapshot, market-refresh — vedi docker/crontab), poi
# sostituisce il processo corrente col server Next.js (exec, così resta PID 1
# e riceve correttamente i segnali di stop/restart di Docker).
set -e

crond -b -l 8

exec node server.js

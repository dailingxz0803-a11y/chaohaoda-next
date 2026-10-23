#!/bin/bash
# 停止监听默认端口的本地服务（只停监听进程，不影响浏览器等客户端）
PORT="${PORT:-8780}"
PIDS="$(lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [ -z "$PIDS" ]; then
  echo "端口 $PORT 上没有运行中的服务。"
  exit 0
fi
# shellcheck disable=SC2086
kill $PIDS
echo "已停止端口 $PORT 上的服务（PID: $PIDS）。"

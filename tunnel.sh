#!/bin/sh
set -e
cd "$(dirname "$0")"

mkdir -p .data
BIN=".data/cloudflared"
if [ ! -x "$BIN" ]; then
  echo "下载 cloudflared…"
  case "$(uname -m)" in
    arm64) PKG="cloudflared-darwin-arm64.tgz" ;;
    *) PKG="cloudflared-darwin-amd64.tgz" ;;
  esac
  curl -L --fail --silent --show-error \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/$PKG" \
    -o .data/cloudflared.tgz
  tar xzf .data/cloudflared.tgz -C .data
  chmod +x "$BIN" 2>/dev/null || chmod +x .data/cloudflared
fi

if [ -f .data/tunnel.pid ] && kill -0 "$(cat .data/tunnel.pid)" 2>/dev/null; then
  kill "$(cat .data/tunnel.pid)" 2>/dev/null || true
  sleep 1
fi

nohup "$BIN" tunnel --url http://127.0.0.1:8780 --no-autoupdate > .data/tunnel.log 2>&1 &
echo $! > .data/tunnel.pid
echo "等待公网地址…"

URL=""
i=0
while [ $i -lt 25 ]; do
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' .data/tunnel.log 2>/dev/null | head -1 || true)
  [ -n "$URL" ] && break
  i=$((i + 1))
  sleep 1
done

if [ -z "$URL" ]; then
  echo "获取公网地址失败，请查看 .data/tunnel.log"
  exit 1
fi

if grep -q '^PUBLIC_BASE_URL=' .env.local 2>/dev/null; then
  sed -i '' "s#^PUBLIC_BASE_URL=.*#PUBLIC_BASE_URL=$URL#" .env.local
else
  printf '\nPUBLIC_BASE_URL=%s\n' "$URL" >> .env.local
fi

./stop.sh >/dev/null 2>&1 || true
sleep 1
nohup ./start.sh > .data/server.log 2>&1 &
sleep 2

echo "公网地址: $URL"
echo "分享二维码会自动使用这个地址。"

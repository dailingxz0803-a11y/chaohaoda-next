#!/bin/bash
# 抄好搭 Next 启动脚本：构建前端并启动本地服务
# 用法：./start.sh           默认 http://127.0.0.1:8780
#       PORT=8790 ./start.sh  换端口
set -euo pipefail
cd "$(dirname "$0")"

find_node() {
  local candidate major
  for candidate in "${NODE_BIN:-}" "$(command -v node 2>/dev/null || true)" \
    "/Users/dailing01/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node" \
    /opt/homebrew/bin/node /usr/local/bin/node; do
    [ -n "$candidate" ] && [ -x "$candidate" ] || continue
    major="$("$candidate" -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
    if [ "$major" -ge 20 ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

NODE="$(find_node)" || {
  echo "未找到 Node.js 20+。请安装 Node.js 20 或以上版本后重试。"
  exit 1
}

echo "Node $("$NODE" -v) · 构建前端…"
"$NODE" scripts/build.mjs
export PORT="${PORT:-8780}"
exec "$NODE" server/index.mjs

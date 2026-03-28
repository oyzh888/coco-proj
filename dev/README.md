# Coco AI — Dev Prototype

**穿搭推荐 AI Demo**，前后端原型，接 OpenClaw 多模态后端。

## 架构

```
Browser (cloth.aitist.ai)
    ↓ HTTPS
Cloudflare (coco-tunnel)
    ↓
nginx :3088 (frontend) / :3089 (backend)
    ↓
React dist/            FastAPI :8000
                           ↓
                   OpenClaw Gateway :18789
                           ↓
                    master bot (Claude)
```

## 服务地址

| 服务 | 公网地址 | 本地端口 |
|------|----------|---------|
| 前端 | https://cloth.aitist.ai | :3088 |
| 后端 API | https://cloth-backend.aitist.ai | :3089 → :8000 |
| Swagger docs | https://cloth-backend.aitist.ai/docs | — |

## 本地路径（服务器）

```
/app/steve/coco-proj/
├── dev/
│   ├── backend/
│   │   ├── server.py       ← FastAPI 主文件
│   │   ├── .env            ← 敏感配置（gitignore）
│   │   └── venv/           ← Python 虚拟环境（gitignore）
│   └── frontend/
│       ├── src/App.jsx     ← 前端主组件（穿搭 UI）
│       ├── src/App.css     ← 样式
│       └── dist/           ← Vite build 产物（nginx serve）
```

## API 接口

### POST `/api/outfit` — 穿搭推荐（主接口）
```json
{
  "location": "San Francisco, CA",
  "mood": "Casual",
  "scene": "Daily",
  "closet_image_base64": null  // 可选，衣橱照片 base64
}
```
返回：`{ "text": "穿搭建议", "images": [] }`

### POST `/api/chat` — 通用对话
```json
{ "message": "你好", "image_base64": null }
```

### GET `/health`
```json
{ "status": "ok", "agent_id": "master" }
```

## 部署（团队协作）

**前端改了（`src/` 下文件）：**
```bash
cd /app/steve/coco-proj && git pull
cd dev/frontend && npm run build
# nginx 自动加载新 dist/，不用重启
```

**后端改了（`server.py`）：**
```bash
cd /app/steve/coco-proj && git pull
pkill -f "uvicorn server:app"
cd dev/backend && source venv/bin/activate
nohup uvicorn server:app --host 0.0.0.0 --port 8000 > /tmp/coco-backend.log 2>&1 &
```

**或者直接@机器人说"帮我 pull 最新代码"。**

## Cloudflare 配置

- Tunnel: `coco-tunnel` (ID: `0473bda6-e9ca-4f2f-b25e-8090afca7b20`)
- 专属 tunnel，与 nas-tunnel 完全隔离（避免多机器 502 问题）
- Config: `/etc/cloudflared/coco-tunnel.yml`

## 本地开发

```bash
# 后端
cd dev/backend
cp .env.example .env  # 填入 OpenClaw token
pip install -r requirements.txt
uvicorn server:app --reload --port 8000

# 前端（开发模式，API 代理到 cloth-backend.aitist.ai）
cd dev/frontend
npm install
npm run dev
# 访问 http://localhost:5173
```

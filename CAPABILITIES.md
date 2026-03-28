# ATELIER Bot — AI Stylist Capabilities

> 本文档记录了在 Hackathon 筹备过程中，AI Bot 展示的核心能力，以及实现方式和部署所需条件。

---

## 🎯 能力总览

| 能力 | 描述 | 核心技术 |
|------|------|---------|
| 穿搭识别 | 上传照片 → 识别衣物品类/颜色/风格 | GPT-4o Vision |
| AI 换装 | 输入场合/风格 → 把照片上的人换成对应穿搭 | Gemini 3 Pro Image Edit |
| 搭配建议 | 单件衣物 → 生成多套搭配方案图 | Gemini 3 Pro Image Gen |
| 购买链接 | 识别穿搭 → 匹配 Amazon 商品链接 | Web Search + 商品搜索 |
| 语音理解 | 发语音 → 自动转文字 → 理解并执行 | OpenAI Whisper API |
| 约会场景推荐 | 描述约会对象 → AI 推荐最合适穿搭 | GPT-4o + Gemini Image |

---

## 🛠 实现细节

### 1. 穿搭识别 (Outfit Recognition)

**实现方式：**
- 用户发送照片
- GPT-4o Vision 分析图片，识别：
  - 衣物类型（上装/下装/鞋）
  - 颜色（charcoal gray / beige 等）
  - 款式（oversized / slim fit / cargo 等）
  - 整体风格标签

**所需 API：**
- `OPENAI_API_KEY` — GPT-4o Vision

**示例 Prompt：**
```
Analyze the clothing in this photo. Identify each piece:
type, color, style, fit. Then describe the overall style aesthetic.
```

---

### 2. AI 换装 (Outfit Swap / Virtual Try-On)

**实现方式：**
- 用户发送照片 + 描述目标场合/风格
- 使用 Gemini 3 Pro Image 的 Image Edit 功能
- 传入原图 + 详细 prompt，AI 生成换装后的图片
- 可以传入多张参考图（原图 + 目标服装图）

**所需 API：**
- `GEMINI_API_KEY` — Gemini 3 Pro Image

**核心命令：**
```bash
GEMINI_API_KEY="xxx" uv run generate_image.py \
  --prompt "Change outfit to [TARGET STYLE]. Keep face, hair, pose, background exactly same." \
  --filename "output.png" \
  -i "/path/to/person.jpg" \
  --resolution 2K
```

**多图参考（参考特定服装）：**
```bash
uv run generate_image.py \
  --prompt "Dress the person in the outfit shown in reference image..." \
  --filename "output.png" \
  -i "/path/to/person.jpg" \
  -i "/path/to/outfit-reference.jpg" \
  --resolution 2K
```

**Prompt 模板（保留人物特征）：**
```
Change the person's outfit to [STYLE DESCRIPTION]. 
Keep the person's face, hair, glasses, body shape, pose, and background EXACTLY the same. 
Only change the clothing. Realistic photo result.
```

**实际 demo 场景：**
- 卫衣 → 西装
- 便装 → Smart Casual（米色chino + 棕色乐福鞋）
- 便装 → 泳裤（夏威夷风）
- 同一人 → 约老富婆版 vs 约大学生版（双图对比）

---

### 3. 搭配方案生成 (Outfit Combination Generator)

**实现方式：**
- 传入单件衣物照片（或描述）
- 生成 2x2 grid，展示 4 种不同场合的搭配方案
- 每种方案标注风格标签

**Prompt 模板：**
```
Fashion lookbook showing [ITEM] styled 4 different ways as 2x2 grid.
Top-left: [STYLE 1 - casual]. Top-right: [STYLE 2 - smart casual].
Bottom-left: [STYLE 3 - outdoor]. Bottom-right: [STYLE 4 - sporty].
Clean white background, minimal fashion editorial style, labels for each outfit.
```

**同时提供穿搭分析：**
- 适合天气/温度范围
- 颜色搭配逻辑
- 每套的具体单品建议

---

### 4. 购买链接 (Shopping Link Finder)

**实现方式：**
- GPT-4o Vision 识别服装关键词
- 使用 Brave Web Search API 搜索 Amazon 商品
- 返回对应搜索页面链接

**所需 API：**
- `BRAVE_SEARCH_API_KEY` — Web 搜索

**示例搜索词生成：**
```
"dark charcoal gray crew neck sweatshirt men amazon"
"beige cargo pants men amazon"
```

**改进方向（Hackathon 升级版）：**
- 接入 Amazon Product API 获取精确商品链接 + 价格
- 或用 SerpAPI 抓取 Google Shopping 结果

---

### 5. 语音交互 (Voice Input)

**实现方式：**
- 用户发送语音消息（.ogg / .m4a）
- OpenAI Whisper API 转文字
- 传给主模型理解并执行

**所需 API：**
- `OPENAI_API_KEY` — Whisper

**核心命令：**
```bash
bash transcribe.sh /path/to/audio.ogg --language zh --out /tmp/transcript.txt
```

**支持语言：** 中文、英文、混合语言（自动识别）

---

### 6. 约会场景推荐 (Context-Aware Date Styling)

**核心逻辑：**
```
用户描述约会对象 (年龄/风格/场合)
→ GPT-4o 分析最合适的穿搭策略
→ Gemini Image 生成换装后的对比图
```

**Prompt 策略示例：**
```
Mature Wealthy Woman Date: navy blazer + V-neck shirt + dress shoes + silver watch
College Girl Date: white ribbed tank + baggy jeans + Air Force 1 + gold chain
```

---

## 🤖 部署新 Bot 所需条件

### 必需 API Keys

| Key | 用途 | 获取方式 |
|-----|------|---------|
| `OPENAI_API_KEY` | GPT-4o Vision + Whisper 语音转文字 | platform.openai.com |
| `GEMINI_API_KEY` | Gemini 3 Pro Image 换装/生成 | aistudio.google.com |
| `BRAVE_SEARCH_API_KEY` | 搜索 Amazon 购买链接 | api.search.brave.com |
| Telegram Bot Token | Bot 接入 Telegram | @BotFather |

### 所需 Skills/Tools

```
- openai-whisper-api (语音转文字)
- nano-banana-pro (Gemini Image 换装)
- web_search (购买链接搜索)
- GPT-4o Vision (穿搭识别)
```

### OpenClaw Config 示例

```json
{
  "env": {
    "vars": {
      "OPENAI_API_KEY": "sk-xxx",
      "GEMINI_API_KEY": "AIzaSy-xxx",
      "BRAVE_SEARCH_API_KEY": "BSA-xxx"
    }
  }
}
```

### 推荐模型

- 主模型：`anthropic/claude-sonnet-4-5` 或 `openai/gpt-4o`
- 图像生成：`google/gemini-3-pro` (via nano-banana-pro skill)
- 语音转文字：`openai/whisper-1`

---

## 📋 Demo 脚本（Hackathon 现场用）

### Demo A — 实时换装（最炸）
```
① 拍一张现场参与者的照片
② 说："我要去看歌剧" 或 "我要约会"
③ Bot 30秒内返回换装后的图片
④ 全场 wow
```

### Demo B — 约会场景对比
```
① 上传同一人照片
② 输入："帮我生成约老富婆 vs 约大学生的穿搭对比"
③ 返回双图对比，左右场景鲜明
④ Judge 笑，然后记住你们
```

### Demo C — 购买链接闭环
```
① AI 识别穿搭 → 列出所有单品
② 每件单品附 Amazon 购买链接
③ 点击真的能买 → 商业价值当场证明
```

---

## 🗂 项目文件结构建议

```
coco-proj/
├── README.md
├── CAPABILITIES.md          # 本文件
├── app/
│   ├── frontend/            # Next.js 14 + Tailwind
│   └── backend/             # Supabase functions
├── ai/
│   ├── outfit_recognition.py
│   ├── outfit_swap.py
│   ├── shopping_search.py
│   └── prompts/
│       ├── outfit_swap.txt
│       ├── date_styling.txt
│       └── combination_gen.txt
└── demo/
    ├── demo_a_swap.md
    ├── demo_b_date.md
    └── demo_c_shopping.md
```

---

*文档生成时间：2026-03-28 | 作者：Coco Team AI Bot*

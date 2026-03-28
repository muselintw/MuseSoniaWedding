# 💒 Muse & Sonia Wedding LINE Chatbot

LINE 官方帳號聊天機器人，部署於 Zeabur，使用 Supabase 作為資料庫。

## 功能

1. **好友加入紀錄** — 自動記錄 LINE UID、顯示名稱、加入時間至 Supabase
2. **桌次查詢** — 好友輸入姓名，自動回覆對應桌次
3. **推播通知** — 透過 Admin 頁面上傳 CSV 名單 + JSON Flex Message 一鍵推播

## 部署資訊

| 項目 | 值 |
|---|---|
| **平台** | [Zeabur](https://zeabur.com) (Free Plan, Jakarta) |
| **公開網域** | `https://musesoniawedding.zeabur.app` |
| **Webhook Endpoint** | `https://musesoniawedding.zeabur.app/webhook` |
| **Admin 推播頁面** | `https://musesoniawedding.zeabur.app/admin.html` |
| **資料庫** | [Supabase](https://supabase.com) — Project ID: `squlhymqeirtgnarsdoh` |

## 環境變數（Zeabur Dashboard → Variable）

| 變數名稱 | 說明 |
|---|---|
| `PORT` | 服務監聽埠（Zeabur 設為 `8080`） |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API Channel Access Token |
| `LINE_CHANNEL_SECRET` | LINE Messaging API Channel Secret |
| `SUPABASE_URL` | `https://squlhymqeirtgnarsdoh.supabase.co` |
| `SUPABASE_KEY` | Supabase anon/public key |

## LINE Developer Console 設定

1. 前往 [LINE Developers Console](https://developers.line.biz/console/)
2. **Webhook URL** 設為：`https://musesoniawedding.zeabur.app/webhook`
3. 開啟 **Use webhook**
4. 建議關閉 **Auto-reply messages**

## Supabase 資料庫

在 SQL Editor 執行：

```sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  line_uid TEXT UNIQUE NOT NULL,
  display_name TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 專案結構

```
├── server.js           # Express 進入點
├── lineBot.js          # LINE Webhook 事件處理
├── tableService.js     # 桌次 CSV 解析與查詢
├── pushService.js      # 推播 API（CSV + JSON 上傳）
├── supabaseClient.js   # Supabase 連線
├── public/admin.html   # 推播管理介面
├── 桌次_0328.csv             # 桌次安排資料
└── .env                # 環境變數（不進版控）
```

## 推播使用方式

1. 打開 `https://musesoniawedding.zeabur.app/admin.html`
2. 提供推播名單（上傳 CSV 或直接貼上 UID + 姓名，格式：`UID, 姓名`）
3. 提供 Flex Message JSON（上傳檔案或直接貼上）
4. 在 JSON 中使用 `{{Name}}` 作為個人化變數，系統會自動替換為每位賓客的姓名
5. 點擊「發送推播」

---

## 🚀 SaaS 架構升級規劃（Future Roadmap）

### Current Architecture

- **Monolithic Express.js server** — webhook, push API, admin UI, static files all in one process
- **Hardcoded single-tenant** — one LINE channel, one CSV, one set of Flex Messages, one Supabase table
- **No authentication** — anyone with the admin URL can push messages
- **Static HTML pages** — no component framework, no build step, inline CSS
- **File-based config** — Flex templates and seating data are flat files in the repo

### Priority Changes for SaaS

**🔴 Critical (Must-have before any paying customer)**
1. **Multi-tenancy** — Each customer needs their own LINE channel credentials, guest list, and templates, isolated from each other
2. **Authentication & Authorization** — Admin panel needs a login wall (Supabase Auth is available)
3. **Database-first architecture** — Move Flex templates, keyword→response mappings, and seating data into Supabase tables instead of flat files

**🟡 Important (Needed for iteration speed)**
4. **API-first design** — Separate backend API from frontend; Express as pure REST API, admin UI as standalone React/Next.js app
5. **Environment-based → DB-based config** — LINE credentials should be per-tenant database records, not `.env` variables
6. **Structured logging & error tracking** — Replace `console.error` with Pino + Sentry

**🟢 Nice-to-have (For scale)**
7. **Queue-based message sending** — Replace synchronous push loop with a job queue (Bull/Redis) to prevent HTTP timeouts at scale
8. **Webhook routing** — Single webhook endpoint routing incoming LINE events to correct tenant via `destination` field
9. **Template editor UI** — Visual Flex Message editor instead of raw JSON pasting

### Open Questions (To Be Decided)

1. **Target customer?** (A) Couples self-service, (B) Wedding planners/agencies, (C) General event organizers
2. **Monetization model?** Pay-per-event / monthly subscription / one-time fee
3. **How technical are users?** Raw JSON vs. no-code drag-and-drop template building
4. **Deployment preference?** Stay on Zeabur, or move to Vercel/Railway/AWS
5. **Timeline & budget?** Quick MVP in 2 weeks, or longer-term product vision
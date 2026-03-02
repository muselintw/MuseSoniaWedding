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
├── 桌次.csv             # 桌次安排資料
└── .env                # 環境變數（不進版控）
```

## 推播使用方式

1. 打開 `https://musesoniawedding.zeabur.app/admin.html`
2. 上傳包含 LINE UID 的 CSV 檔（UID 以 `U` 開頭，約 33 字元）
3. 上傳 Flex Message JSON 檔
4. 點擊「發送推播」
# LINE Wedding Chatbot — 完整開發規格書

> 本文件整理所有開發需求、提供過的憑證、資料檔案結構、以及先前部署遇到的錯誤與經驗，供重新開發使用。

---

## 1. 專案總覽

建立一個 **LINE 官方帳號聊天機器人**，用於婚禮活動。
- **後端框架**：Node.js + Express
- **資料庫**：Supabase (PostgreSQL)
- **部署平台**：Zeabur (Free Plan)
- **GitHub Repo**：`https://github.com/muselintw/MuseSoniaWedding`（private）

---

## 2. 功能需求

### 2.1 Webhook 好友追蹤（Follow Event）
- 接收 LINE Webhook `follow` event
- 用 `client.getProfile(userId)` 取得好友的 `displayName`
- 將 `line_uid`、`display_name`、`joined_at` 寫入 Supabase `users` table
- 使用 `upsert`（以 `line_uid` 為 conflict key），避免重複
- 回覆歡迎訊息，提示可輸入姓名查詢桌次
- LINE Webhook 文件：https://developers.line.biz/en/docs/messaging-api/receiving-messages/

### 2.2 桌次查詢（Message Event）
- 使用者輸入文字 → 比對 `桌次_0328.csv` → 回覆桌次
- 先精確比對，再部分比對（≥ 2 字元）
- 找到 → 回覆「您的桌次安排在【Table X】」
- 找不到 → 回覆找不到的提示訊息

### 2.3 推播功能（Push / Multicast）
- Admin 管理頁面，透過瀏覽器上傳兩個檔案：
  1. **CSV 檔**：包含要推播的 LINE UID（以 `U` 開頭，長度 > 25）
  2. **JSON 檔**：LINE Flex Message 模板
- 使用 `client.multicast()` 發送，每次最多 500 個 UID
- LINE Flex Message 文件：https://developers.line.biz/en/docs/messaging-api/using-flex-messages/

### 2.4 好友名單管理頁面
- 瀏覽器頁面顯示所有已加入好友的列表（LINE UID、名稱、加入時間）
- 提供 **CSV 下載** 功能（含 BOM 支援 Excel 中文）
- 這份 CSV 可直接作為推播名單使用

---

## 3. 憑證與環境變數

| 變數名稱 | 值 |
|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | `/aA/Gp7nZSREUVojUFzYidILlgrM/MmBpbNYU/fdsxBAEShCdgsuxwr1OaBJvZqQ84NPqePUlU12AdB7Osm+Nkd5hnMf46kDwfETbR8qvCpcN5hwy2uQo3mnGoet4N5sxD0vkW8Etz6VVPM004FlAQdB04t89/1O/w1cDnyilFU=` |
| `LINE_CHANNEL_SECRET` | `ace12dc925b580a872ca9a3a987c6e62` |
| `SUPABASE_URL` | `https://squlhymqeirtgnarsdoh.supabase.co` |
| `SUPABASE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxdWxoeW1xZWlydGduYXJzZG9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODMzMDAsImV4cCI6MjA4Nzk1OTMwMH0.6ov-e8Xl46PMLiKMjLrH6lgZcHoAlnHydzfslLSj6aM` |

> **注意**：不要在 Zeabur 上設定 `PORT` 環境變數。讓 Zeabur 自動注入或讓程式碼使用預設值。

---

## 4. Supabase 資料庫

- **Project ID**：`squlhymqeirtgnarsdoh`
- **`users` table 已建立**，SQL schema：

```sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  line_uid TEXT UNIQUE NOT NULL,
  display_name TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. 資料檔案

### 5.1 `桌次_0328.csv` 結構（129 行）

這個 CSV 有**不規則的兩區塊**格式：

**區塊 1（row 1-13）**：主桌 ~ Table 7
**區塊 2（row 14-26）**：Table 8 ~ Table 13

每個區塊的格式：
- **Header row**：偶數欄（col 0, 2, 4...）放 Table 名稱（如 `主桌`、`Table 2 (應媽)`）
- **Data rows**：`col 0` = 座號, `col 1` = 賓客名, `col 2` = 座號, `col 3` = 賓客名...
- **只取 column 0-13**（7 組 table pair），column 14+ 是另一個「座位總表」，不要當 table data 解析

範例（第 1 行是 header）：
```
主桌,,Table 2 (應媽),,Table 3 (應媽),,Table 4(應爸),,Table 5 (應爸),,Table 6 (應朋友),,Table 7 (教會朋友),,,,座位表,賓客名單,尚未安排座位
1-1,應爸,2-1,阿媽,3-1,大姐,4-1,大姑姑,5-1,二姑姑,6-1,Alice,7-1,瑩瑩,,,1/2,應媽,
```

解析邏輯：
1. 逐行掃描 col 0~13（每次 +2），如果偶數欄包含 `Table` 或 `主桌` → 這是 header row，記錄 table name
2. 非 header row → 偶數欄是座號，奇數欄是姓名，對應到最近的 header 的 table name
3. 成功解析應得到 **~127 位賓客**

### 5.2 `證婚 FLEX MESSAGE.txt`

這是一個完整的 LINE Flex Message JSON（bubble 格式），包含：
- 婚禮邀請圖片
- 地點：翡麗詩莊園 5F
- 證婚：2026.03.28 15:45
- 宴客：2026.03.28 17:30
- Dress Code 色塊
- 按鈕：證婚程序（YouTube）、停車場（Google Maps）

---

## 6. LINE Developer Console 設定

- **Webhook URL**：`https://musesoniawedding.zeabur.app/webhook`
- **Use webhook**：開啟
- **Auto-reply messages**：建議關閉

---

## 7. Zeabur 部署設定

- **方案**：Free Plan（Shared Cluster - Legacy, Jakarta）
- **Public Domain**：`musesoniawedding.zeabur.app`
- **GitHub Integration**：push to `main` 自動觸發 redeploy

### `package.json` 重點
```json
{
  "scripts": { "start": "node server.js" },
  "type": "commonjs"
}
```

---

## 8. 先前遇到的部署錯誤與教訓

> [!CAUTION]
> 以下是先前部署到 Zeabur 反覆遇到 502 / 404 的根本原因，**請務必注意**。

### 8.1 PORT 環境變數問題（最嚴重）
- Zeabur 會自動注入 `PORT` 環境變數
- 先前手動設定 `PORT=${WEB_PORT}`，結果程式收到的是字串 `"${WEB_PORT}"` 而非數字
- 導致 server 監聽在錯誤的 port，Zeabur gateway 無法連線 → 502
- **解法**：**不要在 Zeabur 設定 PORT 環境變數**，讓程式碼直接讀 `process.env.PORT`，Zeabur 會自動注入正確值

### 8.2 Express v5 問題
- 最初用了 `express@^5.2.1`（Express 5），有 breaking changes
- Express 5 的 middleware 與 routing 行為不同，LINE SDK middleware 可能不完全相容
- **解法**：使用 **Express 4**（`express@^4`）

### 8.3 Multer v2 問題
- 最初用了 `multer@^2.1.0`（Multer 2），有 breaking changes
- **解法**：使用 **Multer 1**（`multer@1.4.4-lts.1`）

### 8.4 Server Binding
- 必須綁定到 `0.0.0.0` 而非預設值（容器內 localhost 外部不可達）
- **解法**：`server.listen(port, '0.0.0.0', callback)`

### 8.5 Networking Tab 設定
- Zeabur Networking 的 Private port 和 Public domain 的 Container Port 必須與程式監聽的 port 一致
- 如果用 `process.env.PORT`，Zeabur 會自動處理 port 對應

---

## 9. 推薦的技術棧

```
express@^4          # 穩定版本
@line/bot-sdk@^10   # LINE SDK v10
@supabase/supabase-js@^2
csv-parse@^6        # CSV 解析（sync 模式）
multer@1.4.4-lts.1  # 檔案上傳
dotenv              # 本地開發用
```

---

## 10. 預期的路由結構

| Method | Path | 說明 |
|---|---|---|
| GET | `/` | Health check（回傳 `{status: "ok"}`）|
| POST | `/webhook` | LINE Webhook（需用 LINE middleware 驗證簽名）|
| GET | `/admin.html` | 推播管理頁面（靜態檔）|
| GET | `/friends.html` | 好友名單頁面（靜態檔）|
| POST | `/api/push` | 推播 API（接收 CSV + JSON 上傳）|
| GET | `/api/friends` | 好友列表 API（JSON）|
| GET | `/api/friends/csv` | 好友列表下載（CSV 檔）|

---

## 11. 專案檔案結構

```
├── server.js           # Express 進入點，路由設定
├── lineBot.js          # LINE SDK 整合，Webhook 事件處理
├── tableService.js     # 桌次 CSV 解析與查詢
├── pushService.js      # 推播功能 API
├── supabaseClient.js   # Supabase 連線
├── monitor.js          # 本地端 Zeabur 健康度檢查與 AppleScript iMessage 告警腳本
├── ecosystem.config.js # PM2 佈署設定檔（用於在背景自動執行 monitor.js）
├── public/
│   ├── admin.html      # 推播管理介面
│   └── friends.html    # 好友名單介面
├── 桌次_0328.csv             # 桌次安排資料（不規則格式）
├── 證婚 FLEX MESSAGE.txt # Flex Message 範本
├── .env                # 環境變數（不進版控）
├── .gitignore
├── package.json
└── README.md
```

---

## 12. 網站與監控系統 (Monitoring & URLs)

- **主機網址 (Health check)**：`https://musesoniawedding.zeabur.app/`
- **好友名單管理**：`https://musesoniawedding.zeabur.app/friends.html`
- **推播管理 (Admin)**：`https://musesoniawedding.zeabur.app/admin.html`

### 自動監控與斷線告警 (iMessage Alert)
由於 Zeabur 免費版沒有內建告警功能，目前已於**本機端 (Mac)** 部署了一套自動監控系統：
- **運作方式**：透過 `PM2`（程序名稱 `zeabur-monitor`）每 5 分鐘在背景自動 ping 一次主機。
- **告警條件**：若主機沒有回應（Timeout）、或是回傳 `502 Bad Gateway` / `404 Not Found` 連續達到 2 次。
- **通知管道**：使用 Mac 內建的 AppleScript 透過 `iMessage` 發送。
- **接收帳號 (Email)**：**`987ksk987@gmail.com`**

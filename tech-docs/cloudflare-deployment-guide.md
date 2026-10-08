# Cloudflare Worker 部署指南與維運技術文件

本文件記載 `workertest` 專案的實際環境資訊、Token 權限清單、CLI 指令與 Web GUI 操作步驟，以備日常維運與排查。

---

## 1. 核心專案與環境資訊 (Key Information)

| 項目                  | 數值 / 內容                                  | 說明                          |
| :-------------------- | :------------------------------------------- | :---------------------------- |
| Worker 名稱           | workertest                                   | 定義於 wrangler.jsonc         |
| Cloudflare Account ID | 827b99611b62c4ac9c6cfe95118973c3             | 帳號專屬識別碼                |
| 帳號名稱 / Email      | billy.lam@gmail.com                          | 管理者帳號                    |
| Workers.dev 子網域    | billy-lam-827                                | 帳號專屬 workers.dev 前綴     |
| 正式線上 URL          | https://workertest.billy-lam-827.workers.dev | 全球邊緣已發布端點            |
| 本機開發 Port         | 2020 (http://localhost:2020)                 | 透過 wrangler dev --port 2020 |
| GitHub 倉庫           | https://github.com/billy1030/workertest      | 主分支 main                   |
| GitHub Secret 名稱    | CLOUDFLARE_API_TOKEN                         | 用於 Actions 自動部署         |

---

## 2. API Token 建立流程與權限清單 (Token Creation Procedure)

### 2.1 建立 Token 連結與逐步步驟 (Step-by-Step Links)

1. **直達連結**：開啟瀏覽器前往 [Cloudflare API Tokens 建立頁面](https://dash.cloudflare.com/profile/api-tokens)。
   _(路徑：右上角個人頭像 ➔ **My Profile** ➔ 左側選單 **API Tokens**)  ( \*\*https://dash.cloudflare.com/profile/api-tokens )_
2. **選取範本**：

- 點擊藍色的 **「Create Token」** 按鈕。
- 找到 **「Edit Cloudflare Workers」** 範本，點擊右側的 **「Use template」**。

3. **核對權限範圍 (Scope)**：

- 確認已包含下方 2.2 清單中的權限。
- **Account Resources**：選擇 `All accounts`（或指定帳號）。
- **Zone Resources**：選擇 `All zones`（使用預設 `workers.dev` 網址時必須選 `All zones`）。

4. **生成與複製**：

- 滾動至底部點擊 **「Continue to summary」**。
- 點擊 **「Create Token」**。
- **立即複製顯示的 Token**（⚠️ 該金鑰只會顯示一次，請妥善保管）。

### 2.2 API Token 權限清單 (Permissions Matrix)

建立自訂 Token 時，確認包含以下權限：

- **Account Resources**:

- `Workers Scripts`: **Edit** (上傳/發布代碼)
- `Workers Observability`: **Edit** (即時日誌與監控)
- `Workers Tail`: **Read** (串流日誌檢視)
- `Workers KV Storage`: **Edit** (若未來擴充 KV 快取)
- `Account Settings`: **Read** (讀取帳號資訊)
- 範圍：`All accounts` (或指定帳號)
- **Zone Resources**:

- `Workers Routes`: **Edit** (路由配置)
- 範圍：`All zones` (使用 workers.dev 子網域時選此即可)
- **User Resources**:

- `User Details`: **Read**
- `Memberships`: **Read**

---

## 3. CLI 維運操作手冊 (Command-Line Interface)

### 3.1 本機開發與測試

```
# 啟動本機開發伺服器 (指定 Port 2020)
npx wrangler dev --port 2020

# 測試本機端點回應
curl.exe http://localhost:2020



### 3.2 驗證 Token 有效性




```

# 方式 A: 透過 Wrangler 檢查身份與帳號

$env:CLOUDFLARE_API_TOKEN="您的 Token"
npx wrangler whoami

# 方式 B: 透過 Cloudflare REST API 官方端點驗證

curl.exe -s "https://api.cloudflare.com/client/v4/user/tokens/verify" `
-H "Authorization: Bearer 您的 Token"

### 3.3 執行線上部署

```
# 設定環境變數後發布
$env:CLOUDFLARE_API_TOKEN="您的Token"
npx wrangler deploy

# 測試線上正式端點
curl.exe -s "https://workertest.billy-lam-827.workers.dev"



### 3.4 串流即時生產日誌 (Live Tail)




```

# 即時查看線上端點收到請求時的 console.log / 錯誤

npx wrangler tail workertest

---

## 4. Web GUI 維運操作手冊 (Cloudflare & GitHub Dashboard)

### 4.1 Cloudflare Dashboard

- **Workers 總覽與指標**：
  👉 [https://dash.cloudflare.com/827b99611b62c4ac9c6cfe95118973c3/workers-and-pages](https://dash.cloudflare.com/827b99611b62c4ac9c6cfe95118973c3/workers-and-pages)

- 查看請求數 (Requests)、CPU 耗時、錯誤率 (Error Rate)。
- **部署歷史與版本回退 (Rollback)**：

1. 進入 `workertest` ➔ 點擊 **Deployments** 分頁。
2. 若新版本有異常，可直接針對過去的 Version ID 點擊 **Rollback** 立即恢復。

- **即時日誌檢視 (Logs)**：

1. 進入 `workertest` ➔ **Logs** 分頁。
2. 點擊 **Begin log stream** 即可直接在網頁端串流觀察請求。

### 4.2 GitHub Dashboard

- **設定 CI/CD Secret**：
  👉 [https://github.com/billy1030/workertest/settings/secrets/actions](https://github.com/billy1030/workertest/settings/secrets/actions)

- 點擊 **New repository secret**
- Name: `CLOUDFLARE_API_TOKEN`
- Value: 填入您的 API Token
- **手動觸發部署 (Workflow Dispatch)**：
  👉 [https://github.com/billy1030/workertest/actions](https://github.com/billy1030/workertest/actions)

- 選擇 **Deploy to Cloudflare Workers** ➔ 點擊 **Run workflow**。

---

## 5. 常見問題與排查考量 (Troubleshooting & Considerations)

1. **Error: `This Worker does not exist on your account [code: 10007]`**：

- **原因**：初次發布新 Worker 且使用較舊版 Wrangler 時，查詢 subdomain 端點時可能遭遇版本相容性問題。
- **解決方式**：確認 `wrangler` 升級至 4.x 最新版本（本專案已完成相依套件升級）。

2. **安全性原則**：

- 本機 Token 僅保留於 [.token](../.token)，在 [.gitignore](../.gitignore) 中已設置忽略，切勿將明文 Token 提交至 Git。

3. **自訂網域 (Custom Domain)**：

- 目前使用 Cloudflare 免費子網域 `workers.dev`。
- 若未來需要綁定自有網域（如 `api.example.com`），只需在 Cloudflare Dashboard 的 `workertest` ➔ **Settings** ➔ **Domains & Routes** 新增 Custom Domain，不需更改核心代碼。

---

## 6. Next.js 專案從 Vercel 遷移至 Cloudflare 架構指引 (Vercel to Cloudflare)

> 📘 **專屬詳細指南**：請參閱獨立文件 [convert-vercel-to-cloudflare.md](./convert-vercel-to-cloudflare.md) 了解完整技術細節。

### 6.1 架構差異對照

- **執行環境**：Vercel 原生 Node.js Serverless ➔ Cloudflare Edge Runtime (Workerd / Workers)。
- **打包工具**：原生 `next build` ➔ `next build` 結合 `@cloudflare/next-on-pages` 生成 `.vercel/output/static` 與 `_worker.js`。

### 6.2 遷移五大關鍵步驟

1. **安裝工具**：`pnpm add -D @cloudflare/next-on-pages wrangler`。
2. **調整 `next.config.js`**：
   - 註解或移除 `output: 'standalone'`（避免 Windows 下 symlink 產生 `EPERM` 報錯）。
   - 加入 `images: { unoptimized: true }`。
3. **路由執行環境宣告**：在 API / 動態頁面加入 `export const runtime = 'edge'`。
4. **建立 `wrangler.toml`**：指定 `pages_build_output_dir = ".vercel/output/static"` 與 `compatibility_flags = ["nodejs_compat"]`。
5. **雲端 Linux 建置優先原則**：
   - 由於 `@cloudflare/next-on-pages` 在 Windows 下容易卡死，建議一律透過 GitHub Actions (Ubuntu 容器) 進行自動化編譯與部署。

---

## 7. 自訂網域 (Custom Domain) 配置實務與 Error 1001 排查

在將 Cloudflare Workers 或 Pages 綁定到獨立自訂網域（例如以 MoonTV 專案綁定 `tv.vonnandryan.com` 為例）時的關鍵實務：

### 7.1 常見誤區：Error 1001 (DNS Resolution Error)

- **問題現象**：在 DNS 區域添加了 `CNAME tv.vonnandryan.com -> moontv-1mv.pages.dev`，訪問時卻收到 `HTTP 409 Conflict (error code: 1001)` 與 SSL 握手失敗。
- **根本原因**：Cloudflare 邊緣伺服器需要安全校驗該主機名稱是否已與特定 Pages/Worker 專案綁定，否則不會放行該請求，也不會為其頒發邊緣 SSL 憑證。

### 7.2 標準配置 SOP

1. **進入專案設定**：前往 Cloudflare Dashboard ➔ 進入目標 Pages/Worker 專案。
2. **登記網域**：切換至 **Custom domains** 分頁 ➔ 點擊 **Set up a custom domain**。
3. **輸入網域名稱**：輸入主機名（如 `tv.vonnandryan.com`）並點擊 **Continue**。
4. **自動更新與啟用**：點擊 **Activate domain**，系統將自動配置路由並在 1 分鐘內完成 SSL 憑證簽發（狀態轉為綠燈 Active）。
5. **免重複部署**：此操作純屬路由綁定，**不需要**重新執行 `Create deployment`。

---

## 8. GitHub Secrets 的核心目的與安全機制 (Purpose of GitHub Secrets)

在 CI/CD 自動化流程中，GitHub Secrets 扮演著安全中樞的角色：

### 8.1 為什麼必須使用 GitHub Secrets？

- **避免金鑰寫入代碼 (Zero Hardcoded Credentials)**：
  若將 `CLOUDFLARE_API_TOKEN` 明文寫入 `.github/workflows/*.yml`，任何對該倉庫有讀取權限的人均可查看，甚至遭爬蟲自動掃描竊取。
- **程式碼與機密分離 (Separation of Code & Config)**：
  程式碼中僅保留語法引用 `${{ secrets.CLOUDFLARE_API_TOKEN }}`，實際機密值由倉庫管理員於後台安全存放。

### 8.2 四大關鍵安全防護機制

1. **單向寫入與非對稱加密 (Write-Only Storage)**：
   - 存入 Secret 後即經過強力加密，連管理者本人在網頁上也無法再次查看明文（只能覆蓋更新或刪除）。
2. **日誌自動遮罩 (Automatic Log Masking)**：
   - 若 CI/CD 執行期間的終端機輸出意外印出該 Token，GitHub Actions 系統會自動強制替換為 `***`，杜絕日誌外洩。
3. **記憶體生命週期隔離 (In-Memory Injection)**：
   - 僅在部署步驟執行當下暫時注入執行環境記憶體，部署完成後立即銷毀。
4. **存取權限控制 (Security Boundaries)**：
   - 外部 Fork 專案所發起的 Pull Request (PR) 預設無法存取倉庫 Secrets，防止惡意代碼竊取金鑰。

### 8.3 如何前往設定 GitHub Secrets (Where & How to Add)

#### 直達設定網址：

- **workertest 倉庫**：[https://github.com/billy1030/workertest/settings/secrets/actions](https://github.com/billy1030/workertest/settings/secrets/actions)
- **MoonTV 倉庫**：[https://github.com/billy1030/m2tv/settings/secrets/actions](https://github.com/billy1030/m2tv/settings/secrets/actions)

#### 手動點擊路徑：

1. 進入 GitHub 倉庫首頁。
2. 點擊頂部選單最右邊的 ⚙️ **「Settings」**。
3. 在左側選單往下找到 **Security** 區塊 ➔ 點擊 **「Secrets and variables」** ➔ 點擊 **「Actions」**。
4. 點擊綠色按鈕 **「New repository secret」**。
5. 填寫：
   - **Name**: `CLOUDFLARE_API_TOKEN`
   - **Secret**: 貼上您的 Cloudflare API Token
6. 點擊 **Add secret** 儲存。

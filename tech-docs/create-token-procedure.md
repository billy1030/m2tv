# Cloudflare API Token 申請與管理指南

本文件專門記載如何建立、配置、驗證與管理 Cloudflare API Token，供 Worker 自動化部署使用。

---

## 1. 快速直達連結 (Quick Links)

- **Cloudflare API Tokens 建立入口**：
  👉 [https://dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
- **手動點擊路徑**：
  登入 Cloudflare Dashboard ➔ 點擊右上角個人頭像圖示 ➔ **My Profile** ➔ 左側選單 **API Tokens**。
- **GitHub Repository Secrets 設定頁**：
  👉 [https://github.com/billy1030/workertest/settings/secrets/actions](https://github.com/billy1030/workertest/settings/secrets/actions)

---

## 2. 逐步建立流程 (Step-by-Step Procedure)

### 步驟 1：發起建立

1. 開啟 [API Tokens 管理頁面](https://dash.cloudflare.com/profile/api-tokens)。
2. 點擊藍色的 **「Create Token」** 按鈕。

### 步驟 2：選取範本

1. 在常用範本清單中找到 **「Edit Cloudflare Workers」**。
2. 點擊其右側的 **「Use template」** 按鈕。

### 步驟 3：設定權限與範圍 (Permissions & Scopes)

確認權限清單包含以下項目：

| 資源分類    | 權限名稱                | 存取等級 | 範圍選擇 (Scope) | 說明                                                              |
| :---------- | :---------------------- | :------- | :--------------- | :---------------------------------------------------------------- |
| **Account** | `Workers Scripts`       | **Edit** | `All accounts`   | 允許上傳、發布與更新 Worker 程式碼                                |
| **Account** | `Workers Observability` | **Edit** | `All accounts`   | 啟用 Worker 監控與日誌收集                                        |
| **Account** | `Workers Tail`          | **Read** | `All accounts`   | 支援終端機即時串流查看日誌 (`wrangler tail`)                      |
| **Account** | `Workers KV Storage`    | **Edit** | `All accounts`   | 預留給 KV 快取儲存使用                                            |
| **Account** | `Account Settings`      | **Read** | `All accounts`   | 讀取 Cloudflare Account ID 資訊                                   |
| **Zone**    | `Workers Routes`        | **Edit** | **`All zones`**  | **重要**：若使用 `*.workers.dev`，此處選 `All zones` 即可通過驗證 |
| **User**    | `User Details`          | **Read** | `All users`      | 辨識登入使用者身份                                                |
| **User**    | `Memberships`           | **Read** | `All users`      | 讀取組織與團隊成員權限                                            |

> 💡 **注意事項**：若未來要綁定特定自訂網域（Custom Domain），可在 Zone Resources 選擇 `Specific zone` ➔ 挑選特定網域名稱。

### 步驟 4：生成與保存

1. 滾動至頁面最下方，點擊藍色 **「Continue to summary」** 按鈕。
2. 檢查權限預覽無誤後，點擊 **「Create Token」**。
3. **複製 Token**：畫面會顯示一長串字元（例如 `cfut_...`）。
   - ⚠️ **極為重要**：此 Token **只會顯示這一次**，離開頁面後無法再次查看。請立即妥善保存。

---

## 3. Token 驗證方法 (Verification)

取得 Token 後，可透過以下任一方式驗證是否有效：

### 方式 A：透過 Cloudflare REST API 官方端點驗證

在終端機執行：

```powershell
curl.exe -s "https://api.cloudflare.com/client/v4/user/tokens/verify" `
  -H "Authorization: Bearer 您的Token"
```

**成功回應範例**：

```json
{
  "result": { "id": "...", "status": "active" },
  "success": true,
  "messages": [
    { "code": 10000, "message": "This API Token is valid and active" }
  ]
}
```

### 方式 B：透過 Wrangler CLI 驗證

```powershell
$env:CLOUDFLARE_API_TOKEN="您的Token"
npx wrangler whoami
```

若成功，會顯示關聯的 Account Name 與 Account ID。

---

## 4. Token 使用方式 (Usage)

1. **本機指令部署**：
   ```powershell
   $env:CLOUDFLARE_API_TOKEN="您的Token"
   npm run deploy
   ```
2. **GitHub Actions 自動部署**：
   - 前往 [GitHub Secrets 設定頁](https://github.com/billy1030/workertest/settings/secrets/actions)
   - 點擊 **New repository secret**
   - **Name**: `CLOUDFLARE_API_TOKEN`
   - **Secret**: 貼上 Token 儲存
3. **本機開發隔離存檔**：
   - 存入專案根目錄的 [.token](../.token)
   - 此檔已被 [.gitignore](../.gitignore) 忽略，不會被上傳至 Git 倉庫。

# MoonTV (m2tv) Cloudflare Pages 部署指南與維運技術文件

本文件詳細記載 MoonTV (Next.js 14 App Router) 專案部署至 Cloudflare Pages 的架構設計、核心參數、自訂網域綁定、API Token 設定與排查考量。

---

## 1. 核心專案與環境資訊 (Key Information)

| 項目                                 | 數值 / 內容                                    | 說明                                               |
| :----------------------------------- | :--------------------------------------------- | :------------------------------------------------- |
| **專案名稱**                         | `moontv` (原代碼標識 `m2tv`)                   | Cloudflare Pages 專案名稱                          |
| **Cloudflare Account ID**            | `827b99611b62c4ac9c6cfe95118973c3`             | 帳號專屬識別碼                                     |
| **管理者帳號**                       | `billy.lam@gmail.com`                          | Cloudflare 帳戶管理者                              |
| **正式生產獨立網域 (Custom Domain)** | **`https://tv.vonnandryan.com`**               | **已生效上線 (HTTPS / 200 OK)**                    |
| **Pages 預設網域 (Default Domain)**  | `https://moontv-1mv.pages.dev`                 | Cloudflare 自動配發之備用網址                      |
| **原預定網域說明**                   | `m2tv.pages.dev` **已被他人佔用**              | 故採用專案名 `moontv`，配發 `moontv-1mv.pages.dev` |
| **GitHub 倉庫**                      | `https://github.com/billy1030/m2tv` (`MoonTV`) | 主分支 `main`                                      |
| **GitHub Secret 名稱**               | `CLOUDFLARE_API_TOKEN`                         | 供 GitHub Actions CI/CD 自動發布                   |
| **核心技術棧**                       | Next.js 14, React 18, Tailwind CSS, pnpm       | 採用 `@cloudflare/next-on-pages` 打包              |

---

## 2. 自訂網域配置 SOP (Custom Domain Setup)

### 2.1 避坑與核心原理 (DNS vs Pages Custom Domain)

- **單純在 DNS 加 CNAME 會導致 Error 1001**：
  若僅在 DNS 區域新增 `CNAME tv.vonnandryan.com -> moontv-1mv.pages.dev`，訪問時會收到 `HTTP 409 Conflict (error code: 1001)` 與 SSL 握手失敗。
- **必要步驟**：必須在 Cloudflare Pages 專案內完成「登記與啟用」，邊緣節點才會簽發 SSL 憑證並放行路由。

### 2.2 設定步驟

1. 開啟 Cloudflare Dashboard ➔ 進入 `moontv` 專案。
2. 切換至 **Custom domains** 分頁 ➔ 點擊 **Set up a custom domain**。
3. 輸入 `tv.vonnandryan.com` ➔ 點擊 **Continue** ➔ **Activate domain**。
4. 等待 1 分鐘，狀態轉為 **Active (綠燈)** 即可。

---

## 3. API Token 建立與權限配置 (Token Setup)

### 3.1 直達連結

- **Cloudflare API Tokens 建立入口**：
  👉 [https://dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
- **GitHub Repository Secrets 設定頁**：
  👉 [https://github.com/billy1030/m2tv/settings/secrets/actions](https://github.com/billy1030/m2tv/settings/secrets/actions)

### 3.2 必備權限矩陣 (Permissions Matrix)

- **Account Resources**:
  - `Cloudflare Pages`: **Edit** (建立與發布 Pages 專案)
  - `Workers Scripts`: **Edit** (發布 Next.js Edge Functions)
  - `Workers Observability`: **Edit** (日誌與監控)
  - `Workers KV Storage`: **Edit** (預留 KV 快取)
  - `Account Settings`: **Read** (讀取帳號與配額)
  - 範圍：`All accounts`
- **Zone Resources**:
  - `Workers Routes`: **Edit** (支援自訂網域路由)
  - 範圍：`All zones`
- **User Resources**:
  - `User Details`: **Read**
  - `Memberships`: **Read**

---

## 4. 架構設計與 CI/CD (.github/workflows/deploy-pages.yml)

### 4.1 本機 Windows 限制

在 Windows 環境執行 `pnpm pages:build` 時：

- `@cloudflare/next-on-pages` 會調用 Vercel CLI 進行 edge tracing，在 Windows 下會遭遇符號連結 (symlink) 與程序掛起 (hanging) 問題。
- **最佳實踐**：一律由 GitHub Actions 在 **Ubuntu Linux 容器** 中執行編譯打包。

### 4.2 CI/CD 工作流設計

- 每次 `git push main` 自動執行：
  1. 安裝對應版本之 pnpm。
  2. `pnpm install --frozen-lockfile`。
  3. `pnpm pages:build`。
  4. 使用 `cloudflare/wrangler-action@v3` 自動部署至 `moontv` 專案。

---

## 5. 維運與驗證指令 (Verification Commands)

```powershell
# 驗證自訂網域 HTTP 狀態與轉跳
curl.exe -Iv "https://tv.vonnandryan.com"

# 驗證登入頁面渲染正常 (HTTP 200 OK)
curl.exe -I -s "https://tv.vonnandryan.com/login"
```

---

## 6. GitHub Secrets 的核心目的與安全機制 (Purpose of GitHub Secrets)

在 CI/CD 自動化流程中，GitHub Secrets 扮演著安全中樞的角色：

### 6.1 為什麼必須使用 GitHub Secrets？

- **避免金鑰寫入代碼 (Zero Hardcoded Credentials)**：
  若將 `CLOUDFLARE_API_TOKEN` 明文寫入 `.github/workflows/deploy-pages.yml`，任何對該倉庫有讀取權限的人均可查看，甚至遭爬蟲自動掃描竊取。
- **程式碼與機密分離 (Separation of Code & Config)**：
  程式碼中僅保留語法引用 `${{ secrets.CLOUDFLARE_API_TOKEN }}`，實際機密值由倉庫管理員於後台安全存放。

### 6.2 四大關鍵安全防護機制

1. **單向寫入與非對稱加密 (Write-Only Storage)**：
   - 存入 Secret 後即經過強力加密，連管理者本人在網頁上也無法再次查看明文（只能覆蓋更新或刪除）。
2. **日誌自動遮罩 (Automatic Log Masking)**：
   - 若 CI/CD 執行期間的終端機輸出意外印出該 Token，GitHub Actions 系統會自動強制替換為 `***`，杜絕日誌外洩。
3. **記憶體生命週期隔離 (In-Memory Injection)**：
   - 僅在部署步驟執行當下暫時注入執行環境記憶體，部署完成後立即銷毀。
4. **存取權限控制 (Security Boundaries)**：
   - 外部 Fork 專案所發起的 Pull Request (PR) 預設無法存取倉庫 Secrets，防止惡意代碼竊取金鑰。

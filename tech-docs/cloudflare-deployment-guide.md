# MoonTV (m2tv) Cloudflare Pages 部署指南與維運技術文件

本文件詳細記載 MoonTV (Next.js 14 App Router) 專案部署至 Cloudflare Pages 的架構設計、核心參數、API Token 設定與排查考量。

---

## 1. 核心專案與環境資訊 (Key Information)

| 項目                      | 數值 / 內容                                    | 說明                                                 |
| :------------------------ | :--------------------------------------------- | :--------------------------------------------------- |
| **專案名稱**              | `moontv` (原代碼標識 `m2tv`)                   | Cloudflare Pages 專案名稱                            |
| **Cloudflare Account ID** | `827b99611b62c4ac9c6cfe95118973c3`             | 帳號專屬識別碼                                       |
| **管理者帳號**            | `billy.lam@gmail.com`                          | Cloudflare 帳戶管理者                                |
| **正式線上網域名稱**      | `https://moontv-1mv.pages.dev`                 | Cloudflare 自動配發之全域 HTTPS 網址                 |
| **原預定網域說明**        | `m2tv.pages.dev` **已被他人佔用**              | 故採用專案名 `moontv`，分配至 `moontv-1mv.pages.dev` |
| **GitHub 倉庫**           | `https://github.com/billy1030/m2tv` (`MoonTV`) | 主分支 `main`                                        |
| **GitHub Secret 名稱**    | `CLOUDFLARE_API_TOKEN`                         | 供 GitHub Actions CI/CD 自動發布                     |
| **核心技術棧**            | Next.js 14, React 18, Tailwind CSS, pnpm       | 採用 `@cloudflare/next-on-pages` 打包                |

---

## 2. API Token 建立與權限配置 (Token Setup)

### 2.1 直達連結

- **Cloudflare API Tokens 建立入口**：
  👉 [https://dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
- **GitHub Repository Secrets 設定頁**：
  👉 [https://github.com/billy1030/m2tv/settings/secrets/actions](https://github.com/billy1030/m2tv/settings/secrets/actions)

### 2.2 必備權限矩陣 (Permissions Matrix)

MoonTV 專案需要以下權限：

- **Account Resources**:
  - `Cloudflare Pages`: **Edit** (建立與發布 Pages 專案)
  - `Workers Scripts`: **Edit** (發布 Next.js Edge Functions)
  - `Workers Observability`: **Edit** (日誌與監控)
  - `Workers KV Storage`: **Edit** (若啟用 KV 快取)
  - `Account Settings`: **Read** (讀取帳號與配額)
  - 範圍：`All accounts` (或指定帳號)
- **Zone Resources**:
  - `Workers Routes`: **Edit** (若未來綁定自訂獨立網域)
  - 範圍：`All zones`
- **User Resources**:
  - `User Details`: **Read**
  - `Memberships`: **Read**

---

## 3. 架構設計與部署策略 (Why GitHub Actions?)

### 3.1 本機 Windows 限制

在 Windows 環境執行 `pnpm pages:build` 時：

- `@cloudflare/next-on-pages` 會調用 Vercel CLI 進行 edge tracing，在 Windows 下會遭遇符號連結 (symlink) 與程序掛起 (hanging) 問題。
- 官方給出警告：_Vercel CLI seems not to work reliably on Windows..._

### 3.2 CI/CD 自動化方案 (.github/workflows/deploy-pages.yml)

- GitHub Actions 運行於 **Ubuntu 22.04 (Linux)** 原生環境。
- 自動讀取 `package.json` 中的 `packageManager` 指定 pnpm 版本。
- 執行 `pnpm pages:build` 生成 `.vercel/output/static`。
- 調用 `cloudflare/wrangler-action@v3` 執行：
  ```bash
  npx wrangler pages deploy .vercel/output/static --project-name=moontv --commit-dirty=true
  ```

---

## 4. 維運與常用操作 (Operations & Troubleshooting)

### 4.1 手動觸發部署

1. 開啟 [GitHub Actions 分頁](https://github.com/billy1030/m2tv/actions)。
2. 點選 **Deploy MoonTV to Cloudflare Pages**。
3. 點擊 **Run workflow** ➔ 選擇 `main` 分支。

### 4.2 Cloudflare Dashboard 維運

- **專案管理首頁**：
  👉 [https://dash.cloudflare.com/827b99611b62c4ac9c6cfe95118973c3/workers-and-pages](https://dash.cloudflare.com/827b99611b62c4ac9c6cfe95118973c3/workers-and-pages)
- **Deployments 回退**：
  進入 `moontv` 專案 ➔ **Deployments** 分頁，可檢視歷次版本與一鍵 Rollback。
- **自訂網域綁定**：
  若欲使用自己的獨立網域（例如 `tv.yourdomain.com`）：
  進入 `moontv` ➔ **Custom domains** ➔ 點擊 **Set up a custom domain** 輸入即可。

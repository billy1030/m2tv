# 將 Next.js 專案從 Vercel 遷移至 Cloudflare Pages 指南

本文件詳細記載如何將原本為 Vercel 設計的 Next.js 14 (App Router) 專案（如 MoonTV）完整轉換並部署至 Cloudflare Pages 的標準工程指引。

---

## 1. 核心技術架構差異對照

| 特性               | Vercel 原生架構                       | Cloudflare Pages 架構                                                                    |
| :----------------- | :------------------------------------ | :--------------------------------------------------------------------------------------- |
| **執行環境**       | Node.js Serverless Functions          | Cloudflare Workers / Workerd (Edge Runtime)                                              |
| **靜態資源分發**   | Vercel Edge Network                   | Cloudflare Global CDN / Pages Assets                                                     |
| **API / 動態路由** | 原生 Node.js API (支援所有 Node 模組) | Edge API (需具備 `nodejs_compat` 或輕量化模組)                                           |
| **打包工具**       | `next build` (生成 `.next`)           | `next build` + `@cloudflare/next-on-pages` (生成 `.vercel/output/static` & `_worker.js`) |
| **部署成本**       | 超量需付費 Pro 方案                   | 每日免費 100,000 次請求、無流量費用                                                      |

---

## 2. 轉換五大步驟 (Migration Steps)

### 步驟 1：安裝 Cloudflare Pages 打包套件

在專案中安裝官方轉換工具 `@cloudflare/next-on-pages`：

```bash
pnpm add -D @cloudflare/next-on-pages wrangler
```

### 步驟 2：調整 `next.config.js` 設定

Vercel 專案常會開啟 `output: 'standalone'`，但在轉換至 Cloudflare 時必須注意：

1. **關閉 standalone 模式**：
   ```javascript
   // 務必註解或移除 standalone，避免 Windows 下符號連結 EPERM 報錯
   // output: 'standalone',
   ```
2. **圖片優化設定 (Image Optimization)**：
   Cloudflare Workers 預設不內建 Node.js `sharp` 圖片伺服器，需設定 `unoptimized: true`（或使用 Cloudflare Images）：
   ```javascript
   images: {
     unoptimized: true,
   }
   ```

### 步驟 3：配置動態路由為 Edge Runtime

Cloudflare Pages 透過 Edge 節點執行伺服器邏輯。在有使用 API 或動態伺服器渲染 (SSR) 的頁面/檔案上方加入：

```typescript
export const runtime = 'edge';
```

### 步驟 4：設定 `wrangler.toml` 橋接配置

在專案根目錄建立 `wrangler.toml`，宣告產出物指向 `.vercel/output/static`：

```toml
name = "moontv"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

pages_build_output_dir = ".vercel/output/static"
```

### 步驟 5：更新 `package.json` 構建指令

新增 Cloudflare Pages 專屬建置指令：

```json
"scripts": {
  "pages:build": "pnpm gen:runtime && pnpm gen:manifest && next build && npx @cloudflare/next-on-pages",
  "deploy": "pnpm pages:build && wrangler pages deploy .vercel/output/static"
}
```

---

## 3. 本機 (Windows) vs 雲端 (GitHub Actions) 建置考量

### ⚠️ 重要避坑點：Windows 系統相容性

- `@cloudflare/next-on-pages` 底層調用 Vercel CLI 進行 edge tracing。在 **Windows** 環境下會出現跨平台相容性問題（如 symlink 權限不足或進程卡死）。
- **最佳實踐**：
  強烈建議**不要在本機 Windows 進行 final build**，而是透過 **GitHub Actions (Ubuntu Linux)** 進行自動化打包與發布！

---

## 4. GitHub Actions CI/CD 配置範例

建立 `.github/workflows/deploy-pages.yml`：

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        # 自動根據 package.json 中的 packageManager 安裝對應版本

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build with next-on-pages
        run: pnpm pages:build

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: 827b99611b62c4ac9c6cfe95118973c3
          command: pages deploy .vercel/output/static --project-name=moontv --commit-dirty=true
```

---

## 5. 資料庫與環境變數遷移考量 (Database Migration)

1. **環境變數 (Environment Variables)**：
   - 原先存在 Vercel Dashboard 的環境變數，需至 Cloudflare Dashboard ➔ `moontv` 專案 ➔ **Settings** ➔ **Environment variables** 同步設定。
2. **資料庫 (Database)**：
   - Vercel Postgres / KV 需遷移至 **Cloudflare D1 (SQLite at the Edge)** 或 **Cloudflare KV**。
   - 在專案中可使用 Cloudflare 提供的 D1 client 進行操作（如 `env.DB.prepare(...)`）。

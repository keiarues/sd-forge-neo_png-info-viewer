# Stable Diffusion Forge グリッド画像用 テンプレート抽出・整形ツール

Stable Diffusion WebUI Forge でグリッド画像を生成した際にメタデータ（Raw Parameters）内に1行で圧縮・エスケープされて保存される `Template`（プロンプトテンプレート）および `Negative Template`（ネガティブプロンプトテンプレート）を自動抽出し、改行コード（`\n`）やエスケープ記号を復元・整形して見やすく出力するWebツール（SPA）です。

特に拡張機能 **sd-dynamic-prompts**（ワイルドカード機能：`__構図__` など）を使用している際に、グリッド画像のパラメータから元のテンプレート情報を復元するのに最適です。

---

## ✨ 主な機能・特徴

1. **リアルタイム自動解析 (Auto-parse)**
   - 入力エリアにテキストをペーストまたは入力した瞬間に、即座に `Template` と `Negative Template` を抽出・整形して表示します。
2. **エスケープ文字の完全復元**
   - 1行に圧縮された `\n` や `\r\n` を実際の改行に変換し、ダブルクォーテーションのエスケープ（`\"`）やバックスラッシュ（`\\`）を復元します。
3. **ワンクリック・コピー機能**
   - プロンプト、ネガティブプロンプトそれぞれに独立したコピーボタンを配置。コピー完了時には視覚的なフィードバックとトースト通知が表示されます。
4. **生成パラメータの検出表示**
   - Steps, Sampler, Schedule type, CFG scale, Seed, Size, Model, LoRA hashes などの追加情報も自動で検出し、折りたたみカード内にタグ形式で一覧表示します。
5. **完全クライアントサイド動作 (プライバシー保護)**
   - サーバー通信は一切行わず、全ての処理がブラウザのJavaScript内のみで完結します。
6. **単一ファイル構成 (SPA)**
   - `index.html` 1ファイルのみで動作するため、GitHub Pages やローカル環境で手軽に利用・共有できます。

---

## 🚀 使い方

### 1. ローカルで直接開く場合
- `index.html` ファイルをブラウザ（Google Chrome, Edge, Safari, Firefox など）にドラッグ＆ドロップまたはダブルクリックして開くだけで利用可能です。

### 2. GitHub Pages で公開する場合
1. 本フォルダのファイル（`index.html`, `README.md`）をご自身のGitHubリポジトリにプッシュします。
2. リポジトリの **Settings** > **Pages** に移動します。
3. **Build and deployment** の Source で **Deploy from a branch** を選択します。
4. Branch に `main` (または `master`) / `/ (root)` を指定して **Save** をクリックします。
5. 数分後、発行されたURLにアクセスするとWeb上でツールが利用可能になります。

---

## 📋 動作例

### 入力データ（メタデータ例）:
```text
Steps: 32, Sampler: ER SDE, CFG scale: 4, Seed: 443388188, Size: 1024x1024, Model: anima_baseV10, Template: "masterpiece, best quality,\nyear 2024, newest,\n\n__構図/画面構図__ ,\n1girl,\n<lora:my_lora:1>,\n", Negative Template: "worst quality, low quality,\nscore_1, score_2,\nbad anatomy,"
```

### 抽出後のプロンプト (Template):
```text
masterpiece, best quality,
year 2024, newest,

__構図/画面構図__ ,
1girl,
<lora:my_lora:1>,
```

### 抽出後のネガティブプロンプト (Negative Template):
```text
worst quality, low quality,
score_1, score_2,
bad anatomy,
```

---

## 🛠 技術スタック
- **HTML5 / CSS3 / JavaScript (ES2022 Vanilla JS)**
- **Tailwind CSS (CDN)**
- **Google Fonts (Inter / JetBrains Mono)**

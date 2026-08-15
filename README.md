# Stable Diffusion Forge テンプレート抽出 & PNG Info ビューアー

Stable Diffusion WebUI Forge 等で生成された **PNG画像**（またはグリッド画像・メタデータテキスト）から、**sd-dynamic-prompts**（ワイルドカード機能：`__構図__` など）置換前のプロンプトテンプレート（`Template` / `Negative Template`）および生成パラメータを自動抽出し、改行コードやエスケープ記号を復元・整形して見やすく出力するWebツール（SPA）です。

---

## ✨ 主な機能・特徴

1. **🖼️ 画像ドラッグ＆ドロップ / ペースト対応 (NEW!)**
   - PNG画像を画面上にドラッグ＆ドロップするだけで、画像内のメタデータ（`parameters`）を自動抽出して即座にプロンプトテンプレートを復元。
   - 「画像を選択」ボタンでのファイル選択や、クリップボードからの画像ペースト（`Ctrl + V`）にも完全対応。
   - 読み込んだ画像のサムネイルプレビュー・ファイルサイズ表示付き。
2. **⚡ リアルタイム自動解析 (Auto-parse)**
   - 画像ドロップ時やテキスト入力時に、即座に `Template` と `Negative Template` を抽出・整形して表示。
3. **🔄 エスケープ文字の完全復元**
   - 1行に圧縮された `\n` や `\r\n` を実際の改行に変換し、ダブルクォーテーションのエスケープ（`\"`）やバックスラッシュ（`\\`）を復元。
4. **📋 ワンクリック・コピー機能**
   - プロンプト、ネガティブプロンプトそれぞれに独立したコピーボタンを配置。コピー完了時には視覚的なフィードバックとトースト通知が表示されます。
5. **📊 生成パラメータの検出表示**
   - Steps, Sampler, Schedule type, CFG scale, Seed, Size, Model, LoRA hashes などの追加情報も自動で検出し、折りたたみカード内にタグ形式で一覧表示。
6. **🔒 完全クライアントサイド動作 (プライバシー保護)**
   - サーバー通信は一切行わず、画像やプロンプトデータが外部へ送信されることはありません。
7. **📁 単一ファイル構成 (SPA)**
   - `index.html` 1ファイルのみで動作するため、GitHub Pages やローカル環境で手軽に利用・共有できます。

---

## 🚀 使い方

### 1. ローカルで直接開く場合
- `index.html` ファイルをお使いのブラウザ（Google Chrome, Edge, Safari, Firefox など）にドラッグ＆ドロップまたはダブルクリックして開くだけで利用可能です。

### 2. GitHub Pages で公開する場合
1. 本リポジトリをGitHubにプッシュします。
2. リポジトリの **Settings** > **Pages** に移動します。
3. **Build and deployment** の Source で **Deploy from a branch** を選択します。
4. Branch に `main` (または `master`) / `/ (root)` を指定して **Save** をクリックします。
5. 数分後、発行されたURL（例: `https://keiarues.github.io/sd-forge-neo_png-info-viewer/`）にアクセスするとWeb上でツールが利用可能になります。

---

## 📋 動作例

### 入力データ（メタデータ例）:
```text
masterpiece, best quality, absurdres, highres,
...
Negative prompt: worst quality, ...
Steps: 15, Sampler: Res Multistep, CFG scale: 4, Seed: 3409572798, Size: 896x1152, Model: anima_baseV10, Template: "masterpiece, best quality,\n__構図/画面構図__: { 1 | 1.5 | 2 | 2.5 | 3} ,\n\n1girl,\n<lora:chikarin:1> ,\n__服装/おしゃれ着__ ,\n", Negative Template: "worst quality, low quality,\nbad anatomy,"
```

### 抽出後のプロンプト (Template):
```text
masterpiece, best quality,
__構図/画面構図__: { 1 | 1.5 | 2 | 2.5 | 3} ,

1girl,
<lora:chikarin:1> ,
__服装/おしゃれ着__ ,
```

### 抽出後のネガティブプロンプト (Negative Template):
```text
worst quality, low quality,
bad anatomy,
```

---

## 🛠 技術スタック
- **HTML5 / CSS3 / JavaScript (ES2022 Vanilla JS)**
- **Tailwind CSS (CDN)**
- **Google Fonts (Inter / JetBrains Mono)**

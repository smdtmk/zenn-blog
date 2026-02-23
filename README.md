# zenn-blog

Zennのブログ記事を管理するリポジトリです。

## セットアップ

```bash
# 依存関係のインストール
npm install
```

## コマンド一覧

### 記事作成

#### 新しい記事を作成（画像フォルダ付き）

```bash
npm run new:article
```

- 記事のスラッグ名を入力（Enterで自動生成）
- 記事作成後、自動的に画像フォルダを作成

#### シンプルな記事作成

```bash
npm run new:article:simple
```

- Zenn CLIの標準コマンドを実行
- 画像フォルダは作成されません

#### 書籍作成

```bash
npm run new:book
```

### 画像フォルダ管理

#### 最新記事の画像フォルダを作成

```bash
npm run create-image-folder
```

- 最新の記事ファイル（更新日時が最新）に対応する画像フォルダを作成
- 既にフォルダが存在する場合はスキップ

### 記事管理

#### 記事のリネーム

```bash
npm run rename-article
```

- 記事一覧から変更したい記事を選択
- 新しいスラッグ名を入力
- 記事ファイルと対応する画像フォルダを同時にリネーム

### プレビュー・検証

#### プレビュー表示

```bash
npm run preview
```

- ローカルで記事をプレビュー（<http://localhost:8000）>

#### リンター実行

```bash
npm run lint
```

- 記事のフォーマットやリンクをチェック

#### redpenによる文章校正

```bash
npm run redpen
```

- 記事一覧からチェックする記事を選択（Enterで全てチェック）
- 日本語の文章校正を実行
- 文の長さ、句点、カタカナ、漢字の誤用などをチェック

#### 投稿前チェック（リンター + redpen）

```bash
npm run prepublish
```

- Zennリンターとredpenを順番に実行
- 投稿前に必ず実行することを推奨

## スクリプトの詳細

### `scripts/new-article-with-image-folder.js`

新しい記事を作成し、自動的に画像フォルダを作成します。

**使い方：**

```bash
npm run new:article
```

**動作：**

1. スラッグ名の入力を求める（Enterで自動生成）
2. `zenn new:article` を実行して記事を作成
3. 作成された記事に対応する画像フォルダを自動生成

**特徴：**

- スラッグ名は自動的にサニタイズ（英数字とハイフンのみ）
- 記事作成と画像フォルダ作成を一度に実行

### `scripts/create-image-folder.js`

最新の記事ファイルに対応する画像フォルダを作成します。

**使い方：**

```bash
npm run create-image-folder
```

**動作：**

1. `articles/` ディレクトリ内の `.md` ファイルを検索
2. 更新日時が最新の記事ファイルを特定
3. ファイル名（拡張子除く）をフォルダ名として `images/` に作成
4. `.gitkeep` ファイルを配置（空フォルダをGitに含めるため）

**注意：**

- 既にフォルダが存在する場合はスキップ
- 記事ファイルが見つからない場合はエラー

### `scripts/rename-article.js`

記事ファイルと対応する画像フォルダの名前を変更します。

**使い方：**

```bash
npm run rename-article
```

**動作：**

1. 記事一覧を表示（番号付き）
2. 変更したい記事の番号を入力
3. 新しいスラッグ名を入力
4. 記事ファイル（`articles/*.md`）をリネーム
5. 対応する画像フォルダ（`images/*`）も同時にリネーム

**特徴：**

- スラッグ名は自動的にサニタイズ
- 記事と画像フォルダを同時に管理
- 既存ファイルとの重複チェック

### `scripts/check-with-redpen.js`

redpenを使用して記事の日本語文章校正を実行します。

**使い方：**

```bash
npm run redpen
```

**動作：**

1. 記事一覧を表示（番号付き）
2. チェックする記事の番号を入力（Enterで全てチェック）
3. redpenで文章校正を実行
4. 問題があればエラーを表示

**チェック項目：**

- 文の長さ（最大100文字）
- 文末の句点
- カタカナの長音記号
- 漢字の誤用
- 読点の連続
- 同一語の連続
- スペースの使用
- 括弧の対応
- 句点の位置
- その他

**注意：**

- redpenがインストールされている必要があります
- macOS: `brew install redpen`
- 設定ファイル: `redpen-conf.xml`

### `scripts/prepublish-check.js`

投稿前のチェックを一括実行します。

**使い方：**

```bash
npm run prepublish
```

**動作：**

1. Zennリンターを実行
2. redpenによる文章校正を実行
3. 全てのチェックが成功したら完了

**特徴：**

- 投稿前に必ず実行することを推奨
- エラーがある場合は修正を促す

## 運用フロー

### 1. 新しい記事を作成する場合

```bash
# 1. 記事を作成（画像フォルダ付き）
npm run new:article

# 2. スラッグ名を入力（またはEnterで自動生成）

# 3. 記事を編集
# articles/スラッグ名.md を編集

# 4. 画像を配置
# images/スラッグ名/ に画像ファイルを配置

# 5. プレビューで確認
npm run preview

# 6. リンターで検証
npm run lint
```

### 2. 既存記事の画像フォルダを作成し忘れた場合

```bash
# 最新記事の画像フォルダを作成
npm run create-image-folder
```

### 3. 記事のスラッグ名を変更する場合

```bash
# 記事と画像フォルダを同時にリネーム
npm run rename-article

# 1. 記事一覧から変更したい記事を選択
# 2. 新しいスラッグ名を入力
```

### 4. 記事を公開する前のチェック

```bash
# 1. 投稿前チェック（リンター + redpen）を実行
npm run prepublish

# 2. プレビューで確認
npm run preview

# 3. 画像パスが正しいか確認
# 記事内の画像パス: ![alt](images/スラッグ名/画像ファイル名.png)
```

**投稿前チェックの内容：**

- Zennリンター: フォーマットやリンクのチェック
- redpen: 日本語の文章校正（文の長さ、句点、カタカナ、漢字の誤用など）

## ディレクトリ構造

```
zenn-blog/
├── articles/          # 記事ファイル（.md）
├── images/            # 画像フォルダ
│   └── スラッグ名/    # 各記事に対応する画像フォルダ
├── scripts/           # カスタムスクリプト
│   ├── new-article-with-image-folder.js
│   ├── create-image-folder.js
│   ├── rename-article.js
│   ├── check-with-redpen.js
│   └── prepublish-check.js
├── redpen-conf.xml    # redpen設定ファイル
└── package.json       # 依存関係とコマンド定義
```

## 注意事項

- 記事ファイル名（スラッグ）と画像フォルダ名は一致させる必要があります
- 画像フォルダは `images/スラッグ名/` の形式で作成されます
- 記事内の画像パスは `images/スラッグ名/画像ファイル名.png` の形式で記述してください
- スラッグ名は英数字とハイフンのみ使用可能です（自動的にサニタイズされます）

## トラブルシューティング

### 画像フォルダが見つからない

```bash
# 最新記事の画像フォルダを作成
npm run create-image-folder
```

### 記事のスラッグ名を変更したい

```bash
# 記事と画像フォルダを同時にリネーム
npm run rename-article
```

### リンターエラーが出る

```bash
# エラー内容を確認
npm run lint

# 主な原因：
# - 画像パスの誤り
# - フロントマターの形式エラー
# - リンクの形式エラー
```

### redpenが実行できない

```bash
# redpenがインストールされているか確認
redpen --version

# macOSの場合、Homebrewでインストール
brew install redpen

# その他のOSの場合、公式サイトからダウンロード
# https://github.com/redpen-cc/redpen/releases
```

### redpenの設定を変更したい

`redpen-conf.xml` を編集することで、チェック項目をカスタマイズできます。
詳しくは [RedPen公式ドキュメント](https://redpen.cc/docs/1.5/index.html) を参照してください。

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * 最新の記事ファイル名に基づいて画像フォルダを作成する
 */
function createImageFolderFromLatestArticle() {
  const articlesDir = path.join(__dirname, '..', 'articles');
  const imagesDir = path.join(__dirname, '..', 'images');

  // articlesディレクトリが存在しない場合は終了
  if (!fs.existsSync(articlesDir)) {
    console.error('articlesディレクトリが見つかりません');
    process.exit(1);
  }

  // 最新の記事ファイルを取得
  const articleFiles = fs.readdirSync(articlesDir)
    .filter(file => file.endsWith('.md'))
    .map(file => ({
      name: file,
      path: path.join(articlesDir, file),
      mtime: fs.statSync(path.join(articlesDir, file)).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (articleFiles.length === 0) {
    console.error('記事ファイルが見つかりません');
    process.exit(1);
  }

  // 最新の記事ファイルを取得
  const latestArticle = articleFiles[0];

  // ファイル名から拡張子を除いた部分をフォルダ名として使用
  const folderName = path.basename(latestArticle.name, '.md');

  if (!folderName) {
    console.error('有効なフォルダ名を生成できませんでした');
    process.exit(1);
  }

  // 記事のタイトルを取得（表示用）
  const content = fs.readFileSync(latestArticle.path, 'utf-8');
  const titleMatch = content.match(/^title:\s*["'](.+?)["']/m);
  const title = titleMatch ? titleMatch[1] : 'タイトル不明';

  // imagesディレクトリが存在しない場合は作成
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  // 画像フォルダのパス
  const imageFolderPath = path.join(imagesDir, folderName);

  // フォルダが既に存在する場合はスキップ
  if (fs.existsSync(imageFolderPath)) {
    console.log(`画像フォルダは既に存在します: images/${folderName}`);
    return;
  }

  // 画像フォルダを作成
  fs.mkdirSync(imageFolderPath, { recursive: true });

  // .gitkeepファイルを作成（空のフォルダをGitに含めるため）
  fs.writeFileSync(path.join(imageFolderPath, '.gitkeep'), '');

  console.log(`✅ 画像フォルダを作成しました: images/${folderName}`);
  console.log(`   記事ファイル: ${latestArticle.name}`);
  console.log(`   記事タイトル: ${title}`);
}

createImageFolderFromLatestArticle();

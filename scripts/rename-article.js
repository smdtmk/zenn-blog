#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * 記事ファイル名と対応する画像フォルダ名を変更する
 */
function renameArticle() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const articlesDir = path.join(__dirname, '..', 'articles');
  const imagesDir = path.join(__dirname, '..', 'images');

  // 記事ファイル一覧を取得
  const articleFiles = fs.readdirSync(articlesDir)
    .filter(file => file.endsWith('.md'))
    .map(file => {
      const filePath = path.join(articlesDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const titleMatch = content.match(/^title:\s*["'](.+?)["']/m);
      const title = titleMatch ? titleMatch[1] : 'タイトル不明';
      
      return {
        name: file,
        slug: path.basename(file, '.md'),
        title: title
      };
    });

  if (articleFiles.length === 0) {
    console.error('記事ファイルが見つかりません');
    process.exit(1);
  }

  // 記事一覧を表示
  console.log('\n📝 記事一覧:\n');
  articleFiles.forEach((article, index) => {
    console.log(`${index + 1}. ${article.name}`);
    console.log(`   タイトル: ${article.title}`);
    console.log(`   スラッグ: ${article.slug}\n`);
  });

  // 変更する記事を選択
  rl.question('変更する記事の番号を入力してください: ', (answer) => {
    const index = parseInt(answer) - 1;
    
    if (isNaN(index) || index < 0 || index >= articleFiles.length) {
      console.error('無効な番号です');
      rl.close();
      process.exit(1);
    }

    const article = articleFiles[index];
    
    // 新しいスラッグを入力
    rl.question(`新しいスラッグ名を入力してください (現在: ${article.slug}): `, (newSlug) => {
      if (!newSlug || newSlug.trim() === '') {
        console.error('スラッグ名が入力されていません');
        rl.close();
        process.exit(1);
      }

      const sanitizedSlug = newSlug.trim()
        .replace(/[^\w-]/g, '-')  // 英数字とハイフン以外をハイフンに
        .replace(/-+/g, '-')       // 連続するハイフンを1つに
        .replace(/^-+|-+$/g, '');  // 先頭・末尾のハイフンを削除

      if (!sanitizedSlug) {
        console.error('有効なスラッグ名を生成できませんでした');
        rl.close();
        process.exit(1);
      }

      const oldArticlePath = path.join(articlesDir, article.name);
      const newArticlePath = path.join(articlesDir, `${sanitizedSlug}.md`);
      const oldImagePath = path.join(imagesDir, article.slug);
      const newImagePath = path.join(imagesDir, sanitizedSlug);

      // 新しいファイル名が既に存在するかチェック
      if (fs.existsSync(newArticlePath)) {
        console.error(`エラー: ${sanitizedSlug}.md は既に存在します`);
        rl.close();
        process.exit(1);
      }

      try {
        // 記事ファイルをリネーム
        fs.renameSync(oldArticlePath, newArticlePath);
        console.log(`✅ 記事ファイルをリネームしました: ${article.name} → ${sanitizedSlug}.md`);

        // 画像フォルダが存在する場合はリネーム
        if (fs.existsSync(oldImagePath)) {
          if (fs.existsSync(newImagePath)) {
            console.log(`⚠️  画像フォルダ ${sanitizedSlug} は既に存在するため、リネームをスキップしました`);
          } else {
            fs.renameSync(oldImagePath, newImagePath);
            console.log(`✅ 画像フォルダをリネームしました: ${article.slug} → ${sanitizedSlug}`);
          }
        } else {
          console.log(`ℹ️  画像フォルダ ${article.slug} は存在しないため、スキップしました`);
        }

        console.log(`\n✨ 完了しました！`);
      } catch (error) {
        console.error(`エラーが発生しました: ${error.message}`);
        process.exit(1);
      }

      rl.close();
    });
  });
}

renameArticle();

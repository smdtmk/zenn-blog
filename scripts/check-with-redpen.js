#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * redpenで記事をチェックする
 */
function checkWithRedpen() {
  const articlesDir = path.join(__dirname, '..', 'articles');
  const configPath = path.join(__dirname, '..', 'redpen-conf.xml');

  // redpen-conf.xmlが存在するか確認
  if (!fs.existsSync(configPath)) {
    console.error('❌ redpen-conf.xmlが見つかりません');
    process.exit(1);
  }

  // articlesディレクトリが存在しない場合は終了
  if (!fs.existsSync(articlesDir)) {
    console.error('❌ articlesディレクトリが見つかりません');
    process.exit(1);
  }

  // 記事ファイル一覧を取得
  const articleFiles = fs.readdirSync(articlesDir)
    .filter(file => file.endsWith('.md'));

  if (articleFiles.length === 0) {
    console.error('❌ 記事ファイルが見つかりません');
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // 記事一覧を表示
  console.log('\n📝 記事一覧:\n');
  articleFiles.forEach((file, index) => {
    const filePath = path.join(articlesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const titleMatch = content.match(/^title:\s*["'](.+?)["']/m);
    const title = titleMatch ? titleMatch[1] : 'タイトル不明';
    console.log(`${index + 1}. ${file}`);
    console.log(`   タイトル: ${title}\n`);
  });

  // チェックする記事を選択
  rl.question('チェックする記事の番号を入力してください（Enterで全てチェック）: ', (answer) => {
    rl.close();

    let filesToCheck = [];

    if (!answer || answer.trim() === '') {
      // 全ての記事をチェック
      filesToCheck = articleFiles.map(file => path.join(articlesDir, file));
      console.log('\n📋 全ての記事をチェックします...\n');
    } else {
      const index = parseInt(answer) - 1;
      
      if (isNaN(index) || index < 0 || index >= articleFiles.length) {
        console.error('❌ 無効な番号です');
        process.exit(1);
      }

      filesToCheck = [path.join(articlesDir, articleFiles[index])];
      console.log(`\n📋 ${articleFiles[index]} をチェックします...\n`);
    }

    // redpenを実行
    checkFiles(filesToCheck, configPath);
  });
}

/**
 * redpenでファイルをチェック
 */
function checkFiles(files, configPath) {
  let hasError = false;
  let checkedCount = 0;

  files.forEach((filePath, index) => {
    const fileName = path.basename(filePath);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${index + 1}/${files.length}] ${fileName}`);
    console.log('='.repeat(60));

    // redpenコマンドを実行
    // redpenがインストールされているか確認
    const redpenCommand = process.platform === 'win32' ? 'redpen.bat' : 'redpen';
    
    const redpenProcess = spawn(redpenCommand, [
      '-c', configPath,
      '-f', 'markdown',
      filePath
    ], {
      stdio: 'inherit',
      shell: true
    });

    redpenProcess.on('close', (code) => {
      checkedCount++;
      
      if (code !== 0) {
        hasError = true;
        console.log(`\n❌ ${fileName} に問題が見つかりました`);
      } else {
        console.log(`\n✅ ${fileName} は問題ありません`);
      }

      // 全てのファイルをチェックし終えたら終了
      if (checkedCount === files.length) {
        console.log('\n' + '='.repeat(60));
        if (hasError) {
          console.log('❌ 一部の記事に問題が見つかりました');
          process.exit(1);
        } else {
          console.log('✅ 全ての記事に問題はありませんでした');
          process.exit(0);
        }
      }
    });

    redpenProcess.on('error', (error) => {
      console.error(`\n❌ redpenの実行に失敗しました: ${error.message}`);
      console.error('\nredpenがインストールされているか確認してください:');
      console.error('  macOS: brew install redpen');
      console.error('  または: https://github.com/redpen-cc/redpen/releases');
      process.exit(1);
    });
  });
}

checkWithRedpen();

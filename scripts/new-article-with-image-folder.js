#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

/**
 * zenn new:articleを実行し、記事作成後に画像フォルダを作成する
 */
function newArticleWithImageFolder() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('📝 新しい記事を作成します...\n');
  
  // スラッグを入力してもらう
  rl.question('記事のスラッグ名を入力してください（Enterで自動生成）: ', (slug) => {
    const args = ['zenn-cli', 'new:article'];
    
    // スラッグが入力された場合は--slugオプションを追加
    if (slug && slug.trim() !== '') {
      const sanitizedSlug = slug.trim()
        .replace(/[^\w-]/g, '-')  // 英数字とハイフン以外をハイフンに
        .replace(/-+/g, '-')       // 連続するハイフンを1つに
        .replace(/^-+|-+$/g, '');  // 先頭・末尾のハイフンを削除
      
      if (sanitizedSlug) {
        args.push('--slug', sanitizedSlug);
        console.log(`スラッグ: ${sanitizedSlug}\n`);
      }
    }

    rl.close();

    // zenn new:articleを実行
    const zennProcess = spawn('npx', args, {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '..')
    });

    zennProcess.on('close', (code) => {
      if (code === 0) {
        console.log('\n📁 画像フォルダを作成します...\n');
        
        // 画像フォルダ作成スクリプトを実行
        const createFolderProcess = spawn('node', [
          path.join(__dirname, 'create-image-folder.js')
        ], {
          stdio: 'inherit',
          shell: true,
          cwd: path.join(__dirname, '..')
        });

        createFolderProcess.on('close', (folderCode) => {
          if (folderCode === 0) {
            console.log('\n✨ 完了しました！');
          } else {
            console.error('\n❌ 画像フォルダの作成に失敗しました');
            process.exit(folderCode);
          }
        });
      } else {
        console.error('\n❌ 記事の作成に失敗しました');
        process.exit(code);
      }
    });
  });
}

newArticleWithImageFolder();

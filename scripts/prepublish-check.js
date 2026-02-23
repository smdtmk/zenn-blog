#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

/**
 * 投稿前のチェックを実行
 * 1. Zennのリンター
 * 2. redpenによる文章校正
 */
function prepublishCheck() {
  console.log('📝 投稿前チェックを開始します...\n');
  console.log('='.repeat(60));

  // 1. Zennのリンターを実行
  console.log('\n[1/2] Zennリンターを実行中...\n');
  
  const lintProcess = spawn('npm', ['run', 'lint'], {
    stdio: 'inherit',
    shell: true,
    cwd: path.join(__dirname, '..')
  });

  lintProcess.on('close', (lintCode) => {
    if (lintCode !== 0) {
      console.error('\n❌ Zennリンターでエラーが見つかりました');
      console.error('エラーを修正してから再度実行してください');
      process.exit(lintCode);
    }

    console.log('\n✅ Zennリンター: OK\n');
    console.log('='.repeat(60));

    // 2. redpenを実行
    console.log('\n[2/2] redpenによる文章校正を実行中...\n');
    
    const redpenProcess = spawn('npm', ['run', 'redpen'], {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '..')
    });

    redpenProcess.on('close', (redpenCode) => {
      if (redpenCode !== 0) {
        console.error('\n❌ redpenで問題が見つかりました');
        console.error('エラーを修正してから再度実行してください');
        process.exit(redpenCode);
      }

      console.log('\n' + '='.repeat(60));
      console.log('✅ 全てのチェックが完了しました！');
      console.log('記事を投稿しても問題ありません。');
      console.log('='.repeat(60));
      process.exit(0);
    });

    redpenProcess.on('error', (error) => {
      console.error(`\n❌ redpenの実行に失敗しました: ${error.message}`);
      console.error('\nredpenがインストールされているか確認してください:');
      console.error('  macOS: brew install redpen');
      console.error('  または: https://github.com/redpen-cc/redpen/releases');
      process.exit(1);
    });
  });

  lintProcess.on('error', (error) => {
    console.error(`\n❌ リンターの実行に失敗しました: ${error.message}`);
    process.exit(1);
  });
}

prepublishCheck();

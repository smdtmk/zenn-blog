---
title: "Amazon Linux 2023でrsyslogサーバーをTLS暗号化で構築する手順"
emoji: "📋"
type: "tech" # tech: 技術記事 / idea: アイデア
topics: ["aws", "amazonlinux", "rsyslog", "tls", "syslog"]
published: true
---

# Amazon Linux 2023でrsyslogサーバーをTLS暗号化で構築する手順

Amazon Linux 2023を使用して、TLSで暗号化されたrsyslogサーバーを構築する手順を解説します。同一VPC内のクライアントからセキュアにログを収集できる環境を構築します。

## 背景

本記事は、Amazon Linux 2からAmazon Linux 2023への移行に際して、syslogサーバーを再構築する必要があった際の調査・検証の記録をまとめたものです。

Amazon Linux 2023では、rsyslogのTLS実装がGnuTLSからOpenSSLに変更され、設定方法やパッケージ名が変更されています。本記事では、これらの変更点を踏まえ、Amazon Linux 2023でTLS暗号化されたrsyslogサーバーを構築する手順を詳しく解説します。

## Amazon Linux 2からの主な変更点

Amazon Linux 2からAmazon Linux 2023への移行に際して、rsyslogのTLS設定に関して以下の変更があります：

### パッケージの変更

| 項目 | Amazon Linux 2 | Amazon Linux 2023 |
|------|----------------|-------------------|
| TLS用パッケージ | `rsyslog-gnutls` | `rsyslog-openssl` |
| TLSライブラリ | GnuTLS | OpenSSL |

### 設定の変更

| 項目 | Amazon Linux 2 | Amazon Linux 2023 |
|------|----------------|-------------------|
| StreamDriver | `gtls` | `ossl` |
| DefaultNetstreamDriver | `gtls` | `ossl` |
| StreamDriverCAFile | `action()`内で指定可能 | `global()`ブロックで`DefaultNetstreamDriverCAFile`として指定 |
| StreamDriverAuthMode | `action()`内で指定可能 | `ossl`ドライバーでは`action()`内で指定不可（anon認証はデフォルト） |

### 設定例の比較

**Amazon Linux 2での設定例**:

```conf
module(load="imtcp" StreamDriver.Name="gtls" StreamDriver.Mode="1" StreamDriver.AuthMode="anon")

global(
    DefaultNetstreamDriver="gtls"
    DefaultNetstreamDriverCAFile="/etc/rsyslog.d/tls/ca-cert.pem"
)

*.* action(
    type="omfwd"
    protocol="tcp"
    target="10.0.8.255"
    port="6514"
    StreamDriver="gtls"
    StreamDriverMode="1"
    StreamDriverCAFile="/etc/rsyslog.d/tls/ca-cert.pem"
    StreamDriverAuthMode="anon"
)
```

**Amazon Linux 2023での設定例**:

```conf
module(load="imtcp" StreamDriver.Name="ossl" StreamDriver.Mode="1" StreamDriver.AuthMode="anon")

global(
    DefaultNetstreamDriver="ossl"
    DefaultNetstreamDriverCAFile="/etc/rsyslog.d/tls/ca-cert.pem"
)

*.* action(
    type="omfwd"
    protocol="tcp"
    target="10.0.8.255"
    port="6514"
    StreamDriver="ossl"
    StreamDriverMode="1"
    StreamDriverPermittedPeers="syslog"
)
```

### 主な注意点

1. **パッケージ名の変更**: `rsyslog-gnutls`は削除され、`rsyslog-openssl`を使用する必要があります
2. **ドライバー名の変更**: `gtls`から`ossl`に変更されています
3. **CA証明書の指定方法**: `action()`内の`StreamDriverCAFile`は使用できず、`global()`ブロックの`DefaultNetstreamDriverCAFile`を使用します
4. **認証方式の指定**: `ossl`ドライバーでは`action()`内で`StreamDriverAuthMode`を指定できません。anon認証を使用する場合は、`StreamDriverPermittedPeers`でサーバー証明書のCNを指定します

## 概要

本記事では、以下の構成でrsyslogサーバーを構築します：

![rsyslogサーバー構成図](/images/amazonlinux2023-rsyslog-tls/architecture.png)

- **syslogサーバー**: ログを受信するサーバー（受信側）
- **client**: ログを送信するクライアント（送信側）
- **通信**: TLSで暗号化されたTCP接続（ポート6514）
- **認証方式**: anon（匿名認証） - デフォルト設定
- **ログ保存形式**: ホスト名とプログラム名で分割 - デフォルト設定

## 前提条件

- 同一パブリックVPC内に2台のAmazon Linux 2023インスタンスが存在すること
- サーバー名: `syslog`（受信側）
- サーバー名: `client`（送信側）
- 両サーバーにSSH接続が可能であること
- sudo権限を持つユーザーで作業すること

## 環境構築

### 1. セキュリティグループの設定

#### syslogサーバー側のセキュリティグループ

受信側のセキュリティグループに以下のインバウンドルールを追加します：

| タイプ | プロトコル | ポート範囲 | ソース |
|--------|-----------|-----------|--------|
| SSH | TCP | 22 | 作業環境のIP |
| SSH | TCP | 22 | clientサーバーのセキュリティグループID |
| カスタムTCP | TCP | 6514 | clientサーバーのセキュリティグループID |

:::message
**ポート6514について**: rsyslogのTLS接続で使用する標準ポートです。必要に応じて別のポート番号を使用することも可能です。
:::

:::message
**SSH接続について**: サーバー設定や証明書のコピーなど、作業を行うためにSSH接続が必要です。セキュリティのため、可能な限り特定のIPアドレスやセキュリティグループからのみアクセスを許可することを推奨します。
:::

#### client側のセキュリティグループ

送信側のセキュリティグループに以下のインバウンド・アウトバウンドルールを設定します：

**インバウンドルール：**

| タイプ | プロトコル | ポート範囲 | ソース |
|--------|-----------|-----------|--------|
| SSH | TCP | 22 | 作業環境のIP |

**アウトバウンドルール：**

| タイプ | プロトコル | ポート範囲 | 送信先 |
|--------|-----------|-----------|--------|
| SSH | TCP | 22 | syslogサーバーのセキュリティグループID |
| カスタムTCP | TCP | 6514 | syslogサーバーのセキュリティグループID |

:::message
**SSH/SCP接続について**: client側からsyslogサーバーへのSSH接続（SCPによる証明書コピーなど）にポート22のアウトバウンドが必要です。rsyslogのTLS通信にはポート6514のアウトバウンドが必要です。
:::

### 2. ホスト名の設定（オプション）

両サーバーでホスト名を設定しておくと、後続の設定が分かりやすくなります。

**syslogサーバー側**:

```bash
sudo hostnamectl set-hostname syslog
```

**client側**:

```bash
sudo hostnamectl set-hostname client
```

## syslogサーバー側の設定（受信側）

:::message alert
**重要**: このセクションの作業はすべて**syslogサーバー側**で実行してください。
:::

### 1. rsyslogのインストール

**syslogサーバー側で実行**:

Amazon Linux 2023にはrsyslogが標準でインストールされていますが、TLS機能を使用するには`rsyslog-openssl`パッケージが必要です：

```bash
sudo dnf update -y
sudo dnf install -y rsyslog rsyslog-openssl
```

:::message alert
**重要**: Amazon Linux 2023では`rsyslog-gnutls`が削除され、`rsyslog-openssl`に置き換えられています。TLS機能を使用するには`rsyslog-openssl`パッケージのインストールが必須です。
:::

バージョンを確認します：

```bash
rsyslogd -v
```

### 2. TLS証明書の生成

**syslogサーバー側で実行**:

rsyslogサーバーでTLS証明書を生成します。自己署名証明書を使用します：

```bash
# 証明書保存用ディレクトリを作成
sudo mkdir -p /etc/rsyslog.d/tls
cd /etc/rsyslog.d/tls

# CA秘密鍵を生成
sudo openssl genrsa -out ca-key.pem 2048

# CA証明書を生成（有効期限10年）
sudo openssl req -new -x509 -days 3650 -key ca-key.pem -out ca-cert.pem \
  -subj "/CN=rsyslog-ca"

# サーバー秘密鍵を生成
sudo openssl genrsa -out server-key.pem 2048

# サーバー証明書署名要求（CSR）を生成
sudo openssl req -new -key server-key.pem -out server.csr \
  -subj "/CN=syslog"

# サーバー証明書を生成（有効期限1年）
sudo openssl x509 -req -in server.csr -CA ca-cert.pem -CAkey ca-key.pem \
  -CAcreateserial -out server-cert.pem -days 365

# 証明書ファイルの権限を設定
sudo chmod 600 ca-key.pem server-key.pem
sudo chmod 644 ca-cert.pem server-cert.pem

# 不要なファイルを削除
sudo rm server.csr
```

:::message
**証明書の有効期限について**: 本手順ではCA証明書を10年、サーバー証明書を1年に設定しています。運用環境では、セキュリティポリシーに応じて適切な期間を設定してください。
:::

### 3. rsyslog設定ファイルの編集

**syslogサーバー側で実行**:

rsyslogの設定ファイルを編集して、TLS接続でログを受信できるようにします：

```bash
sudo vi /etc/rsyslog.conf
```

以下の設定を追加します：

```conf:/etc/rsyslog.conf
# TLSモジュールの読み込み（OpenSSLを使用）
module(load="imtcp" StreamDriver.Name="ossl" StreamDriver.Mode="1" StreamDriver.AuthMode="anon")

# TLS接続の設定
input(type="imtcp" port="6514")

# 証明書ファイルのパス指定
global(
    DefaultNetstreamDriver="ossl"
    DefaultNetstreamDriverCAFile="/etc/rsyslog.d/tls/ca-cert.pem"
    DefaultNetstreamDriverCertFile="/etc/rsyslog.d/tls/server-cert.pem"
    DefaultNetstreamDriverKeyFile="/etc/rsyslog.d/tls/server-key.pem"
)
```

:::message alert
**重要**: Amazon Linux 2023では`gtls`（GnuTLS）ではなく`ossl`（OpenSSL）を使用します。`StreamDriver.Name`と`DefaultNetstreamDriver`は`ossl`を指定してください。
:::

:::message
**認証方式について**: 本手順では`anon`（匿名認証）を使用します。サーバー証明書のみを使用し、クライアント証明書は不要です。設定が簡単で、同一VPC内の信頼できる環境では十分なセキュリティを提供します。TLS暗号化により通信は保護されます。
:::

### 4. ログ保存先の設定

**syslogサーバー側で実行**:

クライアントからのログを保存するディレクトリを作成し、設定を追加します：

```bash
# ログ保存用ディレクトリを作成
sudo mkdir -p /var/log/remote

# ディレクトリの権限を設定（rsyslogはrootで実行されるため、所有者はrootのまま）
sudo chmod 755 /var/log/remote
```

rsyslog設定ファイルにログ保存ルールを追加します：

```bash
sudo vi /etc/rsyslog.conf
```

ファイルの末尾に以下を追加：

```conf:/etc/rsyslog.conf
# リモートホストからのログを保存（デフォルト設定: ホスト名とプログラム名で分割）
$template RemoteLogs,"/var/log/remote/%HOSTNAME%/%PROGRAMNAME%.log"
*.* ?RemoteLogs
& stop
```

:::message
**ログ保存形式について**: 本手順では、ホスト名とプログラム名ごとにログファイルを分けて保存するデフォルト設定を使用します。保存先例: `/var/log/remote/client/sshd.log`。他の保存形式が必要な場合は、後述の「ログ保存形式の詳細設定」セクションを参照してください。
:::

### ログ保存形式の詳細設定（参考）

rsyslogでは、テンプレート機能を使用してログの保存形式を柔軟に設定できます。以下の変数を使用できます：

| 変数 | 説明 | 例 |
|------|------|-----|
| `%HOSTNAME%` | 送信元ホスト名 | `client` |
| `%PROGRAMNAME%` | プログラム名 | `sshd`, `systemd` |
| `%TIMESTAMP%` | タイムスタンプ | `2025-03-01T12:34:56` |
| `%syslogfacility-text%` | ファシリティ名 | `local0`, `kern` |
| `%syslogseverity-text%` | 重要度 | `info`, `error` |
| `%msg%` | ログメッセージ本体 | 実際のログ内容 |

**保存形式の例**:

1. **ホスト名とプログラム名で分割**（デフォルト設定）:

   ```conf
   $template RemoteLogs,"/var/log/remote/%HOSTNAME%/%PROGRAMNAME%.log"
   ```

   保存先例: `/var/log/remote/client/sshd.log`

2. **ホスト名と日付で分割**:

   ```conf
   $template RemoteLogs,"/var/log/remote/%HOSTNAME%/%$YEAR%-%$MONTH%-%$DAY%.log"
   ```

   保存先例: `/var/log/remote/client/2025-03-01.log`

3. **ファシリティと重要度で分割**:

   ```conf
   $template RemoteLogs,"/var/log/remote/%HOSTNAME%/%syslogfacility-text%-%syslogseverity-text%.log"
   ```

   保存先例: `/var/log/remote/client/local0-info.log`

4. **すべてのログを1つのファイルに**:

   ```conf
   $template RemoteLogs,"/var/log/remote/%HOSTNAME%.log"
   ```

   保存先例: `/var/log/remote/client.log`

5. **カスタム形式（JSON形式など）**:

   ```conf
   $template RemoteLogs,"{\"host\":\"%HOSTNAME%\",\"program\":\"%PROGRAMNAME%\",\"timestamp\":\"%TIMESTAMP%\",\"message\":\"%msg%\"}\n"
   ```

   保存先: `/var/log/remote/all.log`（1ファイルに全ログ）

:::message
**ログ保存形式の選択について**:

- ホスト数が多い場合: ホスト名で分割すると管理しやすい
- プログラムごとに分析したい場合: プログラム名で分割
- 日次でログを確認したい場合: 日付で分割
- ログ量が少ない場合: 1ファイルにまとめることも可能

運用要件に応じて適切な形式を選択してください。
:::

### 5. rsyslogサービスの再起動

**syslogサーバー側で実行**:

設定を反映するため、rsyslogサービスを再起動します：

```bash
# 設定ファイルの構文チェック
sudo rsyslogd -N1

# 問題がなければサービスを再起動
sudo systemctl restart rsyslog

# サービスが正常に起動しているか確認
sudo systemctl status rsyslog
```

### 6. ファイアウォール設定（必要に応じて）

**syslogサーバー側で実行**:

#### ファイアウォールの状態確認

まず、ファイアウォールが有効かどうかを確認します：

```bash
# firewalldの状態確認
sudo systemctl status firewalld

# firewalldが有効な場合、以下のような出力が表示されます：
# Active: active (running)
```

firewalldが有効（`active (running)`）な場合のみ、以下の設定を行ってください。

#### ポート6514の開放

firewalldが有効な場合、ポート6514を開放します：

```bash
# ポート6514を開放
sudo firewall-cmd --permanent --add-port=6514/tcp

# 設定を反映
sudo firewall-cmd --reload

# 設定が正しく反映されたか確認
sudo firewall-cmd --list-ports | grep 6514
```

:::message
**ファイアウォールが無効な場合**: firewalldが無効（`inactive`）な場合は、追加の設定は不要です。AWSのセキュリティグループでポート6514が開放されていれば、通信は可能です。
:::

## client側の設定（送信側）

:::message alert
**重要**: このセクションの作業はすべて**client側**で実行してください。
:::

### 1. rsyslogのインストール

**client側で実行**:

TLS機能を使用するには`rsyslog-openssl`パッケージが必要です：

```bash
sudo dnf update -y
sudo dnf install -y rsyslog rsyslog-openssl
```

### 2. CA証明書の配置

**client側で実行**:

syslogサーバーからCA証明書を取得して配置します。

:::message alert
**重要**: ローカルマシンから各サーバーへのSSH接続は可能でも、サーバー間のSSH接続でSSH鍵認証が設定されていない場合は、SCPは使用できません。`Permission denied (publickey)`エラーが発生します。

SCPを使用する場合は、事前にSSH鍵認証を設定する必要があります。設定が複雑な場合は、**手動コピー方法（方法2）を推奨します**。
:::

### SSH鍵認証の設定（SCPを使用する場合のみ必要）

**clientサーバー側で実行**:

1. **EC2作成時にダウンロードしたec2-key.pemの確認**

   clientサーバーに`ec2-key.pem`を配置します（既に配置されている場合はそのまま使用）：

   ```bash
   # ec2-key.pemが~/.ssh/ディレクトリにあることを確認
   ls -la ~/.ssh/ec2-key.pem

   # 権限を確認（秘密鍵は600である必要があります）
   chmod 600 ~/.ssh/ec2-key.pem
   ```

2. **公開鍵の抽出**

   秘密鍵から公開鍵を抽出します：

   ```bash
   # ec2-key.pemから公開鍵を抽出
   ssh-keygen -y -f ~/.ssh/ec2-key.pem
   ```

   表示された公開鍵の内容をコピーします（`ssh-rsa`で始まる1行の文字列）。

**syslogサーバー側で実行**:

1. **公開鍵をauthorized_keysに追加**

   **方法A: viエディタを使用する方法（推奨）**

   ```bash
   # .sshディレクトリが存在しない場合は作成
   mkdir -p ~/.ssh
   chmod 700 ~/.ssh

   # authorized_keysファイルを編集
   vi ~/.ssh/authorized_keys
   ```

   viエディタで以下の操作を行います：
   1. `i`キーを押して挿入モードに入る
   2. clientサーバーからコピーした公開鍵の内容を貼り付け（1行で、`ssh-rsa`で始まる文字列）
   3. `Esc`キーを押して挿入モードを終了
   4. `:wq`と入力してEnterキーを押し、保存して終了する

   ```bash
   # 権限を設定
   chmod 600 ~/.ssh/authorized_keys
   ```

   **方法B: echoコマンドを使用する方法**

   ```bash
   # .sshディレクトリが存在しない場合は作成
   mkdir -p ~/.ssh
   chmod 700 ~/.ssh

   # authorized_keysファイルに公開鍵を追加
   # 以下のコマンドの"公開鍵の内容"を実際の公開鍵に置き換える
   echo "公開鍵の内容" >> ~/.ssh/authorized_keys

   # 権限を設定
   chmod 600 ~/.ssh/authorized_keys
   ```

   :::message
   **公開鍵の取得方法**:
   - clientサーバーで`ssh-keygen -y -f ~/.ssh/ec2-key.pem`を実行して公開鍵を抽出
   - 表示された内容全体をコピー（`ssh-rsa`で始まり、メールアドレスやコメントで終わる1行）
   - syslogサーバーで上記のいずれかの方法で`authorized_keys`に追加

   **注意**: 公開鍵は1行で、改行を含まない形式で追加してください。既存の鍵がある場合は、新しい行に追加してください。
   :::

2. **接続テスト**

   **clientサーバー側で実行**:

   ```bash
   # syslogサーバーへのSSH接続をテスト
   # -iオプションでec2-key.pemを指定
   ssh -i ~/.ssh/ec2-key.pem ec2-user@10.0.8.255 "echo 'SSH接続成功'"
   ```

   パスワード入力なしで接続できれば、設定は成功です。

**方法1: SCPでコピーする場合**（SSH鍵認証設定後）

:::message
**注意**: 上記のSSH鍵認証設定が完了している場合のみ、この方法を使用できます。設定が完了していない場合は、方法2（手動コピー）を使用してください。
:::

syslogサーバーからclientサーバーにCA証明書をコピー：

```bash
# clientサーバーで実行
# syslogサーバーのプライベートIPアドレス（10.0.8.255）を指定
# ec2-userは実際のユーザー名に置き換えてください
# -iオプションでec2-key.pemを指定
scp -i ~/.ssh/ec2-key.pem ec2-user@10.0.8.255:/etc/rsyslog.d/tls/ca-cert.pem /tmp/ca-cert.pem

# 証明書を配置
sudo mkdir -p /etc/rsyslog.d/tls
sudo mv /tmp/ca-cert.pem /etc/rsyslog.d/tls/
sudo chmod 644 /etc/rsyslog.d/tls/ca-cert.pem
```

:::message alert
**SCPが使えない場合**:

- SSM（Session Manager）経由で接続している場合は、SCPが使用できません
- ホスト名解決ができない場合（`Could not resolve hostname syslog`エラー）は、IPアドレスを指定しても接続できない可能性があります
- 上記の場合は、**方法2（手動コピー）を使用してください**（推奨）
:::

**方法2: 手動でコピーする場合**（推奨・SSM接続時は必須）

**syslogサーバー側で実行**（CA証明書の内容を表示）:

```bash
sudo cat /etc/rsyslog.d/tls/ca-cert.pem
```

出力された証明書の内容をコピーします。`-----BEGIN CERTIFICATE-----`から`-----END CERTIFICATE-----`までを含めてください。

**client側で実行**（証明書ファイルを作成）:

```bash
sudo mkdir -p /etc/rsyslog.d/tls
sudo vi /etc/rsyslog.d/tls/ca-cert.pem
# syslogサーバーからコピーした内容を貼り付け
sudo chmod 644 /etc/rsyslog.d/tls/ca-cert.pem
```

:::message
**手動コピーの手順**:

1. syslogサーバー側で`sudo cat /etc/rsyslog.d/tls/ca-cert.pem`を実行
2. 表示された証明書の内容全体をコピー
3. client側で`sudo vi /etc/rsyslog.d/tls/ca-cert.pem`を実行してファイルを作成
4. コピーした内容を貼り付け、保存（`:wq`）
5. 権限を設定: `sudo chmod 644 /etc/rsyslog.d/tls/ca-cert.pem`

:::

### 3. rsyslog設定ファイルの編集

**client側で実行**:

rsyslog設定を編集して、syslogサーバーにログを送信するようにします：

```bash
sudo vi /etc/rsyslog.conf
```

ファイルの末尾に以下を追加：

```conf:/etc/rsyslog.conf
# TLS設定（OpenSSLを使用）
global(
    DefaultNetstreamDriver="ossl"
    DefaultNetstreamDriverCAFile="/etc/rsyslog.d/tls/ca-cert.pem"
)

# syslogサーバーへのTLS送信設定
*.* action(
    type="omfwd"
    protocol="tcp"
    target="10.0.8.255"
    port="6514"
    StreamDriver="ossl"
    StreamDriverMode="1"
    StreamDriverPermittedPeers="syslog"
)
```

:::message
**omfwdモジュールについて**: `omfwd`はrsyslogの標準モジュールのため、明示的に`module(load="omfwd")`を指定する必要はありません。`action(type="omfwd" ...)`を使用すると自動的にロードされます。

**osslドライバーの設定について**: Amazon Linux 2023のrsyslog-opensslでは、`StreamDriverCAFile`は`action()`内では使用できません。`global()`ブロックで`DefaultNetstreamDriverCAFile`を指定します。`action()`内では`StreamDriverPermittedPeers`でサーバー証明書のCNを指定します。

**警告メッセージについて**: "Certificate file is not set"と"Key file is not set"の警告が表示される場合があります。anon認証ではclient側に証明書ファイルとキーファイルは不要です。この警告は無視して問題ありません。ログが正常に送信されているか確認してください。
:::

:::message alert
**重要**: client側でも`StreamDriver`は`ossl`（OpenSSL）を指定してください。`gtls`ではありません。
:::

### 4. rsyslogサービスの再起動

**client側で実行**:

```bash
# 設定ファイルの構文チェック
sudo rsyslogd -N1

# 問題がなければサービスを再起動
sudo systemctl restart rsyslog

# サービスが正常に起動しているか確認
sudo systemctl status rsyslog
```

## 動作確認

### 1. syslogサーバー側での確認

**syslogサーバー側で実行**:

syslogサーバーでポート6514がリッスンしているか確認します：

```bash
sudo netstat -tlnp | grep 6514
# または
sudo ss -tlnp | grep 6514
```

以下のような出力が表示されれば正常です：

```
tcp  0  0  0.0.0.0:6514  0.0.0.0:*  LISTEN  1234/rsyslogd
```

### 2. client側から接続テスト

**client側で実行**:

client側からsyslogサーバーへの接続をテストします：

```bash
# テストログを送信
logger -n 10.0.8.255 -P 6514 -T "test message from client"

# または、opensslでTLS接続をテスト
echo "test message" | openssl s_client -connect 10.0.8.255:6514 -quiet
```

### 3. ログファイルの確認

**syslogサーバー側で実行**:

syslogサーバーで、clientからのログが保存されているか確認します：

```bash
# ログディレクトリの確認
sudo ls -la /var/log/remote/

# 特定のホストのディレクトリ内容を確認（ホスト名は実際のホスト名に置き換える）
# 例: ホスト名が"client"の場合
sudo ls -la /var/log/remote/client/
```

**ログファイルの内容を確認**:

```bash
# loggerコマンドで生成したログは、ユーザー名やプログラム名によって異なるファイルに保存されます
# 例: ec2-user.logに保存されている場合
sudo cat /var/log/remote/client/ec2-user.log

# または、message.logに保存されている場合（ホスト名によって異なる）
sudo cat /var/log/remote/client/message.log

# すべてのログファイルを確認
sudo find /var/log/remote/client/ -name "*.log" -type f

# 実際に存在するログファイルの例:
# - amazon-ssm-agent.log
# - audit.log
# - ec2-user.log (loggerコマンドで生成したログ)
# - ec2net.log
# - rsyslogd.log
# - sshd.log
# - sudo.log
# - systemd-logind.log
# - systemd.log
```

**ログファイルの内容をリアルタイムで確認する場合**:

```bash
# 特定のログファイルを監視
# loggerコマンドで生成したログを監視する場合
sudo tail -f /var/log/remote/client/ec2-user.log

# または、他のプログラムのログを監視
sudo tail -f /var/log/remote/client/sshd.log
sudo tail -f /var/log/remote/client/systemd.log
sudo tail -f /var/log/remote/client/audit.log
```

:::message
**ログファイルの確認方法**:

- まず`sudo ls -la /var/log/remote/client/`でディレクトリ内のファイルを確認してください。
- `logger`コマンドで生成したログは、**ユーザー名.log**（例: `ec2-user.log`）または**message.log**に保存される場合があります
- ログファイルは、プログラム名ごとに作成されます（例: `sshd.log`, `systemd.log`, `audit.log`, `amazon-ssm-agent.log`など）
- ログファイルが見つからない場合は、client側で`logger "test message"`を実行してログを生成し、数秒後に再度確認してください

:::

### 4. 実際のログ送信テスト

**client側で実行**（ログを生成）:

```bash
# テストログを生成
logger "This is a test log message from client server"
```

**syslogサーバー側で実行**（ログを確認）:

```bash
# 数秒待ってから、ログを確認
# まず、ログファイルが存在するか確認
sudo ls -la /var/log/remote/client/

# ログファイルが存在する場合、内容を確認
# loggerコマンドで生成したログは、ユーザー名.logまたはmessage.logに保存されます
# 例: ec2-user.logに保存されている場合
sudo cat /var/log/remote/client/ec2-user.log

# または、message.logに保存されている場合
sudo cat /var/log/remote/client/message.log

# リアルタイムでログを監視する場合
# まず、どのファイルにログが保存されているか確認してから監視
sudo tail -f /var/log/remote/client/ec2-user.log
# または
sudo tail -f /var/log/remote/client/message.log
```

:::message
**ログファイルの確認方法**:

- まず`sudo ls -la /var/log/remote/client/`でディレクトリ内のファイルを確認してください。
- `logger`コマンドで生成したログは、**ユーザー名.log**（例: `ec2-user.log`）または**message.log**に保存される場合があります
- ログファイルが存在する場合は、`sudo cat`で内容を確認するか、`sudo tail -f`でリアルタイム監視できます
- ログファイルが見つからない場合は、client側で再度`logger "test message"`を実行し、数秒後に`sudo ls -la /var/log/remote/client/`で新しく作成されたファイルを確認してください

:::

## トラブルシューティング

### 接続できない場合

1. **セキュリティグループの確認**（AWSコンソールで確認）
   - syslogサーバーのセキュリティグループでポート6514が開放されているか確認
   - clientサーバーからsyslogサーバーへの通信が許可されているか確認

2. **ファイアウォールの確認**

   **syslogサーバー側で実行**:

   ```bash
   # firewalldの状態確認
   sudo systemctl status firewalld

   # firewalldが有効な場合、開放されているポートを確認
   sudo firewall-cmd --list-ports | grep 6514

   # iptablesを直接使用している場合の確認
   sudo iptables -L -n | grep 6514

   # ポート6514が開放されていない場合、firewalldで開放する
   sudo firewall-cmd --permanent --add-port=6514/tcp
   sudo firewall-cmd --reload
   ```

3. **ネットワーク接続の確認**

   **client側で実行**:

   ```bash
   telnet 10.0.8.255 6514
   # または
   nc -zv 10.0.8.255 6514
   ```

### ログが保存されない場合

1. **rsyslog設定の確認**

   **syslogサーバー側で実行**:

   ```bash
   # 設定ファイルの構文チェック
   sudo rsyslogd -N1
   ```

2. **rsyslogログの確認**

   **syslogサーバー側で実行**:

   ```bash
   sudo journalctl -u rsyslog -f
   ```

3. **ディレクトリの権限確認**

   **syslogサーバー側で実行**:

   ```bash
   ls -la /var/log/remote/
   # Amazon Linux 2023ではrsyslogはrootで実行されるため、所有者はrootになります
   # 権限が正しくない場合は以下で修正する
   sudo chown -R root:root /var/log/remote/
   sudo chmod 755 /var/log/remote/
   ```

### TLS証明書エラーの場合

1. **証明書ファイルの存在確認**

   **syslogサーバー側で実行**:

   ```bash
   ls -la /etc/rsyslog.d/tls/
   ```

   **client側で実行**:

   ```bash
   ls -la /etc/rsyslog.d/tls/ca-cert.pem
   ```

2. **証明書の有効性確認**

   **syslogサーバー側で実行**:

   ```bash
   openssl x509 -in /etc/rsyslog.d/tls/server-cert.pem -text -noout
   ```

   **client側で実行**:

   ```bash
   openssl x509 -in /etc/rsyslog.d/tls/ca-cert.pem -text -noout
   ```

3. **証明書のCN確認**
   - サーバー証明書のCNが`syslog`になっているか確認（syslogサーバー側で確認）
   - client側の設定で`StreamDriverPermittedPeers`が正しく設定されているか確認（client側で確認）

## ログローテーションの設定

**syslogサーバー側で実行**:

大量のログが蓄積されないよう、logrotateを設定します：

```bash
sudo vi /etc/logrotate.d/rsyslog-remote
```

以下の内容を追加：

```conf:/etc/logrotate.d/rsyslog-remote
/var/log/remote/*/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
    sharedscripts
    postrotate
        /bin/systemctl reload rsyslog > /dev/null 2>&1 || true
    endscript
}
```

:::message
**ログファイルの所有者について**: Amazon Linux 2023ではrsyslogは`root`ユーザーで実行されるため、ログファイルの所有者も`root`になります。logrotateの設定でも`root root`を指定しています。
:::

## まとめ

Amazon Linux 2023でTLS暗号化されたrsyslogサーバーを構築する手順を解説しました。

- syslogサーバー側でTLS証明書を生成し、rsyslogを設定
- client側でCA証明書を配置し、syslogサーバーへの送信を設定
- TLSで暗号化された通信により、セキュアにログを収集

この構成により、同一VPC内のクライアントからセキュアにログを収集できる環境が構築できます。運用環境では、証明書の有効期限管理やログローテーション設定を適切に行い、継続的に運用できるようにしてください。

## 参考資料

- [rsyslog公式ドキュメント](https://www.rsyslog.com/doc/)
- [Amazon Linux 2023 ドキュメント](https://docs.aws.amazon.com/linux/al2023/)
- [rsyslog TLS設定ガイド](https://www.rsyslog.com/doc/v8-stable/tutorials/tls_cert_summary.html)

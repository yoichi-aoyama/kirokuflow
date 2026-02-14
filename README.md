# KirokuFlow

作業記録の入力、検索、日報作成をまとめて扱う Web アプリです。  
対象は個人利用の MVP ですが、将来の複数ユーザー対応を見据えたデータ構造で実装しています。

## 実装済み機能

### 1. 作業記録の登録
- 日時は自動記録（`createdAt`）
- テキスト記録
- 画像添付（ローカル保存）
- 作業時間（分）の入力

### 2. 作業記録一覧
- 最新 50 件を表示
- 各記録に以下を表示
  - 登録日時
  - 作業時間（分）
  - 本文
  - 添付画像

### 3. 検索
- 本文キーワード検索（`q`）
- 日時範囲検索（`from` / `to`）
- キーワード + 日時範囲の複合検索

### 4. 日報作成・編集
- カレンダーで対象日を選択（`reportDate`）
- 日報本文を手動入力して保存
- 同一日付は上書き保存（後から修正可能）
- 日報保存時に当日分の作業記録を自動集計
  - 合計作業時間（分）
  - 当日の作業記録の要約リスト

### 5. 日報アーカイブ
- 最新の日報を一覧表示
- 各日報の合計作業時間を表示
- アーカイブの「この日報を編集」から対象日の日報編集フォームへ遷移

## 画面仕様（現状）

### 作業記録フォーム
- 入力項目
  - `text`（必須）
  - `workMinutes`（分）
  - `image`（任意）

### 日報フォーム
- 対象日をカレンダーで選択
- 選択日の集計プレビューを表示
  - 合計分
  - 対象日の記録一覧
- 日報本文を保存

### 一覧・検索
- 作業記録一覧に検索フォーム
  - キーワード
  - 開始日
  - 終了日

## 技術構成
- Framework: Next.js (App Router)
- Language: TypeScript
- DB/ORM: SQLite + Prisma
- Styling: Tailwind CSS
- Package Manager: pnpm

## データモデル（主要）
- `User`
- `Entry`
  - `text`
  - `workMinutes`
  - `createdAt`
- `Attachment`
  - 画像ファイル情報
- `DailyReport`
  - `date`
  - `summary`
  - `totalWorkMinutes`
  - `aggregatedEntries`

## ローカル保存先
- DB: `/Users/ao/work/kirokuflow/dev.db`
- 画像: `/Users/ao/work/kirokuflow/public/uploads/`

## セットアップ

```bash
cp .env.example .env
pnpm install
pnpm prisma migrate dev
pnpm dev
```

- 起動後: [http://localhost:3000](http://localhost:3000)

## 補足
- 現在はデフォルトユーザー（`Default User`）で動作
- 認証・ユーザー分離は未実装（将来対応）

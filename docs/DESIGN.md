# NostrYears 設計ドキュメント

## 概要

NostrYearsは、2025年のNostr活動を集計・表示するフロントエンド完結型Webアプリです。

## 技術スタック

- **フレームワーク**: React 18 + Vite + TypeScript
- **パッケージマネージャ**: pnpm
- **Nostrライブラリ**: nostr-fetch, nostr-tools
- **UIライブラリ**: Material UI (MUI) v5
- **デフォルトリレー**: `wss://r.kojira.io`, `wss://yabu.me`

## 集計期間

- **開始**: 2025年1月1日 0:00:00 JST（UTC: 2024-12-31T15:00:00Z）
- **終了**: 2025年12月1日 0:00:00 JST（UTC: 2025-11-30T15:00:00Z）

## 機能

### 1. ユーザー指定

- npub入力フィールドで公開鍵を指定
- NIP-07拡張機能が検出された場合は「NIP-07から取得」ボタンを表示
- nostr-toolsを使用してnpubからhex公開鍵に変換

### 2. 集計項目

| 項目 | Kind | 計算方法 |
|------|------|----------|
| 仲が良かった人TOP10 | 1, 7 | 仲良しスコアリング戦略参照 |
| kind 1投稿数 | 1 | author=自分のイベント数 |
| kind 1総文字数 | 1 | content文字数（URL除去後） |
| kind 30023の数/文字数 | 30023 | 長文記事の投稿数と総文字数 |
| kind 6, 7, 42の数 | 6, 7, 42 | Repost, Reaction, チャットメッセージ数 |
| 総投稿画像数 | 1 | contentの画像URL（.jpg/.png/.gif/.webp等）をカウント |
| 最もリアクションが多かった投稿 | 7 | 自分のkind 1へのリアクション数をカウントしTop1表示 |

### 3. 仲良しスコアリング戦略

#### データ収集

1. **自分 → 相手**
   - 自分のkind 7（リアクション）を取得し、pタグから相手のpubkeyを抽出
   - 自分のkind 1（投稿）を取得し、pタグ（メンション/リプライ先）から相手を抽出

2. **相手 → 自分**
   - 自分のkind 1投稿のIDに対するkind 7を取得し、authorを集計
   - 自分へのリプライ（kind 1でpタグに自分が含まれる）を取得し、authorを集計

#### スコア計算式

```
スコア = (自分→相手のリアクション数 × 1)
       + (自分→相手のリプライ数 × 2)
       + (相手→自分のリアクション数 × 1)
       + (相手→自分のリプライ数 × 2)
```

- リプライは文章を書く手間があるため、リアクションの2倍の重み付け
- 双方向のインタラクションを合算してランキング

### 4. 集計結果のリレー投稿（kind 30078）

#### イベント構造

```json
{
  "kind": 30078,
  "tags": [
    ["d", "nostr-years-2025"],
    ["version", "1"]
  ],
  "content": "{
    \"period\": { \"since\": 1735657200, \"until\": 1764450000 },
    \"kind1Count\": 1234,
    \"kind1Chars\": 56789,
    \"kind30023Count\": 10,
    \"kind30023Chars\": 12345,
    \"kind6Count\": 100,
    \"kind7Count\": 500,
    \"kind42Count\": 50,
    \"imageCount\": 200,
    \"topPostId\": \"<event_id>\",
    \"topPostReactionCount\": 42
  }"
}
```

#### パーセンタイル計算

- リレーから他ユーザーのkind 30078（d=nostr-years-2025）を取得
- 各指標について、自分が上位何％かを計算して表示
- 例: 「投稿数: 1234件（上位15%）」

#### NIP-07がない場合

- 集計結果の閲覧のみ可能
- リレーへの投稿機能は無効化
- 「NIP-07拡張をインストールすると結果を共有できます」と表示

## ファイル構成

```
NostrYears/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.tsx              # エントリーポイント
│   ├── App.tsx               # メインアプリケーション
│   ├── theme.ts              # MUIテーマ設定
│   ├── types/
│   │   └── nostr.ts          # Nostr型定義、NIP-07拡張、kind 30078構造
│   ├── hooks/
│   │   └── useNostrStats.ts  # データ取得・統計計算フック
│   ├── services/
│   │   ├── nostrFetcher.ts   # nostr-fetchラッパー
│   │   └── nostrPublisher.ts # kind 30078投稿・取得
│   ├── utils/
│   │   ├── textAnalysis.ts   # URL除去、画像URL抽出
│   │   ├── scoring.ts        # 仲良しスコア計算
│   │   └── percentile.ts     # パーセンタイル計算
│   └── components/
│       ├── InputForm.tsx     # npub入力フォーム + ローディング表示
│       ├── StatsCard.tsx     # 統計カード（汎用）+ パーセンタイル表示
│       ├── FriendsRanking.tsx# 仲良しランキング
│       ├── TopPost.tsx       # 最人気投稿表示
│       └── YearSummary.tsx   # メイン結果画面
└── docs/
    └── DESIGN.md             # このファイル
```

## 使用方法

### 開発

```bash
pnpm install
pnpm dev
```

### ビルド

```bash
pnpm build
```

### プレビュー

```bash
pnpm preview
```


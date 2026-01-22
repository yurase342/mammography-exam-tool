# マンモグラフィ認定試験対策ツール - 動作確認用プロンプト

## 概要
このプロジェクトは柔道整復師国試対策ツールをマンモグラフィ認定試験対策ツールに変換したものです。
動作確認とビルドテストを行ってください。

## 変更内容サマリー

### 1. 問題データの変換（完了済み）
- 実力テスト: 24回分、484問
- 試験対策問題: 20回分、389問
- 合計: 873問
- 出力先: `public/data/questions/` (jitsuryoku_*.json, taisaku_*.json)

### 2. カテゴリ変更（完了済み）
柔道整復11科目 → マンモグラフィ8分野:
- `positioning`: 撮影技術・ポジショニング
- `xray_physics`: X線装置・物理
- `quality_control`: 品質管理・精度管理
- `anatomy`: 解剖・組織
- `pathology`: 乳腺疾患・病理
- `image_reading`: 画像評価・読影
- `digital_imaging`: デジタル画像技術
- `screening`: 検診・疫学

### 3. 制限時間変更（完了済み）
- 旧: 75秒/問
- 新: 150秒/問（20問=50分、マンモ認定本試験と同様）
- 変更箇所: `src/components/Home.tsx` 行152, 414

### 4. 問題ソース選択（完了済み）
- 練習モード・テストモード両方で「実力テスト」「試験対策問題」を選択可能
- 複数回次の選択も可能

### 5. 2択問題対応（完了済み）★新規
問題文に「2つ選べ」「２つ選べ」がある場合の特別処理:
- 1つ目選択 → 反応なし（選択中の青い枠のみ）
- 2つ目選択 → 「回答を確定する」ボタンが有効化
- ボタンを押す → 正解/不正解を判定・表示
- UIに「⚠️ この問題は2つ選んでください（X/2 選択中）」と表示
- 変更ファイル:
  - `src/components/QuestionView.tsx` - 複数選択UI
  - `src/components/QuestionSession.tsx` - 複数回答の正解判定
  - `src/components/AnswerFeedback.tsx` - 2択問題用フィードバック表示

## 確認してほしいタスク

### タスク1: TypeScriptビルド確認
```bash
cd /path/to/project
npm run build
```
ビルドエラーがあれば修正してください。

### タスク2: 開発サーバー起動確認
```bash
npm run dev
```
以下を確認:
1. ホーム画面が表示される
2. 8つのマンモグラフィカテゴリが表示される
3. 実力テスト/試験対策問題の選択ができる
4. 問題が読み込まれる（873問）
5. テストモードで制限時間が表示される（例: 10問 = 25分）

### タスク3: 2択問題の動作確認 ★重要
1. 実力テスト第1回を選択して開始
2. 「2つ選べ」問題が出るまで進める（第1回はほとんどが2択問題）
3. 以下を確認:
   - 「⚠️ この問題は2つ選んでください」の表示
   - 1つ選択しても自動で次に進まない
   - 2つ選択すると「回答を確定する」ボタンが有効化
   - ボタンを押すと正解/不正解が表示される
   - 正解時「2つとも正解！」、不正解時は選択と正解が両方表示される

### タスク4: 1択問題の動作確認
1. 1択問題（「2つ選べ」がない問題）を解く
2. 選択肢をクリックしたら自動的にフィードバック表示されることを確認

## 既知の問題

### 画像表示について ⚠️
- 問題文に「図」「画像」「写真」を参照するものが81問あります
- しかし、元のPDFから図の抽出は行われていません
- imagesフォルダは存在しますが空です
- 現状では図が必要な問題でも図は表示されません
- 対応方法:
  1. PDFから手動で画像を抽出
  2. `public/data/question-images/mammo/jitsuryoku/{回数}/` に配置
  3. 問題JSONに`image`フィールドを追加

### node_modules関連
以前のビルドでnpmレジストリ接続エラーがありました。
node_modulesが壊れている場合は:
```bash
rm -rf node_modules package-lock.json
npm install
```

## ファイル構成

```
src/
├── types/
│   ├── index.ts          # CategoryId型（8分野）
│   └── questionData.ts   # MammoSourceType型
├── config/
│   └── categoryConfig.ts # カテゴリ設定
├── services/
│   ├── jsonQuestionLoader.ts # JSON問題読み込み
│   ├── questionGenerator.ts  # 問題生成
│   └── hintGenerator.ts      # ヒント生成
└── components/
    ├── Home.tsx              # メイン画面
    ├── QuestionView.tsx      # 問題表示（2択対応）★更新
    ├── QuestionSession.tsx   # セッション管理（2択対応）★更新
    └── AnswerFeedback.tsx    # フィードバック表示（2択対応）★更新

public/data/questions/
├── jitsuryoku_1.json ~ jitsuryoku_24.json  # 実力テスト
└── taisaku_1.json ~ taisaku_20.json        # 試験対策問題
```

## 2択問題のデータ構造

問題JSONでは以下のように2択問題が定義されています:
```json
{
  "questionNumber": 1,
  "questionText": "...2 つ選べ。",
  "choices": { "a": "...", "b": "...", "c": "...", "d": "...", "e": "..." },
  "correctAnswer": "a",
  "correctAnswers": ["a", "b"],
  "category": "anatomy"
}
```

判定ロジック:
- `questionText`に「2 つ選」「2つ選」「２つ選」が含まれる → 2択モード
- ユーザーが選んだ2つが`correctAnswers`と完全一致 → 正解

## 質問があれば

変換スクリプト: `convert_mammo_to_tool_format.py`（プロジェクトルート）
このスクリプトでマンモ認定フォルダ内のJSONを変換しています。

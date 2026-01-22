/**
 * ヒント生成サービス
 * マンモグラフィ認定試験用
 * 問題文と選択肢から自動的にキーワードと考え方のヒントを抽出
 */

import { Question, CategoryId } from '../types';

export interface GeneratedHint {
  keywords: string[];
  thinkingHints: string[];
}

/**
 * マンモグラフィ関連用語辞書
 */
const MAMMO_TERMS: Record<string, string[]> = {
  // 撮影技術
  positioning: [
    'MLO', 'CC', '撮影', 'ポジショニング', '圧迫板', '圧迫圧', '圧迫',
    '胸壁', '乳頭', '大胸筋', '外側', '内側', '下部', '上部',
    'IMF', '乳房下溝', 'SIO', 'スポット', '接線', '拡大撮影',
  ],
  // X線・物理
  xray: [
    'X線', '管電圧', 'kVp', 'Mo', 'Rh', 'W', 'ターゲット',
    'フィルタ', '焦点', '陽極', '陰極', '半価層', 'HVL', '線量',
    'mGy', 'mAs', 'AEC', '特性', '吸収端', 'keV',
  ],
  // 品質管理
  quality: [
    '品質管理', '精度管理', 'ファントム', 'CNR', '定期管理',
    'コントラスト', 'ACR', 'PMMA', 'アクリル', 'AGD', '乳腺線量',
  ],
  // 解剖
  anatomy: [
    '乳管', '小葉', '乳腺', '脂肪', '組織', '腺房', 'Cooper', 'クーパー',
    '腋窩', '乳輪', '大胸筋', '小胸筋', 'リンパ', '血管',
  ],
  // 病理
  pathology: [
    '乳癌', '乳がん', '癌', '乳腺症', '線維腺腫', '葉状腫瘍',
    '嚢胞', '腫瘍', '腫瘤', '良性', '悪性', '浸潤', '非浸潤',
    'DCIS', 'LCIS', '病変', '転移',
  ],
  // 読影
  reading: [
    '石灰化', 'カテゴリー', '境界', 'スピキュラ', '構築の乱れ',
    '集簇', '区域性', '分布', '微細', '粗大', '所見', '読影',
  ],
  // デジタル
  digital: [
    'CR', 'DR', 'デジタル', 'モニタ', 'ピクセル', '解像度', '階調',
    'DQE', 'MTF', 'SNR', 'GSDF', 'NEQ', '量子化', '標本化',
  ],
  // 検診
  screening: [
    '検診', '罹患', '死亡', '感度', '特異度', '陽性適中率',
    '偽陽性', '偽陰性', '受診率', 'dense', 'デンス',
  ],
};

/**
 * 科目別の考え方ヒント
 */
const CATEGORY_THINKING_HINTS: Record<CategoryId, string[]> = {
  positioning: [
    'MLO撮影とCC撮影の違いを思い出しましょう',
    '大胸筋の描出と胸壁の位置関係を確認しましょう',
    '圧迫の目的と適切な圧迫圧を考えましょう',
    '追加撮影法の適応と方法を思い出しましょう',
  ],
  xray_physics: [
    'ターゲット/フィルタの組み合わせと特性を確認しましょう',
    '管電圧と画質・線量の関係を考えましょう',
    'X線スペクトルの特性を思い出しましょう',
    'AECの原理と設定を確認しましょう',
  ],
  quality_control: [
    'ファントム評価の項目と基準を確認しましょう',
    'CNRと画質の関係を考えましょう',
    '日常点検と定期点検の項目を思い出しましょう',
    '乳腺線量の測定方法を確認しましょう',
  ],
  anatomy: [
    '乳腺の解剖学的構造を思い出しましょう',
    '乳管と小葉の位置関係を確認しましょう',
    'クーパー靭帯の役割を考えましょう',
    'リンパ節の分布を思い出しましょう',
  ],
  pathology: [
    '良性腫瘍と悪性腫瘍の特徴を比較しましょう',
    '浸潤癌と非浸潤癌の違いを確認しましょう',
    '乳腺症の病態を思い出しましょう',
    'TNM分類の基準を確認しましょう',
  ],
  image_reading: [
    '石灰化の形態と分布を確認しましょう',
    'カテゴリー分類の基準を思い出しましょう',
    '腫瘤の境界と形状を考えましょう',
    '構築の乱れの所見を確認しましょう',
  ],
  digital_imaging: [
    'CR/DRの原理と特性を確認しましょう',
    'DQEとMTFの意味を思い出しましょう',
    'モニタ診断の環境基準を考えましょう',
    '画像処理の目的を確認しましょう',
  ],
  screening: [
    '感度と特異度の定義を確認しましょう',
    '検診の対象年齢と間隔を思い出しましょう',
    'リスク因子を考えましょう',
    '検診の有効性指標を確認しましょう',
  ],
};

/**
 * 問題文からキーワードを抽出
 */
function extractKeywords(question: Question): string[] {
  const text = `${question.questionText} ${question.choices.map(c => c.text).join(' ')}`;
  const keywords: string[] = [];
  const addedKeywords = new Set<string>();

  // 全カテゴリの用語をチェック
  for (const terms of Object.values(MAMMO_TERMS)) {
    for (const term of terms) {
      if (text.includes(term) && !addedKeywords.has(term)) {
        keywords.push(term);
        addedKeywords.add(term);
      }
    }
  }

  return keywords.slice(0, 5); // 最大5つまで
}

/**
 * 科目に基づくヒントを取得
 */
function getCategoryHints(category: CategoryId): string[] {
  return CATEGORY_THINKING_HINTS[category] || [];
}

/**
 * 問題タイプに基づくヒントを生成
 */
function getQuestionTypeHints(questionText: string): string[] {
  const hints: string[] = [];

  if (questionText.includes('誤っている')) {
    hints.push('「誤っている」を選ぶ問題です。正しい記述を除外しましょう');
  } else if (questionText.includes('正しい')) {
    hints.push('「正しい」を選ぶ問題です。誤った記述を除外しましょう');
  }

  if (questionText.includes('2つ選べ') || questionText.includes('２つ選べ')) {
    hints.push('複数選択問題です。2つの正解を見つけましょう');
  }

  if (questionText.includes('組合せ')) {
    hints.push('組み合わせ問題です。各選択肢を個別に検討しましょう');
  }

  return hints;
}

/**
 * ヒントを生成
 */
export function generateHint(question: Question): GeneratedHint {
  const keywords = extractKeywords(question);
  const thinkingHints: string[] = [];

  // 問題タイプに基づくヒント
  thinkingHints.push(...getQuestionTypeHints(question.questionText));

  // カテゴリに基づくヒント
  if (question.category) {
    const categoryHints = getCategoryHints(question.category);
    // ランダムに1〜2個選択
    const shuffled = [...categoryHints].sort(() => Math.random() - 0.5);
    thinkingHints.push(...shuffled.slice(0, 2));
  }

  return {
    keywords,
    thinkingHints,
  };
}

/**
 * 全ての利用可能なヒントを取得
 */
export function getAllHints(question: Question): GeneratedHint {
  return generateHint(question);
}

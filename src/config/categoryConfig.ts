/**
 * 科目（カテゴリ）設定
 * マンモグラフィ認定試験の8分野を定義
 */

import { CategoryId } from '../types';

export interface CategoryInfo {
  id: CategoryId;
  name: string;
  shortName: string;
  description: string;
  color: string; // Tailwind CSS color class
}

/**
 * 科目情報の定義
 */
export const CATEGORIES: Record<CategoryId, CategoryInfo> = {
  positioning: {
    id: 'positioning',
    name: '撮影技術・ポジショニング',
    shortName: '撮影',
    description: 'MLO・CC撮影、ポジショニング、圧迫、追加撮影法',
    color: 'blue',
  },
  xray_physics: {
    id: 'xray_physics',
    name: 'X線装置・物理',
    shortName: 'X線',
    description: 'X線管、管電圧、ターゲット/フィルタ、線量、AEC',
    color: 'purple',
  },
  quality_control: {
    id: 'quality_control',
    name: '品質管理・精度管理',
    shortName: '品質',
    description: 'ファントム評価、定期管理、CNR、出力測定',
    color: 'green',
  },
  anatomy: {
    id: 'anatomy',
    name: '解剖・組織',
    shortName: '解剖',
    description: '乳管・小葉構造、乳腺組織、脂肪組織、リンパ節',
    color: 'orange',
  },
  pathology: {
    id: 'pathology',
    name: '乳腺疾患・病理',
    shortName: '病理',
    description: '乳癌、乳腺症、線維腺腫、葉状腫瘍、TNM分類',
    color: 'red',
  },
  image_reading: {
    id: 'image_reading',
    name: '画像評価・読影',
    shortName: '読影',
    description: '石灰化、腫瘤、構築の乱れ、カテゴリー分類',
    color: 'pink',
  },
  digital_imaging: {
    id: 'digital_imaging',
    name: 'デジタル画像技術',
    shortName: 'デジタル',
    description: 'CR/DR、モニタ診断、DQE、MTF、画像処理',
    color: 'cyan',
  },
  screening: {
    id: 'screening',
    name: '検診・疫学',
    shortName: '検診',
    description: '検診制度、感度・特異度、罹患率、リスク因子',
    color: 'teal',
  },
};

/**
 * 科目リスト（表示順）
 */
export const CATEGORY_LIST: CategoryId[] = [
  'positioning',
  'xray_physics',
  'quality_control',
  'anatomy',
  'pathology',
  'image_reading',
  'digital_imaging',
  'screening',
];

/**
 * 科目情報を取得
 */
export function getCategoryInfo(categoryId: CategoryId): CategoryInfo {
  return CATEGORIES[categoryId];
}

/**
 * 全科目情報を取得
 */
export function getAllCategories(): CategoryInfo[] {
  return CATEGORY_LIST.map(id => CATEGORIES[id]);
}

/**
 * 問題番号から科目を取得（マンモ認定では使用しない - JSONのcategoriesフィールドを使用）
 * @deprecated マンモ認定試験では問題データのcategoriesフィールドを直接参照してください
 */
export function getCategoryByQuestionNumber(
  _questionNumber: number,
  _session: 'gozen' | 'gogo' | 'jitsuryoku' | 'taisaku'
): CategoryId {
  // マンモ認定では問題番号による分類は行わない
  // 問題データのcategoriesフィールドを使用する
  return 'positioning';
}

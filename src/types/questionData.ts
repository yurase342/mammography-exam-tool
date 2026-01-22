/**
 * JSONベースの問題データ型定義
 * マンモグラフィ認定試験問題データ用
 */

import { SessionType, CategoryId } from './index';

/**
 * マンモ認定ソースタイプ
 */
export type MammoSourceType = 'jitsuryoku' | 'taisaku';

/**
 * JSON問題ファイルの形式
 */
export interface QuestionDataFile {
  examNumber: number;
  year: number;
  session: SessionType | MammoSourceType;
  totalQuestions: number;
  sourceType?: MammoSourceType;
  round?: string;
  questions: QuestionDataItem[];
}

/**
 * 個別の問題データ
 */
export interface QuestionDataItem {
  questionNumber: number;
  questionText: string;
  choices: {
    a: string;
    b: string;
    c: string;
    d: string;
    e?: string;
  };
  correctAnswer?: string;
  correctAnswers?: string[];
  bessatsuPage?: number;
  bessatsuLabel?: string;
  category?: CategoryId;
  categories?: CategoryId[];
  explanation?: string;
  image?: string;
}

/**
 * 別冊マッピング情報
 */
export interface BessatsuMapping {
  examNumber: number;
  session: SessionType | MammoSourceType;
  questionToPage: Record<number, number[]>;
}

/**
 * マンモ認定の回次設定
 */
export interface MammoRoundConfig {
  round: number;
  sourceType: MammoSourceType;
  questionCount: number;
}

/**
 * マンモ認定利用可能な回次一覧
 */
export const MAMMO_JITSURYOKU_ROUNDS = Array.from({length: 24}, (_, i) => i + 1);
export const MAMMO_TAISAKU_ROUNDS = Array.from({length: 20}, (_, i) => i + 1);

/**
 * 問題データJSONファイルのパス取得（マンモ認定用）
 */
export function getQuestionDataPath(round: number, sourceType: MammoSourceType): string {
  return `/data/questions/${sourceType}_${round}.json`;
}

/**
 * 全マンモ認定問題ファイルのパスを取得
 */
export function getAllMammoQuestionPaths(): { path: string; round: number; sourceType: MammoSourceType }[] {
  const paths: { path: string; round: number; sourceType: MammoSourceType }[] = [];
  
  // 実力テスト（24回）
  for (const round of MAMMO_JITSURYOKU_ROUNDS) {
    paths.push({
      path: getQuestionDataPath(round, 'jitsuryoku'),
      round,
      sourceType: 'jitsuryoku'
    });
  }
  
  // 試験対策問題（20回）
  for (const round of MAMMO_TAISAKU_ROUNDS) {
    paths.push({
      path: getQuestionDataPath(round, 'taisaku'),
      round,
      sourceType: 'taisaku'
    });
  }
  
  return paths;
}

/**
 * 別冊マッピングJSONファイルのパス取得
 */
export function getBessatsuMappingPath(examNumber: number, session: SessionType): string {
  return `/data/bessatsu/${examNumber}_${session}_bessatsu.json`;
}

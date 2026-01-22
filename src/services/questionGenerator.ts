/**
 * マンモグラフィ認定試験 問題生成サービス
 * JSONファイルから問題を読み込む
 */

import { Question, CategoryId } from '../types';
import { 
  loadAllMammoQuestions, 
  loadQuestionsFromJson
} from './jsonQuestionLoader';
import { MammoSourceType, MAMMO_JITSURYOKU_ROUNDS, MAMMO_TAISAKU_ROUNDS } from '../types/questionData';

/**
 * 利用可能な回次を取得
 */
export function getAvailableExamNumbers(): { jitsuryoku: number[], taisaku: number[] } {
  return {
    jitsuryoku: MAMMO_JITSURYOKU_ROUNDS,
    taisaku: MAMMO_TAISAKU_ROUNDS
  };
}

/**
 * 全回次番号を取得（互換性のため）
 */
export function getAllExamNumbers(): number[] {
  return [...MAMMO_JITSURYOKU_ROUNDS, ...MAMMO_TAISAKU_ROUNDS];
}

/**
 * 指定した回次・ソースタイプの問題を生成
 */
export async function generateQuestionsFromAnswerPdf(
  round: number,
  sourceType: MammoSourceType
): Promise<Question[]> {
  console.log(`[generateQuestions] 開始: ${sourceType} 第${round}回`);
  
  const questions = await loadQuestionsFromJson(round, sourceType);
  console.log(`[generateQuestions] ${sourceType} 第${round}回: ${questions.length}問`);
  
  return questions;
}

/**
 * 全問題を生成
 */
export async function generateAllQuestions(): Promise<Question[]> {
  console.log(`[generateAllQuestions] マンモ認定全問題を読み込み開始`);
  
  const allQuestions = await loadAllMammoQuestions();
  
  console.log(`[generateAllQuestions] 合計: ${allQuestions.length}問`);
  return allQuestions;
}

/**
 * カテゴリでフィルタリングした問題を取得
 */
export async function getFilteredQuestions(
  sourceTypes?: MammoSourceType[],
  rounds?: number[],
  categories?: CategoryId[]
): Promise<Question[]> {
  const allQuestions = await generateAllQuestions();
  
  let filtered = allQuestions;

  // ソースタイプでフィルタ
  if (sourceTypes && sourceTypes.length > 0) {
    filtered = filtered.filter(q => sourceTypes.includes(q.session as MammoSourceType));
  }

  // 回次でフィルタ
  if (rounds && rounds.length > 0) {
    filtered = filtered.filter(q => rounds.includes(q.examNumber));
  }

  // カテゴリでフィルタ
  if (categories && categories.length > 0) {
    filtered = filtered.filter(q => q.category && categories.includes(q.category));
  }

  return filtered;
}

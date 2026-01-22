/**
 * JSONベースの問題データローダー
 * マンモグラフィ認定試験問題専用
 */

import { Question, Choice, CategoryId } from '../types';
import { 
  QuestionDataFile, 
  QuestionDataItem, 
  MammoSourceType,
  getQuestionDataPath,
  getAllMammoQuestionPaths,
  MAMMO_JITSURYOKU_ROUNDS,
  MAMMO_TAISAKU_ROUNDS
} from '../types/questionData';

/**
 * JSONファイルから問題データを読み込む
 */
export async function loadQuestionsFromJson(
  round: number,
  sourceType: MammoSourceType
): Promise<Question[]> {
  const jsonPath = getQuestionDataPath(round, sourceType);

  console.log(`[jsonQuestionLoader] JSONから問題を読み込み: ${jsonPath}`);

  try {
    const response = await fetch(jsonPath);

    if (!response.ok) {
      console.warn(`[jsonQuestionLoader] JSONファイルが見つかりません: ${jsonPath}`);
      return [];
    }

    const text = await response.text();
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      console.error(`[jsonQuestionLoader] エラー: HTMLが返されました`);
      return [];
    }

    let data: QuestionDataFile;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error(`[jsonQuestionLoader] JSONパースエラー:`, parseError);
      return [];
    }

    // 問題データを変換
    const questions = data.questions.map(item =>
      convertToQuestion(item, round, data.year, sourceType)
    );

    // カテゴリ情報の確認ログ
    const categoryCounts: Record<string, number> = {};
    questions.forEach(q => {
      if (q.category) {
        categoryCounts[q.category] = (categoryCounts[q.category] || 0) + 1;
      }
    });
    console.log(`[jsonQuestionLoader] ${sourceType}_${round}: ${questions.length}問を読み込み (カテゴリ別:`, categoryCounts, ')');

    return questions;
  } catch (error) {
    console.error(`[jsonQuestionLoader] 読み込みエラー:`, error);
    return [];
  }
}

/**
 * QuestionDataItemをQuestion型に変換
 */
function convertToQuestion(
  item: QuestionDataItem,
  round: number,
  year: number,
  sourceType: MammoSourceType
): Question {
  const id = `${sourceType}-${round}-${item.questionNumber}`;

  // 選択肢を構築
  const choices: Choice[] = [
    { label: 'a', text: item.choices.a?.trim() || '' },
    { label: 'b', text: item.choices.b?.trim() || '' },
    { label: 'c', text: item.choices.c?.trim() || '' },
    { label: 'd', text: item.choices.d?.trim() || '' },
  ];

  if (item.choices.e && item.choices.e.trim()) {
    choices.push({ label: 'e', text: item.choices.e.trim() });
  }

  const filteredChoices = choices.filter(c => c.text !== '');

  // 正答を決定
  let correctAnswer: string;
  let correctAnswers: string[] | undefined;

  if (item.correctAnswers && item.correctAnswers.length > 0) {
    correctAnswer = item.correctAnswers[0];
    correctAnswers = item.correctAnswers.length > 1 ? item.correctAnswers : undefined;
  } else if (item.correctAnswer) {
    correctAnswer = item.correctAnswer;
    correctAnswers = undefined;
  } else {
    correctAnswer = 'a';
    correctAnswers = undefined;
  }

  // カテゴリを取得（最初のカテゴリを使用）
  const category: CategoryId = item.category || (item.categories && item.categories[0]) || 'positioning';

  return {
    id,
    year,
    examNumber: round,
    session: sourceType as any, // MammoSourceTypeを使用
    questionNumber: item.questionNumber,
    questionText: item.questionText.trim(),
    choices: filteredChoices,
    correctAnswer,
    correctAnswers,
    explanation: item.explanation || '',
    sourceFile: `${sourceType}_${round}.json`,
    hasSupplementImage: !!item.image,
    supplementReferences: item.image ? [{
      referenceText: `図`,
      supplementId: `${sourceType}-${round}-${item.questionNumber}-img`,
      imageNumber: item.questionNumber.toString()
    }] : [],
    isImageBased: false,
    category,
  };
}

/**
 * 全マンモ認定問題を読み込む
 */
export async function loadAllMammoQuestions(): Promise<Question[]> {
  const allQuestions: Question[] = [];
  const allPaths = getAllMammoQuestionPaths();

  for (const { round, sourceType } of allPaths) {
    const questions = await loadQuestionsFromJson(round, sourceType);
    allQuestions.push(...questions);
  }

  console.log(`[jsonQuestionLoader] 全マンモ認定問題: ${allQuestions.length}問`);
  return allQuestions;
}

/**
 * カテゴリでフィルタリングした問題を取得
 */
export async function loadQuestionsWithFilters(
  sourceTypes?: MammoSourceType[],
  rounds?: number[],
  categories?: CategoryId[]
): Promise<Question[]> {
  const allQuestions = await loadAllMammoQuestions();
  
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

  console.log(`[jsonQuestionLoader] フィルタリング: ${allQuestions.length}問 → ${filtered.length}問`);
  return filtered;
}

/**
 * 利用可能な回次を取得
 */
export function getAvailableRounds(sourceType: MammoSourceType): number[] {
  return sourceType === 'jitsuryoku' ? MAMMO_JITSURYOKU_ROUNDS : MAMMO_TAISAKU_ROUNDS;
}

/**
 * 利用可能なJSONデータファイルをチェック
 */
export async function checkAvailableJsonData(): Promise<{
  round: number;
  sourceType: MammoSourceType;
  available: boolean;
}[]> {
  const checks: { round: number; sourceType: MammoSourceType; available: boolean }[] = [];
  const allPaths = getAllMammoQuestionPaths();

  for (const { path, round, sourceType } of allPaths) {
    try {
      const response = await fetch(path, { method: 'HEAD' });
      checks.push({ round, sourceType, available: response.ok });
    } catch {
      checks.push({ round, sourceType, available: false });
    }
  }

  return checks;
}

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
 * JSONファイルから問題データを読み込む（最適化版）
 */
export async function loadQuestionsFromJson(
  round: number,
  sourceType: MammoSourceType
): Promise<Question[]> {
  const jsonPath = getQuestionDataPath(round, sourceType);

  try {
    // fetchのタイムアウトを設定（10秒）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(jsonPath, {
      signal: controller.signal,
      cache: 'default' // ブラウザキャッシュを活用
    });

    clearTimeout(timeoutId);

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

    // 問題データを変換（最適化: mapの結果を直接返す）
    const questions = data.questions.map(item =>
      convertToQuestion(item, round, data.year, sourceType)
    );

    return questions;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn(`[jsonQuestionLoader] タイムアウト: ${jsonPath}`);
    } else {
      console.error(`[jsonQuestionLoader] 読み込みエラー (${jsonPath}):`, error);
    }
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
 * 全マンモ認定問題を読み込む（並列読み込みで高速化）
 */
export async function loadAllMammoQuestions(): Promise<Question[]> {
  const allPaths = getAllMammoQuestionPaths();
  const startTime = performance.now();

  // 全てのJSONファイルを並列で読み込む
  const loadPromises = allPaths.map(({ round, sourceType }) =>
    loadQuestionsFromJson(round, sourceType).catch((error) => {
      console.warn(`[jsonQuestionLoader] ${sourceType}_${round} の読み込みに失敗:`, error);
      return []; // エラー時は空配列を返す
    })
  );

  // 全ての読み込みを並列実行
  const results = await Promise.all(loadPromises);
  
  // 結果を結合
  const allQuestions = results.flat();
  
  const loadTime = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log(`[jsonQuestionLoader] 全マンモ認定問題: ${allQuestions.length}問 (読み込み時間: ${loadTime}秒)`);
  
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

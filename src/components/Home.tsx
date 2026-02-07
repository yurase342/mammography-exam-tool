import { useState, useEffect, useMemo, FC } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { Mode, Question, SessionSettings, CategoryId } from '../types';
import { saveQuestions } from '../services/database';
import { generateAllQuestions } from '../services/questionGenerator';
import { CATEGORIES, CATEGORY_LIST } from '../config/categoryConfig';
import { shuffleAllChoices } from '../utils/choiceShuffle';
import { MammoSourceType } from '../types/questionData';

interface HomeProps {
  onStartSession: (questions: Question[], settings: SessionSettings) => void;
}

const Home: FC<HomeProps> = ({ onStartSession }) => {
  const {
    isLoading,
    loadError,
    setLoading,
    setLoadError,
    updateSettings,
  } = useSessionStore();

  const [allLoadedQuestions, setAllLoadedQuestions] = useState<Question[]>([]);

  // 設定画面を開いているかどうか
  const [showSettings, setShowSettings] = useState(false);

  // 設定値
  const [selectedMode, setSelectedMode] = useState<Mode>('learning');
  const [selectedSourceTypes, setSelectedSourceTypes] = useState<MammoSourceType[]>(['jitsuryoku', 'taisaku']);
  const [selectedRounds, setSelectedRounds] = useState<number[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<CategoryId[]>([...CATEGORY_LIST]);
  const [questionCount, setQuestionCount] = useState(10);

  // コンポーネントマウント時に問題を読み込む（最適化版）
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        // 問題を読み込む（並列読み込みで高速化）
        const allQuestions = await generateAllQuestions();

        if (allQuestions.length > 0) {
          // 全回次を選択（すぐに設定してUIを更新）
          const allRounds = [...new Set(allQuestions.map(q => q.examNumber))];
          setSelectedRounds(allRounds);
          
          // 問題をすぐに設定（読み込み完了を待たない）
          setAllLoadedQuestions(allQuestions);
          
          // データベースへの保存は非同期で実行（読み込みをブロックしない）
          saveQuestions(allQuestions).catch((error) => {
            console.warn('[Home] データベースへの保存に失敗しました（問題は使用可能です）:', error);
          });
        } else {
          setAllLoadedQuestions([]);
        }
      } catch (error: any) {
        console.error('[Home] エラー:', error);
        setLoadError(`問題の読み込みに失敗しました: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, []);

  // 選択した条件での問題数を計算
  const filteredQuestionCount = useMemo(() => {
    let filtered = allLoadedQuestions;

    // ソースタイプでフィルタ
    if (selectedSourceTypes.length > 0) {
      filtered = filtered.filter(q => selectedSourceTypes.includes(q.session as MammoSourceType));
    }

    // 回次でフィルタ
    if (selectedRounds.length > 0) {
      filtered = filtered.filter(q => selectedRounds.includes(q.examNumber));
    }

    // カテゴリでフィルタ
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(q => q.category && selectedCategories.includes(q.category));
    } else {
      return 0;
    }

    return filtered.length;
  }, [allLoadedQuestions, selectedSourceTypes, selectedRounds, selectedCategories]);

  // すぐに始める（デフォルト設定）
  const handleQuickStart = () => {
    startSession('learning', 10, [...CATEGORY_LIST], selectedSourceTypes, selectedRounds);
  };

  // 設定を使って開始
  const handleStartWithSettings = () => {
    startSession(selectedMode, questionCount, selectedCategories, selectedSourceTypes, selectedRounds);
  };

  // セッション開始の共通処理
  const startSession = async (
    mode: Mode,
    count: number,
    categories: CategoryId[],
    sourceTypes: MammoSourceType[],
    rounds: number[]
  ) => {
    if (categories.length === 0) {
      alert('科目を選択してください');
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      let filteredQuestions = allLoadedQuestions;

      // ソースタイプでフィルタ
      if (sourceTypes.length > 0) {
        filteredQuestions = filteredQuestions.filter(q => sourceTypes.includes(q.session as MammoSourceType));
      }

      // 回次でフィルタ
      if (rounds.length > 0) {
        filteredQuestions = filteredQuestions.filter(q => rounds.includes(q.examNumber));
      }

      // カテゴリでフィルタ
      filteredQuestions = filteredQuestions.filter(q =>
        q.category && categories.includes(q.category)
      );

      if (filteredQuestions.length === 0) {
        setLoadError('問題が見つかりませんでした。');
        setLoading(false);
        return;
      }

      // シャッフルして出題数分を選択
      const shuffled = [...filteredQuestions].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(count, shuffled.length));

      // 選択肢もシャッフル
      const finalQuestions = shuffleAllChoices(selected);

      const settings: SessionSettings = {
        mode,
        questionCount: finalQuestions.length,
        examNumbers: rounds,
        sessions: sourceTypes as any,
        categories,
        shuffle: true,
        shuffleChoices: true,
        timeLimit: mode === 'test' ? finalQuestions.length * 150 : undefined,
      };

      updateSettings(settings);
      onStartSession(finalQuestions, settings);
    } catch (error: any) {
      console.error('[startSession] エラー:', error);
      setLoadError(`問題の読み込みに失敗しました: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 科目の選択/解除
  const toggleCategory = (categoryId: CategoryId) => {
    if (selectedCategories.includes(categoryId)) {
      setSelectedCategories(selectedCategories.filter(c => c !== categoryId));
    } else {
      setSelectedCategories([...selectedCategories, categoryId]);
    }
  };

  // ソースタイプの選択/解除
  const toggleSourceType = (sourceType: MammoSourceType) => {
    if (selectedSourceTypes.includes(sourceType)) {
      setSelectedSourceTypes(selectedSourceTypes.filter(s => s !== sourceType));
    } else {
      setSelectedSourceTypes([...selectedSourceTypes, sourceType]);
    }
  };

  // 回次の選択/解除

  // ソースタイプ別の回次を取得

  // ローディング中
  if (isLoading && allLoadedQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">📚</div>
          <p className="text-lg text-gray-600">問題を読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white p-4 sm:p-6">
      <div className="max-w-lg mx-auto">
        {/* タイトル */}
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-gray-800 mb-8 mt-4">
          マンモグラフィ認定
          <br />
          <span className="text-pink-600">対策ツール</span>
        </h1>

        {/* エラー表示 */}
        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-600 text-sm">{loadError}</p>
          </div>
        )}

        {/* メイン画面（設定を開いていない時） */}
        {!showSettings && (
          <div className="space-y-4">
            {/* すぐに始めるボタン */}
            <button
              onClick={handleQuickStart}
              disabled={isLoading || allLoadedQuestions.length === 0}
              className="w-full bg-pink-600 hover:bg-pink-700 active:bg-pink-800 text-white rounded-2xl p-6 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-4xl mb-2">🎯</div>
              <div className="text-xl font-bold mb-1">すぐに始める</div>
              <div className="text-pink-100 text-sm">
                10問・全科目・ランダム出題
              </div>
            </button>

            {/* 設定を変えて始めるボタン */}
            <button
              onClick={() => setShowSettings(true)}
              disabled={isLoading || allLoadedQuestions.length === 0}
              className="w-full bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-800 rounded-2xl p-6 shadow-lg border-2 border-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-4xl mb-2">⚙️</div>
              <div className="text-xl font-bold mb-1">設定を変えて始める</div>
              <div className="text-gray-500 text-sm">
                問題数・科目・テストモードなど
              </div>
            </button>

            {/* 問題数表示 */}
            <div className="text-center text-gray-500 text-sm mt-6">
              📊 {allLoadedQuestions.length}問 読み込み済み
            </div>
          </div>
        )}

        {/* 設定画面 */}
        {showSettings && (
          <div className="space-y-6">
            {/* 戻るボタン */}
            <button
              onClick={() => setShowSettings(false)}
              className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
            >
              <span className="text-xl mr-2">←</span>
              <span>戻る</span>
            </button>

            {/* モード選択 */}
            <div className="bg-white rounded-2xl p-4 shadow">
              <h2 className="text-lg font-bold text-gray-800 mb-3">モード</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedMode('learning')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedMode === 'learning'
                      ? 'border-pink-500 bg-pink-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="text-2xl mb-1">📚</div>
                  <div className="font-semibold text-sm">練習</div>
                  <div className="text-xs text-gray-500">解説あり</div>
                </button>
                <button
                  onClick={() => setSelectedMode('test')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedMode === 'test'
                      ? 'border-pink-500 bg-pink-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="text-2xl mb-1">📝</div>
                  <div className="font-semibold text-sm">テスト</div>
                  <div className="text-xs text-gray-500">時間制限あり</div>
                </button>
              </div>
            </div>

            {/* 出題数 */}
            <div className="bg-white rounded-2xl p-4 shadow">
              <h2 className="text-lg font-bold text-gray-800 mb-3">何問やる？</h2>
              <div className="grid grid-cols-4 gap-2">
                {[10, 20, 50, 100].map((count) => (
                  <button
                    key={count}
                    onClick={() => setQuestionCount(count)}
                    className={`py-3 rounded-xl border-2 font-semibold transition-all ${
                      questionCount === count
                        ? 'border-pink-500 bg-pink-50 text-pink-700'
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    {count}問
                  </button>
                ))}
              </div>
              {filteredQuestionCount > 0 && filteredQuestionCount < questionCount && (
                <p className="text-orange-600 text-xs mt-2">
                  ※ 選択した条件では最大{filteredQuestionCount}問です
                </p>
              )}
            </div>

            {/* 問題タイプ選択 */}
            <div className="bg-white rounded-2xl p-4 shadow">
              <h2 className="text-lg font-bold text-gray-800 mb-3">問題タイプ</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => toggleSourceType('jitsuryoku')}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    selectedSourceTypes.includes('jitsuryoku')
                      ? 'border-pink-500 bg-pink-50 text-pink-700'
                      : 'border-gray-200 bg-white text-gray-500'
                  }`}
                >
                  {selectedSourceTypes.includes('jitsuryoku') ? '✓ ' : ''}実力テスト
                  <div className="text-xs text-gray-400 mt-1">全24回</div>
                </button>
                <button
                  onClick={() => toggleSourceType('taisaku')}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    selectedSourceTypes.includes('taisaku')
                      ? 'border-pink-500 bg-pink-50 text-pink-700'
                      : 'border-gray-200 bg-white text-gray-500'
                  }`}
                >
                  {selectedSourceTypes.includes('taisaku') ? '✓ ' : ''}試験対策問題
                  <div className="text-xs text-gray-400 mt-1">全20回</div>
                </button>
              </div>
            </div>

            {/* 科目選択 */}
            <div className="bg-white rounded-2xl p-4 shadow">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold text-gray-800">どの科目から出す？</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedCategories([...CATEGORY_LIST])}
                    className="text-xs text-pink-600 underline"
                  >
                    全て
                  </button>
                  <button
                    onClick={() => setSelectedCategories([])}
                    className="text-xs text-pink-600 underline"
                  >
                    解除
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORY_LIST.map((categoryId) => {
                  const category = CATEGORIES[categoryId];
                  const isSelected = selectedCategories.includes(categoryId);

                  return (
                    <button
                      key={categoryId}
                      onClick={() => toggleCategory(categoryId)}
                      className={`px-3 py-2 rounded-xl border-2 text-left text-sm font-medium transition-all ${
                        isSelected
                          ? 'border-pink-500 bg-pink-50 text-pink-700'
                          : 'border-gray-200 bg-white text-gray-500'
                      }`}
                    >
                      {isSelected ? '✓ ' : ''}{category.shortName}
                    </button>
                  );
                })}
              </div>
              {selectedCategories.length === 0 && (
                <p className="text-orange-600 text-xs mt-2">
                  ※ 科目を選んでください
                </p>
              )}
            </div>

            {/* 出題可能数の表示 */}
            {filteredQuestionCount > 0 && (
              <div className="text-center text-gray-600 text-sm">
                選んだ条件で <span className="font-bold text-pink-600">{filteredQuestionCount}問</span> 出題できます
              </div>
            )}

            {/* 開始ボタン */}
            <button
              onClick={handleStartWithSettings}
              disabled={isLoading || selectedCategories.length === 0 || selectedSourceTypes.length === 0}
              className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-2xl p-5 shadow-lg font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {selectedMode === 'learning' ? '🎯 練習を始める' : '📝 テストを始める'}
            </button>

            {/* テストモードの場合の時間表示 */}
            {selectedMode === 'test' && (
              <p className="text-center text-gray-500 text-sm">
                ⏱ 制限時間: 約{Math.ceil(Math.min(questionCount, filteredQuestionCount || questionCount) * 150 / 60)}分
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;

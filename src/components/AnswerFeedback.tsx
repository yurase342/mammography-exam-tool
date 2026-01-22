import { useEffect, useRef, useMemo } from 'react';

interface AnswerFeedbackProps {
  isCorrect: boolean;
  selectedAnswer: string;
  correctAnswer: string;
  correctAnswers?: string[]; // 複数正答（2つ選べ問題など）
  onNext: () => void;
  mode: 'learning' | 'test';
}

const AnswerFeedback: React.FC<AnswerFeedbackProps> = ({
  isCorrect,
  selectedAnswer,
  correctAnswer,
  correctAnswers,
  onNext,
  mode,
}) => {
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  // 学習モード: 1秒後に自動遷移
  // テストモード: 0.5秒後に自動遷移
  useEffect(() => {
    const timer = setTimeout(() => {
      onNextRef.current();
    }, mode === 'learning' ? 1000 : 500);

    return () => clearTimeout(timer);
  }, [mode]);

  // 2択問題かどうか判定（選択した回答にカンマが含まれていれば2択）
  const isMultipleChoice = selectedAnswer.includes(',');
  const selectedList = isMultipleChoice
    ? selectedAnswer.split(',').map(a => a.trim().toUpperCase())
    : [selectedAnswer.toUpperCase()];

  // 正解リスト
  const correctList = correctAnswers && correctAnswers.length > 0
    ? correctAnswers.map(a => a.toUpperCase())
    : [correctAnswer.toUpperCase()];

  // 2択問題の詳細分析（どれが合っていてどれが間違っているか）
  const multipleChoiceAnalysis = useMemo(() => {
    if (!isMultipleChoice || isCorrect) return null;

    const correctSet = new Set(correctList);
    const selectedSet = new Set(selectedList);

    // 選択したもののうち正解だったもの
    const correctSelections = selectedList.filter(s => correctSet.has(s));
    // 選択したもののうち不正解だったもの
    const incorrectSelections = selectedList.filter(s => !correctSet.has(s));
    // 選択しなかったが正解だったもの
    const missedCorrect = correctList.filter(c => !selectedSet.has(c));

    return {
      correctSelections,
      incorrectSelections,
      missedCorrect,
      hasPartialCorrect: correctSelections.length > 0,
    };
  }, [isMultipleChoice, isCorrect, selectedList, correctList]);

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${
        isCorrect ? 'bg-green-500 bg-opacity-30' : 'bg-red-500 bg-opacity-30'
      }`}
    >
      <div
        className={`bg-white rounded-lg p-6 sm:p-8 shadow-lg w-full max-w-md ${
          isCorrect ? 'border-4 border-green-500' : 'border-4 border-red-500'
        }`}
      >
        <div className="text-center">
          {isCorrect ? (
            <>
              <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">✓</div>
              <div className="text-xl sm:text-2xl font-bold text-green-600 mb-2">
                {isMultipleChoice ? '2つとも正解！' : '正解！'}
              </div>
              {isMultipleChoice && (
                <div className="text-sm text-gray-600 mt-2">
                  選択: {selectedList.join(' と ')}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">✗</div>
              <div className="text-xl sm:text-2xl font-bold text-red-600 mb-2">
                不正解
              </div>
              <div className="text-base sm:text-lg text-gray-700 mb-2">
                {isMultipleChoice && multipleChoiceAnalysis ? (
                  <div className="space-y-2">
                    {/* 選択した回答の詳細 */}
                    <div className="text-left bg-gray-50 rounded-lg p-3">
                      <p className="text-sm text-gray-500 mb-2">あなたの選択:</p>
                      {selectedList.map((selected) => {
                        const isThisCorrect = correctList.includes(selected);
                        return (
                          <div key={selected} className="flex items-center gap-2 mb-1">
                            <span className={`text-lg ${isThisCorrect ? 'text-green-600' : 'text-red-600'}`}>
                              {isThisCorrect ? '○' : '✗'}
                            </span>
                            <span className={`font-bold ${isThisCorrect ? 'text-green-600' : 'text-red-600'}`}>
                              {selected}
                            </span>
                            <span className="text-sm text-gray-500">
                              {isThisCorrect ? '← 正解' : '← 不正解'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* 正解の表示 */}
                    <div className="text-left bg-green-50 rounded-lg p-3">
                      <p className="text-sm text-gray-500 mb-1">正解:</p>
                      <p className="font-bold text-green-600 text-lg">
                        {correctList.join(' と ')}
                      </p>
                      {multipleChoiceAnalysis.missedCorrect.length > 0 && (
                        <p className="text-sm text-gray-600 mt-1">
                          ※ {multipleChoiceAnalysis.missedCorrect.join(', ')} を選ぶ必要がありました
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p>
                    正解は <span className="font-bold text-green-600">{correctList.length > 1 ? correctList.join(' または ') : correctAnswer.toUpperCase()}</span> です
                  </p>
                )}
              </div>
            </>
          )}
          <div className="text-xs sm:text-sm text-gray-500 mt-3 sm:mt-4">
            {mode === 'learning' ? '1秒後に次の問題へ...' : '0.5秒後に次の問題へ...'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnswerFeedback;

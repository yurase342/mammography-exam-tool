import { useState, useEffect, useRef, useMemo } from 'react';
import { Question } from '../types';
import ImageModal from './ImageModal';
import BessatsuViewer from './BessatsuViewer';
import { generateHint } from '../services/hintGenerator';
import { hasQuestionImage, getQuestionImagePath } from '../config/pdfConfig';

interface QuestionViewProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (answer: string | string[]) => void; // 複数回答対応
  onSkip?: () => void;
  onHintUsed?: () => void;
  mode: 'learning' | 'test';
  elapsedTime?: number;
  remainingTime?: number;
}

const QuestionView: React.FC<QuestionViewProps> = ({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  onSkip,
  onHintUsed,
  mode,
  elapsedTime,
  remainingTime,
}) => {
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]); // 複数選択対応
  const [isAnswered, setIsAnswered] = useState(false); // 回答済みフラグ
  const [showHint, setShowHint] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showBessatsuViewer, setShowBessatsuViewer] = useState(false);
  const [bessatsuPage, setBessatsuPage] = useState<number | undefined>(undefined);
  const [bessatsuImages, setBessatsuImages] = useState<Map<number, string>>(new Map());
  const [loadingBessatsu, setLoadingBessatsu] = useState(false);
  const [questionImageUrl, setQuestionImageUrl] = useState<string | null>(null);
  const [loadingQuestionImage, setLoadingQuestionImage] = useState(false);
  const [showQuestionImageModal, setShowQuestionImageModal] = useState(false);
  const choicesRef = useRef<HTMLDivElement>(null);

  // 2択問題かどうかを判定
  const isMultipleChoice = useMemo(() => {
    const text = question.questionText || '';
    return text.includes('2 つ選') || text.includes('2つ選') || text.includes('２つ選');
  }, [question.questionText]);

  // 必要な選択数
  const requiredSelections = isMultipleChoice ? 2 : 1;

  // 問題が変わった時に選択状態をリセット
  useEffect(() => {
    setSelectedAnswers([]);
    setIsAnswered(false);
    setShowHint(false);
    setHintUsed(false);
    setShowBessatsuViewer(false);
    setQuestionImageUrl(null);
    setShowQuestionImageModal(false);
  }, [question.id]);

  // 別冊画像を読み込む
  useEffect(() => {
    const loadBessatsuImages = async () => {
      if (question.supplementReferences.length === 0) {
        setBessatsuImages(new Map());
        return;
      }

      setLoadingBessatsu(true);
      const newImages = new Map<number, string>();

      try {
        const { getBessatsuImagePath } = await import('../config/pdfConfig');

        for (const ref of question.supplementReferences) {
          const pageNumber = parseInt(ref.imageNumber.replace(/[^0-9]/g, ''), 10);

          if (!isNaN(pageNumber) && pageNumber > 0) {
            const imagePath = getBessatsuImagePath(
              question.examNumber,
              question.session,
              pageNumber
            );

            try {
              const response = await fetch(imagePath, { method: 'HEAD' });
              if (response.ok) {
                newImages.set(pageNumber, imagePath);
              }
            } catch (fetchError) {
              console.warn(`[QuestionView] 別冊画像の読み込みに失敗: ${imagePath}`);
            }
          }
        }
      } catch (error) {
        console.error('[QuestionView] 別冊画像読み込みエラー:', error);
      } finally {
        setBessatsuImages(newImages);
        setLoadingBessatsu(false);
      }
    };

    loadBessatsuImages();
  }, [question.id, question.supplementReferences, question.examNumber, question.session]);

  // 問題内図画像を読み込む
  useEffect(() => {
    const loadQuestionImage = async () => {
      if (!hasQuestionImage(question.examNumber, question.session, question.questionNumber)) {
        setQuestionImageUrl(null);
        return;
      }

      setLoadingQuestionImage(true);
      try {
        const imagePath = getQuestionImagePath(
          question.examNumber,
          question.session,
          question.questionNumber
        );

        const response = await fetch(imagePath, { method: 'HEAD' });
        if (response.ok) {
          setQuestionImageUrl(imagePath);
        } else {
          setQuestionImageUrl(null);
        }
      } catch (error) {
        setQuestionImageUrl(null);
      } finally {
        setLoadingQuestionImage(false);
      }
    };

    loadQuestionImage();
  }, [question.id, question.examNumber, question.session, question.questionNumber]);

  // キーボードショートカット
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isAnswered) return;

      const key = e.key;
      const choiceIndex = parseInt(key) - 1;

      if (choiceIndex >= 0 && choiceIndex < question.choices.length) {
        handleChoiceClick(question.choices[choiceIndex].label);
        choicesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isAnswered, question.choices, selectedAnswers]);

  // 選択肢クリック処理
  const handleChoiceClick = (answer: string) => {
    if (isAnswered) return;

    if (isMultipleChoice) {
      // 2択問題の場合
      setSelectedAnswers(prev => {
        if (prev.includes(answer)) {
          // 既に選択されていたら解除
          return prev.filter(a => a !== answer);
        } else if (prev.length < requiredSelections) {
          // まだ選択できる場合は追加
          return [...prev, answer];
        } else {
          // 2つ選択済みの場合は古い方を削除して新しいのを追加
          return [...prev.slice(1), answer];
        }
      });
    } else {
      // 1択問題の場合は即座に回答
      setSelectedAnswers([answer]);
      setIsAnswered(true);
      onAnswer(answer);
    }
  };

  // 回答確定処理（2択問題用）
  const handleConfirmAnswer = () => {
    if (selectedAnswers.length !== requiredSelections) return;
    setIsAnswered(true);
    onAnswer(selectedAnswers);
  };

  // 残り時間の色を決定
  const getTimeColor = () => {
    if (!remainingTime || !question) return 'text-gray-700';
    const totalTime = totalQuestions * 150;
    const percentage = (remainingTime / totalTime) * 100;

    if (percentage > 50) return 'text-green-600';
    if (percentage > 25) return 'text-yellow-600';
    if (percentage > 10) return 'text-orange-600';
    return 'text-red-600 animate-pulse';
  };

  // 時間表示フォーマット
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 別冊画像
  const supplementImages = question.supplementReferences.map((ref) => {
    const pageNum = parseInt(ref.imageNumber.replace(/[^0-9]/g, ''), 10);
    return {
      id: ref.supplementId || `${question.examNumber}-${question.session}-${ref.imageNumber}`,
      imageNumber: ref.imageNumber,
      imageData: bessatsuImages.get(pageNum) || '',
      pageNumber: pageNum,
    };
  });

  // ヒントを生成
  const hint = useMemo(() => generateHint(question), [question]);

  return (
    <div className="min-h-screen bg-gray-50 overflow-auto">
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-3 sm:p-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-bold">
              第 {questionNumber} 問 / {totalQuestions} 問
            </h2>
            <p className="text-xs text-gray-600">
              {(() => {
                const session = question.session as string;
                if (session === 'jitsuryoku') {
                  return `【実力テスト 第${question.examNumber}回 問${question.questionNumber}】`;
                } else if (session === 'taisaku') {
                  return `【試験対策問題 第${question.examNumber}回 問${question.questionNumber}】`;
                } else {
                  return `【第${question.examNumber}回 ${session === 'gozen' ? '午前' : '午後'} 問${question.questionNumber}】`;
                }
              })()}
            </p>
          </div>
          <div className="text-left sm:text-right w-full sm:w-auto">
            {mode === 'learning' && elapsedTime !== undefined && (
              <div className="text-sm text-gray-600">
                経過時間: {formatTime(elapsedTime)}
              </div>
            )}
            {mode === 'test' && remainingTime !== undefined && (
              <div className={`text-base sm:text-lg font-semibold ${getTimeColor()}`}>
                残り時間: {formatTime(remainingTime)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          {/* 別冊画像表示 */}
          {(supplementImages.length > 0 || question.hasSupplementImage) && (
            <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-800">📎 別冊画像</h3>
                <button
                  onClick={() => {
                    setBessatsuPage(undefined);
                    setShowBessatsuViewer(true);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  フルスクリーン表示
                </button>
              </div>
              {loadingBessatsu ? (
                <div className="flex items-center justify-center py-12 text-gray-500">
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                    <span>別冊画像を読み込み中...</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {supplementImages.map((img) => (
                    <div
                      key={img.id}
                      className="border-2 border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:border-blue-400 transition-colors"
                      onClick={() => {
                        if (img.imageData) {
                          setBessatsuPage(img.pageNumber);
                          setShowBessatsuViewer(true);
                        }
                      }}
                    >
                      {img.imageData ? (
                        <div className="relative">
                          <img
                            src={img.imageData}
                            alt={`別冊 ${img.imageNumber}`}
                            className="w-full max-h-[60vh] object-contain bg-gray-50"
                          />
                          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                            クリックで拡大
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-48 bg-gray-100 flex items-center justify-center text-gray-500">
                          画像を読み込めませんでした
                        </div>
                      )}
                      <div className="bg-gray-50 px-3 py-2 border-t">
                        <p className="text-sm font-medium text-gray-700">別冊 No.{img.imageNumber}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 問題文 */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
            <div className="mb-3 sm:mb-4">
              {question.questionText ? (
                <div>
                  <p className="text-base sm:text-lg leading-relaxed whitespace-pre-wrap">
                    {question.questionText}
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500">問題文を読み込み中...</div>
                </div>
              )}
            </div>

            {/* 問題内図画像 */}
            {(questionImageUrl || loadingQuestionImage) && (
              <div className="mt-4 border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">📊 問題の図</h4>
                {loadingQuestionImage ? (
                  <div className="flex items-center justify-center py-8 text-gray-500">
                    <div className="flex flex-col items-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mb-2"></div>
                      <span className="text-sm">図を読み込み中...</span>
                    </div>
                  </div>
                ) : questionImageUrl && (
                  <div
                    className="border-2 border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:border-blue-400 transition-colors"
                    onClick={() => setShowQuestionImageModal(true)}
                  >
                    <div className="relative">
                      <img
                        src={questionImageUrl}
                        alt="問題の図"
                        className="w-full max-h-[50vh] object-contain bg-gray-50"
                      />
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        クリックで拡大
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ヒントボタン（学習モードのみ） */}
            {mode === 'learning' && (
              <div className="mt-3 sm:mt-4">
                <button
                  onClick={() => {
                    const newShowHint = !showHint;
                    setShowHint(newShowHint);
                    if (newShowHint && !hintUsed) {
                      setHintUsed(true);
                      onHintUsed?.();
                    }
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg active:bg-yellow-200 flex items-center justify-center gap-2 touch-manipulation text-sm"
                >
                  <span>💡</span>
                  <span>{showHint ? 'ヒントを隠す' : 'ヒントを見る'}{hintUsed ? ' (確認済)' : ''}</span>
                </button>
                {showHint && (
                  <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    {hint.keywords.length > 0 && (
                      <div className="mb-3">
                        <h4 className="font-semibold mb-2 text-yellow-800">🔑 キーワード</h4>
                        <div className="flex flex-wrap gap-2">
                          {hint.keywords.map((keyword, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-white rounded-full text-sm border border-yellow-300 text-yellow-900"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {hint.thinkingHints.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2 text-yellow-800">💭 考え方のヒント</h4>
                        <ul className="space-y-1">
                          {hint.thinkingHints.map((thinkingHint, index) => (
                            <li
                              key={index}
                              className="text-sm text-gray-700 flex items-start gap-2"
                            >
                              <span className="text-yellow-600 mt-0.5">•</span>
                              <span>{thinkingHint}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {hint.keywords.length === 0 && hint.thinkingHints.length === 0 && (
                      <p className="text-sm text-gray-600">
                        選択肢を一つずつ検討し、消去法も活用しましょう
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 選択肢エリア */}
          <div ref={choicesRef} className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base sm:text-lg font-semibold">選択肢</h3>
                {/* 2択問題の案内表示 */}
                {isMultipleChoice && !isAnswered && (
                  <p className="text-sm text-orange-600 font-medium mt-1">
                    ⚠️ この問題は2つ選んでください（{selectedAnswers.length}/2 選択中）
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-500">キーボード: 1-{question.choices.length}キーで選択</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {question.choices.map((choice, index) => {
                const isSelected = selectedAnswers.includes(choice.label);
                return (
                  <button
                    key={choice.label}
                    onClick={() => handleChoiceClick(choice.label)}
                    disabled={isAnswered}
                    className={`text-left p-3 sm:p-4 rounded-lg border-2 transition-all touch-manipulation ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-300 active:bg-gray-50 hover:bg-gray-50'
                    } ${isAnswered ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`flex-shrink-0 font-semibold text-base sm:text-lg ${
                        isSelected ? 'text-blue-600' : 'text-gray-600'
                      }`}>
                        {choice.label.toUpperCase()}.
                      </span>
                      <span className="flex-1 text-sm sm:text-base">{choice.text}</span>
                      <span className="flex-shrink-0 text-xs text-gray-400 font-mono">
                        [{index + 1}]
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 2択問題の確定ボタン */}
            {isMultipleChoice && !isAnswered && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">
                      {selectedAnswers.length === 0 && '2つの選択肢を選んでください'}
                      {selectedAnswers.length === 1 && 'あと1つ選んでください'}
                      {selectedAnswers.length === 2 && '選択完了！「回答を確定する」を押してください'}
                    </p>
                    {selectedAnswers.length > 0 && (
                      <p className="mt-1 text-xs">
                        選択中: {selectedAnswers.map(a => a.toUpperCase()).join(', ')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleConfirmAnswer}
                    disabled={selectedAnswers.length !== requiredSelections}
                    className={`px-6 py-3 rounded-lg font-semibold transition-all touch-manipulation ${
                      selectedAnswers.length === requiredSelections
                        ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    ✓ 回答を確定する
                  </button>
                </div>
              </div>
            )}

            {/* スキップボタン */}
            {onSkip && !isAnswered && (
              <div className="mt-3 text-center">
                <button
                  onClick={onSkip}
                  className="px-6 py-2 border-2 border-gray-300 rounded-lg active:bg-gray-50 touch-manipulation text-sm"
                >
                  ⏭ スキップ
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 画像モーダル */}
      {showImageModal && supplementImages.length > 0 && (
        <ImageModal
          images={supplementImages}
          currentIndex={selectedImageIndex}
          onClose={() => setShowImageModal(false)}
          onNext={() =>
            setSelectedImageIndex(
              (selectedImageIndex + 1) % supplementImages.length
            )
          }
          onPrev={() =>
            setSelectedImageIndex(
              (selectedImageIndex - 1 + supplementImages.length) %
                supplementImages.length
            )
          }
        />
      )}

      {/* 別冊ビューアー */}
      {showBessatsuViewer && (
        <BessatsuViewer
          examNumber={question.examNumber}
          session={question.session}
          pageNumber={bessatsuPage}
          label={bessatsuPage ? `別冊 ページ${bessatsuPage}` : undefined}
          onClose={() => setShowBessatsuViewer(false)}
          fullScreen={true}
        />
      )}

      {/* 問題画像モーダル */}
      {showQuestionImageModal && questionImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setShowQuestionImageModal(false)}
        >
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <img
              src={questionImageUrl}
              alt="問題の図（拡大）"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setShowQuestionImageModal(false)}
              className="absolute top-4 right-4 bg-white/80 hover:bg-white text-gray-800 rounded-full p-2 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 text-white text-sm px-4 py-2 rounded">
              {(() => {
                const session = question.session as string;
                if (session === 'jitsuryoku') {
                  return `実力テスト 第${question.examNumber}回 問${question.questionNumber}`;
                } else if (session === 'taisaku') {
                  return `試験対策問題 第${question.examNumber}回 問${question.questionNumber}`;
                } else {
                  return `第${question.examNumber}回 ${session === 'gozen' ? '午前' : '午後'} 問${question.questionNumber}`;
                }
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionView;

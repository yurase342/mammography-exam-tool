import { useState, useEffect, useRef } from 'react';
import { Question, Answer, SessionSettings } from '../types';
import QuestionView from './QuestionView';
import AnswerFeedback from './AnswerFeedback';

interface QuestionSessionProps {
  questions: Question[];
  settings: SessionSettings;
  onComplete: (answers: Answer[]) => void;
}

const QuestionSession: React.FC<QuestionSessionProps> = ({
  questions,
  settings,
  onComplete,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [_answers, setAnswers] = useState<Answer[]>([]); // eslint-disable-line @typescript-eslint/no-unused-vars
  const answersRef = useRef<Answer[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackData, setFeedbackData] = useState<{
    isCorrect: boolean;
    selectedAnswer: string | string[];
    correctAnswer: string;
    correctAnswers?: string[];
  } | null>(null);
  const [startTime] = useState<number>(Date.now());
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [remainingTime, setRemainingTime] = useState<number | undefined>(
    settings.timeLimit
  );
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const learningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentHintUsedRef = useRef<boolean>(false);

  const currentQuestion = questions[currentIndex];
  const mode = settings.mode;

  // 学習モードのリアルタイムタイマー
  useEffect(() => {
    if (mode === 'learning') {
      learningTimerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      return () => {
        if (learningTimerRef.current) {
          clearInterval(learningTimerRef.current);
        }
      };
    }
  }, [mode, startTime]);

  // テストモードのタイマー
  useEffect(() => {
    if (mode === 'test' && remainingTime !== undefined) {
      timerRef.current = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev === undefined) return undefined;
          if (prev <= 0) {
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [mode, remainingTime]);

  // 時間切れ処理
  const handleTimeUp = () => {
    const unansweredAnswers: Answer[] = [];
    for (let i = currentIndex; i < questions.length; i++) {
      unansweredAnswers.push({
        questionId: questions[i].id,
        selectedAnswer: null,
        isCorrect: false,
        status: 'timeout',
        timeSpent: 0,
        answeredAt: null,
      });
    }

    const allAnswers = [...answersRef.current, ...unansweredAnswers];
    onComplete(allAnswers);
  };

  // ヒント使用のコールバック
  const handleHintUsed = () => {
    currentHintUsedRef.current = true;
  };

  // 回答処理（単一選択・複数選択両対応）
  const handleAnswer = (selectedAnswer: string | string[]) => {
    const question = questions[currentIndex];

    // 正解リストを取得
    const correctAnswerList = question.correctAnswers && question.correctAnswers.length > 0
      ? question.correctAnswers
      : [question.correctAnswer];

    // 正解判定
    let isCorrect: boolean;
    if (Array.isArray(selectedAnswer)) {
      // 複数選択の場合：全ての選択肢が正解リストに含まれ、数も一致するか
      const selectedLower = selectedAnswer.map(a => a.toLowerCase()).sort();
      const correctLower = correctAnswerList.map(a => a.toLowerCase()).sort();
      isCorrect = selectedLower.length === correctLower.length &&
        selectedLower.every((s, i) => s === correctLower[i]);
    } else {
      // 単一選択の場合
      isCorrect = correctAnswerList.some(
        ca => ca.toLowerCase() === selectedAnswer.toLowerCase()
      );
    }

    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);

    // 選択した回答を文字列に変換（複数の場合はカンマ区切り）
    const selectedAnswerStr = Array.isArray(selectedAnswer)
      ? selectedAnswer.join(',')
      : selectedAnswer;

    const answer: Answer = {
      questionId: question.id,
      selectedAnswer: selectedAnswerStr,
      isCorrect,
      status: 'answered',
      timeSpent,
      answeredAt: new Date(),
      usedHint: currentHintUsedRef.current,
    };

    setAnswers((prevAnswers) => {
      const newAnswers = [...prevAnswers, answer];
      answersRef.current = newAnswers;
      return newAnswers;
    });

    setFeedbackData({
      isCorrect,
      selectedAnswer,
      correctAnswer: question.correctAnswer,
      correctAnswers: question.correctAnswers,
    });
    setShowFeedback(true);
  };

  // スキップ処理
  const handleSkip = () => {
    const question = questions[currentIndex];
    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
    const answer: Answer = {
      questionId: question.id,
      selectedAnswer: null,
      isCorrect: false,
      status: 'skipped',
      timeSpent,
      answeredAt: null,
      usedHint: currentHintUsedRef.current,
    };

    setAnswers((prevAnswers) => {
      const newAnswers = [...prevAnswers, answer];
      answersRef.current = newAnswers;
      return newAnswers;
    });
    moveToNext();
  };

  // 次の問題へ
  const moveToNext = () => {
    setShowFeedback(false);
    setFeedbackData(null);
    setQuestionStartTime(Date.now());
    currentHintUsedRef.current = false;

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete(answersRef.current);
    }
  };

  if (!currentQuestion) {
    return <div>問題を読み込み中...</div>;
  }

  return (
    <>
      <QuestionView
        question={currentQuestion}
        questionNumber={currentIndex + 1}
        totalQuestions={questions.length}
        onAnswer={handleAnswer}
        onSkip={handleSkip}
        onHintUsed={handleHintUsed}
        mode={mode}
        elapsedTime={mode === 'learning' ? elapsedTime : undefined}
        remainingTime={mode === 'test' ? remainingTime : undefined}
      />

      {showFeedback && feedbackData && (
        <AnswerFeedback
          isCorrect={feedbackData.isCorrect}
          selectedAnswer={
            Array.isArray(feedbackData.selectedAnswer)
              ? feedbackData.selectedAnswer.join(', ')
              : feedbackData.selectedAnswer
          }
          correctAnswer={feedbackData.correctAnswer}
          correctAnswers={feedbackData.correctAnswers}
          onNext={moveToNext}
          mode={mode}
        />
      )}
    </>
  );
};

export default QuestionSession;

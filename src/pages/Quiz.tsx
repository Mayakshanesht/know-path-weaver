import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { QuizWithQuestions, QuizAttempt } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress as ProgressBar } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export default function QuizPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { authUser } = useAuth();
  const { toast } = useToast();

  const [quiz, setQuiz] = useState<QuizWithQuestions | null>(null);
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (quizId && authUser) {
      fetchQuiz();
    }
  }, [quizId, authUser]);

  useEffect(() => {
    if (started && timeLeft !== null && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && started) {
      handleSubmit();
    }
  }, [timeLeft, started]);

  const fetchQuiz = async () => {
    if (!authUser || !quizId) return;

    // Fetch quiz with questions
    const { data: quizData, error: quizError } = await supabase
      .from('quizzes')
      .select('*, quiz_questions(*)')
      .eq('id', quizId)
      .single();

    if (quizError) {
      toast({
        title: 'Error',
        description: 'Failed to load quiz.',
        variant: 'destructive',
      });
      return;
    }

    setQuiz(quizData as unknown as QuizWithQuestions);

    // Check for existing attempt
    const { data: attemptData } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('user_id', authUser.id)
      .not('completed_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (attemptData) {
      setAttempt(attemptData);
    }

    setLoading(false);
  };

  const startQuiz = async () => {
    if (!quiz || !authUser) return;

    setStarted(true);
    if (quiz.time_limit_minutes) {
      setTimeLeft(quiz.time_limit_minutes * 60);
    }

    // Create new attempt
    const { error: attemptError } = await supabase
      .from('quiz_attempts')
      .insert({
        quiz_id: quizId,
        user_id: authUser.id,
        started_at: new Date().toISOString(),
        answers: {},
        score: null,
        max_score: quiz.quiz_questions.reduce((sum, q) => sum + (q.points || 1), 0),
        passed: null,
      });

    if (attemptError) {
      toast({
        title: 'Error',
        description: 'Failed to start quiz.',
        variant: 'destructive',
      });
      return;
    }
  };

  const handleSubmit = async () => {
    if (!quiz || !authUser) return;

    setSubmitting(true);

    // Calculate score
    let score = 0;
    const maxScore = quiz.quiz_questions.reduce((sum, q) => sum + (q.points || 1), 0);

    quiz.quiz_questions.forEach((question) => {
      const userAnswer = answers[question.id];
      const correctAnswer = question.correct_answer;

      if (question.question_type === 'mcq' || question.question_type === 'true_false') {
        if (userAnswer === correctAnswer) {
          score += question.points || 1;
        }
      } else if (question.question_type === 'multiple_select') {
        const userAnswers = Array.isArray(userAnswer) ? userAnswer : [];
        const correctAnswers = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
        
        if (userAnswers.length === correctAnswers.length &&
            userAnswers.every(ans => correctAnswers.includes(ans))) {
          score += question.points || 1;
        }
      } else if (question.question_type === 'short_answer') {
        // For short answers, you might want manual grading
        // For now, we'll mark as correct if exact match
        if (userAnswer?.toString().toLowerCase().trim() === correctAnswer?.toString().toLowerCase().trim()) {
          score += question.points || 1;
        }
      }
    });

    const percentage = Math.round((score / maxScore) * 100);
    const passed = quiz.passing_score ? percentage >= quiz.passing_score : null;

    // Update attempt
    const { error: updateError } = await supabase
      .from('quiz_attempts')
      .update({
        completed_at: new Date().toISOString(),
        answers,
        score,
        max_score: maxScore,
        passed,
      })
      .eq('quiz_id', quizId)
      .eq('user_id', authUser.id)
      .is('completed_at', 'null');

    if (updateError) {
      toast({
        title: 'Error',
        description: 'Failed to submit quiz.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Quiz Submitted!',
        description: `Your score: ${score}/${maxScore} (${percentage}%)`,
      });
      
      // Navigate back to course
      navigate(-1);
    }

    setSubmitting(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Quiz Not Found</h2>
          <p className="text-muted-foreground">This quiz doesn't exist or you don't have access.</p>
        </div>
      </div>
    );
  }

  if (attempt && attempt.completed_at) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <CardTitle>Quiz Completed</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div>
              <p className="text-2xl font-bold">
                {attempt.score}/{attempt.max_score}
              </p>
              <p className="text-muted-foreground">
                {Math.round((Number(attempt.score) / Number(attempt.max_score)) * 100)}%
              </p>
            </div>
            {attempt.passed !== null && (
              <div className={`p-3 rounded-lg ${
                attempt.passed 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {attempt.passed ? '✓ Passed' : '✗ Not Passed'}
              </div>
            )}
            <Button onClick={() => navigate(-1)} className="w-full">
              Back to Course
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestionData = quiz.quiz_questions[currentQuestion];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold mb-2">{quiz.title}</h1>
                  <p className="text-muted-foreground">
                    Question {currentQuestion + 1} of {quiz.quiz_questions.length}
                  </p>
                </div>
                {timeLeft !== null && (
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-lg font-mono">
                      <Clock className="w-4 h-4" />
                      {formatTime(timeLeft)}
                    </div>
                    <ProgressBar 
                      value={((quiz.time_limit_minutes! * 60 - timeLeft) / (quiz.time_limit_minutes! * 60)) * 100} 
                      className="w-32 mt-2"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {!started ? (
          /* Start Screen */
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Quiz Instructions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {quiz.description && (
                  <p className="text-muted-foreground">{quiz.description}</p>
                )}
                <div className="space-y-2 text-sm">
                  {quiz.time_limit_minutes && (
                    <p>• Time limit: {quiz.time_limit_minutes} minutes</p>
                  )}
                  {quiz.passing_score && (
                    <p>• Passing score: {quiz.passing_score}%</p>
                  )}
                  {quiz.max_attempts && (
                    <p>• Maximum attempts: {quiz.max_attempts}</p>
                  )}
                  <p>• Total questions: {quiz.quiz_questions.length}</p>
                </div>
                <Button onClick={startQuiz} className="w-full" size="lg">
                  Start Quiz
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          /* Quiz Questions */
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">
                    Question {currentQuestion + 1}
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {currentQuestionData.points || 1} point{currentQuestionData.points !== 1 ? 's' : ''}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-base leading-relaxed">
                  {currentQuestionData.question_text}
                </p>

                {/* Answer Options */}
                <div className="space-y-3">
                  {currentQuestionData.question_type === 'mcq' && (
                    <RadioGroup
                      value={answers[currentQuestionData.id]}
                      onValueChange={(value) =>
                        setAnswers({ ...answers, [currentQuestionData.id]: value })
                      }
                    >
                      {Object.entries(currentQuestionData.options || {}).map(([key, value]) => (
                        <div key={key} className="flex items-center space-x-2">
                          <RadioGroupItem value={key} id={`${currentQuestionData.id}-${key}`} />
                          <Label htmlFor={`${currentQuestionData.id}-${key}`}>
                            {value as string}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}

                  {currentQuestionData.question_type === 'true_false' && (
                    <RadioGroup
                      value={answers[currentQuestionData.id]}
                      onValueChange={(value) =>
                        setAnswers({ ...answers, [currentQuestionData.id]: value })
                      }
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="true" id={`${currentQuestionData.id}-true`} />
                        <Label htmlFor={`${currentQuestionData.id}-true`}>True</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="false" id={`${currentQuestionData.id}-false`} />
                        <Label htmlFor={`${currentQuestionData.id}-false`}>False</Label>
                      </div>
                    </RadioGroup>
                  )}

                  {currentQuestionData.question_type === 'multiple_select' && (
                    <div className="space-y-2">
                      {Object.entries(currentQuestionData.options || {}).map(([key, value]) => (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${currentQuestionData.id}-${key}`}
                            checked={answers[currentQuestionData.id]?.includes(key)}
                            onCheckedChange={(checked) => {
                              const currentAnswers = answers[currentQuestionData.id] || [];
                              if (checked) {
                                setAnswers({
                                  ...answers,
                                  [currentQuestionData.id]: [...currentAnswers, key],
                                });
                              } else {
                                setAnswers({
                                  ...answers,
                                  [currentQuestionData.id]: currentAnswers.filter((a: string) => a !== key),
                                });
                              }
                            }}
                          />
                          <Label htmlFor={`${currentQuestionData.id}-${key}`}>
                            {value as string}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}

                  {currentQuestionData.question_type === 'short_answer' && (
                    <Textarea
                      value={answers[currentQuestionData.id] || ''}
                      onChange={(e) =>
                        setAnswers({ ...answers, [currentQuestionData.id]: e.target.value })
                      }
                      placeholder="Type your answer here..."
                      rows={4}
                    />
                  )}
                </div>

                {/* Navigation */}
                <div className="flex justify-between pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                    disabled={currentQuestion === 0}
                  >
                    Previous
                  </Button>
                  
                  {currentQuestion < quiz.quiz_questions.length - 1 ? (
                    <Button
                      onClick={() => setCurrentQuestion(currentQuestion + 1)}
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit Quiz'
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}

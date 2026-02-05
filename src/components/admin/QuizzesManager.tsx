import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Quiz, QuizQuestion, Course, Capsule } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Edit,
  Trash2,
  FileQuestion,
  ClipboardList,
  GripVertical,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface QuizWithDetails extends Quiz {
  courses: Course;
  capsules?: Capsule | null;
  quiz_questions: QuizQuestion[];
}

export default function QuizzesManager() {
  const { toast } = useToast();
  const [quizzes, setQuizzes] = useState<QuizWithDetails[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  
  // Form state for quiz
  const [formData, setFormData] = useState({
    course_id: '',
    capsule_id: '',
    title: '',
    description: '',
    quiz_type: 'quiz' as 'quiz' | 'assignment',
    is_graded: false,
    passing_score: 70,
    time_limit_minutes: 0,
    max_attempts: 1,
    is_published: false,
  });

  // Form state for question
  const [questionFormData, setQuestionFormData] = useState({
    question_type: 'mcq' as 'mcq' | 'short_answer' | 'true_false' | 'multiple_select',
    question_text: '',
    options: ['', '', '', ''],
    correct_answer: 0,
    explanation: '',
    points: 1,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch quizzes with questions
    const { data: quizzesData, error: quizzesError } = await supabase
      .from('quizzes')
      .select('*, courses(*), quiz_questions(*)')
      .order('created_at', { ascending: false });

    if (quizzesError) {
      console.error('Error fetching quizzes:', quizzesError);
    } else {
      setQuizzes((quizzesData || []) as unknown as QuizWithDetails[]);
    }

    // Fetch courses
    const { data: coursesData } = await supabase
      .from('courses')
      .select('*')
      .order('title');
    
    setCourses(coursesData || []);

    setLoading(false);
  };

  const fetchCapsulesForCourse = async (courseId: string) => {
    const { data } = await supabase
      .from('learning_paths')
      .select('capsules(*)')
      .eq('course_id', courseId);

    const allCapsules = (data || []).flatMap(p => (p.capsules || []) as Capsule[]);
    setCapsules(allCapsules);
  };

  const handleCreateQuiz = () => {
    setEditingQuiz(null);
    setFormData({
      course_id: '',
      capsule_id: 'course-level',
      title: '',
      description: '',
      quiz_type: 'quiz',
      is_graded: false,
      passing_score: 70,
      time_limit_minutes: 0,
      max_attempts: 1,
      is_published: false,
    });
    setDialogOpen(true);
  };

  const handleEditQuiz = (quiz: Quiz) => {
    setEditingQuiz(quiz);
    setFormData({
      course_id: quiz.course_id,
      capsule_id: quiz.capsule_id || 'course-level',
      title: quiz.title,
      description: quiz.description || '',
      quiz_type: quiz.quiz_type,
      is_graded: quiz.is_graded || false,
      passing_score: quiz.passing_score || 70,
      time_limit_minutes: quiz.time_limit_minutes || 0,
      max_attempts: quiz.max_attempts || 1,
      is_published: quiz.is_published || false,
    });
    fetchCapsulesForCourse(quiz.course_id);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.course_id) {
      toast({
        title: 'Course Required',
        description: 'Please select a course for this quiz.',
        variant: 'destructive',
      });
      return;
    }

    if (formData.quiz_type === 'quiz' && !formData.capsule_id) {
      toast({
        title: 'Capsule Required',
        description: 'Please select a capsule for this quiz.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.title.trim()) {
      toast({
        title: 'Required fields missing',
        description: 'Please fill in title.',
        variant: 'destructive',
      });
      return;
    }

    const quizData = {
      course_id: formData.course_id,
      capsule_id: formData.capsule_id === 'course-level' ? null : formData.capsule_id,
      title: formData.title,
      description: formData.description || null,
      quiz_type: formData.quiz_type,
      is_graded: formData.is_graded,
      passing_score: formData.passing_score,
      time_limit_minutes: formData.time_limit_minutes || null,
      max_attempts: formData.max_attempts,
      is_published: formData.is_published,
    };

    if (editingQuiz) {
      const { error } = await supabase
        .from('quizzes')
        .update(quizData)
        .eq('id', editingQuiz.id);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Quiz updated!' });
        setDialogOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase.from('quizzes').insert(quizData);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Quiz created!' });
        setDialogOpen(false);
        fetchData();
      }
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!confirm('Are you sure you want to delete this quiz and all its questions?')) return;

    const { error } = await supabase.from('quizzes').delete().eq('id', quizId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Quiz deleted!' });
      fetchData();
    }
  };

  const handleAddQuestion = (quizId: string) => {
    setSelectedQuizId(quizId);
    setEditingQuestion(null);
    setQuestionFormData({
      question_type: 'mcq',
      question_text: '',
      options: ['', '', '', ''],
      correct_answer: 0,
      explanation: '',
      points: 1,
    });
    setQuestionDialogOpen(true);
  };

  const handleEditQuestion = (question: QuizQuestion) => {
    setSelectedQuizId(question.quiz_id);
    setEditingQuestion(question);
    
    const options = question.options as { options?: string[] } | null;
    const correctAnswer = question.correct_answer as { correct_index?: number } | null;
    
    setQuestionFormData({
      question_type: question.question_type,
      question_text: question.question_text,
      options: options?.options || ['', '', '', ''],
      correct_answer: correctAnswer?.correct_index || 0,
      explanation: question.explanation || '',
      points: question.points || 1,
    });
    setQuestionDialogOpen(true);
  };

  const handleSaveQuestion = async () => {
    if (!questionFormData.question_text.trim() || !selectedQuizId) {
      toast({
        title: 'Required fields missing',
        description: 'Please enter the question text.',
        variant: 'destructive',
      });
      return;
    }

    const questionData = {
      quiz_id: selectedQuizId,
      question_type: questionFormData.question_type,
      question_text: questionFormData.question_text,
      options: questionFormData.question_type === 'mcq' || questionFormData.question_type === 'multiple_select'
        ? { options: questionFormData.options.filter(o => o.trim()) }
        : null,
      correct_answer: questionFormData.question_type === 'mcq'
        ? { correct_index: questionFormData.correct_answer }
        : questionFormData.question_type === 'true_false'
        ? { answer: questionFormData.correct_answer === 0 }
        : { answer: questionFormData.options[0] },
      explanation: questionFormData.explanation || null,
      points: questionFormData.points,
    };

    if (editingQuestion) {
      const { error } = await supabase
        .from('quiz_questions')
        .update(questionData)
        .eq('id', editingQuestion.id);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Question updated!' });
        setQuestionDialogOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase.from('quiz_questions').insert(questionData);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Question added!' });
        setQuestionDialogOpen(false);
        fetchData();
      }
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Delete this question?')) return;

    const { error } = await supabase.from('quiz_questions').delete().eq('id', questionId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Question deleted!' });
      fetchData();
    }
  };

  const handleReorderQuestions = async (quizId: string, dragIndex: number, dropIndex: number) => {
    if (dragIndex === dropIndex) return;

    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz) return;

    const reorderedQuestions = [...quiz.quiz_questions];
    const [draggedQuestion] = reorderedQuestions.splice(dragIndex, 1);
    reorderedQuestions.splice(dropIndex, 0, draggedQuestion);

    // Update order_index for all questions individually
    try {
      for (let i = 0; i < reorderedQuestions.length; i++) {
        const { error } = await supabase
          .from('quiz_questions')
          .update({ order_index: i })
          .eq('id', reorderedQuestions[i].id);
        
        if (error) throw error;
      }
      
      toast({ title: 'Questions reordered' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Manage Quizzes & Assignments</h2>
        <Button onClick={handleCreateQuiz}>
          <Plus className="w-4 h-4 mr-2" />
          Create Quiz
        </Button>
      </div>

      {quizzes.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileQuestion className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No quizzes yet</h3>
            <p className="text-muted-foreground mb-4">
              Create quizzes and assignments for your courses.
            </p>
            <Button onClick={handleCreateQuiz}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Quiz
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-4">
          {quizzes.map((quiz) => (
            <AccordionItem key={quiz.id} value={quiz.id} className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-4 flex-1">
                  {quiz.quiz_type === 'assignment' ? (
                    <ClipboardList className="w-5 h-5 text-primary" />
                  ) : (
                    <FileQuestion className="w-5 h-5 text-primary" />
                  )}
                  <div className="text-left flex-1">
                    <div className="font-medium">{quiz.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {quiz.courses?.title} • {quiz.quiz_questions?.length || 0} questions
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={quiz.is_published ? 'default' : 'secondary'}>
                      {quiz.is_published ? 'Published' : 'Draft'}
                    </Badge>
                    {quiz.is_graded && (
                      <Badge variant="outline">Graded</Badge>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-4">
                  {quiz.description && (
                    <p className="text-sm text-muted-foreground">{quiz.description}</p>
                  )}
                  
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    {quiz.passing_score && (
                      <span>Passing: {quiz.passing_score}%</span>
                    )}
                    {quiz.time_limit_minutes && (
                      <span>Time: {quiz.time_limit_minutes}min</span>
                    )}
                    <span>Attempts: {quiz.max_attempts}</span>
                  </div>

                  {/* Questions list */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">Questions</h4>
                      <Button size="sm" variant="outline" onClick={() => handleAddQuestion(quiz.id)}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add Question
                      </Button>
                    </div>
                    
                    {quiz.quiz_questions?.length > 0 ? (
                      <div className="space-y-2">
                        {quiz.quiz_questions.map((q, i) => (
                          <div
                            key={q.id}
                            className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg group"
                          >
                            <GripVertical className="w-4 h-4 text-muted-foreground cursor-move opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center">
                              {i + 1}
                            </span>
                            <div className="flex-1">
                              <p className="text-sm line-clamp-1">{q.question_text}</p>
                              <p className="text-xs text-muted-foreground">
                                {q.question_type} • {q.points} pts
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => handleEditQuestion(q)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDeleteQuestion(q.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No questions yet. Add questions to this quiz.
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <Button size="sm" variant="outline" onClick={() => handleEditQuiz(quiz)}>
                      <Edit className="w-4 h-4 mr-1" />
                      Edit Quiz
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteQuiz(quiz.id)}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Quiz Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuiz ? 'Edit Quiz' : 'Create Quiz'}</DialogTitle>
            <DialogDescription>
              {editingQuiz ? 'Edit the quiz details and questions.' : 'Create a new quiz or assignment for your course.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Course *</Label>
              <Select
                value={formData.course_id}
                onValueChange={(value) => {
                  setFormData({ ...formData, course_id: value, capsule_id: 'course-level' });
                  fetchCapsulesForCourse(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Attach to Capsule (optional)</Label>
              <Select
                value={formData.capsule_id}
                onValueChange={(value) => setFormData({ ...formData, capsule_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Course-level (no capsule)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="course-level">Course-level (no capsule)</SelectItem>
                  {capsules.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Quiz title"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Quiz description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.quiz_type}
                  onValueChange={(value: 'quiz' | 'assignment') => 
                    setFormData({ ...formData, quiz_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="assignment">Assignment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Passing Score (%)</Label>
                <Input
                  type="number"
                  value={formData.passing_score}
                  onChange={(e) => setFormData({ ...formData, passing_score: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Time Limit (min)</Label>
                <Input
                  type="number"
                  value={formData.time_limit_minutes}
                  onChange={(e) => setFormData({ ...formData, time_limit_minutes: parseInt(e.target.value) || 0 })}
                  placeholder="0 = no limit"
                />
              </div>

              <div className="space-y-2">
                <Label>Max Attempts</Label>
                <Input
                  type="number"
                  value={formData.max_attempts}
                  onChange={(e) => setFormData({ ...formData, max_attempts: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_graded}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_graded: checked })}
                />
                <Label>Graded</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_published}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                />
                <Label>Published</Label>
              </div>
            </div>

            <Button onClick={handleSubmit} className="w-full">
              {editingQuiz ? 'Update Quiz' : 'Create Quiz'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Question Dialog */}
      <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? 'Edit Question' : 'Add Question'}</DialogTitle>
            <DialogDescription>
              {editingQuestion ? 'Edit the question details and answer options.' : 'Add a new question to this quiz.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Question Type</Label>
              <Select
                value={questionFormData.question_type}
                onValueChange={(value: 'mcq' | 'short_answer' | 'true_false' | 'multiple_select') =>
                  setQuestionFormData({ ...questionFormData, question_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">Multiple Choice (Single)</SelectItem>
                  <SelectItem value="multiple_select">Multiple Choice (Multi)</SelectItem>
                  <SelectItem value="true_false">True/False</SelectItem>
                  <SelectItem value="short_answer">Short Answer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Question Text *</Label>
              <Textarea
                value={questionFormData.question_text}
                onChange={(e) => setQuestionFormData({ ...questionFormData, question_text: e.target.value })}
                placeholder="Enter your question"
                rows={3}
              />
            </div>

            {(questionFormData.question_type === 'mcq' || questionFormData.question_type === 'multiple_select') && (
              <div className="space-y-2">
                <Label>Options</Label>
                {questionFormData.options.map((opt, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      value={opt}
                      onChange={(e) => {
                        const newOptions = [...questionFormData.options];
                        newOptions[i] = e.target.value;
                        setQuestionFormData({ ...questionFormData, options: newOptions });
                      }}
                      placeholder={`Option ${i + 1}`}
                    />
                    {questionFormData.question_type === 'mcq' && (
                      <Button
                        type="button"
                        size="icon"
                        variant={questionFormData.correct_answer === i ? 'default' : 'outline'}
                        onClick={() => setQuestionFormData({ ...questionFormData, correct_answer: i })}
                      >
                        {questionFormData.correct_answer === i ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                ))}
                {questionFormData.question_type === 'mcq' && (
                  <p className="text-xs text-muted-foreground">Click the button to mark the correct answer</p>
                )}
              </div>
            )}

            {questionFormData.question_type === 'true_false' && (
              <div className="space-y-2">
                <Label>Correct Answer</Label>
                <Select
                  value={String(questionFormData.correct_answer)}
                  onValueChange={(value) => setQuestionFormData({ ...questionFormData, correct_answer: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">True</SelectItem>
                    <SelectItem value="1">False</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {questionFormData.question_type === 'short_answer' && (
              <div className="space-y-2">
                <Label>Expected Answer</Label>
                <Input
                  value={questionFormData.options[0]}
                  onChange={(e) => setQuestionFormData({ 
                    ...questionFormData, 
                    options: [e.target.value, '', '', ''] 
                  })}
                  placeholder="Expected answer"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Points</Label>
                <Input
                  type="number"
                  value={questionFormData.points}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, points: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Explanation (optional)</Label>
              <Textarea
                value={questionFormData.explanation}
                onChange={(e) => setQuestionFormData({ ...questionFormData, explanation: e.target.value })}
                placeholder="Explanation shown after answering"
                rows={2}
              />
            </div>

            <Button onClick={handleSaveQuestion} className="w-full">
              {editingQuestion ? 'Update Question' : 'Add Question'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
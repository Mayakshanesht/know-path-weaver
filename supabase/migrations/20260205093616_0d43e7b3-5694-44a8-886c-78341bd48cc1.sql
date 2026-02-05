-- Create quiz-related tables for KnowGraph LMS

-- Create question type enum
CREATE TYPE public.question_type AS ENUM ('mcq', 'short_answer', 'true_false', 'multiple_select');

-- Create quiz type enum
CREATE TYPE public.quiz_type AS ENUM ('quiz', 'assignment');

-- Create quizzes table
CREATE TABLE public.quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  capsule_id UUID REFERENCES public.capsules(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  quiz_type public.quiz_type NOT NULL DEFAULT 'quiz',
  is_graded BOOLEAN DEFAULT false,
  passing_score INTEGER DEFAULT 70,
  time_limit_minutes INTEGER,
  max_attempts INTEGER DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create questions table
CREATE TABLE public.quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_type public.question_type NOT NULL DEFAULT 'mcq',
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer JSONB NOT NULL,
  explanation TEXT,
  points INTEGER DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quiz attempts table
CREATE TABLE public.quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  score INTEGER,
  max_score INTEGER,
  passed BOOLEAN,
  answers JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Quizzes RLS policies
CREATE POLICY "Admins can manage quizzes"
  ON public.quizzes
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Published quizzes are viewable by enrolled users"
  ON public.quizzes
  FOR SELECT
  USING (
    is_published = true 
    AND EXISTS (
      SELECT 1 FROM public.enrollments e 
      WHERE e.course_id = quizzes.course_id 
      AND e.user_id = auth.uid() 
      AND e.status = 'approved'
    )
  );

-- Quiz questions RLS policies
CREATE POLICY "Admins can manage quiz questions"
  ON public.quiz_questions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Questions viewable for published quizzes by enrolled users"
  ON public.quiz_questions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      JOIN public.enrollments e ON e.course_id = q.course_id
      WHERE q.id = quiz_questions.quiz_id
      AND q.is_published = true
      AND e.user_id = auth.uid()
      AND e.status = 'approved'
    )
  );

-- Quiz attempts RLS policies
CREATE POLICY "Admins can view all attempts"
  ON public.quiz_attempts
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can manage own attempts"
  ON public.quiz_attempts
  FOR ALL
  USING (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_quizzes_updated_at
  BEFORE UPDATE ON public.quizzes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quiz_questions_updated_at
  BEFORE UPDATE ON public.quiz_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
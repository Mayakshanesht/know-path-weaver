import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Course, Capsule, LearningPath, CapsuleContent, Progress, Quiz, QuizWithQuestions, CapsuleWithProgress, LearningPathWithCapsules as BaseLearningPathWithCapsules } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress as ProgressBar } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Lock,
  Play,
  Circle,
  Menu,
  X,
  Home,
  BookOpen,
  FileVideo,
  Youtube,
  Github,
  ExternalLink,
  FileText,
  Image,
  FileType,
} from 'lucide-react';

interface CapsuleWithStatus extends CapsuleWithProgress {
  isCompleted: boolean;
}

interface LearningPathWithCapsules extends BaseLearningPathWithCapsules {
  capsules: CapsuleWithStatus[];
}

export default function LearnCourse() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { authUser } = useAuth();
  const { toast } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [learningPaths, setLearningPaths] = useState<LearningPathWithCapsules[]>([]);
  const [currentCapsule, setCurrentCapsule] = useState<CapsuleWithStatus | null>(null);
  const [capsuleContent, setCapsuleContent] = useState<CapsuleContent[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [prerequisites, setPrerequisites] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (courseId && authUser) {
      checkEnrollmentAndFetch();
    }
  }, [courseId, authUser]);

  const checkEnrollmentAndFetch = async () => {
    if (!authUser || !courseId) return;

    // Check if enrolled and approved
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('*')
      .eq('course_id', courseId)
      .eq('user_id', authUser.id)
      .eq('status', 'approved')
      .maybeSingle();

    if (!enrollment) {
      toast({
        title: 'Access Denied',
        description: 'You need to be enrolled in this course to access it.',
        variant: 'destructive',
      });
      navigate(`/courses/${courseId}`);
      return;
    }

    await fetchCourseData();
  };

  const fetchCourseData = async () => {
    if (!authUser || !courseId) return;

    // Fetch course
    const { data: courseData } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (!courseData) {
      navigate('/dashboard');
      return;
    }
    setCourse(courseData);

    // Fetch quizzes for this course
    const { data: quizData } = await supabase
      .from('quizzes')
      .select('*')
      .eq('course_id', courseId)
      .eq('is_published', true)
      .order('order_index');

    setQuizzes(quizData || []);

    // Fetch learning paths with capsules
    const { data: pathsData } = await supabase
      .from('learning_paths')
      .select('*, capsules(*)')
      .eq('course_id', courseId)
      .order('order_index');

    if (!pathsData) {
      setLoading(false);
      return;
    }

    // Get all capsule IDs
    const allCapsuleIds = pathsData.flatMap((p) =>
      (p.capsules || []).map((c: Capsule) => c.id)
    );

    // Fetch progress for all capsules
    const { data: progressData } = await supabase
      .from('progress')
      .select('*')
      .eq('user_id', authUser.id)
      .in('capsule_id', allCapsuleIds);

    const progressMap = new Map(
      (progressData || []).map((p) => [p.capsule_id, p])
    );

    // Fetch prerequisites
    const { data: prereqData } = await supabase
      .from('capsule_prerequisites')
      .select('*')
      .in('capsule_id', allCapsuleIds);

    const prereqMap: Record<string, string[]> = {};
    (prereqData || []).forEach((p) => {
      if (!prereqMap[p.capsule_id]) {
        prereqMap[p.capsule_id] = [];
      }
      prereqMap[p.capsule_id].push(p.prerequisite_capsule_id);
    });
    setPrerequisites(prereqMap);

    // Build paths with status
    const completedCapsuleIds = new Set(
      (progressData || [])
        .filter((p) => p.is_completed)
        .map((p) => p.capsule_id)
    );

    const enrichedPaths = pathsData.map((path) => {
      const capsules = ((path.capsules || []) as Capsule[])
        .sort((a, b) => a.order_index - b.order_index)
        .map((capsule) => {
          const prereqs = prereqMap[capsule.id] || [];
          const isLocked = prereqs.some((prereqId) => !completedCapsuleIds.has(prereqId));
          const progress = progressMap.get(capsule.id) || null;
          const isCompleted = progress?.is_completed || false;

          return {
            ...capsule,
            progress,
            isLocked,
            isCompleted,
          };
        });

      return { ...path, capsules };
    });

    setLearningPaths(enrichedPaths);

    // Find first incomplete, unlocked capsule or first capsule
    let firstCapsule: CapsuleWithStatus | null = null;
    for (const path of enrichedPaths) {
      for (const capsule of path.capsules) {
        if (!firstCapsule) {
          firstCapsule = capsule;
        }
        if (!capsule.isCompleted && !capsule.isLocked) {
          setCurrentCapsule(capsule);
          fetchCapsuleContent(capsule.id);
          setLoading(false);
          return;
        }
      }
    }

    setCurrentCapsule(firstCapsule);
    if (firstCapsule) {
      fetchCapsuleContent(firstCapsule.id);
    }
    setLoading(false);
  };

  const handleMarkComplete = async () => {
    if (!authUser || !currentCapsule) return;

    setMarking(true);

    // Upsert progress
    const { error } = await supabase.from('progress').upsert(
      {
        user_id: authUser.id,
        capsule_id: currentCapsule.id,
        is_completed: true,
        completed_at: new Date().toISOString(),
        watch_percentage: 100,
        last_watched_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,capsule_id',
      }
    );

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to mark capsule as complete.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Capsule completed!',
        description: 'Great progress! Keep going!',
      });
      await fetchCourseData();
    }

    setMarking(false);
  };

  const fetchCapsuleContent = async (capsuleId: string) => {
    const { data } = await supabase
      .from('capsule_content')
      .select('*')
      .eq('capsule_id', capsuleId)
      .order('order_index');
    
    setCapsuleContent((data || []) as CapsuleContent[]);
  };

  const renderContent = (content: CapsuleContent) => {
    const config = {
      google_drive: { icon: FileVideo, label: 'Google Drive' },
      youtube: { icon: Youtube, label: 'YouTube' },
      github: { icon: Github, label: 'GitHub' },
      colab: { icon: ExternalLink, label: 'Google Colab' },
      weblink: { icon: ExternalLink, label: 'Web Link' },
      text: { icon: FileText, label: 'Text' },
      image: { icon: Image, label: 'Image' },
      pdf: { icon: FileType, label: 'PDF' },
    };

    const { icon: Icon, label } = config[content.content_type];

    switch (content.content_type) {
      case 'google_drive':
        return (
          <iframe
            src={`https://drive.google.com/file/d/${content.content_value}/preview`}
            className="w-full h-full border-0"
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-presentation allow-top-navigation"
          />
        );
      
      case 'youtube':
        const getYoutubeEmbedUrl = (url: string) => {
          // Handle various YouTube URL formats
          if (url.includes('youtube.com/watch?v=')) {
            const videoId = url.split('v=')[1]?.split('&')[0];
            return `https://www.youtube.com/embed/${videoId}`;
          }
          if (url.includes('youtu.be/')) {
            const videoId = url.split('/').pop();
            return `https://www.youtube.com/embed/${videoId}`;
          }
          if (url.includes('youtube.com/embed/')) {
            return url; // Already in embed format
          }
          // Default: treat as video ID
          return `https://www.youtube.com/embed/${url}`;
        };
        
        return (
          <div className="w-full h-full flex flex-col">
            <iframe
              src={getYoutubeEmbedUrl(content.content_value)}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              title={content.title || 'YouTube Video'}
            />
            <div className="mt-2 p-2 bg-secondary/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(content.content_value, '_blank')}
                className="w-full"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in YouTube
              </Button>
            </div>
          </div>
        );
      
      case 'github':
        return (
          <div className="w-full h-full flex flex-col">
            <iframe
              src={content.content_value}
              className="w-full h-full border-0"
              allowFullScreen
              title={content.title || 'GitHub Repository'}
            />
            <div className="mt-2 p-2 bg-secondary/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(content.content_value, '_blank')}
                className="w-full"
              >
                <Github className="w-4 h-4 mr-2" />
                Open in GitHub
              </Button>
            </div>
          </div>
        );
      
      case 'colab':
        return (
          <div className="w-full h-full flex flex-col">
            <iframe
              src={content.content_value}
              className="w-full h-full border-0"
              allowFullScreen
              title={content.title || 'Google Colab Notebook'}
            />
            <div className="mt-2 p-2 bg-secondary/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(content.content_value, '_blank')}
                className="w-full"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Colab
              </Button>
            </div>
          </div>
        );
      
      case 'weblink':
        return (
          <div className="w-full h-full flex flex-col">
            <iframe
              src={content.content_value}
              className="w-full h-full border-0"
              allowFullScreen
              title={content.title || 'External Content'}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-presentation allow-top-navigation"
            />
            <div className="mt-2 p-2 bg-secondary/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(content.content_value, '_blank')}
                className="w-full"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in New Tab
              </Button>
            </div>
          </div>
        );
      
      case 'text':
        return (
          <div className="p-6 bg-white dark:bg-gray-900 rounded-lg">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <pre className="whitespace-pre-wrap text-sm">{content.content_value}</pre>
            </div>
          </div>
        );
      
      case 'image':
        return (
          <img
            src={content.content_value}
            alt={content.title || 'Content image'}
            className="w-full h-full object-contain"
          />
        );
      
      case 'pdf':
        return (
          <iframe
            src={content.content_value}
            className="w-full h-full border-0"
            allowFullScreen
          />
        );
      
      default:
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Icon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Unsupported content type: {label}</p>
            </div>
          </div>
        );
    }
  };

  const navigateToCapsule = async (capsule: CapsuleWithStatus) => {
    if (!capsule.isLocked) {
      setCurrentCapsule(capsule);
      await fetchCapsuleContent(capsule.id);
    }
  };

  const getNextCapsule = (): CapsuleWithStatus | null => {
    if (!currentCapsule) return null;

    let found = false;
    for (const path of learningPaths) {
      for (const capsule of path.capsules) {
        if (found && !capsule.isLocked) {
          return capsule;
        }
        if (capsule.id === currentCapsule.id) {
          found = true;
        }
      }
    }
    return null;
  };

  const getPrevCapsule = (): CapsuleWithStatus | null => {
    if (!currentCapsule) return null;

    let prev: CapsuleWithStatus | null = null;
    for (const path of learningPaths) {
      for (const capsule of path.capsules) {
        if (capsule.id === currentCapsule.id) {
          return prev;
        }
        if (!capsule.isLocked) {
          prev = capsule;
        }
      }
    }
    return null;
  };

  // Calculate overall progress
  const totalCapsules = learningPaths.reduce((acc, p) => acc + p.capsules.length, 0);
  const completedCapsules = learningPaths.reduce(
    (acc, p) => acc + p.capsules.filter((c) => c.isCompleted).length,
    0
  );
  const overallProgress = totalCapsules > 0 ? Math.round((completedCapsules / totalCapsules) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex">
        <div className="w-80 bg-sidebar border-r border-sidebar-border p-4">
          <Skeleton className="h-8 w-full mb-4" />
          <Skeleton className="h-4 w-3/4 mb-8" />
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full mb-2" />
          ))}
        </div>
        <div className="flex-1 p-8">
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <motion.aside
        className={`fixed inset-y-0 left-0 z-40 w-80 bg-sidebar text-sidebar-foreground border-r border-sidebar-border transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static`}
        initial={false}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-sidebar-border">
            <Link to="/dashboard" className="flex items-center gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground mb-4 text-sm">
              <Home className="w-4 h-4" />
              Back to Dashboard
            </Link>
            <h2 className="font-bold text-lg line-clamp-2">{course?.title}</h2>
            <div className="mt-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-sidebar-foreground/70">Progress</span>
                <span>{overallProgress}%</span>
              </div>
              <ProgressBar value={overallProgress} className="h-2 bg-sidebar-accent" />
            </div>
          </div>

          {/* Curriculum */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {learningPaths.map((path, pathIndex) => (
                <div key={path.id}>
                  <h3 className="text-xs uppercase tracking-wider text-sidebar-foreground/50 mb-2">
                    Module {pathIndex + 1}: {path.title}
                  </h3>
                  <div className="space-y-1">
                    {path.capsules.map((capsule, capsuleIndex) => (
                      <button
                        key={capsule.id}
                        onClick={() => navigateToCapsule(capsule)}
                        disabled={capsule.isLocked}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left text-sm transition-colors ${
                          currentCapsule?.id === capsule.id
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                            : capsule.isLocked
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-sidebar-accent'
                        }`}
                      >
                        {capsule.isLocked ? (
                          <Lock className="w-4 h-4 flex-shrink-0" />
                        ) : capsule.isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-success" />
                        ) : currentCapsule?.id === capsule.id ? (
                          <Play className="w-4 h-4 flex-shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 flex-shrink-0" />
                        )}
                        <span className="flex-1 line-clamp-2">{capsule.title}</span>
                        {capsule.duration_minutes && (
                          <span className="text-xs opacity-70">{capsule.duration_minutes}m</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <div className="flex-1">
            <h1 className="font-medium line-clamp-1">{currentCapsule?.title || 'Select a capsule'}</h1>
          </div>
          <Badge variant="secondary">
            {completedCapsules}/{totalCapsules} completed
          </Badge>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-4 md:p-8">
          {currentCapsule ? (
            <motion.div
              key={currentCapsule.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="max-w-4xl mx-auto space-y-6"
            >
              {/* Content Player */}
              {capsuleContent.length > 0 ? (
                <div className="space-y-6">
                  {capsuleContent.map((content, index) => (
                    <Card key={content.id} className="overflow-hidden">
                      <div className="bg-muted/50 px-4 py-2 border-b">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-medium">
                            {index + 1}
                          </span>
                          <h3 className="font-medium">{content.title || `Content ${index + 1}`}</h3>
                          <Badge variant="outline" className="text-xs">
                            {content.content_type.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                      <div className="aspect-video bg-black flex items-center justify-center">
                        {renderContent(content)}
                      </div>
                      {content.description && (
                        <div className="p-4 bg-muted/30">
                          <p className="text-sm text-muted-foreground">{content.description}</p>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              ) : null}

              {/* Quizzes */}
              {quizzes.filter(quiz => 
                quiz.capsule_id === currentCapsule?.id || 
                (quiz.capsule_id === null && quiz.quiz_type === 'assignment')
              ).length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Assessments</h3>
                  {quizzes
                    .filter(quiz => 
                      quiz.capsule_id === currentCapsule?.id || 
                      (quiz.capsule_id === null && quiz.quiz_type === 'assignment')
                    )
                    .map((quiz, index) => (
                      <Card key={quiz.id} className="overflow-hidden">
                        <div className="bg-muted/50 px-4 py-2 border-b">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-blue-10 text-blue-600 text-sm flex items-center justify-center font-medium">
                              Q{index + 1}
                            </span>
                            <h3 className="font-medium">{quiz.title}</h3>
                            <Badge variant="outline" className="text-xs">
                              {quiz.quiz_type === 'quiz' ? 'Quiz' : 'Assignment'}
                            </Badge>
                            {quiz.is_graded && (
                              <Badge variant="secondary" className="text-xs">
                                Graded
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="p-4">
                          {quiz.description && (
                            <p className="text-sm text-muted-foreground mb-4">{quiz.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                            {quiz.time_limit_minutes && (
                              <span>Time Limit: {quiz.time_limit_minutes} minutes</span>
                            )}
                            {quiz.passing_score && (
                              <span>Passing Score: {quiz.passing_score}%</span>
                            )}
                            {quiz.max_attempts && (
                              <span>Max Attempts: {quiz.max_attempts}</span>
                            )}
                          </div>
                          <Button 
                            onClick={() => navigate(`/quiz/${quiz.id}`)}
                            className="w-full"
                          >
                            Start {quiz.quiz_type === 'quiz' ? 'Quiz' : 'Assignment'}
                          </Button>
                        </div>
                      </Card>
                    ))}
                </div>
              )}

              {capsuleContent.length === 0 && !quizzes.filter(quiz => 
                quiz.capsule_id === currentCapsule?.id || 
                (quiz.capsule_id === null && quiz.quiz_type === 'assignment')
              ).length && currentCapsule.drive_file_id ? (
                <Card className="overflow-hidden">
                  <div className="aspect-video bg-black flex items-center justify-center">
                    <iframe
                      src={`https://drive.google.com/file/d/${currentCapsule.drive_file_id}/preview`}
                      className="w-full h-full border-0"
                      allow="autoplay; encrypted-media; fullscreen"
                      allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                      sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-presentation allow-top-navigation"
                    />
                  </div>
                </Card>
              ) : (
                <Card className="overflow-hidden">
                  <div className="aspect-video bg-black flex items-center justify-center">
                    <div className="text-center text-white/70">
                      <BookOpen className="w-16 h-16 mx-auto mb-4" />
                      <p>No content available</p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Capsule Info */}
              <Card>
                <CardHeader>
                  <CardTitle>{currentCapsule.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  {currentCapsule.description && (
                    <p className="text-muted-foreground mb-4">{currentCapsule.description}</p>
                  )}

                  <div className="flex flex-wrap gap-4">
                    {currentCapsule.isCompleted ? (
                      <Badge className="bg-success/10 text-success">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Completed
                      </Badge>
                    ) : (
                      <Button onClick={handleMarkComplete} disabled={marking}>
                        {marking ? (
                          'Marking...'
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Mark as Complete
                          </>
                        )}
                      </Button>
                    )}

                    {currentCapsule.duration_minutes && (
                      <Badge variant="secondary">
                        {currentCapsule.duration_minutes} minutes
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Navigation */}
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => getPrevCapsule() && navigateToCapsule(getPrevCapsule()!)}
                  disabled={!getPrevCapsule()}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
                <Button
                  onClick={() => getNextCapsule() && navigateToCapsule(getNextCapsule()!)}
                  disabled={!getNextCapsule()}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select a capsule to start learning</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

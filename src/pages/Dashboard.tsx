import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { EnrollmentWithCourse, Progress } from '@/types/database';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress as ProgressBar } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BookOpen,
  Play,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

interface EnrollmentWithProgress extends EnrollmentWithCourse {
  totalCapsules: number;
  completedCapsules: number;
  progressPercent: number;
}

export default function Dashboard() {
  const { authUser } = useAuth();
  const [enrollments, setEnrollments] = useState<EnrollmentWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authUser) {
      fetchEnrollments();
    }
  }, [authUser]);

  const fetchEnrollments = async () => {
    if (!authUser) return;

    // Fetch enrollments with courses
    const { data: enrollmentsData, error } = await supabase
      .from('enrollments')
      .select('*, courses(*)')
      .eq('user_id', authUser.id)
      .order('enrolled_at', { ascending: false });

    if (error) {
      console.error('Error fetching enrollments:', error);
      setLoading(false);
      return;
    }

    // For approved enrollments, fetch progress
    const enrichedEnrollments = await Promise.all(
      (enrollmentsData || []).map(async (enrollment) => {
        if (enrollment.status !== 'approved') {
          return {
            ...enrollment,
            totalCapsules: 0,
            completedCapsules: 0,
            progressPercent: 0,
          };
        }

        // Get all capsules for this course
        const { data: pathsData } = await supabase
          .from('learning_paths')
          .select('capsules(id)')
          .eq('course_id', enrollment.course_id);

        const allCapsuleIds = (pathsData || []).flatMap((p) =>
          (p.capsules || []).map((c: any) => c.id)
        );

        // Get completed capsules
        const { data: progressData } = await supabase
          .from('progress')
          .select('*')
          .eq('user_id', authUser.id)
          .in('capsule_id', allCapsuleIds)
          .eq('is_completed', true);

        const completedCount = progressData?.length || 0;
        const totalCount = allCapsuleIds.length;

        return {
          ...enrollment,
          totalCapsules: totalCount,
          completedCapsules: completedCount,
          progressPercent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
        };
      })
    );

    setEnrollments(enrichedEnrollments as EnrollmentWithProgress[]);
    setLoading(false);
  };

  const approvedEnrollments = enrollments.filter((e) => e.status === 'approved');
  const pendingEnrollments = enrollments.filter((e) => e.status === 'pending');
  const rejectedEnrollments = enrollments.filter((e) => e.status === 'rejected');

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-3xl font-bold mb-2">Welcome back, {authUser?.profile?.full_name || 'Student'}!</h1>
            <p className="text-muted-foreground mb-8">Continue your learning journey</p>
          </motion.div>

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-2 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : enrollments.length === 0 ? (
            <motion.div
              className="text-center py-16"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-2xl font-semibold mb-2">No courses yet</h2>
              <p className="text-muted-foreground mb-6">
                Start your learning journey by enrolling in a course
              </p>
              <Button asChild>
                <Link to="/courses">
                  Browse Courses
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </motion.div>
          ) : (
            <Tabs defaultValue="active" className="space-y-6">
              <TabsList>
                <TabsTrigger value="active">
                  Active ({approvedEnrollments.length})
                </TabsTrigger>
                <TabsTrigger value="pending">
                  Pending ({pendingEnrollments.length})
                </TabsTrigger>
                {rejectedEnrollments.length > 0 && (
                  <TabsTrigger value="rejected">
                    Rejected ({rejectedEnrollments.length})
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="active" className="space-y-6">
                {approvedEnrollments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No active courses. Check your pending enrollments or browse new courses.
                  </p>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {approvedEnrollments.map((enrollment, i) => (
                      <motion.div
                        key={enrollment.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: i * 0.1 }}
                      >
                        <Card className="h-full flex flex-col card-hover">
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <CardTitle className="line-clamp-2">
                                {enrollment.courses.title}
                              </CardTitle>
                              <Badge variant="secondary" className="bg-success/10 text-success">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Active
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="flex-1">
                            <div className="space-y-4">
                              <div>
                                <div className="flex justify-between text-sm mb-2">
                                  <span className="text-muted-foreground">Progress</span>
                                  <span className="font-medium">{enrollment.progressPercent}%</span>
                                </div>
                                <ProgressBar value={enrollment.progressPercent} className="h-2" />
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <BookOpen className="w-4 h-4" />
                                  <span>{enrollment.completedCapsules}/{enrollment.totalCapsules} capsules</span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                          <CardFooter>
                            <Button asChild className="w-full">
                              <Link to={`/learn/${enrollment.course_id}`}>
                                <Play className="w-4 h-4 mr-2" />
                                Continue
                              </Link>
                            </Button>
                          </CardFooter>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="pending" className="space-y-6">
                {pendingEnrollments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No pending enrollments.
                  </p>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pendingEnrollments.map((enrollment, i) => (
                      <motion.div
                        key={enrollment.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: i * 0.1 }}
                      >
                        <Card className="h-full flex flex-col">
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <CardTitle className="line-clamp-2">
                                {enrollment.courses.title}
                              </CardTitle>
                              <Badge variant="secondary" className="bg-warning/10 text-warning">
                                <Clock className="w-3 h-3 mr-1" />
                                Pending
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="flex-1">
                            <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg">
                              <p className="text-sm">
                                Your payment is being verified. You'll be notified once approved.
                              </p>
                            </div>
                          </CardContent>
                          <CardFooter>
                            <Button variant="outline" asChild className="w-full">
                              <Link to={`/courses/${enrollment.course_id}`}>
                                View Course
                              </Link>
                            </Button>
                          </CardFooter>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {rejectedEnrollments.length > 0 && (
                <TabsContent value="rejected" className="space-y-6">
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {rejectedEnrollments.map((enrollment, i) => (
                      <motion.div
                        key={enrollment.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: i * 0.1 }}
                      >
                        <Card className="h-full flex flex-col">
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <CardTitle className="line-clamp-2">
                                {enrollment.courses.title}
                              </CardTitle>
                              <Badge variant="destructive">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Rejected
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="flex-1">
                            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                              <p className="text-sm">
                                {enrollment.admin_notes || 'Your enrollment was rejected. Please contact support.'}
                              </p>
                            </div>
                          </CardContent>
                          <CardFooter>
                            <Button variant="outline" asChild className="w-full">
                              <Link to={`/courses/${enrollment.course_id}`}>
                                Try Again
                              </Link>
                            </Button>
                          </CardFooter>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </TabsContent>
              )}
            </Tabs>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

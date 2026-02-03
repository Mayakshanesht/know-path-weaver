import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Course, LearningPath, Capsule, Enrollment } from '@/types/database';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BookOpen,
  Clock,
  IndianRupee,
  DollarSign,
  Play,
  Lock,
  CheckCircle2,
  Upload,
  Loader2,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';

interface LearningPathWithCapsules extends LearningPath {
  capsules: Capsule[];
}

export default function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { authUser } = useAuth();
  const { toast } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [learningPaths, setLearningPaths] = useState<LearningPathWithCapsules[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);

  useEffect(() => {
    if (courseId) {
      fetchCourseData();
    }
  }, [courseId, authUser]);

  const fetchCourseData = async () => {
    setLoading(true);

    // Fetch course
    const { data: courseData, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (courseError || !courseData) {
      console.error('Error fetching course:', courseError);
      navigate('/courses');
      return;
    }

    setCourse(courseData);

    // Fetch learning paths with capsules
    const { data: pathsData, error: pathsError } = await supabase
      .from('learning_paths')
      .select('*, capsules(*)')
      .eq('course_id', courseId)
      .order('order_index');

    if (!pathsError && pathsData) {
      // Sort capsules within each path
      const sortedPaths = pathsData.map((path) => ({
        ...path,
        capsules: (path.capsules || []).sort((a: Capsule, b: Capsule) => a.order_index - b.order_index),
      }));
      setLearningPaths(sortedPaths);
    }

    // Check enrollment status if logged in
    if (authUser) {
      const { data: enrollmentData } = await supabase
        .from('enrollments')
        .select('*')
        .eq('course_id', courseId)
        .eq('user_id', authUser.id)
        .maybeSingle();

      setEnrollment(enrollmentData);
    }

    setLoading(false);
  };

  const handleEnroll = async () => {
    if (!authUser || !course) {
      navigate('/login');
      return;
    }

    setEnrolling(true);

    try {
      let receiptUrl = null;

      // Upload receipt if provided
      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${authUser.id}/${courseId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('payment-receipts')
          .upload(fileName, receiptFile);

        if (uploadError) {
          throw new Error('Failed to upload receipt');
        }

        const { data: urlData } = supabase.storage
          .from('payment-receipts')
          .getPublicUrl(fileName);

        receiptUrl = urlData.publicUrl;
      }

      // Create enrollment
      const { error: enrollError } = await supabase.from('enrollments').insert({
        user_id: authUser.id,
        course_id: course.id,
        payment_reference: paymentReference || null,
        payment_receipt_url: receiptUrl,
        status: 'pending',
      });

      if (enrollError) {
        throw enrollError;
      }

      toast({
        title: 'Enrollment submitted!',
        description: 'Your enrollment is pending approval. We\'ll notify you once approved.',
      });

      setEnrollDialogOpen(false);
      fetchCourseData();
    } catch (error: any) {
      toast({
        title: 'Enrollment failed',
        description: error.message,
        variant: 'destructive',
      });
    }

    setEnrolling(false);
  };

  const totalCapsules = learningPaths.reduce((acc, path) => acc + path.capsules.length, 0);
  const totalDuration = learningPaths.reduce(
    (acc, path) => acc + path.capsules.reduce((sum, cap) => sum + (cap.duration_minutes || 0), 0),
    0
  );

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 py-12">
          <div className="container mx-auto px-4">
            <Skeleton className="h-8 w-32 mb-6" />
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Skeleton className="h-64 w-full rounded-xl" />
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-24 w-full" />
              </div>
              <div>
                <Skeleton className="h-96 w-full rounded-xl" />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!course) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4">
          <Link
            to="/courses"
            className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to courses
          </Link>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <motion.div
              className="lg:col-span-2 space-y-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Hero */}
              <div className="relative h-64 md:h-80 rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20">
                {course.thumbnail_url ? (
                  <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen className="w-24 h-24 text-primary/40" />
                  </div>
                )}
              </div>

              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-4">{course.title}</h1>
                <p className="text-lg text-muted-foreground">{course.description}</p>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <span>{totalCapsules} Capsules</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg">
                  <Clock className="w-5 h-5 text-primary" />
                  <span>{Math.round(totalDuration / 60)}h {totalDuration % 60}m</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg">
                  <Play className="w-5 h-5 text-primary" />
                  <span>{learningPaths.length} Modules</span>
                </div>
              </div>

              {/* Curriculum Preview */}
              {course.curriculum_preview && (
                <Card>
                  <CardHeader>
                    <CardTitle>What You'll Learn</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground whitespace-pre-wrap">{course.curriculum_preview}</p>
                  </CardContent>
                </Card>
              )}

              {/* Learning Paths */}
              <Card>
                <CardHeader>
                  <CardTitle>Course Curriculum</CardTitle>
                </CardHeader>
                <CardContent>
                  {learningPaths.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Curriculum coming soon...
                    </p>
                  ) : (
                    <Accordion type="multiple" className="space-y-2">
                      {learningPaths.map((path, i) => (
                        <AccordionItem key={path.id} value={path.id} className="border rounded-lg px-4">
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-3">
                              <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                                {i + 1}
                              </span>
                              <div className="text-left">
                                <div className="font-medium">{path.title}</div>
                                <div className="text-sm text-muted-foreground">
                                  {path.capsules.length} capsules
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <ul className="space-y-2 ml-11">
                              {path.capsules.map((capsule) => (
                                <li key={capsule.id} className="flex items-center gap-3 py-2">
                                  <Lock className="w-4 h-4 text-muted-foreground" />
                                  <span className="flex-1">{capsule.title}</span>
                                  {capsule.duration_minutes && (
                                    <span className="text-sm text-muted-foreground">
                                      {capsule.duration_minutes} min
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Sidebar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card className="sticky top-24">
                <CardContent className="p-6 space-y-6">
                  {/* Pricing */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IndianRupee className="w-5 h-5" />
                        <span className="text-sm text-muted-foreground">India</span>
                      </div>
                      <span className="text-2xl font-bold">₹{course.price_india || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        <span className="text-sm text-muted-foreground">International</span>
                      </div>
                      <span className="text-2xl font-bold">${course.price_international || 0}</span>
                    </div>
                  </div>

                  {/* Enrollment Status */}
                  {enrollment ? (
                    <div className="space-y-4">
                      {enrollment.status === 'pending' && (
                        <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg">
                          <div className="flex items-center gap-2 text-warning">
                            <AlertCircle className="w-5 h-5" />
                            <span className="font-medium">Pending Approval</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Your payment is being verified.
                          </p>
                        </div>
                      )}
                      {enrollment.status === 'approved' && (
                        <div className="space-y-4">
                          <div className="p-4 bg-success/10 border border-success/30 rounded-lg">
                            <div className="flex items-center gap-2 text-success">
                              <CheckCircle2 className="w-5 h-5" />
                              <span className="font-medium">Enrolled</span>
                            </div>
                          </div>
                          <Button asChild className="w-full" size="lg">
                            <Link to={`/learn/${course.id}`}>
                              <Play className="w-5 h-5 mr-2" />
                              Continue Learning
                            </Link>
                          </Button>
                        </div>
                      )}
                      {enrollment.status === 'rejected' && (
                        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                          <div className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="w-5 h-5" />
                            <span className="font-medium">Rejected</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {enrollment.admin_notes || 'Please contact support.'}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full" size="lg">
                          Enroll Now
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Enroll in {course.title}</DialogTitle>
                          <DialogDescription>
                            Complete your payment via bank transfer and upload your receipt.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                          {/* Bank Details */}
                          {course.bank_details && (
                            <div className="p-4 bg-secondary rounded-lg">
                              <h4 className="font-medium mb-2">Bank Details</h4>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {course.bank_details}
                              </p>
                            </div>
                          )}

                          {course.payment_reference_code && (
                            <div className="p-4 bg-accent/10 border border-accent/30 rounded-lg">
                              <h4 className="font-medium mb-1">Reference Code</h4>
                              <p className="font-mono text-lg">{course.payment_reference_code}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Include this in your payment description
                              </p>
                            </div>
                          )}

                          {/* Payment Reference */}
                          <div className="space-y-2">
                            <Label htmlFor="paymentRef">Your Payment Reference</Label>
                            <Input
                              id="paymentRef"
                              placeholder="Transaction ID or UTR number"
                              value={paymentReference}
                              onChange={(e) => setPaymentReference(e.target.value)}
                            />
                          </div>

                          {/* Receipt Upload */}
                          <div className="space-y-2">
                            <Label htmlFor="receipt">Payment Receipt (Optional)</Label>
                            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                              <input
                                type="file"
                                id="receipt"
                                accept="image/*,.pdf"
                                className="hidden"
                                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                              />
                              <label htmlFor="receipt" className="cursor-pointer">
                                {receiptFile ? (
                                  <div className="flex items-center justify-center gap-2 text-success">
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span>{receiptFile.name}</span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                    <Upload className="w-8 h-8" />
                                    <span>Click to upload receipt</span>
                                  </div>
                                )}
                              </label>
                            </div>
                          </div>

                          <Button
                            onClick={handleEnroll}
                            disabled={enrolling}
                            className="w-full"
                          >
                            {enrolling ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Submitting...
                              </>
                            ) : (
                              'Submit Enrollment'
                            )}
                          </Button>

                          {!authUser && (
                            <p className="text-sm text-center text-muted-foreground">
                              <Link to="/login" className="text-primary hover:underline">
                                Sign in
                              </Link>{' '}
                              to enroll in this course
                            </p>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}

                  <Badge variant="secondary" className="w-full justify-center py-2">
                    Beta Access
                  </Badge>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

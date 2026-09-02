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
  Euro,
  Play,
  Lock,
  CheckCircle2,
  Upload,
  Loader2,
  ArrowLeft,
  AlertCircle,
  CreditCard,
  QrCode,
  Mail,
  Phone,
  Info,
} from 'lucide-react';
import paymentQR from '@/assets/payment_qr_code_cropped.jpeg?url';
import CourseCover from '@/components/courses/CourseCover';
import CourseSyllabus from '@/components/courses/CourseSyllabus';
import LearningGraph from '@/components/courses/LearningGraph';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { COUNTRIES, INDIAN_STATES, guessCountry, regionForCountry } from '@/lib/countries';
import { clipForCourse } from '@/lib/marketingMedia';
import { payWithRazorpay } from '@/lib/razorpay';

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
  const [payingOnline, setPayingOnline] = useState(false);

  const handlePayOnline = async () => {
    if (!course || !authUser) return;
    setPayingOnline(true);
    try {
      const result = await payWithRazorpay({
        courseId: course.id,
        region: regionForCountry(billingCountry) === 'india' ? 'india' : 'international',
        billingCountry,
        billingState,
      });
      if (result.status === 'paid') {
        toast({
          title: 'Enrolled!',
          description: 'Payment received — the course is unlocked. Happy learning!',
        });
        setEnrollDialogOpen(false);
        window.location.reload();
      } else if (result.status === 'failed') {
        toast({
          title: 'Payment failed',
          description: result.error ?? 'You have not been charged.',
          variant: 'destructive',
        });
      }
    } finally {
      setPayingOnline(false);
    }
  };
  const [paymentReference, setPaymentReference] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  // Prefilled from the browser locale, so most learners never open the dropdown.
  const [billingCountry, setBillingCountry] = useState<string>(() => guessCountry());
  const [billingState, setBillingState] = useState<string>('');

  /** The clip of what this course actually builds, if there is one for it. */
  const courseClip = clipForCourse(course?.title);

  /**
   * The code the buyer writes in the payment note, so a line on the bank statement can be
   * matched to exactly one enrolment.
   *
   * course.payment_reference_code already existed, but it is per-COURSE — every ADAS buyer
   * was told to send "ADAS_COURSE_2026", which identifies the course and not the person.
   * With two courses priced identically, that is not enough to reconcile a payment at all.
   *
   * Derived from the user and course ids rather than random, so it is the same every time
   * they open the page — they may pay now and submit the form ten minutes later.
   */
  const paymentCode =
    authUser && course
      ? `KG-${authUser.id.replace(/-/g, '').slice(0, 4).toUpperCase()}-${course.id.replace(/-/g, '').slice(0, 4).toUpperCase()}`
      : '';

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

    if (!billingCountry) {
      toast({
        title: 'Country required',
        description: 'We need your country to issue a valid invoice.',
        variant: 'destructive',
      });
      return;
    }

    // The UTR is the only thing that ties a line on the bank statement to this person. It
    // used to be optional, and the receipt was optional too — so an enrolment could arrive
    // with nothing but a name, and the payment behind it could never be identified.
    if (!paymentReference.trim() && !receiptFile) {
      toast({
        title: 'Payment proof required',
        description:
          'Enter your transaction/UTR number, or upload the payment receipt, so we can match your payment.',
        variant: 'destructive',
      });
      return;
    }

    // Without the buyer's state we cannot tell CGST+SGST from IGST, and the invoice we
    // issue would not be a valid tax invoice.
    if (regionForCountry(billingCountry) === 'india' && !billingState) {
      toast({
        title: 'State required',
        description: 'Please select your state — it decides the GST breakdown on your invoice.',
        variant: 'destructive',
      });
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

      // billing_country/_region are recorded at the point of sale, the only moment
      // the buyer's location is actually knowable.
      // The price on screen at the moment of enrolment is the price agreed. Recording it
      // means a later price change cannot invoice someone for more than they actually paid.
      const isIndia = regionForCountry(billingCountry) === 'india';

      const base = {
        user_id: authUser.id,
        course_id: course.id,
        payment_reference: paymentReference || null,
        payment_receipt_url: receiptUrl,
        payment_code: paymentCode,
        amount_paid: isIndia ? course.price_india : course.price_international,
        currency: isIndia ? 'INR' : 'EUR',
        status: 'pending' as const,
      };

      let { error: enrollError } = await supabase.from('enrollments').insert({
        ...base,
        billing_country: billingCountry,
        billing_region: regionForCountry(billingCountry),
        billing_state: regionForCountry(billingCountry) === 'india' ? billingState : null,
      });

      // PGRST204 = the column is not in the schema cache, i.e. the invoicing
      // migration has not been applied to this database yet. An enrollment is a
      // sale; it must never fail because a nice-to-have column is missing. Retry
      // without the billing fields, and start capturing them automatically once
      // the migration lands.
      if (enrollError && (enrollError as { code?: string }).code === 'PGRST204') {
        console.warn('enrollments.billing_country missing; enrolling without it.');
        ({ error: enrollError } = await supabase.from('enrollments').insert(base));
      }

      if (enrollError) {
        throw enrollError;
      }

      toast({
        title: 'Enrollment submitted!',
        description: 'Your enrollment is pending approval. We\'ll notify you once approved.',
      });

      setEnrollDialogOpen(false);
      setReceiptFile(null);
      setPaymentReference('');
      fetchCourseData();

      // Do not redirect while enrollment is still pending approval.
      // The admin must approve the payment receipt before access is granted.
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
                  {/* floor, not round: 2012 minutes is 33h 32m, and Math.round showed it as 34h 32m. */}
                  <span>{Math.floor(totalDuration / 60)}h {totalDuration % 60}m</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg">
                  <Play className="w-5 h-5 text-primary" />
                  <span>{learningPaths.length} Modules</span>
                </div>
              </div>

              {/*
                What they will actually have built by the end, shown running. It goes above
                the syllabus deliberately: a list of module titles is an argument you have to
                read, and a planner choosing a trajectory is one you don't.
              */}
              {courseClip && (
                <figure className="my-8 overflow-hidden rounded-2xl border bg-card shadow-lg">
                  <div className="bg-slate-950">
                    {courseClip.isVideo ? (
                      <video
                        src={courseClip.url}
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="metadata"
                        className="h-auto w-full"
                        aria-label={courseClip.title}
                      />
                    ) : (
                      <img
                        src={courseClip.url}
                        alt={courseClip.title}
                        loading="lazy"
                        className="h-auto w-full"
                      />
                    )}
                  </div>
                  <figcaption className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                      You build this
                    </p>
                    <h3 className="mt-1.5 text-lg font-semibold">{courseClip.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {courseClip.caption}
                    </p>
                  </figcaption>
                </figure>
              )}

              {/* The structured syllabus. This used to be a whitespace-pre-wrap dump of a
                  text field, which is how internal notes ("🔹 Module 0 — Foundations…")
                  ended up rendered at prospective buyers. */}
              <CourseSyllabus syllabus={(course as { syllabus?: unknown }).syllabus as never} />

              {/* The course as a graph. A syllabus is a list, and a list does not say
                  why module 7 follows module 6 — this shows the chain from foundations
                  through to the capstone, so a buyer can see the shape of the thing. */}
              {learningPaths.length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle>How it fits together</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Each module builds on the one before it. This is the path.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <LearningGraph
                      nodes={learningPaths.map((p) => ({
                        id: p.id,
                        title: p.title,
                        total: p.capsules.length,
                      }))}
                    />
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
                        <Euro className="w-5 h-5" />
                        <span className="text-sm text-muted-foreground">International</span>
                      </div>
                      <span className="text-2xl font-bold">€{course.price_international || 0}</span>
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
                    <div className="space-y-4">
                      {/* Payment Required Notice */}
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                          <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">
                            Payment Required Before Enrollment
                          </h4>
                        </div>
                        <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                          <li>• Secure payment via Razorpay — card, UPI, netbanking</li>
                          <li>• International cards supported</li>
                          <li>• Access unlocks instantly after payment</li>
                        </ul>
                      </div>

                      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
                        <DialogTrigger asChild>
                          <Button className="w-full" size="lg">
                            Pay & Enroll Now
                          </Button>
                        </DialogTrigger>
                      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
                        <DialogHeader>
                          <DialogTitle>Complete Payment & Enroll</DialogTitle>
                          <DialogDescription>
                            Pay securely with card, UPI or netbanking — your enrollment
                            unlocks the moment the payment succeeds.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto space-y-4">
                          {/*
                            Shown BEFORE the payment details, because it only helps if they
                            read it before they pay. Without a per-buyer code in the note, a
                            UPI credit on the bank statement is a name and an amount — and
                            with two courses at the same price, that does not identify anyone.
                          */}
                          {/* Billing country: decides the invoice's tax region. */}
                          <div className="space-y-2">
                            <Label htmlFor="billingCountry">Billing Country *</Label>
                            <Select value={billingCountry} onValueChange={setBillingCountry}>
                              <SelectTrigger id="billingCountry">
                                <SelectValue placeholder="Select your country" />
                              </SelectTrigger>
                              <SelectContent className="max-h-64">
                                {COUNTRIES.map((c) => (
                                  <SelectItem key={c.code} value={c.code}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              {billingCountry
                                ? regionForCountry(billingCountry) === 'india'
                                  ? 'Billed in INR. Used on your invoice.'
                                  : 'Billed in EUR. Used on your invoice.'
                                : 'Required so we can issue a valid invoice.'}
                            </p>
                          </div>

                          {/*
                            The place of supply. For an online course sold to an unregistered
                            person, GST is decided by the buyer's state: Maharashtra pays
                            CGST + SGST, anywhere else in India pays IGST. It cannot be worked
                            out after the sale, so the form has to ask — and without it the
                            invoice is not a valid tax invoice.
                          */}
                          {regionForCountry(billingCountry) === 'india' && (
                            <div className="space-y-2">
                              <Label htmlFor="billingState">State *</Label>
                              <Select value={billingState} onValueChange={setBillingState}>
                                <SelectTrigger id="billingState">
                                  <SelectValue placeholder="Select your state" />
                                </SelectTrigger>
                                <SelectContent className="max-h-64">
                                  {INDIAN_STATES.map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {s}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                Your place of supply. It decides the GST breakdown on your invoice.
                              </p>
                            </div>
                          )}

                        </div>

                        <div className="mt-auto pt-4 border-t space-y-4">
                          <Button
                            onClick={handlePayOnline}
                            disabled={payingOnline || !authUser}
                            className="w-full"
                          >
                            {payingOnline ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Opening secure checkout…
                              </>
                            ) : (
                              'Pay online — card / UPI (instant access)'
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
                    </div>
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

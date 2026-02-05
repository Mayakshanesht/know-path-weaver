import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getCourseBySlug, PAYMENT_DETAILS, COURSES } from '@/data/courses';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/layout/Navbar';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  CheckCircle2,
  IndianRupee,
  Euro,
  BookOpen,
  Upload,
  Copy,
  Loader2,
  Sparkles,
  GraduationCap,
  AlertCircle,
  Mail,
  MessageCircle,
  Lock,
} from 'lucide-react';

export default function MarketingCourseDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { authUser } = useAuth();
  const { toast } = useToast();

  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [dbCourseId, setDbCourseId] = useState<string | null>(null);

  const course = slug ? getCourseBySlug(slug) : undefined;

  // Check if user is already enrolled
  useEffect(() => {
    const checkEnrollmentStatus = async () => {
      if (!authUser || !course) return;
      
      // Find the course in DB by title
      const { data: dbCourse } = await supabase
        .from('courses')
        .select('id')
        .eq('title', course.title)
        .maybeSingle();
      
      if (dbCourse) {
        setDbCourseId(dbCourse.id);
        
        // Check enrollment
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('status')
          .eq('user_id', authUser.id)
          .eq('course_id', dbCourse.id)
          .maybeSingle();
        
        if (enrollment) {
          setEnrollmentStatus(enrollment.status);
          if (enrollment.status === 'pending') {
            setEnrolled(true);
          }
        }
      }
    };
    
    checkEnrollmentStatus();
  }, [authUser, course]);

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Course not found</h1>
            <Button asChild>
              <Link to="/">Back to Courses</Link>
            </Button>
          </div>
        </main>
        <MarketingFooter />
      </div>
    );
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied!` });
  };

  const handleEnroll = async () => {
    if (!authUser) {
      navigate('/signup');
      return;
    }

    if (!paymentReference.trim()) {
      toast({
        title: 'Payment reference required',
        description: 'Please enter your transaction ID or UTR number.',
        variant: 'destructive',
      });
      return;
    }

    setEnrolling(true);

    try {
      let receiptUrl = null;

      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${authUser.id}/${course.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('payment-receipts')
          .upload(fileName, receiptFile);

        if (uploadError) throw new Error('Failed to upload receipt');

        const { data: urlData } = supabase.storage
          .from('payment-receipts')
          .getPublicUrl(fileName);

        receiptUrl = urlData.publicUrl;
      }

      // Check if course exists in DB, if not we'll create enrollment with course_id as slug
      // For now, just create enrollment with a generated ID
      const { data: existingCourse } = await supabase
        .from('courses')
        .select('id')
        .eq('title', course.title)
        .maybeSingle();

      const courseId = existingCourse?.id;

      if (!courseId) {
        // Course doesn't exist in DB - this shouldn't happen for live courses
        // But admin may need to create it first
        toast({
          title: 'Course not available',
          description: 'This course is not yet available for enrollment. Please contact support.',
          variant: 'destructive',
        });
        setEnrolling(false);
        return;
      } else {
        // Check if already enrolled
        const { data: existingEnrollment } = await supabase
          .from('enrollments')
          .select('id, status')
          .eq('user_id', authUser.id)
          .eq('course_id', courseId)
          .maybeSingle();
        
        if (existingEnrollment) {
          toast({
            title: 'Already enrolled',
            description: `You're already enrolled in this course. Status: ${existingEnrollment.status}`,
            variant: 'default',
          });
          setEnrollmentStatus(existingEnrollment.status);
          setEnrolled(true);
          setEnrolling(false);
          setEnrollDialogOpen(false);
          return;
        }
        
        const { error: enrollError } = await supabase.from('enrollments').insert({
          user_id: authUser.id,
          course_id: courseId,
          payment_reference: paymentReference,
          payment_receipt_url: receiptUrl,
          status: 'pending',
        });

        if (enrollError) throw enrollError;
        
        setDbCourseId(courseId);
      }

      setEnrolled(true);
      setEnrollmentStatus('pending');
      toast({
        title: 'Enrollment submitted!',
        description: 'Your payment is pending verification.',
      });
      setEnrollDialogOpen(false);
    } catch (error: any) {
      toast({
        title: 'Enrollment failed',
        description: error.message,
        variant: 'destructive',
      });
    }

    setEnrolling(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4">
          <Link
            to="/"
            className="inline-flex items-center text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Courses
          </Link>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <motion.div
              className="lg:col-span-2 space-y-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Header */}
              <div>
                <Badge variant="outline" className="mb-4">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Powered by KnowGraph Capsules
                </Badge>
                <h1 className="text-3xl md:text-4xl font-bold mb-4">
                  {course.emoji} {course.title}
                </h1>
                <p className="text-lg text-muted-foreground whitespace-pre-line">
                  {course.fullDescription}
                </p>
              </div>

              {/* Domain tags */}
              <div className="flex flex-wrap gap-2">
                {course.domains.map((domain) => (
                  <Badge key={domain} variant="secondary">
                    {domain}
                  </Badge>
                ))}
              </div>

              {/* Curriculum */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    Curriculum Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {course.curriculum.map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-sm font-medium mt-0.5">
                          {i + 1}
                        </div>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Payment Instructions */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Instructions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 bg-secondary rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Account Name</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{PAYMENT_DETAILS.accountName}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(PAYMENT_DETAILS.accountName, 'Account name')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Account Holder</span>
                      <span className="font-medium">{PAYMENT_DETAILS.accountHolder}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Bank</span>
                      <span className="font-medium text-right text-sm">{PAYMENT_DETAILS.bank}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Branch</span>
                      <span className="font-medium">{PAYMENT_DETAILS.branch}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Account Number</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{PAYMENT_DETAILS.accountNumber}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(PAYMENT_DETAILS.accountNumber, 'Account number')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">IFSC Code</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{PAYMENT_DETAILS.ifsc}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(PAYMENT_DETAILS.ifsc, 'IFSC')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-accent/10 border border-accent/30 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Payment Reference</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-bold text-accent">{course.paymentReference}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(course.paymentReference, 'Reference')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Include this reference in your payment description
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 text-sm">
                    <a
                      href={`mailto:${PAYMENT_DETAILS.email}`}
                      className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      {PAYMENT_DETAILS.email}
                    </a>
                    <a
                      href={`https://wa.me/${PAYMENT_DETAILS.whatsapp.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      {PAYMENT_DETAILS.whatsapp}
                    </a>
                  </div>
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
                      <span className="text-3xl font-bold">₹{course.priceIndia.toLocaleString()}</span>
                    </div>
                    {course.priceInternational && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Euro className="w-5 h-5" />
                          <span className="text-sm text-muted-foreground">International</span>
                        </div>
                        <span className="text-2xl font-bold">€{course.priceInternational}</span>
                      </div>
                    )}
                  </div>

                  {enrolled ? (
                    <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg">
                      <div className="flex items-center gap-2 text-warning mb-2">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-semibold">Pending Verification</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Your enrollment is pending. You'll get access once payment is verified.
                      </p>
                    </div>
                  ) : (
                    <Button
                      size="lg"
                      className="w-full"
                      onClick={() => setEnrollDialogOpen(true)}
                    >
                      {authUser ? 'Enroll Now / Proceed to Payment' : 'Join Beta to Access'}
                    </Button>
                  )}

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BookOpen className="w-4 h-4" />
                    <span>{course.curriculum.length} lectures/modules</span>
                  </div>

                  <Badge variant="secondary" className="w-full justify-center py-2">
                    Beta Access
                  </Badge>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>
      <MarketingFooter />

      {/* Enrollment Dialog */}
      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Your Enrollment</DialogTitle>
            <DialogDescription>
              Upload your payment receipt to complete enrollment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!authUser ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">
                  Please sign in or create an account to enroll.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" asChild>
                    <Link to="/login">Sign In</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/signup">Create Account</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-3 bg-accent/10 border border-accent/30 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Payment Reference</p>
                  <p className="font-mono text-lg font-bold">{course.paymentReference}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentRef">Your Transaction ID / UTR *</Label>
                  <Input
                    id="paymentRef"
                    placeholder="Enter your transaction ID"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    required
                  />
                </div>

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
                          <span className="text-sm">{receiptFile.name}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Upload className="w-6 h-6" />
                          <span className="text-sm">Upload receipt</span>
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

                <p className="text-xs text-center text-muted-foreground">
                  Access will be granted after payment verification
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

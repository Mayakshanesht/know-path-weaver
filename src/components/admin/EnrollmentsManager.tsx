import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EnrollmentWithUserAndCourse } from '@/types/database';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Eye,
  Search,
  CheckSquare,
  Square,
  UserMinus,
} from 'lucide-react';
import { format } from 'date-fns';

/** What api/verify-receipt.ts reads off the uploaded image, and how it compared. */
interface ReceiptCheckResult {
  verdict: 'consistent' | 'check_manually' | 'needs_attention';
  passed: number;
  total: number;
  extracted: {
    amount: number | null;
    currency: string | null;
    transaction_id: string | null;
    paid_on: string | null;
    payee: string | null;
    note: string | null;
    notes: string | null;
  };
  checks: Record<string, { ok: boolean; detail: string }>;
}

/**
 * Shows what the model read off the receipt, and where it disagrees with the buyer.
 *
 * It deliberately never says "approved". A screenshot is not proof of payment — it takes
 * minutes to fake one, and a ₹19,999 course is worth faking. The strongest thing this can
 * honestly report is that nothing looked wrong, which is not the same as the money arriving.
 * The bank statement is the only thing that proves that.
 */
function ReceiptCheck({ check }: { check: ReceiptCheckResult }) {
  const tone =
    check.verdict === 'needs_attention'
      ? 'border-destructive/50 bg-destructive/5'
      : check.verdict === 'consistent'
        ? 'border-success/50 bg-success/5'
        : 'border-amber-500/50 bg-amber-500/5';

  const headline =
    check.verdict === 'needs_attention'
      ? 'Something is wrong — do not approve without checking'
      : check.verdict === 'consistent'
        ? 'Nothing looked wrong'
        : 'Check this one by hand';

  const e = check.extracted;

  return (
    <div className={`rounded-lg border p-3 text-sm ${tone}`}>
      <p className="font-semibold">
        {headline}{' '}
        <span className="font-normal text-muted-foreground">
          ({check.passed}/{check.total} checks passed)
        </span>
      </p>

      <ul className="mt-2 space-y-1">
        {Object.entries(check.checks).map(([key, c]) => (
          <li key={key} className="flex items-start gap-2">
            {c.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            )}
            <span className="text-muted-foreground">{c.detail}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
        <span>Amount read: <strong>{e.amount ?? '—'}</strong> {e.currency ?? ''}</span>
        <span>Transaction: <strong>{e.transaction_id ?? '—'}</strong></span>
        <span>Paid on: <strong>{e.paid_on ?? '—'}</strong></span>
        <span>Payee: <strong>{e.payee ?? '—'}</strong></span>
        {e.note && <span className="col-span-2">Note: <strong>{e.note}</strong></span>}
        {e.notes && <span className="col-span-2 text-amber-600">⚠ {e.notes}</span>}
      </div>

      <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">
        A screenshot can be faked. Confirm the amount and UTR against your bank statement
        before approving — this only tells you what to look for.
      </p>
    </div>
  );
}


export default function EnrollmentsManager() {
  const { toast } = useToast();
  const [enrollments, setEnrollments] = useState<EnrollmentWithUserAndCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEnrollment, setSelectedEnrollment] = useState<EnrollmentWithUserAndCourse | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [selectedEnrollments, setSelectedEnrollments] = useState<string[]>([]);
  const [checkingReceipt, setCheckingReceipt] = useState(false);

  /**
   * Reads the uploaded receipt and cross-checks it. Advisory only — it never approves.
   */
  const verifyReceipt = async (enrollmentId: string) => {
    setCheckingReceipt(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch('/api/verify-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session?.access_token}`,
        },
        body: JSON.stringify({ enrollment_id: enrollmentId }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not read the receipt.');

      // Reflect it immediately, and keep the list in step.
      setSelectedEnrollment((prev) =>
        prev && prev.id === enrollmentId ? { ...prev, receipt_check: body } : prev
      );
      await fetchEnrollments();

      toast({
        title:
          body.verdict === 'needs_attention'
            ? 'The receipt does not add up'
            : body.verdict === 'consistent'
              ? 'Nothing looked wrong'
              : 'Check this one by hand',
        description: `${body.passed}/${body.total} checks passed. Confirm against your bank statement before approving.`,
        variant: body.verdict === 'needs_attention' ? 'destructive' : 'default',
      });
    } catch (error) {
      toast({
        title: 'Could not read the receipt',
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setCheckingReceipt(false);
    }
  };
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    fetchEnrollments();
  }, []);

  const fetchEnrollments = async () => {
    const { data, error } = await supabase
      .from('enrollments')
      .select('*, courses(*)')
      .order('enrolled_at', { ascending: false });

    if (error) {
      console.error('Error fetching enrollments:', error);
      setLoading(false);
      return;
    }

    // Fetch profiles separately
    const userIds = [...new Set((data || []).map(e => e.user_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', userIds);

    const profilesMap = new Map((profilesData || []).map(p => [p.user_id, p]));

    const enrichedData = (data || []).map(e => ({
      ...e,
      profiles: profilesMap.get(e.user_id) || null,
    }));

    setEnrollments(enrichedData as any);
    setLoading(false);
  };

  /**
   * The admin has seen the money on the bank statement. THIS is what issues the invoice —
   * not access, and never the receipt OCR.
   */
  const handleConfirmPayment = async (enrollmentId: string) => {
    setProcessing(true);
    const { error } = await supabase
      .from('enrollments')
      .update({
        payment_confirmed: true,
        payment_confirmed_at: new Date().toISOString(),
        status: 'approved',
        approved_at: new Date().toISOString(),
        admin_notes: adminNotes || null,
      })
      .eq('id', enrollmentId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'Payment confirmed',
        description: 'The invoice has been issued and is downloadable by the learner.',
      });
      setSelectedEnrollment(null);
      setAdminNotes('');
      fetchEnrollments();
    }
    setProcessing(false);
  };

  /**
   * The money never arrived. Take the access back.
   *
   * Only reachable for enrolments whose payment was never confirmed, so this can never pull
   * the rug from under someone who genuinely paid.
   */
  const handleRevoke = async (enrollmentId: string) => {
    setProcessing(true);
    const { error } = await supabase
      .from('enrollments')
      .update({
        status: 'rejected',
        admin_notes: adminNotes || 'Revoked: payment never arrived.',
      })
      .eq('id', enrollmentId)
      .eq('payment_confirmed', false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Access revoked', description: 'They can no longer open the course.' });
      setSelectedEnrollment(null);
      setAdminNotes('');
      fetchEnrollments();
    }
    setProcessing(false);
  };

  const handleApprove = async (enrollmentId: string) => {
    setProcessing(true);

    const { error } = await supabase
      .from('enrollments')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        payment_confirmed: true,
        payment_confirmed_at: new Date().toISOString(),
        admin_notes: adminNotes || null,
      })
      .eq('id', enrollmentId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Enrollment approved!' });
      setSelectedEnrollment(null);
      setAdminNotes('');
      fetchEnrollments();
    }

    setProcessing(false);
  };

  const handleReject = async (enrollmentId: string) => {
    if (!adminNotes.trim()) {
      toast({
        title: 'Notes required',
        description: 'Please provide a reason for rejection.',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);

    const { error } = await supabase
      .from('enrollments')
      .update({
        status: 'rejected',
        admin_notes: adminNotes,
      })
      .eq('id', enrollmentId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Enrollment rejected' });
      setSelectedEnrollment(null);
      setAdminNotes('');
      fetchEnrollments();
    }

    setProcessing(false);
  };

  const handleBulkApprove = async () => {
    if (selectedEnrollments.length === 0) {
      toast({
        title: 'No selections',
        description: 'Please select enrollments to approve.',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);

    const { error } = await supabase
      .from('enrollments')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .in('id', selectedEnrollments);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${selectedEnrollments.length} enrollments approved!` });
      setSelectedEnrollments([]);
      fetchEnrollments();
    }

    setProcessing(false);
  };

  const handleSelectEnrollment = (enrollmentId: string, checked: boolean) => {
    if (checked) {
      setSelectedEnrollments([...selectedEnrollments, enrollmentId]);
    } else {
      setSelectedEnrollments(selectedEnrollments.filter(id => id !== enrollmentId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEnrollments(filteredEnrollments.filter(e => e.status === 'pending').map(e => e.id));
    } else {
      setSelectedEnrollments([]);
    }
  };

  const handleRemoveStudent = async (enrollmentId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to remove ${studentName} from this course? This action cannot be undone.`)) {
      return;
    }

    setProcessing(true);

    const { error } = await supabase
      .from('enrollments')
      .delete()
      .eq('id', enrollmentId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove student from course.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Student Removed',
        description: `${studentName} has been removed from the course.`,
      });
      setSelectedEnrollment(null);
      fetchEnrollments(); // Refresh the enrollments list
    }

    setProcessing(false);
  };

  const filteredEnrollments = enrollments.filter((e) => {
    const searchLower = search.toLowerCase();
    return (
      e.profiles?.full_name?.toLowerCase().includes(searchLower) ||
      e.courses?.title?.toLowerCase().includes(searchLower) ||
      e.payment_reference?.toLowerCase().includes(searchLower)
    );
  });

  const pending = filteredEnrollments.filter((e) => e.status === 'pending');
  const approved = filteredEnrollments.filter((e) => e.status === 'approved');
  const rejected = filteredEnrollments.filter((e) => e.status === 'rejected');

  /*
    Access granted by the receipt OCR, money not yet seen on the bank statement. These are the
    ones that can still cost you: a forged screenshot lands here and stays here until someone
    looks. No invoice has been issued for any of them.
  */
  const unreconciled = enrollments.filter((e) => e.status === 'approved' && !e.payment_confirmed);

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-success/10 text-success">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-warning/10 text-warning">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const EnrollmentTable = ({ items, showBulkActions = false }: { items: EnrollmentWithUserAndCourse[]; showBulkActions?: boolean }) => (
    <Table>
      <TableHeader>
        <TableRow>
          {showBulkActions && (
            <TableHead className="w-12">
              <Checkbox
                checked={selectedEnrollments.length === items.filter(e => e.status === 'pending').length && items.filter(e => e.status === 'pending').length > 0}
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
          )}
          <TableHead>Student</TableHead>
          <TableHead>Course</TableHead>
          <TableHead>Payment Ref</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={showBulkActions ? 7 : 6} className="text-center text-muted-foreground py-8">
              No enrollments found
            </TableCell>
          </TableRow>
        ) : (
          items.map((enrollment) => (
            <TableRow key={enrollment.id}>
              {showBulkActions && (
                <TableCell>
                  {enrollment.status === 'pending' && (
                    <Checkbox
                      checked={selectedEnrollments.includes(enrollment.id)}
                      onCheckedChange={(checked) => handleSelectEnrollment(enrollment.id, checked as boolean)}
                    />
                  )}
                </TableCell>
              )}
              <TableCell className="font-medium">
                {enrollment.profiles?.full_name || 'Unknown'}
              </TableCell>
              <TableCell>{enrollment.courses?.title || 'Unknown'}</TableCell>
              <TableCell className="font-mono text-sm">
                {enrollment.payment_reference || '-'}
              </TableCell>
              <TableCell>{format(new Date(enrollment.enrolled_at), 'MMM d, yyyy')}</TableCell>
              <TableCell>
                <StatusBadge status={enrollment.status} />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedEnrollment(enrollment);
                    setAdminNotes(enrollment.admin_notes || '');
                  }}
                >
                  <Eye className="w-4 h-4" />
                </Button>
                {enrollment.status === 'approved' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveStudent(
                      enrollment.id,
                      enrollment.profiles?.full_name || 'Unknown'
                    )}
                    disabled={processing}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <UserMinus className="w-4 h-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

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
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
        <h2 className="text-xl font-semibold">Manage Enrollments</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/*
        The reminder. These learners are already inside the course because their receipt read
        clean — but nobody has seen the money yet, and no invoice has been issued. This is the
        list that has to reach zero, and the only thing that empties it is the bank statement.
      */}
      {unreconciled.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="py-4">
            <p className="font-semibold">
              {unreconciled.length} learner{unreconciled.length > 1 ? 's have' : ' has'} access,
              but the payment is not confirmed
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Their receipt looked right, so access was granted automatically and they are
              studying now. No invoice has been issued. Check these against your bank statement:{' '}
              <strong>confirm</strong> the ones that arrived (that issues the invoice), and{' '}
              <strong>revoke</strong> any that never did.
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              {unreconciled.slice(0, 8).map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setSelectedEnrollment(e)}
                    className="font-medium text-primary hover:underline"
                  >
                    {e.profiles?.full_name || 'Unknown'}
                  </button>
                  <span className="text-muted-foreground">{e.courses?.title}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {e.currency} {e.amount_paid != null ? Number(e.amount_paid).toLocaleString() : '—'}
                  </span>
                  {e.payment_code && (
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {e.payment_code}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {selectedEnrollments.length > 0 && (
        <Card className="border-primary">
          <CardContent className="py-4 flex items-center justify-between">
            <span className="text-sm">
              {selectedEnrollments.length} enrollment{selectedEnrollments.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button
                onClick={handleBulkApprove}
                disabled={processing}
                size="sm"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Approve Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedEnrollments([])}
              >
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">
                Pending ({pending.length})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved ({approved.length})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected ({rejected.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4">
              <EnrollmentTable items={pending} showBulkActions={true} />
            </TabsContent>

            <TabsContent value="approved" className="mt-4">
              <EnrollmentTable items={approved} showBulkActions={false} />
            </TabsContent>

            <TabsContent value="rejected" className="mt-4">
              <EnrollmentTable items={rejected} showBulkActions={false} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Enrollment Detail Dialog */}
      <Dialog open={!!selectedEnrollment} onOpenChange={() => setSelectedEnrollment(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enrollment Details</DialogTitle>
            <DialogDescription>
              Review and manage enrollment information and payment status.
            </DialogDescription>
          </DialogHeader>

          {selectedEnrollment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Student</p>
                  <p className="font-medium">{selectedEnrollment.profiles?.full_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Course</p>
                  <p className="font-medium">{selectedEnrollment.courses?.title}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">UTR / Transaction</p>
                  <p className="font-mono">{selectedEnrollment.payment_reference || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Their payment code</p>
                  <p className="font-mono">{selectedEnrollment.payment_code || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount they were charged</p>
                  <p className="font-medium">
                    {selectedEnrollment.amount_paid != null
                      ? `${selectedEnrollment.currency ?? ''} ${Number(selectedEnrollment.amount_paid).toLocaleString()}`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Enrolled At</p>
                  <p>{format(new Date(selectedEnrollment.enrolled_at), 'MMM d, yyyy h:mm a')}</p>
                </div>
              </div>

              {selectedEnrollment.payment_receipt_url && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Payment Receipt</p>
                    <div className="flex items-center gap-3">
                      <a
                        href={selectedEnrollment.payment_receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        View <ExternalLink className="w-4 h-4" />
                      </a>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={checkingReceipt}
                        onClick={() => verifyReceipt(selectedEnrollment.id)}
                      >
                        {checkingReceipt ? 'Reading…' : 'Read the receipt'}
                      </Button>
                    </div>
                  </div>

                  {selectedEnrollment.receipt_check && (
                    <ReceiptCheck check={selectedEnrollment.receipt_check as ReceiptCheckResult} />
                  )}
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-2">Status</p>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selectedEnrollment.status} />
                  {selectedEnrollment.auto_approved && !selectedEnrollment.payment_confirmed && (
                    <Badge className="bg-amber-500/10 text-amber-600">Access granted by receipt</Badge>
                  )}
                  {selectedEnrollment.payment_confirmed ? (
                    <Badge className="bg-success/10 text-success">Payment confirmed · invoiced</Badge>
                  ) : (
                    <Badge variant="outline">Payment not confirmed · no invoice</Badge>
                  )}
                </div>
              </div>

              {/*
                Access granted (usually by the receipt OCR), money not yet seen. Confirm issues
                the invoice; revoke takes the course back. Revoke is only ever offered while the
                payment is unconfirmed, so it can never be used on someone who genuinely paid.
              */}
              {selectedEnrollment.status === 'approved' && !selectedEnrollment.payment_confirmed && (
                <div className="space-y-3 rounded-lg border border-amber-500/50 bg-amber-500/5 p-3">
                  <p className="text-sm">
                    They are already studying. Check your bank statement for{' '}
                    <strong>
                      {selectedEnrollment.currency}{' '}
                      {selectedEnrollment.amount_paid != null
                        ? Number(selectedEnrollment.amount_paid).toLocaleString()
                        : '—'}
                    </strong>
                    {selectedEnrollment.payment_code && (
                      <>
                        {' '}
                        with the note{' '}
                        <strong className="font-mono">{selectedEnrollment.payment_code}</strong>
                      </>
                    )}
                    .
                  </p>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Optional note…"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleConfirmPayment(selectedEnrollment.id)}
                      disabled={processing}
                      className="flex-1"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      The money arrived — issue the invoice
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleRevoke(selectedEnrollment.id)}
                      disabled={processing}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Revoke
                    </Button>
                  </div>
                </div>
              )}

              {selectedEnrollment.status === 'pending' && (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Admin Notes</p>
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add notes (required for rejection)"
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(selectedEnrollment.id)}
                      disabled={processing}
                      className="flex-1"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleReject(selectedEnrollment.id)}
                      disabled={processing}
                      className="flex-1"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </>
              )}

              {selectedEnrollment.admin_notes && selectedEnrollment.status !== 'pending' && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Admin Notes</p>
                  <p className="text-sm bg-muted p-3 rounded">{selectedEnrollment.admin_notes}</p>
                </div>
              )}

              {selectedEnrollment.status === 'approved' && (
                <div className="pt-4 border-t">
                  <Button
                    variant="destructive"
                    onClick={() => handleRemoveStudent(
                      selectedEnrollment.id,
                      selectedEnrollment.profiles?.full_name || 'Unknown'
                    )}
                    disabled={processing}
                    className="w-full"
                  >
                    <UserMinus className="w-4 h-4 mr-2" />
                    Remove Student from Course
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

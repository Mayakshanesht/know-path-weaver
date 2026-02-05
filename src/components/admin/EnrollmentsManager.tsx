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

export default function EnrollmentsManager() {
  const { toast } = useToast();
  const [enrollments, setEnrollments] = useState<EnrollmentWithUserAndCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEnrollment, setSelectedEnrollment] = useState<EnrollmentWithUserAndCourse | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [selectedEnrollments, setSelectedEnrollments] = useState<string[]>([]);
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

  const handleApprove = async (enrollmentId: string) => {
    setProcessing(true);

    const { error } = await supabase
      .from('enrollments')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
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
      fetchData(); // Refresh the enrollments list
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
                  <p className="text-sm text-muted-foreground">Payment Reference</p>
                  <p className="font-mono">{selectedEnrollment.payment_reference || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Enrolled At</p>
                  <p>{format(new Date(selectedEnrollment.enrolled_at), 'MMM d, yyyy h:mm a')}</p>
                </div>
              </div>

              {selectedEnrollment.payment_receipt_url && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Payment Receipt</p>
                  <a
                    href={selectedEnrollment.payment_receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:underline"
                  >
                    View Receipt <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-2">Status</p>
                <StatusBadge status={selectedEnrollment.status} />
              </div>

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

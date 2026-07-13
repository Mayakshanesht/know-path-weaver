import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Users, BarChart3, FileQuestion, Receipt, Megaphone, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import MarketingManager from '@/components/admin/MarketingManager';
import CoursesManager from '@/components/admin/CoursesManager';
import EnrollmentsManager from '@/components/admin/EnrollmentsManager';
import ProgressViewer from '@/components/admin/ProgressViewer';
import QuizzesManager from '@/components/admin/QuizzesManager';
import InvoicesManager from '@/components/admin/InvoicesManager';

export default function AdminPanel() {
  /*
    A student who has paid and is waiting for approval is the most time-critical thing that
    happens on this platform, and until the notification email is configured nothing tells
    the admin it has happened. So the admin panel tells them, loudly, on every visit.
    Polling because it costs nothing at this scale and a missed realtime event here means a
    paying customer sitting locked out for a day.
  */
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const count = async () => {
      const { count: n } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      setPending(n ?? 0);
    };
    count();
    const t = setInterval(count, 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage courses, enrollments, and view student progress</p>
          </motion.div>

          {pending > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3"
            >
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
              <p className="text-sm">
                <span className="font-semibold">
                  {pending} {pending === 1 ? 'student is' : 'students are'} waiting for approval.
                </span>{' '}
                <span className="text-muted-foreground">
                  They have paid and cannot open their course until you approve them — check the
                  Enrollments tab.
                </span>
              </p>
            </motion.div>
          )}

          <Tabs defaultValue={pending > 0 ? 'enrollments' : 'courses'} className="space-y-6">
            <TabsList className="grid w-full max-w-3xl grid-cols-6">
              <TabsTrigger value="courses" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Courses</span>
              </TabsTrigger>
              <TabsTrigger value="enrollments" className="flex items-center gap-2 relative">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Enrollments</span>
                {pending > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black">
                    {pending}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="invoices" className="flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                <span className="hidden sm:inline">Invoices</span>
              </TabsTrigger>
              <TabsTrigger value="quizzes" className="flex items-center gap-2">
                <FileQuestion className="w-4 h-4" />
                <span className="hidden sm:inline">Quizzes</span>
              </TabsTrigger>
              <TabsTrigger value="marketing" className="flex items-center gap-2">
                <Megaphone className="w-4 h-4" />
                <span className="hidden sm:inline">Marketing</span>
              </TabsTrigger>
              <TabsTrigger value="progress" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Progress</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="courses">
              <CoursesManager />
            </TabsContent>

            <TabsContent value="enrollments">
              <EnrollmentsManager />
            </TabsContent>

            <TabsContent value="invoices">
              <InvoicesManager />
            </TabsContent>

            <TabsContent value="quizzes">
              <QuizzesManager />
            </TabsContent>

            <TabsContent value="marketing">
              <MarketingManager />
            </TabsContent>

            <TabsContent value="progress">
              <ProgressViewer />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}

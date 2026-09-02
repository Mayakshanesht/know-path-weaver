import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Course } from '@/types/database';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, ArrowRight, IndianRupee, Euro, Info, CreditCard, QrCode, Mail, Phone } from 'lucide-react';
import paymentQR from '@/assets/payment_qr_code_cropped.jpeg?url';
import CourseCover from '@/components/courses/CourseCover';

/** Course, plus the counts computed at fetch time from the nested rows. */
interface CourseWithCounts extends Course {
  modules_count: number;
  capsules_count: number;
  /** Total teaching time, in whole hours. */
  hours_count: number;
}

export default function Courses() {
  const [courses, setCourses] = useState<CourseWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const fallbackCourseImage = 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&q=80';

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('*, learning_paths(*, capsules(*))')
      .eq('is_published', true)
      // Deliberate order, not creation order. The catalogue is the shop window: the flagship
      // courses take row one (the grid is three wide), and the short or still-building ones
      // sit on row two. Ordering by created_at put Motion Planning — 2 lessons, early access
      // — above ADAS, which is the course that makes the case for all the others.
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching courses:', error);
    } else {
      // Normalize and include module/capsule counts
      const enriched: CourseWithCounts[] = (data || []).map((c: any) => ({
        ...c,
        modules_count: (c.learning_paths || []).length,
        capsules_count: (c.learning_paths || []).reduce(
          (acc: number, p: any) => acc + (p.capsules || []).length,
          0
        ),
        hours_count: Math.floor(
          (c.learning_paths || []).reduce(
            (acc: number, p: any) =>
              acc + (p.capsules || []).reduce((s: number, cap: any) => s + (cap.duration_minutes || 0), 0),
            0
          ) / 60
        ),
      }));
      setCourses(enriched);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 bg-slate-950 text-slate-50">
        <section className="relative overflow-hidden py-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.17),_transparent_20%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.16),_transparent_25%)]" />
          <div className="container mx-auto px-4 relative">
            <motion.div
              className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-slate-950/40 backdrop-blur-xl"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] items-center">
                <div>
                  <p className="inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-300 ring-1 ring-cyan-300/10">
                    <span className="h-2 w-2 rounded-full bg-cyan-300" />
                    Discover the latest courses
                  </p>
                  <h1 className="mt-6 text-5xl font-bold tracking-tight">Explore courses built for graph-powered learning.</h1>
                  <p className="mt-4 max-w-2xl text-lg text-slate-300">
                    Browse curated learning paths with clear outcomes, capsule counts, and real project focus.
                  </p>
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-slate-950/90 p-6">
                  <div className="text-sm uppercase tracking-[0.32em] text-slate-400">New this week</div>
                  <div className="mt-4 space-y-4">
                    <div className="rounded-3xl bg-slate-900/90 p-4 ring-1 ring-white/10">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-slate-400">AI Bootcamp</p>
                          <p className="mt-1 text-xl font-semibold text-white">Autonomous Driving</p>
                        </div>
                        <Badge variant="secondary">Featured</Badge>
                      </div>
                      <p className="mt-3 text-sm text-slate-400">A project-first course with capsule-based progression and complete learning paths.</p>
                    </div>
                    <div className="rounded-3xl bg-slate-900/90 p-4 ring-1 ring-white/10">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-slate-400">Launchpad</p>
                          <p className="mt-1 text-xl font-semibold text-white">ML Fundamentals</p>
                        </div>
                        <Badge variant="outline">Trending</Badge>
                      </div>
                      <p className="mt-3 text-sm text-slate-400">Hands-on modules for real-world machine learning applications.</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <div className="container mx-auto px-4">
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.04 }}
                >
                  <Card className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-900/90 shadow-lg">
                    <Skeleton className="h-48 w-full" />
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-full mt-2" />
                    </CardHeader>
                    <CardFooter>
                      <Skeleton className="h-10 w-full" />
                    </CardFooter>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : courses.length === 0 ? (
            <motion.div
              className="text-center py-16"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-2xl font-semibold mb-2">No courses yet</h2>
              <p className="text-muted-foreground">
                New courses are coming soon. Check back later!
              </p>
            </motion.div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course, i) => (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -6 }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                  >
                    <Card className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-900/90 shadow-2xl shadow-slate-950/20 transition duration-300 hover:border-cyan-400/30">
                      <div className="relative h-52 overflow-hidden">
                        {/* Drawn from the course's own subject. No stock photography:
                            a generic car photo says nothing and every competitor has it. */}
                        <CourseCover
                          title={course.title}
                          className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                        <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2">
                          <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-slate-100 backdrop-blur-sm">
                            {course.modules_count} modules
                          </span>
                          <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-slate-100 backdrop-blur-sm">
                            {course.capsules_count} lessons
                          </span>
                          {course.hours_count > 0 && (
                            <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-slate-100 backdrop-blur-sm">
                              {course.hours_count}h
                            </span>
                          )}
                        </div>
                      </div>

                      <CardHeader className="flex-1 pt-5">
                        <h3 className="text-2xl font-semibold leading-snug text-white">{course.title}</h3>
                        <p className="mt-3 text-sm leading-6 text-slate-400 line-clamp-3">{course.description || 'No description available'}</p>
                      </CardHeader>

                      <CardContent className="space-y-4 pt-0">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-3xl bg-slate-950/85 p-4 text-sm text-slate-300 ring-1 ring-white/5">
                            <div className="font-medium text-slate-100">Modules</div>
                            <div className="mt-2 text-lg font-semibold">{course.modules_count}</div>
                          </div>
                          <div className="rounded-3xl bg-slate-950/85 p-4 text-sm text-slate-300 ring-1 ring-white/5">
                            <div className="font-medium text-slate-100">Lessons</div>
                            <div className="mt-2 text-lg font-semibold">{course.capsules_count}</div>
                          </div>
                          <div className="rounded-3xl bg-slate-950/85 p-4 text-sm text-slate-300 ring-1 ring-white/5">
                            <div className="font-medium text-slate-100">Hours</div>
                            <div className="mt-2 text-lg font-semibold">
                              {course.hours_count > 0 ? `${course.hours_count}h` : '—'}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-3xl bg-slate-950/85 p-4 text-sm text-slate-300 ring-1 ring-white/5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-slate-100">Pricing</span>
                            <span className="text-slate-400">{course.is_published ? 'Live' : 'Draft'}</span>
                          </div>
                          <div className="mt-3 flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <IndianRupee className="w-4 h-4 text-cyan-300" />
                              <span className="font-semibold text-white">₹{course.price_india || 0}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Euro className="w-4 h-4 text-violet-300" />
                              <span className="font-semibold text-white">€{course.price_international || 0}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>

                      <CardFooter className="pt-0">
                        <Button asChild className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                          <Link to={`/courses/${course.id}`} className="inline-flex items-center justify-center gap-2">
                            View course
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
              ))}
            </div>
          )}
        </div>

      </main>
      <Footer />
    </div>
  );
}

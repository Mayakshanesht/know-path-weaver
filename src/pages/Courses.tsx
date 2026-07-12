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
import { BookOpen, Clock, IndianRupee, Euro, Info, CreditCard, QrCode, Mail, Phone } from 'lucide-react';
import paymentQR from '@/assets/payment-qr.png?url';
import aiThumb from '@/assets/thumbnails/ai-bootcamp.svg?url';
import mlThumb from '@/assets/thumbnails/ml-fundamentals.svg?url';
import roboticsThumb from '@/assets/thumbnails/robotics-projects.svg?url';

export default function Courses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('*, learning_paths(*, capsules(*))')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching courses:', error);
    } else {
      // Normalize and include module/capsule counts
      const enriched = (data || []).map((c: any) => ({
        ...c,
        modules_count: (c.learning_paths || []).length,
        capsules_count: (c.learning_paths || []).reduce((acc: number, p: any) => acc + (p.capsules || []).length, 0),
      }));
      setCourses(enriched || []);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl font-bold mb-4">Explore Courses</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose from our structured learning paths and start your journey
            </p>
          </motion.div>

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-48 w-full" />
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full mt-2" />
                  </CardHeader>
                  <CardFooter>
                    <Skeleton className="h-10 w-full" />
                  </CardFooter>
                </Card>
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
              {courses.map((course, i) => {
                const curatedMap: Record<string, string> = {
                  'AI Bootcamp for Autonomous Driving': aiThumb,
                  'ML Fundamentals': mlThumb,
                  'Robotics Projects': roboticsThumb,
                };
                const curated = curatedMap[course.title as string];

                return (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -6 }}
                    transition={{ duration: 0.6, delay: i * 0.06 }}
                  >
                    <Card className="overflow-hidden h-full flex flex-col transform-gpu will-change-transform hover:shadow-xl transition-shadow duration-300">
                      <div className="relative h-48 bg-gradient-to-br from-primary/20 to-accent/20 group overflow-hidden">
                        {course.thumbnail_url ? (
                          <img
                            src={course.thumbnail_url}
                            alt={course.title}
                            loading="lazy"
                            className="w-full h-full object-cover transform transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : curated ? (
                          <img src={curated} alt={course.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/12 to-accent/12">
                            <motion.svg width="140" height="120" viewBox="0 0 140 120" initial={{ scale: 0.98 }} animate={{ scale: [0.98, 1.02, 0.99] }} transition={{ duration: 6, repeat: Infinity }}>
                              <defs>
                                <linearGradient id={`cgrad-${i}`} x1="0" x2="1">
                                  <stop offset="0%" stopColor="#7c3aed" />
                                  <stop offset="100%" stopColor="#06b6d4" />
                                </linearGradient>
                              </defs>
                              <rect x="0" y="0" width="140" height="120" rx="10" fill={`url(#cgrad-${i})`} opacity="0.12" />
                              <motion.circle cx="30" cy="40" r="12" fill="#fff" animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity }} />
                              <motion.circle cx="110" cy="50" r="8" fill="#fff" animate={{ y: [0, 5, 0] }} transition={{ duration: 4, repeat: Infinity }} />
                              <circle cx="70" cy="85" r="10" fill="#fff" opacity="0.9" />
                              <text x="24" y="95" fontSize="28" fontWeight="700" fill="#fff">{String((course.title || 'KG').split(' ').map(s => s[0]).join('').slice(0,3))}</text>
                            </motion.svg>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-80" />
                        <Badge className="absolute top-3 left-3 bg-accent text-accent-foreground">Beta</Badge>
                        <div className="absolute bottom-3 right-3 bg-gradient-to-r from-black/40 to-transparent text-white text-xs px-3 py-1 rounded">Final Projects • {course.capsules_count ?? 0}</div>
                      </div>

                      <CardHeader className="flex-1">
                        <h3 className="text-xl font-semibold line-clamp-2">{course.title}</h3>
                        <p className="text-muted-foreground line-clamp-3 mt-2">{course.description || 'No description available'}</p>
                      </CardHeader>

                      <CardContent>
                        <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <IndianRupee className="w-4 h-4" />
                              <span className="font-medium">₹{course.price_india || 0}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Euro className="w-4 h-4" />
                              <span className="font-medium">€{course.price_international || 0}</span>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">{course.modules_count ?? 0} modules • {course.capsules_count ?? 0} capsules</div>
                        </div>

                        {(course.bank_details || course.payment_reference_code) && (
                          <div className="mt-4 rounded-lg border bg-muted/30 p-3 space-y-2">
                            {course.payment_reference_code && (
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="text-muted-foreground">Reference</span>
                                <span className="font-mono">{course.payment_reference_code}</span>
                              </div>
                            )}
                            {course.bank_details && (
                              <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">{course.bank_details}</p>
                            )}
                            <p className="text-xs text-muted-foreground">Pay first, then enroll from the course page.</p>
                          </div>
                        )}
                      </CardContent>

                      <CardFooter>
                        <Button asChild className="w-full">
                          <Link to={`/courses/${course.id}`}>View Course</Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment Information Section */}
        <motion.div
          className="mt-16 mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Card className="max-w-4xl mx-auto border-primary/20 bg-primary/5">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CreditCard className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold">Payment Information</h2>
              </div>
              <p className="text-muted-foreground">
                After payment, send confirmation to the details below
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Bank Details */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Bank Transfer Details
                  </h3>
                  <div className="bg-card p-4 rounded-lg border space-y-3">
                    <div>
                      <span className="font-medium">Account Name:</span>
                      <p className="text-sm text-muted-foreground">CloudBee Robotics</p>
                    </div>
                    <div>
                      <span className="font-medium">Account Holder:</span>
                      <p className="text-sm text-muted-foreground">Rajendra Dyandev Waghachoure</p>
                    </div>
                    <div>
                      <span className="font-medium">Bank:</span>
                      <p className="text-sm text-muted-foreground">Pune District Central Co-Op Bank Ltd., Pune</p>
                    </div>
                    <div>
                      <span className="font-medium">Branch:</span>
                      <p className="text-sm text-muted-foreground">Ranjangaon Sandas</p>
                    </div>
                    <div>
                      <span className="font-medium">Account Number:</span>
                      <p className="text-sm text-muted-foreground font-mono">183001600000130</p>
                    </div>
                    <div>
                      <span className="font-medium">IFSC:</span>
                      <p className="text-sm text-muted-foreground font-mono">HDFC0CPDCCB</p>
                    </div>
                    <div>
                      <span className="font-medium">Reference:</span>
                      <p className="text-sm text-muted-foreground font-mono">ADAS_COURSE_2025</p>
                    </div>
                  </div>
                </div>

                {/* QR Code Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <QrCode className="w-5 h-5" />
                    PhonePay QR Code
                  </h3>
                  <div className="bg-card p-6 rounded-lg border text-center">
                    <img 
                      src={paymentQR} 
                      alt="Payment QR Code" 
                      className="w-48 h-48 mx-auto mb-4 border rounded-lg"
                      onError={(e) => {
                        console.error('QR image failed to load', e);
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                    <p className="text-sm text-muted-foreground">
                      Scan to pay via PhonePay
                    </p>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-muted/30 p-4 rounded-lg border border-dashed">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  After Payment Contact
                </h4>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    <span>📧 mayurwaghchoure1995@gmail.com</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-primary" />
                    <span>📱 WhatsApp: +91 88305 79377</span>
                  </div>
                </div>
              </div>

              {/* Payment Instructions */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <h4 className="font-semibold mb-2 text-yellow-800 dark:text-yellow-200">
                  ⚠️ Important Instructions
                </h4>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  <li>• Complete payment before enrolling in any course</li>
                  <li>• Include your name and course name in payment reference</li>
                  <li>• Send payment confirmation to email or WhatsApp</li>
                  <li>• Keep payment receipt for verification</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}

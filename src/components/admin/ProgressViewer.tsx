import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Users, BookOpen } from 'lucide-react';
import { format } from 'date-fns';

interface StudentProgress {
  uniqueKey: string;
  userId: string;
  fullName: string;
  courseId: string;
  courseTitle: string;
  totalCapsules: number;
  completedCapsules: number;
  progressPercent: number;
  lastActivity: string | null;
}

interface Course {
  id: string;
  title: string;
}

export default function ProgressViewer() {
  const [studentProgress, setStudentProgress] = useState<StudentProgress[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: coursesData } = await supabase.from('courses').select('id, title').order('title');
    setCourses(coursesData || []);

    const { data: enrollmentsData } = await supabase
      .from('enrollments')
      .select('*, courses(id, title)')
      .eq('status', 'approved');

    if (!enrollmentsData) {
      setLoading(false);
      return;
    }

    const userIds = [...new Set(enrollmentsData.map(e => e.user_id))];
    const { data: profilesData } = await supabase.from('profiles').select('*').in('user_id', userIds);
    const profilesMap = new Map((profilesData || []).map(p => [p.user_id, p]));

    const progressData: StudentProgress[] = await Promise.all(
      enrollmentsData.map(async (enrollment) => {
        const { data: pathsData } = await supabase
          .from('learning_paths')
          .select('capsules(id)')
          .eq('course_id', enrollment.course_id);

        const allCapsuleIds = (pathsData || []).flatMap((p) =>
          ((p.capsules as { id: string }[]) || []).map((c) => c.id)
        );

        const { data: progressItems } = await supabase
          .from('progress')
          .select('*')
          .eq('user_id', enrollment.user_id)
          .in('capsule_id', allCapsuleIds.length > 0 ? allCapsuleIds : ['none'])
          .eq('is_completed', true);

        const completedCount = progressItems?.length || 0;
        const totalCount = allCapsuleIds.length;

        const { data: lastProgress } = await supabase
          .from('progress')
          .select('last_watched_at')
          .eq('user_id', enrollment.user_id)
          .in('capsule_id', allCapsuleIds.length > 0 ? allCapsuleIds : ['none'])
          .order('last_watched_at', { ascending: false })
          .limit(1);

        return {
          uniqueKey: `${enrollment.user_id}-${enrollment.course_id}`,
          userId: enrollment.user_id,
          fullName: profilesMap.get(enrollment.user_id)?.full_name || 'Unknown',
          courseId: enrollment.course_id,
          courseTitle: (enrollment.courses as { title: string } | null)?.title || 'Unknown',
          totalCapsules: totalCount,
          completedCapsules: completedCount,
          progressPercent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
          lastActivity: lastProgress?.[0]?.last_watched_at || null,
        };
      })
    );

    setStudentProgress(progressData);
    setLoading(false);
  };

  const filteredProgress = studentProgress.filter((p) => {
    const matchesSearch = p.fullName.toLowerCase().includes(search.toLowerCase());
    const matchesCourse = selectedCourse === 'all' || p.courseId === selectedCourse;
    return matchesSearch && matchesCourse;
  });

  const groupedByCourse = filteredProgress.reduce((acc, progress) => {
    if (!acc[progress.courseId]) {
      acc[progress.courseId] = { title: progress.courseTitle, students: [] };
    }
    acc[progress.courseId].students.push(progress);
    return acc;
  }, {} as Record<string, { title: string; students: StudentProgress[] }>);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <h2 className="text-xl font-semibold">Student Progress</h2>
        <div className="flex gap-4">
          <div className="relative w-full sm:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search student..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courses</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {studentProgress.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No enrolled students yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByCourse).map(([courseId, { title, students }]) => (
            <Card key={courseId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    {title}
                  </CardTitle>
                  <Badge variant="secondary">{students.length} students</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {students.map((student) => (
                    <div key={student.uniqueKey} className="flex items-center gap-4 p-4 bg-secondary/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{student.fullName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={student.progressPercent} className="h-2 flex-1" />
                          <span className="text-sm text-muted-foreground w-12">{student.progressPercent}%</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{student.completedCapsules}/{student.totalCapsules} capsules</p>
                      </div>
                      <div className="text-right text-sm">
                        {student.lastActivity ? (
                          <div>
                            <p className="text-muted-foreground">Last active</p>
                            <p>{format(new Date(student.lastActivity), 'MMM d, h:mm a')}</p>
                          </div>
                        ) : (
                          <p className="text-muted-foreground">No activity</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

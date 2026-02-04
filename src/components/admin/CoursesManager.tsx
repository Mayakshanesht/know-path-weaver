import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Course, LearningPath, Capsule } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Edit,
  Trash2,
  BookOpen,
  Loader2,
  GripVertical,
  ChevronDown,
} from 'lucide-react';

interface CourseWithPaths extends Course {
  learning_paths: (LearningPath & { capsules: Capsule[] })[];
}

export default function CoursesManager() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<CourseWithPaths[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Course form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    curriculum_preview: '',
    price_india: 0,
    price_international: 0,
    bank_details: '',
    payment_reference_code: '',
    thumbnail_url: '',
    is_published: false,
  });

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('*, learning_paths(*, capsules(*))')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching courses:', error);
    } else {
      // Sort learning paths and capsules
      const sortedCourses = (data || []).map((course) => ({
        ...course,
        learning_paths: (course.learning_paths || [])
          .sort((a: LearningPath, b: LearningPath) => a.order_index - b.order_index)
          .map((path: LearningPath & { capsules: Capsule[] }) => ({
            ...path,
            capsules: (path.capsules || []).sort((a, b) => a.order_index - b.order_index),
          })),
      }));
      setCourses(sortedCourses);
    }
    setLoading(false);
  };

  const openCourseDialog = (course?: Course) => {
    if (course) {
      setEditingCourse(course);
      setFormData({
        title: course.title,
        description: course.description || '',
        curriculum_preview: course.curriculum_preview || '',
        price_india: course.price_india || 0,
        price_international: course.price_international || 0,
        bank_details: course.bank_details || '',
        payment_reference_code: course.payment_reference_code || '',
        thumbnail_url: course.thumbnail_url || '',
        is_published: course.is_published || false,
      });
    } else {
      setEditingCourse(null);
      setFormData({
        title: '',
        description: '',
        curriculum_preview: '',
        price_india: 0,
        price_international: 0,
        bank_details: '',
        payment_reference_code: '',
        thumbnail_url: '',
        is_published: false,
      });
    }
    setCourseDialogOpen(true);
  };

  const handleSaveCourse = async () => {
    if (!formData.title.trim()) {
      toast({
        title: 'Title required',
        description: 'Please enter a course title.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      if (editingCourse) {
        const { error } = await supabase
          .from('courses')
          .update(formData)
          .eq('id', editingCourse.id);

        if (error) throw error;

        toast({ title: 'Course updated successfully!' });
      } else {
        const { error } = await supabase.from('courses').insert(formData);

        if (error) throw error;

        toast({ title: 'Course created successfully!' });
      }

      setCourseDialogOpen(false);
      fetchCourses();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }

    setSaving(false);
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure? This will delete all learning paths and capsules.')) return;

    const { error } = await supabase.from('courses').delete().eq('id', courseId);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Course deleted' });
      fetchCourses();
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Manage Courses</h2>
        <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openCourseDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              New Course
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCourse ? 'Edit Course' : 'Create New Course'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Course title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Course description"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="curriculum">Curriculum Preview</Label>
                <Textarea
                  id="curriculum"
                  value={formData.curriculum_preview}
                  onChange={(e) => setFormData({ ...formData, curriculum_preview: e.target.value })}
                  placeholder="What students will learn..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priceIndia">Price (India) ₹</Label>
                  <Input
                    id="priceIndia"
                    type="number"
                    value={formData.price_india}
                    onChange={(e) => setFormData({ ...formData, price_india: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priceIntl">Price (International) $</Label>
                  <Input
                    id="priceIntl"
                    type="number"
                    value={formData.price_international}
                    onChange={(e) => setFormData({ ...formData, price_international: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bankDetails">Bank Transfer Details</Label>
                <Textarea
                  id="bankDetails"
                  value={formData.bank_details}
                  onChange={(e) => setFormData({ ...formData, bank_details: e.target.value })}
                  placeholder="Bank name, account number, IFSC..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="refCode">Payment Reference Code</Label>
                <Input
                  id="refCode"
                  value={formData.payment_reference_code}
                  onChange={(e) => setFormData({ ...formData, payment_reference_code: e.target.value })}
                  placeholder="Unique code for this course"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="thumbnail">Thumbnail URL</Label>
                <Input
                  id="thumbnail"
                  value={formData.thumbnail_url}
                  onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="published"
                  checked={formData.is_published}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                />
                <Label htmlFor="published">Published</Label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setCourseDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveCourse} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Course'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No courses yet. Create your first course!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onEdit={() => openCourseDialog(course)}
              onDelete={() => handleDeleteCourse(course.id)}
              onRefresh={fetchCourses}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Course Card Component
function CourseCard({
  course,
  onEdit,
  onDelete,
  onRefresh,
}: {
  course: CourseWithPaths;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [addingPath, setAddingPath] = useState(false);
  const [newPathTitle, setNewPathTitle] = useState('');

  const handleAddPath = async () => {
    if (!newPathTitle.trim()) return;

    setAddingPath(true);

    const { error } = await supabase.from('learning_paths').insert({
      course_id: course.id,
      title: newPathTitle,
      order_index: course.learning_paths.length,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Learning path added!' });
      setNewPathTitle('');
      onRefresh();
    }

    setAddingPath(false);
  };

  const totalCapsules = course.learning_paths.reduce(
    (acc, path) => acc + path.capsules.length,
    0
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{course.title}</CardTitle>
              <Badge variant={course.is_published ? 'default' : 'secondary'}>
                {course.is_published ? 'Published' : 'Draft'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {course.learning_paths.length} modules • {totalCapsules} capsules
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded(!expanded)}
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="border-t pt-4 mt-2 space-y-4">
            {/* Learning Paths */}
            {course.learning_paths.map((path) => (
              <LearningPathCard key={path.id} path={path} onRefresh={onRefresh} />
            ))}

            {/* Add Path */}
            <div className="flex gap-2">
              <Input
                placeholder="New module title"
                value={newPathTitle}
                onChange={(e) => setNewPathTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPath()}
              />
              <Button onClick={handleAddPath} disabled={addingPath || !newPathTitle.trim()}>
                {addingPath ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Learning Path Card
function LearningPathCard({
  path,
  onRefresh,
}: {
  path: LearningPath & { capsules: Capsule[] };
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [addingCapsule, setAddingCapsule] = useState(false);
  const [newCapsuleTitle, setNewCapsuleTitle] = useState('');
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(path.title);

  const handleAddCapsule = async () => {
    if (!newCapsuleTitle.trim()) return;

    setAddingCapsule(true);

    const { error } = await supabase.from('capsules').insert({
      learning_path_id: path.id,
      title: newCapsuleTitle,
      order_index: path.capsules.length,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Capsule added!' });
      setNewCapsuleTitle('');
      onRefresh();
    }

    setAddingCapsule(false);
  };

  const handleUpdateTitle = async () => {
    if (!title.trim() || title === path.title) {
      setEditing(false);
      return;
    }

    const { error } = await supabase
      .from('learning_paths')
      .update({ title })
      .eq('id', path.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      onRefresh();
    }
    setEditing(false);
  };

  const handleDeletePath = async () => {
    if (!confirm('Delete this module and all its capsules?')) return;

    const { error } = await supabase.from('learning_paths').delete().eq('id', path.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Module deleted' });
      onRefresh();
    }
  };

  return (
    <div className="bg-secondary/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
        {editing ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleUpdateTitle}
            onKeyDown={(e) => e.key === 'Enter' && handleUpdateTitle()}
            className="flex-1 h-8"
            autoFocus
          />
        ) : (
          <span
            className="flex-1 font-medium cursor-pointer hover:text-primary"
            onClick={() => setEditing(true)}
          >
            {path.title}
          </span>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDeletePath}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>

      {/* Capsules */}
      <div className="space-y-2 ml-6">
        {path.capsules.map((capsule) => (
          <CapsuleRow key={capsule.id} capsule={capsule} onRefresh={onRefresh} />
        ))}

        {/* Add Capsule */}
        <div className="flex gap-2">
          <Input
            placeholder="New capsule title"
            value={newCapsuleTitle}
            onChange={(e) => setNewCapsuleTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCapsule()}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            onClick={handleAddCapsule}
            disabled={addingCapsule || !newCapsuleTitle.trim()}
          >
            {addingCapsule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Capsule Row
function CapsuleRow({ capsule, onRefresh }: { capsule: Capsule; onRefresh: () => void }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [contentOpen, setContentOpen] = useState(false);
  const [capsuleContent, setCapsuleContent] = useState<any[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [editData, setEditData] = useState({
    title: capsule.title,
    description: capsule.description || '',
    drive_file_id: capsule.drive_file_id || '',
    duration_minutes: capsule.duration_minutes || 0,
  });

  const fetchCapsuleContent = async () => {
    setLoadingContent(true);
    const { data, error } = await supabase
      .from('capsule_content')
      .select('*')
      .eq('capsule_id', capsule.id)
      .order('order_index');
    
    if (!error && data) {
      setCapsuleContent(data);
    }
    setLoadingContent(false);
  };

  const handleOpenContent = async () => {
    await fetchCapsuleContent();
    setContentOpen(true);
  };

  const handleSave = async () => {
    const { error } = await supabase.from('capsules').update(editData).eq('id', capsule.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      onRefresh();
    }
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this capsule?')) return;

    const { error } = await supabase.from('capsules').delete().eq('id', capsule.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Capsule deleted' });
      onRefresh();
    }
  };

  // Dynamically import the content manager to avoid circular deps
  const CapsuleContentManager = require('./CapsuleContentManager').default;

  return (
    <>
      <div className="flex items-center gap-2 bg-background/50 rounded p-2">
        <GripVertical className="w-4 h-4 text-muted-foreground cursor-move flex-shrink-0" />
        
        {editing ? (
          <div className="flex-1 space-y-2">
            <Input
              value={editData.title}
              onChange={(e) => setEditData({ ...editData, title: e.target.value })}
              placeholder="Title"
              className="h-8 text-sm"
            />
            <Input
              value={editData.drive_file_id}
              onChange={(e) => setEditData({ ...editData, drive_file_id: e.target.value })}
              placeholder="Google Drive File ID (legacy)"
              className="h-8 text-sm"
            />
            <div className="flex gap-2">
              <Input
                type="number"
                value={editData.duration_minutes}
                onChange={(e) => setEditData({ ...editData, duration_minutes: Number(e.target.value) })}
                placeholder="Duration (min)"
                className="h-8 text-sm w-32"
              />
              <Button size="sm" onClick={handleSave}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <>
            <span className="flex-1 text-sm">{capsule.title}</span>
            {capsule.drive_file_id && <Badge variant="outline" className="text-xs">Legacy Video</Badge>}
            {capsule.duration_minutes && (
              <span className="text-xs text-muted-foreground">{capsule.duration_minutes}m</span>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              className="h-6 text-xs"
              onClick={handleOpenContent}
            >
              Content
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(true)}>
              <Edit className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDelete}>
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          </>
        )}
      </div>

      <CapsuleContentManager
        capsuleId={capsule.id}
        content={capsuleContent}
        onRefresh={() => {
          fetchCapsuleContent();
          onRefresh();
        }}
        open={contentOpen}
        onOpenChange={setContentOpen}
      />
    </>
  );
}

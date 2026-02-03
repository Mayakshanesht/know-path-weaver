// Database types for KnowGraph LMS

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'student';
  created_at: string;
}

export interface Course {
  id: string;
  title: string;
  description: string | null;
  curriculum_preview: string | null;
  price_india: number | null;
  price_international: number | null;
  bank_details: string | null;
  payment_reference_code: string | null;
  thumbnail_url: string | null;
  is_published: boolean | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LearningPath {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Capsule {
  id: string;
  learning_path_id: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  drive_file_id: string | null;
  drive_file_name: string | null;
  drive_file_type: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface CapsulePrerequisite {
  id: string;
  capsule_id: string;
  prerequisite_capsule_id: string;
  created_at: string;
}

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  status: 'pending' | 'approved' | 'rejected';
  payment_reference: string | null;
  payment_receipt_url: string | null;
  admin_notes: string | null;
  enrolled_at: string;
  approved_at: string | null;
}

export interface Progress {
  id: string;
  user_id: string;
  capsule_id: string;
  watch_percentage: number | null;
  is_completed: boolean | null;
  last_watched_at: string;
  completed_at: string | null;
}

// Extended types with relations
export interface LearningPathWithCapsules extends LearningPath {
  capsules: Capsule[];
}

export interface CourseWithPaths extends Course {
  learning_paths: LearningPathWithCapsules[];
}

export interface CapsuleWithProgress extends Capsule {
  progress?: Progress | null;
  is_locked: boolean;
  prerequisites?: Capsule[];
}

export interface EnrollmentWithCourse extends Enrollment {
  courses: Course;
}

export interface EnrollmentWithUserAndCourse extends Enrollment {
  profiles: Profile;
  courses: Course;
}

// Auth context types
export interface AuthUser {
  id: string;
  email: string;
  profile: Profile | null;
  roles: UserRole[];
  isAdmin: boolean;
}

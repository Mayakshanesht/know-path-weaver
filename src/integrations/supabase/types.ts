export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      capsule_content: {
        Row: {
          capsule_id: string
          content_type: Database["public"]["Enums"]["content_type"]
          content_value: string
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          order_index: number
          title: string | null
          updated_at: string
        }
        Insert: {
          capsule_id: string
          content_type: Database["public"]["Enums"]["content_type"]
          content_value: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          order_index?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          capsule_id?: string
          content_type?: Database["public"]["Enums"]["content_type"]
          content_value?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          order_index?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capsule_content_capsule_id_fkey"
            columns: ["capsule_id"]
            isOneToOne: false
            referencedRelation: "capsules"
            referencedColumns: ["id"]
          },
        ]
      }
      capsule_prerequisites: {
        Row: {
          capsule_id: string
          created_at: string
          id: string
          prerequisite_capsule_id: string
        }
        Insert: {
          capsule_id: string
          created_at?: string
          id?: string
          prerequisite_capsule_id: string
        }
        Update: {
          capsule_id?: string
          created_at?: string
          id?: string
          prerequisite_capsule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capsule_prerequisites_capsule_id_fkey"
            columns: ["capsule_id"]
            isOneToOne: false
            referencedRelation: "capsules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capsule_prerequisites_prerequisite_capsule_id_fkey"
            columns: ["prerequisite_capsule_id"]
            isOneToOne: false
            referencedRelation: "capsules"
            referencedColumns: ["id"]
          },
        ]
      }
      capsules: {
        Row: {
          created_at: string
          description: string | null
          drive_file_id: string | null
          drive_file_name: string | null
          drive_file_type: string | null
          duration_minutes: number | null
          id: string
          learning_path_id: string
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          drive_file_id?: string | null
          drive_file_name?: string | null
          drive_file_type?: string | null
          duration_minutes?: number | null
          id?: string
          learning_path_id: string
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          drive_file_id?: string | null
          drive_file_name?: string | null
          drive_file_type?: string | null
          duration_minutes?: number | null
          id?: string
          learning_path_id?: string
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capsules_learning_path_id_fkey"
            columns: ["learning_path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          bank_details: string | null
          created_at: string
          created_by: string | null
          curriculum_preview: string | null
          description: string | null
          id: string
          is_published: boolean | null
          payment_reference_code: string | null
          price_india: number | null
          price_international: number | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          bank_details?: string | null
          created_at?: string
          created_by?: string | null
          curriculum_preview?: string | null
          description?: string | null
          id?: string
          is_published?: boolean | null
          payment_reference_code?: string | null
          price_india?: number | null
          price_international?: number | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          bank_details?: string | null
          created_at?: string
          created_by?: string | null
          curriculum_preview?: string | null
          description?: string | null
          id?: string
          is_published?: boolean | null
          payment_reference_code?: string | null
          price_india?: number | null
          price_international?: number | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          course_id: string
          enrolled_at: string
          id: string
          payment_receipt_url: string | null
          payment_reference: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          course_id: string
          enrolled_at?: string
          id?: string
          payment_receipt_url?: string | null
          payment_reference?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          course_id?: string
          enrolled_at?: string
          id?: string
          payment_receipt_url?: string | null
          payment_reference?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_paths: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_paths_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      progress: {
        Row: {
          capsule_id: string
          completed_at: string | null
          id: string
          is_completed: boolean | null
          last_watched_at: string
          user_id: string
          watch_percentage: number | null
        }
        Insert: {
          capsule_id: string
          completed_at?: string | null
          id?: string
          is_completed?: boolean | null
          last_watched_at?: string
          user_id: string
          watch_percentage?: number | null
        }
        Update: {
          capsule_id?: string
          completed_at?: string | null
          id?: string
          is_completed?: boolean | null
          last_watched_at?: string
          user_id?: string
          watch_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_capsule_id_fkey"
            columns: ["capsule_id"]
            isOneToOne: false
            referencedRelation: "capsules"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers: Json | null
          completed_at: string | null
          created_at: string
          id: string
          max_score: number | null
          passed: boolean | null
          quiz_id: string
          score: number | null
          started_at: string
          user_id: string
        }
        Insert: {
          answers?: Json | null
          completed_at?: string | null
          created_at?: string
          id?: string
          max_score?: number | null
          passed?: boolean | null
          quiz_id: string
          score?: number | null
          started_at?: string
          user_id: string
        }
        Update: {
          answers?: Json | null
          completed_at?: string | null
          created_at?: string
          id?: string
          max_score?: number | null
          passed?: boolean | null
          quiz_id?: string
          score?: number | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_answer: Json
          created_at: string
          explanation: string | null
          id: string
          options: Json | null
          order_index: number
          points: number | null
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          quiz_id: string
          updated_at: string
        }
        Insert: {
          correct_answer: Json
          created_at?: string
          explanation?: string | null
          id?: string
          options?: Json | null
          order_index?: number
          points?: number | null
          question_text: string
          question_type?: Database["public"]["Enums"]["question_type"]
          quiz_id: string
          updated_at?: string
        }
        Update: {
          correct_answer?: Json
          created_at?: string
          explanation?: string | null
          id?: string
          options?: Json | null
          order_index?: number
          points?: number | null
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          quiz_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          capsule_id: string | null
          course_id: string
          created_at: string
          description: string | null
          id: string
          is_graded: boolean | null
          is_published: boolean | null
          max_attempts: number | null
          order_index: number
          passing_score: number | null
          quiz_type: Database["public"]["Enums"]["quiz_type"]
          time_limit_minutes: number | null
          title: string
          updated_at: string
        }
        Insert: {
          capsule_id?: string | null
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_graded?: boolean | null
          is_published?: boolean | null
          max_attempts?: number | null
          order_index?: number
          passing_score?: number | null
          quiz_type?: Database["public"]["Enums"]["quiz_type"]
          time_limit_minutes?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          capsule_id?: string | null
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_graded?: boolean | null
          is_published?: boolean | null
          max_attempts?: number | null
          order_index?: number
          passing_score?: number | null
          quiz_type?: Database["public"]["Enums"]["quiz_type"]
          time_limit_minutes?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_capsule_id_fkey"
            columns: ["capsule_id"]
            isOneToOne: false
            referencedRelation: "capsules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "student"
      content_type:
        | "google_drive"
        | "youtube"
        | "github"
        | "colab"
        | "weblink"
        | "text"
        | "image"
        | "pdf"
      enrollment_status: "pending" | "approved" | "rejected"
      question_type: "mcq" | "short_answer" | "true_false" | "multiple_select"
      quiz_type: "quiz" | "assignment"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "student"],
      content_type: [
        "google_drive",
        "youtube",
        "github",
        "colab",
        "weblink",
        "text",
        "image",
        "pdf",
      ],
      enrollment_status: ["pending", "approved", "rejected"],
      question_type: ["mcq", "short_answer", "true_false", "multiple_select"],
      quiz_type: ["quiz", "assignment"],
    },
  },
} as const

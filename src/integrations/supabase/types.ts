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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_grants: {
        Row: {
          access_end: string | null
          access_start: string
          created_at: string
          grant_type: Database["public"]["Enums"]["grant_type"]
          granted_by: string | null
          id: string
          is_active: boolean
          parent_id: string
          reason: string | null
          student_id: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          access_end?: string | null
          access_start?: string
          created_at?: string
          grant_type?: Database["public"]["Enums"]["grant_type"]
          granted_by?: string | null
          id?: string
          is_active?: boolean
          parent_id: string
          reason?: string | null
          student_id: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          access_end?: string | null
          access_start?: string
          created_at?: string
          grant_type?: Database["public"]["Enums"]["grant_type"]
          granted_by?: string | null
          id?: string
          is_active?: boolean
          parent_id?: string
          reason?: string | null
          student_id?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_grants_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_timetable_logs: {
        Row: {
          conflicts_count: number | null
          created_at: string
          definition_id: string | null
          feature: string
          generation_time_ms: number | null
          id: string
          optimization_score: number | null
          prompt_sent: Json | null
          response_received: Json | null
          user_id: string | null
          warnings: Json | null
        }
        Insert: {
          conflicts_count?: number | null
          created_at?: string
          definition_id?: string | null
          feature: string
          generation_time_ms?: number | null
          id?: string
          optimization_score?: number | null
          prompt_sent?: Json | null
          response_received?: Json | null
          user_id?: string | null
          warnings?: Json | null
        }
        Update: {
          conflicts_count?: number | null
          created_at?: string
          definition_id?: string | null
          feature?: string
          generation_time_ms?: number | null
          id?: string
          optimization_score?: number | null
          prompt_sent?: Json | null
          response_received?: Json | null
          user_id?: string | null
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_timetable_logs_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "tt_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_id: string | null
          category: string | null
          content: string | null
          created_at: string
          expires_at: string | null
          file_attachments: string[] | null
          id: string
          is_public: boolean
          target_ids: string[] | null
          target_type: string | null
          title: string
        }
        Insert: {
          author_id?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          expires_at?: string | null
          file_attachments?: string[] | null
          id?: string
          is_public?: boolean
          target_ids?: string[] | null
          target_type?: string | null
          title: string
        }
        Update: {
          author_id?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          expires_at?: string | null
          file_attachments?: string[] | null
          id?: string
          is_public?: boolean
          target_ids?: string[] | null
          target_type?: string | null
          title?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_date: string
          created_at: string
          id: string
          notes: string | null
          parent_id: string | null
          status: string | null
          student_id: string | null
          teacher_id: string | null
        }
        Insert: {
          appointment_date: string
          created_at?: string
          id?: string
          notes?: string | null
          parent_id?: string | null
          status?: string | null
          student_id?: string | null
          teacher_id?: string | null
        }
        Update: {
          appointment_date?: string
          created_at?: string
          id?: string
          notes?: string | null
          parent_id?: string | null
          status?: string | null
          student_id?: string | null
          teacher_id?: string | null
        }
        Relationships: []
      }
      assessment_results: {
        Row: {
          assessment_id: string | null
          created_at: string
          feedback: string | null
          graded_by: string | null
          id: string
          mark: number | null
          student_id: string | null
        }
        Insert: {
          assessment_id?: string | null
          created_at?: string
          feedback?: string | null
          graded_by?: string | null
          id?: string
          mark?: number | null
          student_id?: string | null
        }
        Update: {
          assessment_id?: string | null
          created_at?: string
          feedback?: string | null
          graded_by?: string | null
          id?: string
          mark?: number | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_results_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_submissions: {
        Row: {
          answers: Json | null
          assessment_id: string | null
          auto_marked: boolean | null
          id: string
          notes: string | null
          status: string | null
          student_id: string | null
          submission_date: string | null
          submission_url: string | null
          submitted_at: string
        }
        Insert: {
          answers?: Json | null
          assessment_id?: string | null
          auto_marked?: boolean | null
          id?: string
          notes?: string | null
          status?: string | null
          student_id?: string | null
          submission_date?: string | null
          submission_url?: string | null
          submitted_at?: string
        }
        Update: {
          answers?: Json | null
          assessment_id?: string | null
          auto_marked?: boolean | null
          id?: string
          notes?: string | null
          status?: string | null
          student_id?: string | null
          submission_date?: string | null
          submission_url?: string | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_submissions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          assessment_type: string | null
          class_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          file_name: string | null
          file_url: string | null
          form: string | null
          id: string
          instructions: string | null
          is_published: boolean
          max_marks: number | null
          pass_mark: number | null
          questions: Json | null
          stream: string | null
          subject_id: string | null
          teacher_id: string | null
          time_limit_minutes: number | null
          title: string
          total_marks: number | null
        }
        Insert: {
          assessment_type?: string | null
          class_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          file_name?: string | null
          file_url?: string | null
          form?: string | null
          id?: string
          instructions?: string | null
          is_published?: boolean
          max_marks?: number | null
          pass_mark?: number | null
          questions?: Json | null
          stream?: string | null
          subject_id?: string | null
          teacher_id?: string | null
          time_limit_minutes?: number | null
          title: string
          total_marks?: number | null
        }
        Update: {
          assessment_type?: string | null
          class_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          file_name?: string | null
          file_url?: string | null
          form?: string | null
          id?: string
          instructions?: string | null
          is_published?: boolean
          max_marks?: number | null
          pass_mark?: number | null
          questions?: Json | null
          stream?: string | null
          subject_id?: string | null
          teacher_id?: string | null
          time_limit_minutes?: number | null
          title?: string
          total_marks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          class_id: string | null
          created_at: string
          date: string
          id: string
          notes: string | null
          recorded_by: string | null
          status: string
          student_id: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          status?: string
          student_id?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          status?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      award_photos: {
        Row: {
          award_id: string | null
          caption: string | null
          created_at: string
          id: string
          image_url: string
        }
        Insert: {
          award_id?: string | null
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
        }
        Update: {
          award_id?: string | null
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "award_photos_award_id_fkey"
            columns: ["award_id"]
            isOneToOne: false
            referencedRelation: "awards"
            referencedColumns: ["id"]
          },
        ]
      }
      awards: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          recipient: string | null
          title: string
          year: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          recipient?: string | null
          title: string
          year?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          recipient?: string | null
          title?: string
          year?: number | null
        }
        Relationships: []
      }
      bank_transactions: {
        Row: {
          account_number: string | null
          amount_usd: number
          amount_zig: number
          bank_name: string | null
          created_at: string
          description: string
          id: string
          matched_expense_id: string | null
          matched_payment_id: string | null
          matched_supplier_payment_id: string | null
          notes: string | null
          reconciliation_status: string
          recorded_by: string | null
          reference_number: string | null
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          account_number?: string | null
          amount_usd?: number
          amount_zig?: number
          bank_name?: string | null
          created_at?: string
          description: string
          id?: string
          matched_expense_id?: string | null
          matched_payment_id?: string | null
          matched_supplier_payment_id?: string | null
          notes?: string | null
          reconciliation_status?: string
          recorded_by?: string | null
          reference_number?: string | null
          transaction_date?: string
          transaction_type?: string
        }
        Update: {
          account_number?: string | null
          amount_usd?: number
          amount_zig?: number
          bank_name?: string | null
          created_at?: string
          description?: string
          id?: string
          matched_expense_id?: string | null
          matched_payment_id?: string | null
          matched_supplier_payment_id?: string | null
          notes?: string | null
          reconciliation_status?: string
          recorded_by?: string | null
          reference_number?: string | null
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: []
      }
      bed_allocations: {
        Row: {
          academic_year: string | null
          bed_number: string | null
          created_at: string
          id: string
          room_id: string | null
          student_id: string | null
        }
        Insert: {
          academic_year?: string | null
          bed_number?: string | null
          created_at?: string
          id?: string
          room_id?: string | null
          student_id?: string | null
        }
        Update: {
          academic_year?: string | null
          bed_number?: string | null
          created_at?: string
          id?: string
          room_id?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bed_allocations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bed_allocations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      carousel_images: {
        Row: {
          caption: string | null
          created_at: string
          display_order: number
          id: string
          image_url: string
          is_active: boolean
        }
        Insert: {
          caption?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          is_active?: boolean
        }
        Update: {
          caption?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          is_active?: boolean
        }
        Relationships: []
      }
      class_subjects: {
        Row: {
          class_id: string | null
          created_at: string
          id: string
          subject_id: string | null
          teacher_id: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          id?: string
          subject_id?: string | null
          teacher_id?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string
          id?: string
          subject_id?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          academic_year: string | null
          capacity: number | null
          class_teacher_id: string | null
          created_at: string
          id: string
          level: string | null
          name: string
          stream: string | null
        }
        Insert: {
          academic_year?: string | null
          capacity?: number | null
          class_teacher_id?: string | null
          created_at?: string
          id?: string
          level?: string | null
          name: string
          stream?: string | null
        }
        Update: {
          academic_year?: string | null
          capacity?: number | null
          class_teacher_id?: string | null
          created_at?: string
          id?: string
          level?: string | null
          name?: string
          stream?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_class_teacher_id_fkey"
            columns: ["class_teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_class_teacher_id_fkey"
            columns: ["class_teacher_id"]
            isOneToOne: false
            referencedRelation: "staff_public"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_logs: {
        Row: {
          body: string | null
          channel: string | null
          created_at: string
          id: string
          recipient: string | null
          status: string | null
          subject: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          channel?: string | null
          created_at?: string
          id?: string
          recipient?: string | null
          status?: string | null
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          channel?: string | null
          created_at?: string
          id?: string
          recipient?: string | null
          status?: string | null
          subject?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          subject?: string | null
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string | null
          title: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      downloads: {
        Row: {
          category: string
          created_at: string
          description: string | null
          file_url: string
          id: string
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          file_url: string
          id?: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          file_url?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          academic_year: string | null
          class_id: string | null
          created_at: string
          id: string
          status: string | null
          student_id: string | null
          term: string | null
        }
        Insert: {
          academic_year?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          status?: string | null
          student_id?: string | null
          term?: string | null
        }
        Update: {
          academic_year?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          status?: string | null
          student_id?: string | null
          term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          event_date: string
          event_type: string
          id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_date: string
          event_type?: string
          id?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_date?: string
          event_type?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      exam_results: {
        Row: {
          comment: string | null
          created_at: string
          exam_id: string | null
          grade: string | null
          id: string
          mark: number | null
          student_id: string | null
          subject_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          exam_id?: string | null
          grade?: string | null
          id?: string
          mark?: number | null
          student_id?: string | null
          subject_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          exam_id?: string | null
          grade?: string | null
          id?: string
          mark?: number | null
          student_id?: string | null
          subject_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_results_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_timetable_entries: {
        Row: {
          class_id: string | null
          created_at: string
          end_time: string | null
          exam_date: string
          exam_id: string | null
          id: string
          invigilator: string | null
          start_time: string | null
          subject_id: string | null
          venue: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          end_time?: string | null
          exam_date: string
          exam_id?: string | null
          id?: string
          invigilator?: string | null
          start_time?: string | null
          subject_id?: string | null
          venue?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string
          end_time?: string | null
          exam_date?: string
          exam_id?: string | null
          id?: string
          invigilator?: string | null
          start_time?: string | null
          subject_id?: string | null
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_timetable_entries_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_timetable_entries_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_timetable_entries_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          academic_year: string | null
          created_at: string
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          term: string | null
        }
        Insert: {
          academic_year?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          term?: string | null
        }
        Update: {
          academic_year?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          term?: string | null
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          created_at: string
          fetched_at: string
          id: string
          is_active: boolean
          set_by_admin: string | null
          source: string
          usd_to_zwg: number
        }
        Insert: {
          created_at?: string
          fetched_at?: string
          id?: string
          is_active?: boolean
          set_by_admin?: string | null
          source?: string
          usd_to_zwg: number
        }
        Update: {
          created_at?: string
          fetched_at?: string
          id?: string
          is_active?: boolean
          set_by_admin?: string | null
          source?: string
          usd_to_zwg?: number
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount_usd: number
          category: string | null
          created_at: string
          description: string
          expense_date: string
          id: string
          receipt_url: string | null
          recorded_by: string | null
        }
        Insert: {
          amount_usd?: number
          category?: string | null
          created_at?: string
          description: string
          expense_date?: string
          id?: string
          receipt_url?: string | null
          recorded_by?: string | null
        }
        Update: {
          amount_usd?: number
          category?: string | null
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          receipt_url?: string | null
          recorded_by?: string | null
        }
        Relationships: []
      }
      facilities: {
        Row: {
          capacity: number | null
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          capacity?: number | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          capacity?: number | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      facility_images: {
        Row: {
          caption: string | null
          created_at: string
          display_order: number | null
          facility_id: string | null
          id: string
          image_url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          display_order?: number | null
          facility_id?: string | null
          id?: string
          image_url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          display_order?: number | null
          facility_id?: string | null
          id?: string
          image_url?: string
        }
        Relationships: []
      }
      fee_structures: {
        Row: {
          academic_year: string
          amount_usd: number
          amount_zig: number
          boarding_status: string | null
          created_at: string
          description: string | null
          form: string
          id: string
          is_active: boolean
          term: string
        }
        Insert: {
          academic_year: string
          amount_usd?: number
          amount_zig?: number
          boarding_status?: string | null
          created_at?: string
          description?: string | null
          form: string
          id?: string
          is_active?: boolean
          term: string
        }
        Update: {
          academic_year?: string
          amount_usd?: number
          amount_zig?: number
          boarding_status?: string | null
          created_at?: string
          description?: string | null
          form?: string
          id?: string
          is_active?: boolean
          term?: string
        }
        Relationships: []
      }
      finance_approval_requests: {
        Row: {
          amount_usd: number | null
          created_at: string
          description: string | null
          id: string
          request_type: string
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
        }
        Insert: {
          amount_usd?: number | null
          created_at?: string
          description?: string | null
          id?: string
          request_type: string
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Update: {
          amount_usd?: number | null
          created_at?: string
          description?: string | null
          id?: string
          request_type?: string
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Relationships: []
      }
      gallery_images: {
        Row: {
          caption: string | null
          category: string | null
          created_at: string
          id: string
          image_url: string
          is_active: boolean
        }
        Insert: {
          caption?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_url: string
          is_active?: boolean
        }
        Update: {
          caption?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
        }
        Relationships: []
      }
      health_visits: {
        Row: {
          created_at: string
          id: string
          recorded_by: string | null
          student_id: string | null
          symptoms: string | null
          treatment: string | null
          visit_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          recorded_by?: string | null
          student_id?: string | null
          symptoms?: string | null
          treatment?: string | null
          visit_date?: string
        }
        Update: {
          created_at?: string
          id?: string
          recorded_by?: string | null
          student_id?: string | null
          symptoms?: string | null
          treatment?: string | null
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_visits_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      homework: {
        Row: {
          class_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          file_name: string | null
          file_url: string | null
          form: string | null
          id: string
          instructions: string | null
          stream: string | null
          subject_id: string | null
          teacher_id: string | null
          title: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          file_name?: string | null
          file_url?: string | null
          form?: string | null
          id?: string
          instructions?: string | null
          stream?: string | null
          subject_id?: string | null
          teacher_id?: string | null
          title: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          file_name?: string | null
          file_url?: string | null
          form?: string | null
          id?: string
          instructions?: string | null
          stream?: string | null
          subject_id?: string | null
          teacher_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_submissions: {
        Row: {
          file_url: string | null
          homework_id: string
          id: string
          notes: string | null
          status: string
          student_id: string
          submitted_at: string
        }
        Insert: {
          file_url?: string | null
          homework_id: string
          id?: string
          notes?: string | null
          status?: string
          student_id: string
          submitted_at?: string
        }
        Update: {
          file_url?: string | null
          homework_id?: string
          id?: string
          notes?: string | null
          status?: string
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_submissions_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      hostels: {
        Row: {
          capacity: number | null
          created_at: string
          gender: string | null
          id: string
          matron: string | null
          name: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          gender?: string | null
          id?: string
          matron?: string | null
          name: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          gender?: string | null
          id?: string
          matron?: string | null
          name?: string
        }
        Relationships: []
      }
      inventory_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          location: string | null
          name: string
          quantity: number
          reorder_level: number | null
          unit: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name: string
          quantity?: number
          reorder_level?: number | null
          unit?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          quantity?: number
          reorder_level?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inventory_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          notes: string | null
          quantity: number
          recorded_by: string | null
          transaction_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          notes?: string | null
          quantity: number
          recorded_by?: string | null
          transaction_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          notes?: string | null
          quantity?: number
          recorded_by?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount: number
          amount_usd: number
          amount_zig: number
          created_at: string
          description: string
          fee_structure_id: string | null
          id: string
          invoice_id: string | null
        }
        Insert: {
          amount?: number
          amount_usd?: number
          amount_zig?: number
          created_at?: string
          description: string
          fee_structure_id?: string | null
          id?: string
          invoice_id?: string | null
        }
        Update: {
          amount?: number
          amount_usd?: number
          amount_zig?: number
          created_at?: string
          description?: string
          fee_structure_id?: string | null
          id?: string
          invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          academic_year: string | null
          amount_paid: number
          amount_usd: number
          created_at: string
          currency: string | null
          due_date: string | null
          fee_structure_id: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          paid_usd: number
          paid_zig: number
          status: string | null
          student_id: string | null
          term: string | null
          total_usd: number
          total_zig: number
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          amount_paid?: number
          amount_usd?: number
          created_at?: string
          currency?: string | null
          due_date?: string | null
          fee_structure_id?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          paid_usd?: number
          paid_zig?: number
          status?: string | null
          student_id?: string | null
          term?: string | null
          total_usd?: number
          total_zig?: number
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          amount_paid?: number
          amount_usd?: number
          created_at?: string
          currency?: string | null
          due_date?: string | null
          fee_structure_id?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          paid_usd?: number
          paid_zig?: number
          status?: string | null
          student_id?: string | null
          term?: string | null
          total_usd?: number
          total_zig?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_fee_structure_id_fkey"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_materials: {
        Row: {
          class_id: string | null
          created_at: string
          description: string | null
          external_link: string | null
          file_name: string | null
          file_url: string | null
          form: string | null
          id: string
          stream: string | null
          subject_id: string | null
          teacher_id: string | null
          title: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          external_link?: string | null
          file_name?: string | null
          file_url?: string | null
          form?: string | null
          id?: string
          stream?: string | null
          subject_id?: string | null
          teacher_id?: string | null
          title: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          external_link?: string | null
          file_name?: string | null
          file_url?: string | null
          form?: string | null
          id?: string
          stream?: string | null
          subject_id?: string | null
          teacher_id?: string | null
          title?: string
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          staff_id: string | null
          start_date: string
          status: string | null
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          leave_type?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_id?: string | null
          start_date: string
          status?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_id?: string | null
          start_date?: string
          status?: string | null
        }
        Relationships: []
      }
      lesson_plans: {
        Row: {
          academic_year: string | null
          class_id: string | null
          content: string | null
          created_at: string
          id: string
          subject_id: string | null
          teacher_id: string | null
          term: string | null
          title: string
          week_number: number | null
        }
        Insert: {
          academic_year?: string | null
          class_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          subject_id?: string | null
          teacher_id?: string | null
          term?: string | null
          title: string
          week_number?: number | null
        }
        Update: {
          academic_year?: string | null
          class_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          subject_id?: string | null
          teacher_id?: string | null
          term?: string | null
          title?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_plans_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      marks: {
        Row: {
          academic_year: string | null
          assessment_type: string
          class_id: string | null
          comment: string | null
          created_at: string
          id: string
          mark: number
          out_of: number | null
          student_id: string | null
          subject_id: string | null
          teacher_id: string | null
          term: string
        }
        Insert: {
          academic_year?: string | null
          assessment_type?: string
          class_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          mark?: number
          out_of?: number | null
          student_id?: string | null
          subject_id?: string | null
          teacher_id?: string | null
          term?: string
        }
        Update: {
          academic_year?: string | null
          assessment_type?: string
          class_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          mark?: number
          out_of?: number | null
          student_id?: string | null
          subject_id?: string | null
          teacher_id?: string | null
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "marks_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          location: string | null
          meeting_date: string
          meeting_type: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          meeting_date: string
          meeting_type?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          meeting_date?: string
          meeting_type?: string
          title?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_url: string | null
          content: string
          conversation_id: string | null
          created_at: string
          id: string
          message_type: string | null
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          content: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_type?: string | null
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          content?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_type?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      parent_communication_logs: {
        Row: {
          channel: string | null
          created_at: string
          id: string
          message: string | null
          parent_id: string | null
          student_id: string | null
          subject: string | null
          teacher_id: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string
          id?: string
          message?: string | null
          parent_id?: string | null
          student_id?: string | null
          subject?: string | null
          teacher_id?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string
          id?: string
          message?: string | null
          parent_id?: string | null
          student_id?: string | null
          subject?: string | null
          teacher_id?: string | null
        }
        Relationships: []
      }
      parent_student_links: {
        Row: {
          created_at: string
          id: string
          parent_id: string
          student_id: string
          verified: boolean | null
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id: string
          student_id: string
          verified?: boolean | null
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string
          student_id?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      parent_students: {
        Row: {
          created_at: string
          id: string
          parent_id: string
          relationship: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id: string
          relationship?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string
          relationship?: string | null
          student_id?: string
        }
        Relationships: []
      }
      payment_reminders: {
        Row: {
          ai_generated_message: string | null
          created_at: string
          created_by: string | null
          delivery_method: string
          id: string
          parent_id: string
          reminder_type: string
          sent_at: string
          status: string
          student_id: string | null
        }
        Insert: {
          ai_generated_message?: string | null
          created_at?: string
          created_by?: string | null
          delivery_method?: string
          id?: string
          parent_id: string
          reminder_type: string
          sent_at?: string
          status?: string
          student_id?: string | null
        }
        Update: {
          ai_generated_message?: string | null
          created_at?: string
          created_by?: string | null
          delivery_method?: string
          id?: string
          parent_id?: string
          reminder_type?: string
          sent_at?: string
          status?: string
          student_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          amount_usd: number
          amount_zig: number
          created_at: string
          currency: string
          id: string
          invoice_id: string | null
          ip_address: string | null
          mobile_number: string | null
          notes: string | null
          parent_id: string
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_notes: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          paynow_poll_url: string | null
          paynow_reference: string | null
          proof_of_payment_url: string | null
          receipt_number: string | null
          receipt_url: string | null
          recorded_by: string | null
          reference_number: string | null
          rejection_reason: string | null
          student_id: string | null
          subscription_id: string | null
          transaction_id: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          amount_usd?: number
          amount_zig?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string | null
          ip_address?: string | null
          mobile_number?: string | null
          notes?: string | null
          parent_id: string
          payment_date?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          paynow_poll_url?: string | null
          paynow_reference?: string | null
          proof_of_payment_url?: string | null
          receipt_number?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          reference_number?: string | null
          rejection_reason?: string | null
          student_id?: string | null
          subscription_id?: string | null
          transaction_id?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          amount_usd?: number
          amount_zig?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string | null
          ip_address?: string | null
          mobile_number?: string | null
          notes?: string | null
          parent_id?: string
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          paynow_poll_url?: string | null
          paynow_reference?: string | null
          proof_of_payment_url?: string | null
          receipt_number?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          reference_number?: string | null
          rejection_reason?: string | null
          student_id?: string | null
          subscription_id?: string | null
          transaction_id?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_timetables: {
        Row: {
          data: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          data?: Json
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      petty_cash: {
        Row: {
          amount_usd: number
          created_at: string
          description: string
          id: string
          recorded_by: string | null
          transaction_date: string
          transaction_type: string | null
        }
        Insert: {
          amount_usd?: number
          created_at?: string
          description: string
          id?: string
          recorded_by?: string | null
          transaction_date?: string
          transaction_type?: string | null
        }
        Update: {
          amount_usd?: number
          created_at?: string
          description?: string
          id?: string
          recorded_by?: string | null
          transaction_date?: string
          transaction_type?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          class_name: string | null
          created_at: string
          email: string | null
          full_name: string | null
          grade: string | null
          id: string
          phone: string | null
          role: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          class_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          grade?: string | null
          id: string
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          class_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          grade?: string | null
          id?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      rooms: {
        Row: {
          capacity: number | null
          created_at: string
          hostel_id: string | null
          id: string
          room_number: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          hostel_id?: string | null
          id?: string
          room_number: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          hostel_id?: string | null
          id?: string
          room_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
        ]
      }
      school_bank_details: {
        Row: {
          account_name: string
          account_number: string
          bank_name: string
          branch: string | null
          created_at: string
          id: string
          is_active: boolean
          paynow_integration_id: string | null
          paynow_integration_key_secret_ref: string | null
          swift_code: string | null
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_name: string
          branch?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          paynow_integration_id?: string | null
          paynow_integration_key_secret_ref?: string | null
          swift_code?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_name?: string
          branch?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          paynow_integration_id?: string | null
          paynow_integration_key_secret_ref?: string | null
          swift_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      school_projects: {
        Row: {
          created_at: string
          description: string | null
          goal_amount: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          raised_amount: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          goal_amount?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          raised_amount?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          goal_amount?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          raised_amount?: number | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      sms_templates: {
        Row: {
          body: string
          category: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      sports_schedule: {
        Row: {
          created_at: string
          event_date: string
          id: string
          opponent: string | null
          result: string | null
          sport: string
          venue: string | null
        }
        Insert: {
          created_at?: string
          event_date: string
          id?: string
          opponent?: string | null
          result?: string | null
          sport: string
          venue?: string | null
        }
        Update: {
          created_at?: string
          event_date?: string
          id?: string
          opponent?: string | null
          result?: string | null
          sport?: string
          venue?: string | null
        }
        Relationships: []
      }
      staff: {
        Row: {
          address: string | null
          bio: string | null
          category: string
          created_at: string
          date_joined: string | null
          department: string | null
          email: string | null
          emergency_contact: string | null
          employment_date: string | null
          full_name: string
          id: string
          national_id: string | null
          phone: string | null
          photo_url: string | null
          qualifications: string | null
          role: string | null
          staff_number: string | null
          status: string | null
          subjects_taught: string[] | null
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          bio?: string | null
          category?: string
          created_at?: string
          date_joined?: string | null
          department?: string | null
          email?: string | null
          emergency_contact?: string | null
          employment_date?: string | null
          full_name: string
          id?: string
          national_id?: string | null
          phone?: string | null
          photo_url?: string | null
          qualifications?: string | null
          role?: string | null
          staff_number?: string | null
          status?: string | null
          subjects_taught?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          bio?: string | null
          category?: string
          created_at?: string
          date_joined?: string | null
          department?: string | null
          email?: string | null
          emergency_contact?: string | null
          employment_date?: string | null
          full_name?: string
          id?: string
          national_id?: string | null
          phone?: string | null
          photo_url?: string | null
          qualifications?: string | null
          role?: string | null
          staff_number?: string | null
          status?: string | null
          subjects_taught?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      student_classes: {
        Row: {
          class_id: string | null
          created_at: string
          id: string
          student_id: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          id?: string
          student_id?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string
          id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          admission_number: string | null
          boarding_status: string | null
          class: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          emergency_contact: string | null
          enrollment_date: string | null
          first_name: string | null
          form: string | null
          full_name: string
          gender: string | null
          guardian_email: string | null
          guardian_name: string | null
          guardian_phone: string | null
          has_medical_alert: boolean | null
          id: string
          last_name: string | null
          medical_conditions: string | null
          name: string | null
          photo_url: string | null
          profile_photo_url: string | null
          sports: string[] | null
          sports_activities: string[] | null
          status: string | null
          stream: string | null
          student_number: string | null
          subject_combination: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          admission_number?: string | null
          boarding_status?: string | null
          class?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact?: string | null
          enrollment_date?: string | null
          first_name?: string | null
          form?: string | null
          full_name?: string
          gender?: string | null
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          has_medical_alert?: boolean | null
          id?: string
          last_name?: string | null
          medical_conditions?: string | null
          name?: string | null
          photo_url?: string | null
          profile_photo_url?: string | null
          sports?: string[] | null
          sports_activities?: string[] | null
          status?: string | null
          stream?: string | null
          student_number?: string | null
          subject_combination?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          admission_number?: string | null
          boarding_status?: string | null
          class?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact?: string | null
          enrollment_date?: string | null
          first_name?: string | null
          form?: string | null
          full_name?: string
          gender?: string | null
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          has_medical_alert?: boolean | null
          id?: string
          last_name?: string | null
          medical_conditions?: string | null
          name?: string | null
          photo_url?: string | null
          profile_photo_url?: string | null
          sports?: string[] | null
          sports_activities?: string[] | null
          status?: string | null
          stream?: string | null
          student_number?: string | null
          subject_combination?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      study_materials: {
        Row: {
          class_id: string | null
          created_at: string
          description: string | null
          download_count: number
          expiry_date: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          is_published: boolean
          link_url: string | null
          material_type: string
          subject_id: string | null
          tags: string[] | null
          teacher_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          download_count?: number
          expiry_date?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_published?: boolean
          link_url?: string | null
          material_type?: string
          subject_id?: string | null
          tags?: string[] | null
          teacher_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          download_count?: number
          expiry_date?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_published?: boolean
          link_url?: string | null
          material_type?: string
          subject_id?: string | null
          tags?: string[] | null
          teacher_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_materials_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_materials_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string | null
          created_at: string
          department: string | null
          id: string
          is_examinable: boolean | null
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          department?: string | null
          id?: string
          is_examinable?: boolean | null
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          department?: string | null
          id?: string
          is_examinable?: boolean | null
          name?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          amount_usd: number
          created_at: string
          description: string | null
          duration_days: number
          features: Json
          id: string
          is_active: boolean
          is_recommended: boolean
          name: string
          plan_type: Database["public"]["Enums"]["subscription_plan_type"]
          sibling_discount_2: number
          sibling_discount_3_plus: number
          updated_at: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          description?: string | null
          duration_days: number
          features?: Json
          id?: string
          is_active?: boolean
          is_recommended?: boolean
          name: string
          plan_type: Database["public"]["Enums"]["subscription_plan_type"]
          sibling_discount_2?: number
          sibling_discount_3_plus?: number
          updated_at?: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          description?: string | null
          duration_days?: number
          features?: Json
          id?: string
          is_active?: boolean
          is_recommended?: boolean
          name?: string
          plan_type?: Database["public"]["Enums"]["subscription_plan_type"]
          sibling_discount_2?: number
          sibling_discount_3_plus?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          academic_year: string | null
          access_end: string | null
          access_start: string | null
          amount_usd: number
          amount_zwg: number | null
          auto_renew: boolean
          created_at: string
          currency_paid: string
          id: string
          parent_id: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          paynow_reference: string | null
          plan_id: string | null
          plan_type: Database["public"]["Enums"]["subscription_plan_type"]
          status: Database["public"]["Enums"]["subscription_status"]
          student_id: string
          term: string | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          access_end?: string | null
          access_start?: string | null
          amount_usd: number
          amount_zwg?: number | null
          auto_renew?: boolean
          created_at?: string
          currency_paid?: string
          id?: string
          parent_id: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          paynow_reference?: string | null
          plan_id?: string | null
          plan_type: Database["public"]["Enums"]["subscription_plan_type"]
          status?: Database["public"]["Enums"]["subscription_status"]
          student_id: string
          term?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          access_end?: string | null
          access_start?: string | null
          amount_usd?: number
          amount_zwg?: number | null
          auto_renew?: boolean
          created_at?: string
          currency_paid?: string
          id?: string
          parent_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          paynow_reference?: string | null
          plan_id?: string | null
          plan_type?: Database["public"]["Enums"]["subscription_plan_type"]
          status?: Database["public"]["Enums"]["subscription_status"]
          student_id?: string
          term?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoices: {
        Row: {
          amount_usd: number
          created_at: string
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string | null
          notes: string | null
          status: string | null
          supplier_name: string
        }
        Insert: {
          amount_usd?: number
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          notes?: string | null
          status?: string | null
          supplier_name: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          notes?: string | null
          status?: string | null
          supplier_name?: string
        }
        Relationships: []
      }
      supplier_payments: {
        Row: {
          amount_usd: number
          created_at: string
          id: string
          payment_date: string
          payment_method: string | null
          recorded_by: string | null
          reference: string | null
          supplier_invoice_id: string | null
        }
        Insert: {
          amount_usd?: number
          created_at?: string
          id?: string
          payment_date?: string
          payment_method?: string | null
          recorded_by?: string | null
          reference?: string | null
          supplier_invoice_id?: string | null
        }
        Update: {
          amount_usd?: number
          created_at?: string
          id?: string
          payment_date?: string
          payment_method?: string | null
          recorded_by?: string | null
          reference?: string | null
          supplier_invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_resources: {
        Row: {
          created_at: string
          description: string | null
          file_url: string | null
          id: string
          resource_type: string | null
          teacher_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          resource_type?: string | null
          teacher_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          resource_type?: string | null
          teacher_id?: string | null
          title?: string
        }
        Relationships: []
      }
      term_registrations: {
        Row: {
          academic_year: string
          amount_due: number | null
          amount_paid: number | null
          boarding_status: string | null
          id: string
          invoice_id: string | null
          registered_at: string
          registered_by: string | null
          status: string | null
          student_id: string | null
          subjects: string[] | null
          term: string
        }
        Insert: {
          academic_year: string
          amount_due?: number | null
          amount_paid?: number | null
          boarding_status?: string | null
          id?: string
          invoice_id?: string | null
          registered_at?: string
          registered_by?: string | null
          status?: string | null
          student_id?: string | null
          subjects?: string[] | null
          term: string
        }
        Update: {
          academic_year?: string
          amount_due?: number | null
          amount_paid?: number | null
          boarding_status?: string | null
          id?: string
          invoice_id?: string | null
          registered_at?: string
          registered_by?: string | null
          status?: string | null
          student_id?: string | null
          subjects?: string[] | null
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "term_registrations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      term_reports: {
        Row: {
          academic_year: string
          comments: string | null
          created_at: string
          id: string
          position: number | null
          report_url: string | null
          student_id: string | null
          term: string
        }
        Insert: {
          academic_year: string
          comments?: string | null
          created_at?: string
          id?: string
          position?: number | null
          report_url?: string | null
          student_id?: string | null
          term: string
        }
        Update: {
          academic_year?: string
          comments?: string | null
          created_at?: string
          id?: string
          position?: number | null
          report_url?: string | null
          student_id?: string | null
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "term_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      textbook_issues: {
        Row: {
          book_title: string
          condition: string | null
          created_at: string
          id: string
          issued_date: string | null
          returned_date: string | null
          student_id: string | null
        }
        Insert: {
          book_title: string
          condition?: string | null
          created_at?: string
          id?: string
          issued_date?: string | null
          returned_date?: string | null
          student_id?: string | null
        }
        Update: {
          book_title?: string
          condition?: string | null
          created_at?: string
          id?: string
          issued_date?: string | null
          returned_date?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "textbook_issues_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_entries: {
        Row: {
          class_id: string | null
          created_at: string
          day_of_week: number
          end_time: string | null
          id: string
          room: string | null
          start_time: string | null
          subject_id: string | null
          teacher_id: string | null
          term: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          day_of_week: number
          end_time?: string | null
          id?: string
          room?: string | null
          start_time?: string | null
          subject_id?: string | null
          teacher_id?: string | null
          term?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string
          day_of_week?: number
          end_time?: string | null
          id?: string
          room?: string | null
          start_time?: string | null
          subject_id?: string | null
          teacher_id?: string | null
          term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timetable_entries_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "staff_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tt_conflicts: {
        Row: {
          conflict_type: string
          created_at: string
          definition_id: string
          description: string
          id: string
          resolved: boolean
          resolved_at: string | null
          severity: string
          slot_ids: Json | null
        }
        Insert: {
          conflict_type: string
          created_at?: string
          definition_id: string
          description: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          slot_ids?: Json | null
        }
        Update: {
          conflict_type?: string
          created_at?: string
          definition_id?: string
          description?: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          slot_ids?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "tt_conflicts_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "tt_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      tt_definitions: {
        Row: {
          academic_year: string | null
          breaks: Json | null
          class_label: string | null
          created_at: string
          created_by: string | null
          day_start_time: string | null
          end_date: string | null
          id: string
          name: string
          period_minutes: number | null
          periods_per_day: number | null
          school_days: number[] | null
          settings: Json | null
          start_date: string | null
          status: string
          term: string | null
          type: string
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          breaks?: Json | null
          class_label?: string | null
          created_at?: string
          created_by?: string | null
          day_start_time?: string | null
          end_date?: string | null
          id?: string
          name: string
          period_minutes?: number | null
          periods_per_day?: number | null
          school_days?: number[] | null
          settings?: Json | null
          start_date?: string | null
          status?: string
          term?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          breaks?: Json | null
          class_label?: string | null
          created_at?: string
          created_by?: string | null
          day_start_time?: string | null
          end_date?: string | null
          id?: string
          name?: string
          period_minutes?: number | null
          periods_per_day?: number | null
          school_days?: number[] | null
          settings?: Json | null
          start_date?: string | null
          status?: string
          term?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      tt_exam_slots: {
        Row: {
          capacity: number | null
          class_label: string | null
          created_at: string
          definition_id: string
          end_time: string | null
          exam_date: string
          id: string
          invigilator_name: string | null
          notes: string | null
          session: string
          start_time: string | null
          subject_name: string | null
          venue: string | null
        }
        Insert: {
          capacity?: number | null
          class_label?: string | null
          created_at?: string
          definition_id: string
          end_time?: string | null
          exam_date: string
          id?: string
          invigilator_name?: string | null
          notes?: string | null
          session: string
          start_time?: string | null
          subject_name?: string | null
          venue?: string | null
        }
        Update: {
          capacity?: number | null
          class_label?: string | null
          created_at?: string
          definition_id?: string
          end_time?: string | null
          exam_date?: string
          id?: string
          invigilator_name?: string | null
          notes?: string | null
          session?: string
          start_time?: string | null
          subject_name?: string | null
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tt_exam_slots_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "tt_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      tt_slots: {
        Row: {
          break_label: string | null
          created_at: string
          day_of_week: number
          definition_id: string
          end_time: string
          id: string
          is_break: boolean
          is_manual_override: boolean
          notes: string | null
          period_index: number
          room: string | null
          start_time: string
          subject_color: string | null
          subject_name: string | null
          teacher_name: string | null
        }
        Insert: {
          break_label?: string | null
          created_at?: string
          day_of_week: number
          definition_id: string
          end_time: string
          id?: string
          is_break?: boolean
          is_manual_override?: boolean
          notes?: string | null
          period_index: number
          room?: string | null
          start_time: string
          subject_color?: string | null
          subject_name?: string | null
          teacher_name?: string | null
        }
        Update: {
          break_label?: string | null
          created_at?: string
          day_of_week?: number
          definition_id?: string
          end_time?: string
          id?: string
          is_break?: boolean
          is_manual_override?: boolean
          notes?: string | null
          period_index?: number
          room?: string | null
          start_time?: string
          subject_color?: string | null
          subject_name?: string | null
          teacher_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tt_slots_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "tt_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_by: string | null
          blocked_user_id: string
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_by?: string | null
          blocked_user_id: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_by?: string | null
          blocked_user_id?: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          reported_user_id: string | null
          reporter_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          reported_user_id?: string | null
          reporter_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          reported_user_id?: string | null
          reporter_id?: string | null
          status?: string | null
        }
        Relationships: []
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
      staff_public: {
        Row: {
          bio: string | null
          category: string | null
          department: string | null
          full_name: string | null
          id: string | null
          photo_url: string | null
          qualifications: string | null
          title: string | null
        }
        Insert: {
          bio?: string | null
          category?: string | null
          department?: string | null
          full_name?: string | null
          id?: string | null
          photo_url?: string | null
          qualifications?: string | null
          title?: string | null
        }
        Update: {
          bio?: string | null
          category?: string | null
          department?: string | null
          full_name?: string | null
          id?: string | null
          photo_url?: string | null
          qualifications?: string | null
          title?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      build_invoice_for_student: {
        Args: { _student_id: string }
        Returns: string
      }
      delete_student_cascade: {
        Args: { _student_id: string }
        Returns: undefined
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_finance_admin: { Args: { _uid: string }; Returns: boolean }
      is_school_admin: { Args: { _uid: string }; Returns: boolean }
      recalculate_invoice_payment_totals: {
        Args: { _invoice_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "teacher"
        | "student"
        | "parent"
        | "staff"
        | "hod"
        | "registration"
        | "supervisor"
        | "finance"
        | "principal"
        | "deputy_principal"
        | "admin_supervisor"
        | "bursar"
        | "finance_clerk"
      grant_type: "paid" | "complimentary" | "trial" | "suspended"
      payment_method:
        | "ecocash"
        | "onemoney"
        | "telecash"
        | "paynow_web"
        | "bank_transfer"
        | "visa_mastercard"
        | "manual"
        | "card"
        | "eft"
        | "snapscan"
        | "zapper"
      payment_status:
        | "pending"
        | "paid"
        | "failed"
        | "cancelled"
        | "refunded"
        | "awaiting_verification"
        | "rejected"
      subscription_plan_type: "monthly" | "term" | "custom"
      subscription_status:
        | "active"
        | "expired"
        | "pending"
        | "suspended"
        | "complimentary"
        | "trial"
        | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "admin",
        "teacher",
        "student",
        "parent",
        "staff",
        "hod",
        "registration",
        "supervisor",
        "finance",
        "principal",
        "deputy_principal",
        "admin_supervisor",
        "bursar",
        "finance_clerk",
      ],
      grant_type: ["paid", "complimentary", "trial", "suspended"],
      payment_method: [
        "ecocash",
        "onemoney",
        "telecash",
        "paynow_web",
        "bank_transfer",
        "visa_mastercard",
        "manual",
        "card",
        "eft",
        "snapscan",
        "zapper",
      ],
      payment_status: [
        "pending",
        "paid",
        "failed",
        "cancelled",
        "refunded",
        "awaiting_verification",
        "rejected",
      ],
      subscription_plan_type: ["monthly", "term", "custom"],
      subscription_status: [
        "active",
        "expired",
        "pending",
        "suspended",
        "complimentary",
        "trial",
        "cancelled",
      ],
    },
  },
} as const

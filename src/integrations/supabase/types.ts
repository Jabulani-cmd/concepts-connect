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
      academic_years: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          is_current: boolean
          name: string
          starts_on: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          is_current?: boolean
          name: string
          starts_on: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          is_current?: boolean
          name?: string
          starts_on?: string
          updated_at?: string
        }
        Relationships: []
      }
      access_grants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          reason: string | null
          student_id: string | null
          term: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          reason?: string | null
          student_id?: string | null
          term?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          reason?: string | null
          student_id?: string | null
          term?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience_roles: Database["public"]["Enums"]["app_role"][]
          body: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience_roles?: Database["public"]["Enums"]["app_role"][]
          body: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience_roles?: Database["public"]["Enums"]["app_role"][]
          body?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      assessments: {
        Row: {
          assessment_type: string
          class_subject_id: string
          created_at: string
          created_by: string
          description: string | null
          due_at: string | null
          id: string
          published: boolean
          term_id: string
          title: string
          total_marks: number
          updated_at: string
        }
        Insert: {
          assessment_type?: string
          class_subject_id: string
          created_at?: string
          created_by: string
          description?: string | null
          due_at?: string | null
          id?: string
          published?: boolean
          term_id: string
          title: string
          total_marks: number
          updated_at?: string
        }
        Update: {
          assessment_type?: string
          class_subject_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          due_at?: string | null
          id?: string
          published?: boolean
          term_id?: string
          title?: string
          total_marks?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_class_subject_id_fkey"
            columns: ["class_subject_id"]
            isOneToOne: false
            referencedRelation: "class_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
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
          is_published: boolean
          notes: string | null
          status: string
          student_id: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          date: string
          id?: string
          is_published?: boolean
          notes?: string | null
          status?: string
          student_id: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          date?: string
          id?: string
          is_published?: boolean
          notes?: string | null
          status?: string
          student_id?: string
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
      attendance_records: {
        Row: {
          created_at: string
          id: string
          note: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          attendance_date: string
          class_id: string
          class_subject_id: string | null
          created_at: string
          id: string
          taken_by: string
          updated_at: string
        }
        Insert: {
          attendance_date: string
          class_id: string
          class_subject_id?: string | null
          created_at?: string
          id?: string
          taken_by: string
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          class_id?: string
          class_subject_id?: string | null
          created_at?: string
          id?: string
          taken_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_class_subject_id_fkey"
            columns: ["class_subject_id"]
            isOneToOne: false
            referencedRelation: "class_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      award_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
        }
        Relationships: []
      }
      awards: {
        Row: {
          created_at: string
          id: string
          recipient: string
          title: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          recipient: string
          title: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          recipient?: string
          title?: string
          year?: number
        }
        Relationships: []
      }
      bank_transactions: {
        Row: {
          account_number: string | null
          amount_usd: number
          amount_zig: number | null
          bank_name: string | null
          created_at: string
          description: string
          id: string
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
          amount_zig?: number | null
          bank_name?: string | null
          created_at?: string
          description: string
          id?: string
          notes?: string | null
          reconciliation_status?: string
          recorded_by?: string | null
          reference_number?: string | null
          transaction_date: string
          transaction_type?: string
        }
        Update: {
          account_number?: string | null
          amount_usd?: number
          amount_zig?: number | null
          bank_name?: string | null
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          reconciliation_status?: string
          recorded_by?: string | null
          reference_number?: string | null
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: []
      }
      class_subjects: {
        Row: {
          academic_year_id: string | null
          class_id: string
          created_at: string
          id: string
          subject_id: string
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          academic_year_id?: string | null
          class_id: string
          created_at?: string
          id?: string
          subject_id: string
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          academic_year_id?: string | null
          class_id?: string
          created_at?: string
          id?: string
          subject_id?: string
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "class_subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          academic_year: string | null
          active: boolean
          capacity: number | null
          class_teacher_id: string | null
          created_at: string
          id: string
          level: string | null
          level_name: string | null
          name: string
          stream: string | null
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          active?: boolean
          capacity?: number | null
          class_teacher_id?: string | null
          created_at?: string
          id?: string
          level?: string | null
          level_name?: string | null
          name: string
          stream?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          active?: boolean
          capacity?: number | null
          class_teacher_id?: string | null
          created_at?: string
          id?: string
          level?: string | null
          level_name?: string | null
          name?: string
          stream?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
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
          created_by: string
          id: string
          name: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          academic_year_id: string
          class_id: string
          created_at: string
          enrolled_on: string
          id: string
          status: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          class_id: string
          created_at?: string
          enrolled_on?: string
          id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          class_id?: string
          created_at?: string
          enrolled_on?: string
          id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
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
      exam_timetable_entries: {
        Row: {
          created_at: string
          end_time: string
          exam_date: string
          exam_id: string
          id: string
          invigilators: string[] | null
          notes: string | null
          start_time: string
          subject_id: string | null
          venue: string | null
        }
        Insert: {
          created_at?: string
          end_time: string
          exam_date: string
          exam_id: string
          id?: string
          invigilators?: string[] | null
          notes?: string | null
          start_time: string
          subject_id?: string | null
          venue?: string | null
        }
        Update: {
          created_at?: string
          end_time?: string
          exam_date?: string
          exam_id?: string
          id?: string
          invigilators?: string[] | null
          notes?: string | null
          start_time?: string
          subject_id?: string | null
          venue?: string | null
        }
        Relationships: [
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
          form_level: string | null
          id: string
          is_published: boolean
          name: string
          subject_ids: string[] | null
          term: string | null
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          created_at?: string
          form_level?: string | null
          id?: string
          is_published?: boolean
          name: string
          subject_ids?: string[] | null
          term?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          created_at?: string
          form_level?: string | null
          id?: string
          is_published?: boolean
          name?: string
          subject_ids?: string[] | null
          term?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          created_at: string
          effective_from: string
          id: string
          set_by: string
          usd_to_zig: number
        }
        Insert: {
          created_at?: string
          effective_from?: string
          id?: string
          set_by: string
          usd_to_zig: number
        }
        Update: {
          created_at?: string
          effective_from?: string
          id?: string
          set_by?: string
          usd_to_zig?: number
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount_usd: number
          category: string
          created_at: string
          description: string
          expense_date: string
          id: string
          recorded_by: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount_usd: number
          category: string
          created_at?: string
          description: string
          expense_date?: string
          id?: string
          recorded_by: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount_usd?: number
          category?: string
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          recorded_by?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      facility_images: {
        Row: {
          caption: string | null
          created_at: string
          facility_type: string | null
          id: string
          image_url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          facility_type?: string | null
          id?: string
          image_url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          facility_type?: string | null
          id?: string
          image_url?: string
        }
        Relationships: []
      }
      fee_structures: {
        Row: {
          active: boolean
          amount_usd: number
          class_id: string
          created_at: string
          due_date: string | null
          id: string
          name: string
          term_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_usd: number
          class_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          name: string
          term_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_usd?: number
          class_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          name?: string
          term_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_structures_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          unit_amount_usd: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          unit_amount_usd: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          unit_amount_usd?: number
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
          created_at: string
          created_by: string
          due_on: string | null
          id: string
          invoice_number: string
          issued_on: string | null
          notes: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          term_id: string
          total_usd: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          due_on?: string | null
          id?: string
          invoice_number: string
          issued_on?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          term_id: string
          total_usd?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          due_on?: string | null
          id?: string
          invoice_number?: string
          issued_on?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id?: string
          term_id?: string
          total_usd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      marks: {
        Row: {
          assessment_id: string
          created_at: string
          entered_by: string
          id: string
          moderated: boolean
          score: number
          student_id: string
          teacher_comment: string | null
          updated_at: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          entered_by: string
          id?: string
          moderated?: boolean
          score: number
          student_id: string
          teacher_comment?: string | null
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          entered_by?: string
          id?: string
          moderated?: boolean
          score?: number
          student_id?: string
          teacher_comment?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marks_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          message_type: string
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          message_type?: string
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_type?: string
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
      parent_access_plans: {
        Row: {
          active: boolean
          created_at: string
          expires_on: string | null
          guardian_id: string
          id: string
          notes: string | null
          plan_type: Database["public"]["Enums"]["access_plan_type"]
          starts_on: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          expires_on?: string | null
          guardian_id: string
          id?: string
          notes?: string | null
          plan_type: Database["public"]["Enums"]["access_plan_type"]
          starts_on: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          expires_on?: string | null
          guardian_id?: string
          id?: string
          notes?: string | null
          plan_type?: Database["public"]["Enums"]["access_plan_type"]
          starts_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_access_plans_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_student_links: {
        Row: {
          created_at: string
          id: string
          parent_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_student_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_students: {
        Row: {
          created_at: string
          id: string
          parent_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_usd: number
          created_at: string
          id: string
          invoice_id: string | null
          method: Database["public"]["Enums"]["payment_method"]
          paid_at: string
          receipt_number: string
          recorded_by: string
          reference: string | null
          student_id: string
          updated_at: string
          zig_rate: number | null
        }
        Insert: {
          amount_usd: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          method: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          receipt_number: string
          recorded_by: string
          reference?: string | null
          student_id: string
          updated_at?: string
          zig_rate?: number | null
        }
        Update: {
          amount_usd?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          receipt_number?: string
          recorded_by?: string
          reference?: string | null
          student_id?: string
          updated_at?: string
          zig_rate?: number | null
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
        ]
      }
      personal_timetables: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          full_name: string
          id: string
          must_change_password: boolean
          phone: string | null
          preferred_language: string
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          full_name?: string
          id: string
          must_change_password?: boolean
          phone?: string | null
          preferred_language?: string
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          full_name?: string
          id?: string
          must_change_password?: boolean
          phone?: string | null
          preferred_language?: string
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          category: string | null
          created_at: string
          department: string | null
          department_id: string | null
          email: string | null
          employment_status: string | null
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          position: string | null
          role: string | null
          staff_number: string | null
          status: string | null
          subjects_taught: string[] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          email?: string | null
          employment_status?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          position?: string | null
          role?: string | null
          staff_number?: string | null
          status?: string | null
          subjects_taught?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          email?: string | null
          employment_status?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          position?: string | null
          role?: string | null
          staff_number?: string | null
          status?: string | null
          subjects_taught?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      student_classes: {
        Row: {
          academic_year: string | null
          class_id: string | null
          created_at: string
          id: string
          status: string
          student_id: string
          term: string | null
        }
        Insert: {
          academic_year?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          status?: string
          student_id: string
          term?: string | null
        }
        Update: {
          academic_year?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          status?: string
          student_id?: string
          term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_classes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_guardians: {
        Row: {
          can_collect: boolean
          created_at: string
          guardian_id: string
          id: string
          is_primary: boolean
          relationship: string
          student_id: string
        }
        Insert: {
          can_collect?: boolean
          created_at?: string
          guardian_id: string
          id?: string
          is_primary?: boolean
          relationship: string
          student_id: string
        }
        Update: {
          can_collect?: boolean
          created_at?: string
          guardian_id?: string
          id?: string
          is_primary?: boolean
          relationship?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_guardians_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_guardians_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          admission_number: string
          boarding_status: string | null
          class: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          emergency_contact: string | null
          enrollment_date: string | null
          enrollment_status: Database["public"]["Enums"]["enrollment_status"]
          first_name: string
          form: string | null
          full_name: string | null
          gender: Database["public"]["Enums"]["gender_type"] | null
          guardian_email: string | null
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          last_name: string
          phone: string | null
          province: string | null
          status: string | null
          stream: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          admission_number: string
          boarding_status?: string | null
          class?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact?: string | null
          enrollment_date?: string | null
          enrollment_status?: Database["public"]["Enums"]["enrollment_status"]
          first_name: string
          form?: string | null
          full_name?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          last_name: string
          phone?: string | null
          province?: string | null
          status?: string | null
          stream?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          admission_number?: string
          boarding_status?: string | null
          class?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact?: string | null
          enrollment_date?: string | null
          enrollment_status?: Database["public"]["Enums"]["enrollment_status"]
          first_name?: string
          form?: string | null
          full_name?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          last_name?: string
          phone?: string | null
          province?: string | null
          status?: string | null
          stream?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      subjects: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          department_id: string | null
          id: string
          is_examinable: boolean
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          is_examinable?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          is_examinable?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      terms: {
        Row: {
          academic_year_id: string
          created_at: string
          ends_on: string
          id: string
          is_current: boolean
          starts_on: string
          term_number: number
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          ends_on: string
          id?: string
          is_current?: boolean
          starts_on: string
          term_number: number
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          ends_on?: string
          id?: string
          is_current?: boolean
          starts_on?: string
          term_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "terms_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_entries: {
        Row: {
          class_id: string | null
          created_at: string
          day_of_week: number
          description: string | null
          end_time: string | null
          id: string
          room: string | null
          start_time: string
          subject_id: string | null
          teacher_id: string | null
          term: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          day_of_week: number
          description?: string | null
          end_time?: string | null
          id?: string
          room?: string | null
          start_time: string
          subject_id?: string | null
          teacher_id?: string | null
          term?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string
          day_of_week?: number
          description?: string | null
          end_time?: string | null
          id?: string
          room?: string | null
          start_time?: string
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
        ]
      }
      tt_definitions: {
        Row: {
          academic_year: string | null
          class_label: string | null
          created_at: string
          day_start_time: string
          description: string | null
          id: string
          name: string
          period_minutes: number
          periods_per_day: number
          school_days: number[]
          status: string
          term: string | null
          type: string
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          class_label?: string | null
          created_at?: string
          day_start_time?: string
          description?: string | null
          id?: string
          name: string
          period_minutes?: number
          periods_per_day?: number
          school_days?: number[]
          status?: string
          term?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          class_label?: string | null
          created_at?: string
          day_start_time?: string
          description?: string | null
          id?: string
          name?: string
          period_minutes?: number
          periods_per_day?: number
          school_days?: number[]
          status?: string
          term?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
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
          blocked_by: string
          blocked_user_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_by: string
          blocked_user_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_by?: string
          blocked_user_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reported_user_id: string
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reported_user_id: string
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          status?: string
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
      [_ in never]: never
    }
    Functions: {
      get_contact_directory: {
        Args: { _limit?: number; _search?: string }
        Returns: {
          email: string
          full_name: string
          id: string
          role: string
        }[]
      }
    }
    Enums: {
      access_plan_type: "termly" | "yearly" | "complimentary"
      app_role:
        | "admin"
        | "principal"
        | "deputy_principal"
        | "admin_supervisor"
        | "hod"
        | "teacher"
        | "student"
        | "parent"
        | "bursar"
        | "finance_clerk"
        | "registration_officer"
      attendance_status: "present" | "absent" | "late" | "excused"
      enrollment_status: "active" | "withdrawn" | "graduated" | "suspended"
      gender_type: "female" | "male" | "other" | "prefer_not_to_say"
      invoice_status:
        | "draft"
        | "issued"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "void"
      payment_method:
        | "cash"
        | "ecocash"
        | "onemoney"
        | "telecash"
        | "paynow"
        | "eft"
        | "card"
      profile_status: "active" | "suspended" | "invited"
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
      access_plan_type: ["termly", "yearly", "complimentary"],
      app_role: [
        "admin",
        "principal",
        "deputy_principal",
        "admin_supervisor",
        "hod",
        "teacher",
        "student",
        "parent",
        "bursar",
        "finance_clerk",
        "registration_officer",
      ],
      attendance_status: ["present", "absent", "late", "excused"],
      enrollment_status: ["active", "withdrawn", "graduated", "suspended"],
      gender_type: ["female", "male", "other", "prefer_not_to_say"],
      invoice_status: [
        "draft",
        "issued",
        "partially_paid",
        "paid",
        "overdue",
        "void",
      ],
      payment_method: [
        "cash",
        "ecocash",
        "onemoney",
        "telecash",
        "paynow",
        "eft",
        "card",
      ],
      profile_status: ["active", "suspended", "invited"],
    },
  },
} as const

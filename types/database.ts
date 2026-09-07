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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      applicant_documents: {
        Row: {
          applicant_id: string
          category: string
          created_at: string
          id: string
          job_application_id: string | null
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          applicant_id: string
          category: string
          created_at?: string
          id?: string
          job_application_id?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          applicant_id?: string
          category?: string
          created_at?: string
          id?: string
          job_application_id?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applicant_documents_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicant_documents_job_application_id_fkey"
            columns: ["job_application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicant_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      applicants: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          linkedin_url: string | null
          location: string | null
          phone: string | null
          portfolio_url: string | null
          profile_id: string | null
          resume_path: string | null
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          linkedin_url?: string | null
          location?: string | null
          phone?: string | null
          portfolio_url?: string | null
          profile_id?: string | null
          resume_path?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          linkedin_url?: string | null
          location?: string | null
          phone?: string | null
          portfolio_url?: string | null
          profile_id?: string | null
          resume_path?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applicants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      application_stage_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_stage: Database["public"]["Enums"]["application_stage"] | null
          id: string
          job_application_id: string
          notes: string | null
          to_stage: Database["public"]["Enums"]["application_stage"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_stage?: Database["public"]["Enums"]["application_stage"] | null
          id?: string
          job_application_id: string
          notes?: string | null
          to_stage: Database["public"]["Enums"]["application_stage"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_stage?: Database["public"]["Enums"]["application_stage"] | null
          id?: string
          job_application_id?: string
          notes?: string | null
          to_stage?: Database["public"]["Enums"]["application_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "application_stage_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_stage_history_job_application_id_fkey"
            columns: ["job_application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_actions: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          id: string
          notes: string | null
          request_id: string
          step_order: number
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          id?: string
          notes?: string | null
          request_id: string
          step_order: number
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          request_id?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "approval_actions_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_actions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          created_at: string
          current_step: number
          entity_id: string
          entity_type: string
          id: string
          organization_id: string | null
          payload: Json
          requester_user_id: string
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
          workflow_id: string
        }
        Insert: {
          created_at?: string
          current_step?: number
          entity_id: string
          entity_type: string
          id?: string
          organization_id?: string | null
          payload?: Json
          requester_user_id: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
          workflow_id: string
        }
        Update: {
          created_at?: string
          current_step?: number
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string | null
          payload?: Json
          requester_user_id?: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_requester_user_id_fkey"
            columns: ["requester_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_steps: {
        Row: {
          id: string
          name: string
          permission_code: string | null
          role_code: string | null
          step_order: number
          workflow_id: string
        }
        Insert: {
          id?: string
          name: string
          permission_code?: string | null
          role_code?: string | null
          step_order: number
          workflow_id: string
        }
        Update: {
          id?: string
          name?: string
          permission_code?: string | null
          role_code?: string | null
          step_order?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_workflows: {
        Row: {
          active: boolean
          code: string
          created_at: string
          entity_type: string
          id: string
          name: string
          organization_id: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          entity_type: string
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          entity_type?: string
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          assessment_type: string
          completed_at: string | null
          created_at: string
          id: string
          job_application_id: string
          max_score: number | null
          notes: string | null
          score: number | null
          title: string
          updated_at: string
        }
        Insert: {
          assessment_type?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          job_application_id: string
          max_score?: number | null
          notes?: string | null
          score?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          assessment_type?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          job_application_id?: string
          max_score?: number | null
          notes?: string | null
          score?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_job_application_id_fkey"
            columns: ["job_application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_correction_requests: {
        Row: {
          attachment_url: string | null
          attendance_record_id: string
          created_at: string
          employee_id: string
          id: string
          reason: string
          requested_clock_in_at: string | null
          requested_clock_out_at: string | null
          review_notes: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["correction_request_status"]
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          attendance_record_id: string
          created_at?: string
          employee_id: string
          id?: string
          reason: string
          requested_clock_in_at?: string | null
          requested_clock_out_at?: string | null
          review_notes?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["correction_request_status"]
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          attendance_record_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          reason?: string
          requested_clock_in_at?: string | null
          requested_clock_out_at?: string | null
          review_notes?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["correction_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_correction_requests_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_correction_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "attendance_correction_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_correction_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_events: {
        Row: {
          accuracy_meters: number | null
          client_reported_at: string | null
          created_at: string
          created_by: string | null
          device_id: string | null
          employee_id: string
          event_type: Database["public"]["Enums"]["attendance_event_type"]
          id: string
          ip_address: unknown
          latitude: number | null
          longitude: number | null
          server_recorded_at: string
          shift_assignment_id: string | null
          source: Database["public"]["Enums"]["attendance_source"]
        }
        Insert: {
          accuracy_meters?: number | null
          client_reported_at?: string | null
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          employee_id: string
          event_type: Database["public"]["Enums"]["attendance_event_type"]
          id?: string
          ip_address?: unknown
          latitude?: number | null
          longitude?: number | null
          server_recorded_at?: string
          shift_assignment_id?: string | null
          source?: Database["public"]["Enums"]["attendance_source"]
        }
        Update: {
          accuracy_meters?: number | null
          client_reported_at?: string | null
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          employee_id?: string
          event_type?: Database["public"]["Enums"]["attendance_event_type"]
          id?: string
          ip_address?: unknown
          latitude?: number | null
          longitude?: number | null
          server_recorded_at?: string
          shift_assignment_id?: string | null
          source?: Database["public"]["Enums"]["attendance_source"]
        }
        Relationships: [
          {
            foreignKeyName: "attendance_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "attendance_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_shift_assignment_id_fkey"
            columns: ["shift_assignment_id"]
            isOneToOne: false
            referencedRelation: "shift_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_policies: {
        Row: {
          active: boolean
          auto_deduct_break: boolean
          break_minutes: number
          client_organization_id: string | null
          client_timesheet_approval_required: boolean
          created_at: string
          grace_minutes: number
          id: string
          name: string
          organization_id: string
          overtime_enabled: boolean
          overtime_requires_approval: boolean
          required_minutes_per_day: number | null
          required_minutes_per_week: number | null
          schedule_type: Database["public"]["Enums"]["schedule_type"]
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          auto_deduct_break?: boolean
          break_minutes?: number
          client_organization_id?: string | null
          client_timesheet_approval_required?: boolean
          created_at?: string
          grace_minutes?: number
          id?: string
          name: string
          organization_id: string
          overtime_enabled?: boolean
          overtime_requires_approval?: boolean
          required_minutes_per_day?: number | null
          required_minutes_per_week?: number | null
          schedule_type?: Database["public"]["Enums"]["schedule_type"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          auto_deduct_break?: boolean
          break_minutes?: number
          client_organization_id?: string | null
          client_timesheet_approval_required?: boolean
          created_at?: string
          grace_minutes?: number
          id?: string
          name?: string
          organization_id?: string
          overtime_enabled?: boolean
          overtime_requires_approval?: boolean
          required_minutes_per_day?: number | null
          required_minutes_per_week?: number | null
          schedule_type?: Database["public"]["Enums"]["schedule_type"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_policies_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          approval_status: Database["public"]["Enums"]["timesheet_approval_status"]
          break_minutes: number
          clock_in_at: string | null
          clock_out_at: string | null
          created_at: string
          employee_id: string
          id: string
          late_minutes: number
          overtime_minutes: number
          shift_assignment_id: string | null
          status: Database["public"]["Enums"]["attendance_record_status"]
          undertime_minutes: number
          updated_at: string
          work_date: string
          worked_minutes: number
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["timesheet_approval_status"]
          break_minutes?: number
          clock_in_at?: string | null
          clock_out_at?: string | null
          created_at?: string
          employee_id: string
          id?: string
          late_minutes?: number
          overtime_minutes?: number
          shift_assignment_id?: string | null
          status?: Database["public"]["Enums"]["attendance_record_status"]
          undertime_minutes?: number
          updated_at?: string
          work_date: string
          worked_minutes?: number
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["timesheet_approval_status"]
          break_minutes?: number
          clock_in_at?: string | null
          clock_out_at?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          late_minutes?: number
          overtime_minutes?: number
          shift_assignment_id?: string | null
          status?: Database["public"]["Enums"]["attendance_record_status"]
          undertime_minutes?: number
          updated_at?: string
          work_date?: string
          worked_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_shift_assignment_id_fkey"
            columns: ["shift_assignment_id"]
            isOneToOne: false
            referencedRelation: "shift_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          organization_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          organization_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          organization_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_accounts: {
        Row: {
          billing_email: string | null
          client_organization_id: string
          created_at: string
          currency: string
          id: string
          payment_terms_days: number
          status: Database["public"]["Enums"]["billing_account_status"]
          updated_at: string
        }
        Insert: {
          billing_email?: string | null
          client_organization_id: string
          created_at?: string
          currency?: string
          id?: string
          payment_terms_days?: number
          status?: Database["public"]["Enums"]["billing_account_status"]
          updated_at?: string
        }
        Update: {
          billing_email?: string | null
          client_organization_id?: string
          created_at?: string
          currency?: string
          id?: string
          payment_terms_days?: number
          status?: Database["public"]["Enums"]["billing_account_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_accounts_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_user_id: string | null
          body: string
          cover_image_url: string | null
          created_at: string
          excerpt: string
          id: string
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["cms_content_status"]
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author_user_id?: string | null
          body?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["cms_content_status"]
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string | null
          body?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["cms_content_status"]
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_studies: {
        Row: {
          body: string
          client_name: string | null
          created_at: string
          hero_image_url: string | null
          id: string
          industry: string | null
          published_at: string | null
          results: Json
          slug: string
          status: Database["public"]["Enums"]["cms_content_status"]
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          client_name?: string | null
          created_at?: string
          hero_image_url?: string | null
          id?: string
          industry?: string | null
          published_at?: string | null
          results?: Json
          slug: string
          status?: Database["public"]["Enums"]["cms_content_status"]
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          client_name?: string | null
          created_at?: string
          hero_image_url?: string | null
          id?: string
          industry?: string | null
          published_at?: string | null
          results?: Json
          slug?: string
          status?: Database["public"]["Enums"]["cms_content_status"]
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cash_advance_deductions: {
        Row: {
          amount: number
          cash_advance_id: string
          created_at: string
          deducted_at: string
          id: string
          payroll_record_id: string | null
        }
        Insert: {
          amount: number
          cash_advance_id: string
          created_at?: string
          deducted_at?: string
          id?: string
          payroll_record_id?: string | null
        }
        Update: {
          amount?: number
          cash_advance_id?: string
          created_at?: string
          deducted_at?: string
          id?: string
          payroll_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_advance_deductions_cash_advance_id_fkey"
            columns: ["cash_advance_id"]
            isOneToOne: false
            referencedRelation: "cash_advance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_advance_deductions_payroll_record_id_fkey"
            columns: ["payroll_record_id"]
            isOneToOne: false
            referencedRelation: "payroll_records"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_advance_requests: {
        Row: {
          approved_amount: number | null
          approved_by: string | null
          created_at: string
          employee_id: string
          finance_reviewed_by: string | null
          hr_reviewed_by: string | null
          id: string
          reason: string
          released_at: string | null
          remaining_balance: number
          requested_amount: number
          requested_repayment_periods: number | null
          status: Database["public"]["Enums"]["cash_advance_status"]
          updated_at: string
        }
        Insert: {
          approved_amount?: number | null
          approved_by?: string | null
          created_at?: string
          employee_id: string
          finance_reviewed_by?: string | null
          hr_reviewed_by?: string | null
          id?: string
          reason: string
          released_at?: string | null
          remaining_balance?: number
          requested_amount: number
          requested_repayment_periods?: number | null
          status?: Database["public"]["Enums"]["cash_advance_status"]
          updated_at?: string
        }
        Update: {
          approved_amount?: number | null
          approved_by?: string | null
          created_at?: string
          employee_id?: string
          finance_reviewed_by?: string | null
          hr_reviewed_by?: string | null
          id?: string
          reason?: string
          released_at?: string | null
          remaining_balance?: number
          requested_amount?: number
          requested_repayment_periods?: number | null
          status?: Database["public"]["Enums"]["cash_advance_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_advance_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_advance_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "cash_advance_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_advance_requests_finance_reviewed_by_fkey"
            columns: ["finance_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_advance_requests_hr_reviewed_by_fkey"
            columns: ["hr_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_organization_id: string
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          job_title: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          client_organization_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          job_title?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          client_organization_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          job_title?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_profiles: {
        Row: {
          account_manager_employee_id: string | null
          billing_currency: string
          contract_end_date: string | null
          contract_start_date: string | null
          created_at: string
          industry: string | null
          notes: string | null
          organization_id: string
          primary_contact_email: string | null
          primary_contact_name: string | null
          relationship_start_date: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          account_manager_employee_id?: string | null
          billing_currency?: string
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          industry?: string | null
          notes?: string | null
          organization_id: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          relationship_start_date?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_manager_employee_id?: string | null
          billing_currency?: string
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          industry?: string | null
          notes?: string | null
          organization_id?: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          relationship_start_date?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_profiles_account_manager_employee_id_fkey"
            columns: ["account_manager_employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "client_profiles_account_manager_employee_id_fkey"
            columns: ["account_manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_settings: {
        Row: {
          allow_attendance_view: boolean
          allow_billing_view: boolean
          allow_documents_view: boolean
          allow_performance_view: boolean
          allow_ticketing: boolean
          allow_timesheet_approval: boolean
          client_organization_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          allow_attendance_view?: boolean
          allow_billing_view?: boolean
          allow_documents_view?: boolean
          allow_performance_view?: boolean
          allow_ticketing?: boolean
          allow_timesheet_approval?: boolean
          client_organization_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          allow_attendance_view?: boolean
          allow_billing_view?: boolean
          allow_documents_view?: boolean
          allow_performance_view?: boolean
          allow_ticketing?: boolean
          allow_timesheet_approval?: boolean
          client_organization_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_settings_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_periods: {
        Row: {
          created_at: string
          end_date: string
          id: string
          name: string
          organization_id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          name: string
          organization_id: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          organization_id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_periods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_records: {
        Row: {
          adjustment_amount: number
          approved_by: string | null
          base_amount: number | null
          basis_description: string
          calculated_amount: number
          commission_period_id: string
          commission_rate: number | null
          created_at: string
          employee_id: string
          final_amount: number
          id: string
          payroll_record_id: string | null
          status: Database["public"]["Enums"]["commission_record_status"]
          updated_at: string
        }
        Insert: {
          adjustment_amount?: number
          approved_by?: string | null
          base_amount?: number | null
          basis_description?: string
          calculated_amount?: number
          commission_period_id: string
          commission_rate?: number | null
          created_at?: string
          employee_id: string
          final_amount?: number
          id?: string
          payroll_record_id?: string | null
          status?: Database["public"]["Enums"]["commission_record_status"]
          updated_at?: string
        }
        Update: {
          adjustment_amount?: number
          approved_by?: string | null
          base_amount?: number | null
          basis_description?: string
          calculated_amount?: number
          commission_period_id?: string
          commission_rate?: number | null
          created_at?: string
          employee_id?: string
          final_amount?: number
          id?: string
          payroll_record_id?: string | null
          status?: Database["public"]["Enums"]["commission_record_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_records_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_records_commission_period_id_fkey"
            columns: ["commission_period_id"]
            isOneToOne: false
            referencedRelation: "commission_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "commission_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_records_payroll_record_id_fkey"
            columns: ["payroll_record_id"]
            isOneToOne: false
            referencedRelation: "payroll_records"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["crm_activity_type"]
          body: string
          completed_at: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          due_at: string | null
          id: string
          lead_id: string | null
          owner_user_id: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["crm_activity_type"]
          body?: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          owner_user_id?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["crm_activity_type"]
          body?: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          owner_user_id?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_companies: {
        Row: {
          country: string | null
          created_at: string
          id: string
          industry: string | null
          name: string
          notes: string
          size_range: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          name: string
          notes?: string
          size_range?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          name?: string
          notes?: string
          size_range?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      crm_contacts: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          job_title: string | null
          lead_id: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          job_title?: string | null
          lead_id?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          job_title?: string | null
          lead_id?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contracts: {
        Row: {
          client_organization_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deal_id: string | null
          document_path: string | null
          end_date: string | null
          id: string
          signed_at: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
          value: number | null
        }
        Insert: {
          client_organization_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          document_path?: string | null
          end_date?: string | null
          id?: string
          signed_at?: string | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          client_organization_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          document_path?: string | null
          end_date?: string | null
          id?: string
          signed_at?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contracts_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contracts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          company_id: string | null
          created_at: string
          currency: string
          estimated_value: number | null
          expected_close_date: string | null
          id: string
          lead_id: string | null
          lost_reason: string | null
          owner_user_id: string | null
          stage: Database["public"]["Enums"]["crm_deal_stage"]
          title: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          currency?: string
          estimated_value?: number | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          lost_reason?: string | null
          owner_user_id?: string | null
          stage?: Database["public"]["Enums"]["crm_deal_stage"]
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          currency?: string
          estimated_value?: number | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          lost_reason?: string | null
          owner_user_id?: string | null
          stage?: Database["public"]["Enums"]["crm_deal_stage"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          assigned_sales_user_id: string | null
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          id: string
          industry: string | null
          notes: string
          source: string
          status: Database["public"]["Enums"]["crm_lead_status"]
          updated_at: string
        }
        Insert: {
          assigned_sales_user_id?: string | null
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          notes?: string
          source?: string
          status?: Database["public"]["Enums"]["crm_lead_status"]
          updated_at?: string
        }
        Update: {
          assigned_sales_user_id?: string | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          notes?: string
          source?: string
          status?: Database["public"]["Enums"]["crm_lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_assigned_sales_user_id_fkey"
            columns: ["assigned_sales_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_proposals: {
        Row: {
          amount: number | null
          created_at: string
          created_by: string | null
          currency: string
          deal_id: string
          document_path: string | null
          id: string
          sent_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id: string
          document_path?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string
          document_path?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_proposals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_proposals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          id: string
          manager_employee_id: string | null
          name: string
          organization_id: string
          status: Database["public"]["Enums"]["department_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          manager_employee_id?: string | null
          name: string
          organization_id: string
          status?: Database["public"]["Enums"]["department_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          manager_employee_id?: string | null
          name?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["department_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_manager_employee_fk"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "departments_manager_employee_fk"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplinary_actions: {
        Row: {
          action_type: string
          created_at: string
          created_by: string | null
          effective_date: string
          id: string
          notes: string | null
          nte_case_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          created_by?: string | null
          effective_date: string
          id?: string
          notes?: string | null
          nte_case_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          created_by?: string | null
          effective_date?: string
          id?: string
          notes?: string | null
          nte_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disciplinary_actions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disciplinary_actions_nte_case_id_fkey"
            columns: ["nte_case_id"]
            isOneToOne: false
            referencedRelation: "nte_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          client_organization_id: string | null
          created_at: string
          employee_id: string | null
          expires_at: string | null
          id: string
          mime_type: string | null
          organization_id: string
          size_bytes: number | null
          storage_bucket: string
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string | null
          visibility: Database["public"]["Enums"]["visibility"]
        }
        Insert: {
          category: string
          client_organization_id?: string | null
          created_at?: string
          employee_id?: string | null
          expires_at?: string | null
          id?: string
          mime_type?: string | null
          organization_id: string
          size_bytes?: number | null
          storage_bucket: string
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Update: {
          category?: string
          client_organization_id?: string | null
          created_at?: string
          employee_id?: string | null
          expires_at?: string | null
          id?: string
          mime_type?: string | null
          organization_id?: string
          size_bytes?: number | null
          storage_bucket?: string
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_assignments: {
        Row: {
          account_manager_employee_id: string | null
          assignment_type: Database["public"]["Enums"]["assignment_type"]
          attendance_policy_id: string | null
          billable: boolean
          client_organization_id: string | null
          created_at: string
          employee_id: string
          end_date: string | null
          id: string
          role_title: string
          schedule_template_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["assignment_status"]
          updated_at: string
        }
        Insert: {
          account_manager_employee_id?: string | null
          assignment_type: Database["public"]["Enums"]["assignment_type"]
          attendance_policy_id?: string | null
          billable?: boolean
          client_organization_id?: string | null
          created_at?: string
          employee_id: string
          end_date?: string | null
          id?: string
          role_title?: string
          schedule_template_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
        }
        Update: {
          account_manager_employee_id?: string | null
          assignment_type?: Database["public"]["Enums"]["assignment_type"]
          attendance_policy_id?: string | null
          billable?: boolean
          client_organization_id?: string | null
          created_at?: string
          employee_id?: string
          end_date?: string | null
          id?: string
          role_title?: string
          schedule_template_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_assignments_account_manager_employee_id_fkey"
            columns: ["account_manager_employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employee_assignments_account_manager_employee_id_fkey"
            columns: ["account_manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_assignments_attendance_policy_id_fkey"
            columns: ["attendance_policy_id"]
            isOneToOne: false
            referencedRelation: "attendance_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_assignments_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employee_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_assignments_schedule_template_id_fkey"
            columns: ["schedule_template_id"]
            isOneToOne: false
            referencedRelation: "schedule_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          default_timezone: string
          department_id: string | null
          employee_number: string
          employment_status: Database["public"]["Enums"]["employment_status"]
          employment_type: Database["public"]["Enums"]["employment_type"]
          hire_date: string | null
          id: string
          job_title: string
          manager_employee_id: string | null
          organization_id: string
          payroll_profile_id: string | null
          personal_email: string | null
          profile_id: string | null
          regularization_date: string | null
          team_id: string | null
          termination_date: string | null
          updated_at: string
          work_email: string | null
        }
        Insert: {
          created_at?: string
          default_timezone?: string
          department_id?: string | null
          employee_number: string
          employment_status?: Database["public"]["Enums"]["employment_status"]
          employment_type?: Database["public"]["Enums"]["employment_type"]
          hire_date?: string | null
          id?: string
          job_title?: string
          manager_employee_id?: string | null
          organization_id: string
          payroll_profile_id?: string | null
          personal_email?: string | null
          profile_id?: string | null
          regularization_date?: string | null
          team_id?: string | null
          termination_date?: string | null
          updated_at?: string
          work_email?: string | null
        }
        Update: {
          created_at?: string
          default_timezone?: string
          department_id?: string | null
          employee_number?: string
          employment_status?: Database["public"]["Enums"]["employment_status"]
          employment_type?: Database["public"]["Enums"]["employment_type"]
          hire_date?: string | null
          id?: string
          job_title?: string
          manager_employee_id?: string | null
          organization_id?: string
          payroll_profile_id?: string | null
          personal_email?: string | null
          profile_id?: string | null
          regularization_date?: string | null
          team_id?: string | null
          termination_date?: string | null
          updated_at?: string
          work_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_employee_id_fkey"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employees_manager_employee_id_fkey"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_payroll_profile_fk"
            columns: ["payroll_profile_id"]
            isOneToOne: false
            referencedRelation: "payroll_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer: string
          category: string
          created_at: string
          id: string
          question: string
          sort_order: number
          status: Database["public"]["Enums"]["cms_content_status"]
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string
          created_at?: string
          id?: string
          question: string
          sort_order?: number
          status?: Database["public"]["Enums"]["cms_content_status"]
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          id?: string
          question?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["cms_content_status"]
          updated_at?: string
        }
        Relationships: []
      }
      holiday_calendars: {
        Row: {
          active: boolean
          client_organization_id: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          client_organization_id?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          client_organization_id?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holiday_calendars_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holiday_calendars_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          holiday_calendar_id: string
          holiday_date: string
          id: string
          is_recurring: boolean
          name: string
        }
        Insert: {
          created_at?: string
          holiday_calendar_id: string
          holiday_date: string
          id?: string
          is_recurring?: boolean
          name: string
        }
        Update: {
          created_at?: string
          holiday_calendar_id?: string
          holiday_date?: string
          id?: string
          is_recurring?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "holidays_holiday_calendar_id_fkey"
            columns: ["holiday_calendar_id"]
            isOneToOne: false
            referencedRelation: "holiday_calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      industries: {
        Row: {
          created_at: string
          description: string
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["cms_content_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["cms_content_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["cms_content_status"]
          updated_at?: string
        }
        Relationships: []
      }
      interviews: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          interviewer_user_id: string | null
          job_application_id: string
          location: string | null
          meeting_url: string | null
          notes: string | null
          scheduled_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          id?: string
          interviewer_user_id?: string | null
          job_application_id: string
          location?: string | null
          meeting_url?: string | null
          notes?: string | null
          scheduled_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          interviewer_user_id?: string | null
          job_application_id?: string
          location?: string | null
          meeting_url?: string | null
          notes?: string | null
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_interviewer_user_id_fkey"
            columns: ["interviewer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_job_application_id_fkey"
            columns: ["job_application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          employee_assignment_id: string | null
          id: string
          invoice_id: string
          quantity: number
          unit_rate: number
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          employee_assignment_id?: string | null
          id?: string
          invoice_id: string
          quantity?: number
          unit_rate?: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          employee_assignment_id?: string | null
          id?: string
          invoice_id?: string
          quantity?: number
          unit_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_employee_assignment_id_fkey"
            columns: ["employee_assignment_id"]
            isOneToOne: false
            referencedRelation: "employee_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: string | null
          paid_at: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: string | null
          paid_at?: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string | null
          paid_at?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          adjustments: number
          client_organization_id: string
          created_at: string
          currency: string
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          adjustments?: number
          client_organization_id: string
          created_at?: string
          currency?: string
          due_date: string
          id?: string
          invoice_number: string
          issue_date: string
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          adjustments?: number
          client_organization_id?: string
          created_at?: string
          currency?: string
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          applicant_id: string
          assigned_recruiter_user_id: string | null
          availability_date: string | null
          created_at: string
          id: string
          job_post_id: string
          notes: string | null
          salary_expectation: number | null
          stage: Database["public"]["Enums"]["application_stage"]
          updated_at: string
        }
        Insert: {
          applicant_id: string
          assigned_recruiter_user_id?: string | null
          availability_date?: string | null
          created_at?: string
          id?: string
          job_post_id: string
          notes?: string | null
          salary_expectation?: number | null
          stage?: Database["public"]["Enums"]["application_stage"]
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          assigned_recruiter_user_id?: string | null
          availability_date?: string | null
          created_at?: string
          id?: string
          job_post_id?: string
          notes?: string | null
          salary_expectation?: number | null
          stage?: Database["public"]["Enums"]["application_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_assigned_recruiter_user_id_fkey"
            columns: ["assigned_recruiter_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_job_post_id_fkey"
            columns: ["job_post_id"]
            isOneToOne: false
            referencedRelation: "job_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      job_posts: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          id: string
          location_text: string | null
          location_type: Database["public"]["Enums"]["location_type"]
          nice_to_have: string
          organization_id: string
          published_at: string | null
          requirements: string
          responsibilities: string
          salary_display: string | null
          slug: string
          status: Database["public"]["Enums"]["job_post_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          location_text?: string | null
          location_type?: Database["public"]["Enums"]["location_type"]
          nice_to_have?: string
          organization_id: string
          published_at?: string | null
          requirements?: string
          responsibilities?: string
          salary_display?: string | null
          slug: string
          status?: Database["public"]["Enums"]["job_post_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          location_text?: string | null
          location_type?: Database["public"]["Enums"]["location_type"]
          nice_to_have?: string
          organization_id?: string
          published_at?: string | null
          requirements?: string
          responsibilities?: string
          salary_display?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["job_post_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_posts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_posts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_attribution: {
        Row: {
          attributed_at: string
          created_at: string
          fbclid: string | null
          gclid: string | null
          id: string
          ip_address: unknown
          landing_page: string | null
          lead_id: string
          referrer_url: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          attributed_at?: string
          created_at?: string
          fbclid?: string | null
          gclid?: string | null
          id?: string
          ip_address?: unknown
          landing_page?: string | null
          lead_id: string
          referrer_url?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          attributed_at?: string
          created_at?: string
          fbclid?: string | null
          gclid?: string | null
          id?: string
          ip_address?: unknown
          landing_page?: string | null
          lead_id?: string
          referrer_url?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_attribution_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          adjustment_minutes: number
          created_at: string
          employee_id: string
          entitled_minutes: number
          id: string
          leave_type_id: string
          pending_minutes: number
          period_year: number
          updated_at: string
          used_minutes: number
        }
        Insert: {
          adjustment_minutes?: number
          created_at?: string
          employee_id: string
          entitled_minutes?: number
          id?: string
          leave_type_id: string
          pending_minutes?: number
          period_year: number
          updated_at?: string
          used_minutes?: number
        }
        Update: {
          adjustment_minutes?: number
          created_at?: string
          employee_id?: string
          entitled_minutes?: number
          id?: string
          leave_type_id?: string
          pending_minutes?: number
          period_year?: number
          updated_at?: string
          used_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          attachment_url: string | null
          created_at: string
          current_approver: string | null
          employee_id: string
          end_at: string
          id: string
          leave_type_id: string
          reason: string
          requested_minutes: number
          start_at: string
          status: Database["public"]["Enums"]["leave_request_status"]
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          current_approver?: string | null
          employee_id: string
          end_at: string
          id?: string
          leave_type_id: string
          reason?: string
          requested_minutes: number
          start_at: string
          status?: Database["public"]["Enums"]["leave_request_status"]
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          current_approver?: string | null
          employee_id?: string
          end_at?: string
          id?: string
          leave_type_id?: string
          reason?: string
          requested_minutes?: number
          start_at?: string
          status?: Database["public"]["Enums"]["leave_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_current_approver_fkey"
            columns: ["current_approver"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          organization_id: string
          paid: boolean
          requires_attachment: boolean
          unit: Database["public"]["Enums"]["leave_unit"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          paid?: boolean
          requires_attachment?: boolean
          unit?: Database["public"]["Enums"]["leave_unit"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          paid?: boolean
          requires_attachment?: boolean
          unit?: Database["public"]["Enums"]["leave_unit"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_roles: {
        Row: {
          membership_id: string
          role_id: string
        }
        Insert: {
          membership_id: string
          role_id: string
        }
        Update: {
          membership_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_roles_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          category_preferences: Json
          email_enabled: boolean
          in_app_enabled: boolean
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          category_preferences?: Json
          email_enabled?: boolean
          in_app_enabled?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          category_preferences?: Json
          email_enabled?: boolean
          in_app_enabled?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nte_cases: {
        Row: {
          case_number: string
          created_at: string
          description: string
          employee_id: string
          evidence_urls: Json
          id: string
          incident_date: string
          incident_type: string
          issued_at: string | null
          issued_by: string | null
          resolution_notes: string | null
          resolution_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          response_due_at: string | null
          status: Database["public"]["Enums"]["nte_case_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          case_number: string
          created_at?: string
          description: string
          employee_id: string
          evidence_urls?: Json
          id?: string
          incident_date: string
          incident_type: string
          issued_at?: string | null
          issued_by?: string | null
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          response_due_at?: string | null
          status?: Database["public"]["Enums"]["nte_case_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          case_number?: string
          created_at?: string
          description?: string
          employee_id?: string
          evidence_urls?: Json
          id?: string
          incident_date?: string
          incident_type?: string
          issued_at?: string | null
          issued_by?: string | null
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          response_due_at?: string | null
          status?: Database["public"]["Enums"]["nte_case_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nte_cases_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "nte_cases_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nte_cases_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nte_cases_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nte_responses: {
        Row: {
          attachment_urls: Json
          created_at: string
          employee_id: string
          id: string
          nte_case_id: string
          response_text: string
          submitted_at: string
        }
        Insert: {
          attachment_urls?: Json
          created_at?: string
          employee_id: string
          id?: string
          nte_case_id: string
          response_text: string
          submitted_at?: string
        }
        Update: {
          attachment_urls?: Json
          created_at?: string
          employee_id?: string
          id?: string
          nte_case_id?: string
          response_text?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nte_responses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "nte_responses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nte_responses_nte_case_id_fkey"
            columns: ["nte_case_id"]
            isOneToOne: false
            referencedRelation: "nte_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          membership_type: Database["public"]["Enums"]["membership_type"]
          organization_id: string
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          membership_type: Database["public"]["Enums"]["membership_type"]
          organization_id: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          membership_type?: Database["public"]["Enums"]["membership_type"]
          organization_id?: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          country: string | null
          created_at: string
          id: string
          legal_name: string | null
          logo_url: string | null
          name: string
          slug: string
          status: Database["public"]["Enums"]["org_status"]
          timezone: string
          type: Database["public"]["Enums"]["org_type"]
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          slug: string
          status?: Database["public"]["Enums"]["org_status"]
          timezone?: string
          type: Database["public"]["Enums"]["org_type"]
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["org_status"]
          timezone?: string
          type?: Database["public"]["Enums"]["org_type"]
          updated_at?: string
        }
        Relationships: []
      }
      overtime_requests: {
        Row: {
          approved_by: string | null
          created_at: string
          employee_id: string
          id: string
          reason: string
          requested_minutes: number
          status: Database["public"]["Enums"]["overtime_request_status"]
          updated_at: string
          work_date: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          employee_id: string
          id?: string
          reason: string
          requested_minutes: number
          status?: Database["public"]["Enums"]["overtime_request_status"]
          updated_at?: string
          work_date: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          reason?: string
          requested_minutes?: number
          status?: Database["public"]["Enums"]["overtime_request_status"]
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "overtime_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_components: {
        Row: {
          amount: number
          code: string
          created_at: string
          id: string
          label: string
          payroll_record_id: string
          quantity: number | null
          rate: number | null
          source_id: string | null
          source_type: string | null
          type: Database["public"]["Enums"]["payroll_component_type"]
        }
        Insert: {
          amount: number
          code: string
          created_at?: string
          id?: string
          label: string
          payroll_record_id: string
          quantity?: number | null
          rate?: number | null
          source_id?: string | null
          source_type?: string | null
          type: Database["public"]["Enums"]["payroll_component_type"]
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          id?: string
          label?: string
          payroll_record_id?: string
          quantity?: number | null
          rate?: number | null
          source_id?: string | null
          source_type?: string | null
          type?: Database["public"]["Enums"]["payroll_component_type"]
        }
        Relationships: [
          {
            foreignKeyName: "payroll_components_payroll_record_id_fkey"
            columns: ["payroll_record_id"]
            isOneToOne: false
            referencedRelation: "payroll_records"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_periods: {
        Row: {
          approved_by: string | null
          created_at: string
          created_by: string | null
          end_date: string
          finalized_at: string | null
          id: string
          name: string
          organization_id: string
          pay_date: string
          start_date: string
          status: Database["public"]["Enums"]["payroll_period_status"]
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          end_date: string
          finalized_at?: string | null
          id?: string
          name: string
          organization_id: string
          pay_date: string
          start_date: string
          status?: Database["public"]["Enums"]["payroll_period_status"]
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string
          finalized_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          pay_date?: string
          start_date?: string
          status?: Database["public"]["Enums"]["payroll_period_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_periods_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_periods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_periods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_profiles: {
        Row: {
          active: boolean
          base_salary: number | null
          compensation_type: Database["public"]["Enums"]["compensation_type"]
          created_at: string
          currency: string
          daily_rate: number | null
          employee_id: string
          hourly_rate: number | null
          id: string
          overtime_multiplier: number
          pay_frequency: Database["public"]["Enums"]["pay_frequency"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_salary?: number | null
          compensation_type?: Database["public"]["Enums"]["compensation_type"]
          created_at?: string
          currency?: string
          daily_rate?: number | null
          employee_id: string
          hourly_rate?: number | null
          id?: string
          overtime_multiplier?: number
          pay_frequency?: Database["public"]["Enums"]["pay_frequency"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_salary?: number | null
          compensation_type?: Database["public"]["Enums"]["compensation_type"]
          created_at?: string
          currency?: string
          daily_rate?: number | null
          employee_id?: string
          hourly_rate?: number | null
          id?: string
          overtime_multiplier?: number
          pay_frequency?: Database["public"]["Enums"]["pay_frequency"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_profiles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "payroll_profiles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_records: {
        Row: {
          absence_deduction: number
          allowances: number
          basic_pay: number
          bonuses: number
          calculation_snapshot: Json
          cash_advance_deduction: number
          commissions: number
          created_at: string
          employee_id: string
          gross_pay: number
          id: string
          incentives: number
          manual_adjustments: number
          net_pay: number
          other_deductions: number
          overtime_minutes: number
          overtime_pay: number
          paid_leave_amount: number
          payroll_period_id: string
          status: Database["public"]["Enums"]["payroll_record_status"]
          total_deductions: number
          undertime_deduction: number
          undertime_minutes: number
          unpaid_leave_deduction: number
          updated_at: string
          worked_minutes: number
        }
        Insert: {
          absence_deduction?: number
          allowances?: number
          basic_pay?: number
          bonuses?: number
          calculation_snapshot?: Json
          cash_advance_deduction?: number
          commissions?: number
          created_at?: string
          employee_id: string
          gross_pay?: number
          id?: string
          incentives?: number
          manual_adjustments?: number
          net_pay?: number
          other_deductions?: number
          overtime_minutes?: number
          overtime_pay?: number
          paid_leave_amount?: number
          payroll_period_id: string
          status?: Database["public"]["Enums"]["payroll_record_status"]
          total_deductions?: number
          undertime_deduction?: number
          undertime_minutes?: number
          unpaid_leave_deduction?: number
          updated_at?: string
          worked_minutes?: number
        }
        Update: {
          absence_deduction?: number
          allowances?: number
          basic_pay?: number
          bonuses?: number
          calculation_snapshot?: Json
          cash_advance_deduction?: number
          commissions?: number
          created_at?: string
          employee_id?: string
          gross_pay?: number
          id?: string
          incentives?: number
          manual_adjustments?: number
          net_pay?: number
          other_deductions?: number
          overtime_minutes?: number
          overtime_pay?: number
          paid_leave_amount?: number
          payroll_period_id?: string
          status?: Database["public"]["Enums"]["payroll_record_status"]
          total_deductions?: number
          undertime_deduction?: number
          undertime_minutes?: number
          unpaid_leave_deduction?: number
          updated_at?: string
          worked_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "payroll_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_records_payroll_period_id_fkey"
            columns: ["payroll_period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          created_at: string
          employee_id: string
          generated_at: string
          id: string
          payroll_record_id: string
          pdf_path: string | null
          version: number
        }
        Insert: {
          created_at?: string
          employee_id: string
          generated_at?: string
          id?: string
          payroll_record_id: string
          pdf_path?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          employee_id?: string
          generated_at?: string
          id?: string
          payroll_record_id?: string
          pdf_path?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_payroll_record_id_fkey"
            columns: ["payroll_record_id"]
            isOneToOne: true
            referencedRelation: "payroll_records"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_cycles: {
        Row: {
          created_at: string
          end_date: string
          id: string
          name: string
          organization_id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          name: string
          organization_id: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          organization_id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_cycles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_goals: {
        Row: {
          created_at: string
          current_value: number | null
          cycle_id: string | null
          description: string
          due_date: string | null
          employee_id: string
          id: string
          status: string
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility"]
        }
        Insert: {
          created_at?: string
          current_value?: number | null
          cycle_id?: string | null
          description?: string
          due_date?: string | null
          employee_id: string
          id?: string
          status?: string
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Update: {
          created_at?: string
          current_value?: number | null
          cycle_id?: string | null
          description?: string
          due_date?: string | null
          employee_id?: string
          id?: string
          status?: string
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "performance_goals_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "performance_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_goals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "performance_goals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_kpis: {
        Row: {
          actual_value: number | null
          code: string
          created_at: string
          cycle_id: string | null
          employee_id: string
          id: string
          label: string
          target_value: number | null
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility"]
          weight: number
        }
        Insert: {
          actual_value?: number | null
          code: string
          created_at?: string
          cycle_id?: string | null
          employee_id: string
          id?: string
          label: string
          target_value?: number | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          weight?: number
        }
        Update: {
          actual_value?: number | null
          code?: string
          created_at?: string
          cycle_id?: string | null
          employee_id?: string
          id?: string
          label?: string
          target_value?: number | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_kpis_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "performance_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_kpis_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "performance_kpis_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_reviews: {
        Row: {
          comments: string
          created_at: string
          cycle_id: string
          employee_id: string
          id: string
          overall_score: number | null
          reviewer_type: Database["public"]["Enums"]["performance_reviewer_type"]
          reviewer_user_id: string | null
          status: Database["public"]["Enums"]["performance_review_status"]
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility"]
        }
        Insert: {
          comments?: string
          created_at?: string
          cycle_id: string
          employee_id: string
          id?: string
          overall_score?: number | null
          reviewer_type: Database["public"]["Enums"]["performance_reviewer_type"]
          reviewer_user_id?: string | null
          status?: Database["public"]["Enums"]["performance_review_status"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Update: {
          comments?: string
          created_at?: string
          cycle_id?: string
          employee_id?: string
          id?: string
          overall_score?: number | null
          reviewer_type?: Database["public"]["Enums"]["performance_reviewer_type"]
          reviewer_user_id?: string | null
          status?: Database["public"]["Enums"]["performance_review_status"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "performance_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "performance_reviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reviews_reviewer_user_id_fkey"
            columns: ["reviewer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          id?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          first_name: string
          id: string
          last_login_at: string | null
          last_name: string
          locale: string
          middle_name: string | null
          phone: string | null
          status: Database["public"]["Enums"]["profile_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          first_name?: string
          id: string
          last_login_at?: string | null
          last_name?: string
          locale?: string
          middle_name?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          first_name?: string
          id?: string
          last_login_at?: string | null
          last_name?: string
          locale?: string
          middle_name?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_label: string | null
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          device_label?: string | null
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          device_label?: string | null
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          is_system: boolean
          name: string
          scope: Database["public"]["Enums"]["role_scope"]
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          id?: string
          is_system?: boolean
          name: string
          scope: Database["public"]["Enums"]["role_scope"]
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          is_system?: boolean
          name?: string
          scope?: Database["public"]["Enums"]["role_scope"]
        }
        Relationships: []
      }
      schedule_template_days: {
        Row: {
          break_minutes: number
          day_of_week: number
          end_time: string | null
          id: string
          is_rest_day: boolean
          schedule_template_id: string
          start_time: string | null
        }
        Insert: {
          break_minutes?: number
          day_of_week: number
          end_time?: string | null
          id?: string
          is_rest_day?: boolean
          schedule_template_id: string
          start_time?: string | null
        }
        Update: {
          break_minutes?: number
          day_of_week?: number
          end_time?: string | null
          id?: string
          is_rest_day?: boolean
          schedule_template_id?: string
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_template_days_schedule_template_id_fkey"
            columns: ["schedule_template_id"]
            isOneToOne: false
            referencedRelation: "schedule_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_templates: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          organization_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          organization_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          description: string
          icon: string | null
          id: string
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["cms_content_status"]
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          icon?: string | null
          id?: string
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["cms_content_status"]
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string | null
          id?: string
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["cms_content_status"]
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      shift_assignments: {
        Row: {
          assignment_id: string | null
          created_at: string
          employee_id: string
          id: string
          scheduled_end: string | null
          scheduled_start: string | null
          source: Database["public"]["Enums"]["shift_source"]
          status: Database["public"]["Enums"]["shift_assignment_status"]
          updated_at: string
          work_date: string
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string
          employee_id: string
          id?: string
          scheduled_end?: string | null
          scheduled_start?: string | null
          source?: Database["public"]["Enums"]["shift_source"]
          status?: Database["public"]["Enums"]["shift_assignment_status"]
          updated_at?: string
          work_date: string
        }
        Update: {
          assignment_id?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          scheduled_end?: string | null
          scheduled_start?: string | null
          source?: Database["public"]["Enums"]["shift_source"]
          status?: Database["public"]["Enums"]["shift_assignment_status"]
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_assignments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "employee_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "shift_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "site_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          name: string
          organization_id: string
          team_lead_employee_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          name: string
          organization_id: string
          team_lead_employee_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          name?: string
          organization_id?: string
          team_lead_employee_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_team_lead_employee_fk"
            columns: ["team_lead_employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "teams_team_lead_employee_fk"
            columns: ["team_lead_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          avatar_url: string | null
          client_name: string
          client_title: string | null
          company_name: string | null
          created_at: string
          id: string
          quote: string
          rating: number | null
          sort_order: number
          status: Database["public"]["Enums"]["cms_content_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          client_name: string
          client_title?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          quote: string
          rating?: number | null
          sort_order?: number
          status?: Database["public"]["Enums"]["cms_content_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          client_name?: string
          client_title?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          quote?: string
          rating?: number | null
          sort_order?: number
          status?: Database["public"]["Enums"]["cms_content_status"]
          updated_at?: string
        }
        Relationships: []
      }
      ticket_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          message_id: string | null
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          ticket_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          message_id?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          ticket_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          message_id?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          ticket_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ticket_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_internal_notes: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          ticket_id: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_internal_notes_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_internal_notes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_sla_policies: {
        Row: {
          active: boolean
          created_at: string
          first_response_minutes: number
          id: string
          name: string
          organization_id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolution_minutes: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          first_response_minutes: number
          id?: string
          name: string
          organization_id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolution_minutes: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          first_response_minutes?: number
          id?: string
          name?: string
          organization_id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolution_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_sla_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["ticket_status"] | null
          id: string
          notes: string | null
          ticket_id: string
          to_status: Database["public"]["Enums"]["ticket_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["ticket_status"] | null
          id?: string
          notes?: string | null
          ticket_id: string
          to_status: Database["public"]["Enums"]["ticket_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["ticket_status"] | null
          id?: string
          notes?: string | null
          ticket_id?: string
          to_status?: Database["public"]["Enums"]["ticket_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ticket_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_status_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_team: string | null
          assigned_user_id: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          client_organization_id: string | null
          created_at: string
          description: string
          employee_id: string | null
          first_response_at: string | null
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          requester_user_id: string
          resolved_at: string | null
          sla_due_at: string | null
          sla_policy_id: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          ticket_number: string
          updated_at: string
        }
        Insert: {
          assigned_team?: string | null
          assigned_user_id?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          client_organization_id?: string | null
          created_at?: string
          description?: string
          employee_id?: string | null
          first_response_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          requester_user_id: string
          resolved_at?: string | null
          sla_due_at?: string | null
          sla_policy_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          ticket_number: string
          updated_at?: string
        }
        Update: {
          assigned_team?: string | null
          assigned_user_id?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          client_organization_id?: string | null
          created_at?: string
          description?: string
          employee_id?: string | null
          first_response_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          requester_user_id?: string
          resolved_at?: string | null
          sla_due_at?: string | null
          sla_policy_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          ticket_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "tickets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_requester_user_id_fkey"
            columns: ["requester_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_sla_policy_id_fkey"
            columns: ["sla_policy_id"]
            isOneToOne: false
            referencedRelation: "ticket_sla_policies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      client_attendance_summary: {
        Row: {
          approval_status:
            | Database["public"]["Enums"]["timesheet_approval_status"]
            | null
          attendance_record_id: string | null
          break_minutes: number | null
          client_organization_id: string | null
          clock_in_at: string | null
          clock_out_at: string | null
          display_name: string | null
          employee_id: string | null
          employee_number: string | null
          job_title: string | null
          late_minutes: number | null
          overtime_minutes: number | null
          role_title: string | null
          status: Database["public"]["Enums"]["attendance_record_status"] | null
          work_date: string | null
          worked_minutes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "client_visible_employees"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_assignments_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_visible_employees: {
        Row: {
          assignment_status:
            | Database["public"]["Enums"]["assignment_status"]
            | null
          billable: boolean | null
          client_organization_id: string | null
          display_name: string | null
          employee_id: string | null
          employee_number: string | null
          end_date: string | null
          job_title: string | null
          role_title: string | null
          start_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_assignments_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_payroll_record: {
        Args: { p_payroll_record_id: string }
        Returns: undefined
      }
      can_access_client: { Args: { p_org_id: string }; Returns: boolean }
      can_read_assigned_attendance: {
        Args: { p_employee_id: string }
        Returns: boolean
      }
      clock_event: {
        Args: {
          p_accuracy?: number
          p_device_id?: string
          p_employee_id: string
          p_event_type: string
          p_lat?: number
          p_lng?: number
        }
        Returns: string
      }
      current_membership_ids: { Args: never; Returns: string[] }
      current_uid: { Args: never; Returns: string }
      generate_employee_number: { Args: never; Returns: string }
      generate_ticket_number: { Args: never; Returns: string }
      has_any_permission: { Args: { p_codes: string[] }; Returns: boolean }
      has_permission: { Args: { p_code: string }; Returns: boolean }
      is_assigned_to_current_client: {
        Args: { p_employee_id: string }
        Returns: boolean
      }
      is_client_member: { Args: { p_org_id: string }; Returns: boolean }
      is_internal_user: { Args: never; Returns: boolean }
      is_self_employee: { Args: { p_employee_id: string }; Returns: boolean }
      user_permission_codes: { Args: never; Returns: string[] }
    }
    Enums: {
      application_stage:
        | "applied"
        | "screening"
        | "initial_interview"
        | "assessment"
        | "client_endorsement"
        | "client_interview"
        | "offer"
        | "hired"
        | "rejected"
        | "withdrawn"
        | "talent_pool"
        | "on_hold"
      approval_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "escalated"
      assignment_status: "active" | "pending" | "completed" | "cancelled"
      assignment_type: "internal" | "client"
      attendance_event_type:
        | "clock_in"
        | "break_start"
        | "break_end"
        | "clock_out"
      attendance_record_status:
        | "present"
        | "late"
        | "absent"
        | "leave"
        | "rest_day"
        | "holiday"
        | "incomplete"
      attendance_source: "pwa" | "web" | "admin"
      billing_account_status: "active" | "inactive" | "suspended"
      cash_advance_status:
        | "pending"
        | "hr_review"
        | "finance_review"
        | "approved"
        | "rejected"
        | "released"
        | "completed"
        | "cancelled"
      cms_content_status: "draft" | "published" | "archived"
      commission_record_status:
        | "draft"
        | "review"
        | "approved"
        | "included_in_payroll"
      compensation_type: "monthly_salary" | "hourly" | "daily"
      correction_request_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
      crm_activity_type:
        | "call"
        | "email"
        | "meeting"
        | "note"
        | "task"
        | "follow_up"
      crm_deal_stage:
        | "new_lead"
        | "contacted"
        | "qualified"
        | "discovery"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost"
        | "on_hold"
        | "follow_up_later"
      crm_lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "unqualified"
        | "converted"
        | "lost"
      department_status: "active" | "inactive"
      employment_status:
        | "active"
        | "on_leave"
        | "suspended"
        | "terminated"
        | "resigned"
      employment_type:
        | "regular"
        | "probationary"
        | "contractual"
        | "part_time"
        | "intern"
      invoice_status:
        | "draft"
        | "issued"
        | "sent"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "void"
      job_post_status: "draft" | "published" | "closed"
      leave_request_status:
        | "pending"
        | "manager_approved"
        | "hr_approved"
        | "approved"
        | "rejected"
        | "cancelled"
      leave_unit: "hours" | "days"
      location_type: "remote" | "onsite" | "hybrid"
      membership_status: "invited" | "active" | "suspended" | "inactive"
      membership_type: "internal" | "client" | "applicant"
      nte_case_status:
        | "draft"
        | "issued"
        | "awaiting_response"
        | "under_review"
        | "resolved"
      org_status: "active" | "inactive" | "onboarding"
      org_type: "internal" | "client"
      overtime_request_status: "pending" | "approved" | "rejected" | "cancelled"
      pay_frequency: "semi_monthly" | "monthly" | "weekly" | "hourly"
      payroll_component_type: "earning" | "deduction" | "adjustment"
      payroll_period_status:
        | "draft"
        | "preparing"
        | "review"
        | "approval"
        | "finalized"
        | "disbursed"
        | "closed"
      payroll_record_status:
        | "draft"
        | "calculated"
        | "review"
        | "approved"
        | "finalized"
        | "paid"
        | "void"
      performance_review_status:
        | "draft"
        | "in_progress"
        | "submitted"
        | "approved"
        | "archived"
      performance_reviewer_type: "self" | "manager" | "client" | "hr"
      profile_status: "active" | "invited" | "suspended" | "inactive"
      role_scope: "system" | "internal" | "client" | "applicant"
      schedule_type: "fixed" | "flexible"
      shift_assignment_status:
        | "scheduled"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
      shift_source: "template" | "override" | "manual"
      ticket_category:
        | "employee_concern"
        | "attendance"
        | "schedule_change"
        | "performance"
        | "replacement_request"
        | "additional_employee"
        | "payroll"
        | "billing"
        | "hr"
        | "technical"
        | "implementation"
        | "general"
      ticket_priority: "low" | "normal" | "high" | "urgent"
      ticket_status:
        | "new"
        | "assigned"
        | "in_progress"
        | "waiting_for_client"
        | "resolved"
        | "closed"
      timesheet_approval_status:
        | "draft"
        | "employee_review"
        | "supervisor_review"
        | "client_review"
        | "finalized"
      visibility:
        | "private"
        | "employee_visible"
        | "client_visible"
        | "internal"
        | "public"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      application_stage: [
        "applied",
        "screening",
        "initial_interview",
        "assessment",
        "client_endorsement",
        "client_interview",
        "offer",
        "hired",
        "rejected",
        "withdrawn",
        "talent_pool",
        "on_hold",
      ],
      approval_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "escalated",
      ],
      assignment_status: ["active", "pending", "completed", "cancelled"],
      assignment_type: ["internal", "client"],
      attendance_event_type: [
        "clock_in",
        "break_start",
        "break_end",
        "clock_out",
      ],
      attendance_record_status: [
        "present",
        "late",
        "absent",
        "leave",
        "rest_day",
        "holiday",
        "incomplete",
      ],
      attendance_source: ["pwa", "web", "admin"],
      billing_account_status: ["active", "inactive", "suspended"],
      cash_advance_status: [
        "pending",
        "hr_review",
        "finance_review",
        "approved",
        "rejected",
        "released",
        "completed",
        "cancelled",
      ],
      cms_content_status: ["draft", "published", "archived"],
      commission_record_status: [
        "draft",
        "review",
        "approved",
        "included_in_payroll",
      ],
      compensation_type: ["monthly_salary", "hourly", "daily"],
      correction_request_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
      ],
      crm_activity_type: [
        "call",
        "email",
        "meeting",
        "note",
        "task",
        "follow_up",
      ],
      crm_deal_stage: [
        "new_lead",
        "contacted",
        "qualified",
        "discovery",
        "proposal",
        "negotiation",
        "won",
        "lost",
        "on_hold",
        "follow_up_later",
      ],
      crm_lead_status: [
        "new",
        "contacted",
        "qualified",
        "unqualified",
        "converted",
        "lost",
      ],
      department_status: ["active", "inactive"],
      employment_status: [
        "active",
        "on_leave",
        "suspended",
        "terminated",
        "resigned",
      ],
      employment_type: [
        "regular",
        "probationary",
        "contractual",
        "part_time",
        "intern",
      ],
      invoice_status: [
        "draft",
        "issued",
        "sent",
        "partially_paid",
        "paid",
        "overdue",
        "void",
      ],
      job_post_status: ["draft", "published", "closed"],
      leave_request_status: [
        "pending",
        "manager_approved",
        "hr_approved",
        "approved",
        "rejected",
        "cancelled",
      ],
      leave_unit: ["hours", "days"],
      location_type: ["remote", "onsite", "hybrid"],
      membership_status: ["invited", "active", "suspended", "inactive"],
      membership_type: ["internal", "client", "applicant"],
      nte_case_status: [
        "draft",
        "issued",
        "awaiting_response",
        "under_review",
        "resolved",
      ],
      org_status: ["active", "inactive", "onboarding"],
      org_type: ["internal", "client"],
      overtime_request_status: ["pending", "approved", "rejected", "cancelled"],
      pay_frequency: ["semi_monthly", "monthly", "weekly", "hourly"],
      payroll_component_type: ["earning", "deduction", "adjustment"],
      payroll_period_status: [
        "draft",
        "preparing",
        "review",
        "approval",
        "finalized",
        "disbursed",
        "closed",
      ],
      payroll_record_status: [
        "draft",
        "calculated",
        "review",
        "approved",
        "finalized",
        "paid",
        "void",
      ],
      performance_review_status: [
        "draft",
        "in_progress",
        "submitted",
        "approved",
        "archived",
      ],
      performance_reviewer_type: ["self", "manager", "client", "hr"],
      profile_status: ["active", "invited", "suspended", "inactive"],
      role_scope: ["system", "internal", "client", "applicant"],
      schedule_type: ["fixed", "flexible"],
      shift_assignment_status: [
        "scheduled",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      shift_source: ["template", "override", "manual"],
      ticket_category: [
        "employee_concern",
        "attendance",
        "schedule_change",
        "performance",
        "replacement_request",
        "additional_employee",
        "payroll",
        "billing",
        "hr",
        "technical",
        "implementation",
        "general",
      ],
      ticket_priority: ["low", "normal", "high", "urgent"],
      ticket_status: [
        "new",
        "assigned",
        "in_progress",
        "waiting_for_client",
        "resolved",
        "closed",
      ],
      timesheet_approval_status: [
        "draft",
        "employee_review",
        "supervisor_review",
        "client_review",
        "finalized",
      ],
      visibility: [
        "private",
        "employee_visible",
        "client_visible",
        "internal",
        "public",
      ],
    },
  },
} as const

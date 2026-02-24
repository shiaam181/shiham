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
      announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          priority: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_updates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_critical: boolean | null
          title: string
          version: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_critical?: boolean | null
          title: string
          version: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_critical?: boolean | null
          title?: string
          version?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          admin_notes: string | null
          challenge_token: string | null
          check_in_face_verified: boolean | null
          check_in_latitude: number | null
          check_in_longitude: number | null
          check_in_photo_url: string | null
          check_in_time: string | null
          check_out_face_verified: boolean | null
          check_out_latitude: number | null
          check_out_longitude: number | null
          check_out_photo_url: string | null
          check_out_time: string | null
          created_at: string
          date: string
          face_confidence: number | null
          gps_timestamp: string | null
          id: string
          modified_by: string | null
          notes: string | null
          overtime_minutes: number | null
          status: string
          updated_at: string
          user_id: string
          verification_method: string | null
        }
        Insert: {
          admin_notes?: string | null
          challenge_token?: string | null
          check_in_face_verified?: boolean | null
          check_in_latitude?: number | null
          check_in_longitude?: number | null
          check_in_photo_url?: string | null
          check_in_time?: string | null
          check_out_face_verified?: boolean | null
          check_out_latitude?: number | null
          check_out_longitude?: number | null
          check_out_photo_url?: string | null
          check_out_time?: string | null
          created_at?: string
          date?: string
          face_confidence?: number | null
          gps_timestamp?: string | null
          id?: string
          modified_by?: string | null
          notes?: string | null
          overtime_minutes?: number | null
          status?: string
          updated_at?: string
          user_id: string
          verification_method?: string | null
        }
        Update: {
          admin_notes?: string | null
          challenge_token?: string | null
          check_in_face_verified?: boolean | null
          check_in_latitude?: number | null
          check_in_longitude?: number | null
          check_in_photo_url?: string | null
          check_in_time?: string | null
          check_out_face_verified?: boolean | null
          check_out_latitude?: number | null
          check_out_longitude?: number | null
          check_out_photo_url?: string | null
          check_out_time?: string | null
          created_at?: string
          date?: string
          face_confidence?: number | null
          gps_timestamp?: string | null
          id?: string
          modified_by?: string | null
          notes?: string | null
          overtime_minutes?: number | null
          status?: string
          updated_at?: string
          user_id?: string
          verification_method?: string | null
        }
        Relationships: []
      }
      attendance_challenges: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          brand_color: string | null
          brand_color_secondary: string | null
          created_at: string
          esi_registration_number: string | null
          face_verification_disabled: boolean
          gst_number: string | null
          id: string
          invite_code: string | null
          invite_expires_at: string | null
          invite_max_uses: number | null
          invite_uses_count: number | null
          is_active: boolean | null
          legal_name: string | null
          live_tracking_enabled: boolean | null
          logo_url: string | null
          name: string
          pan_number: string | null
          pay_cycle: string | null
          pay_day: number | null
          pf_registration_number: string | null
          pt_registration_number: string | null
          registered_address: string | null
          slug: string
          tagline: string | null
          tan_number: string | null
          tracking_interval_seconds: number | null
          updated_at: string
        }
        Insert: {
          brand_color?: string | null
          brand_color_secondary?: string | null
          created_at?: string
          esi_registration_number?: string | null
          face_verification_disabled?: boolean
          gst_number?: string | null
          id?: string
          invite_code?: string | null
          invite_expires_at?: string | null
          invite_max_uses?: number | null
          invite_uses_count?: number | null
          is_active?: boolean | null
          legal_name?: string | null
          live_tracking_enabled?: boolean | null
          logo_url?: string | null
          name: string
          pan_number?: string | null
          pay_cycle?: string | null
          pay_day?: number | null
          pf_registration_number?: string | null
          pt_registration_number?: string | null
          registered_address?: string | null
          slug: string
          tagline?: string | null
          tan_number?: string | null
          tracking_interval_seconds?: number | null
          updated_at?: string
        }
        Update: {
          brand_color?: string | null
          brand_color_secondary?: string | null
          created_at?: string
          esi_registration_number?: string | null
          face_verification_disabled?: boolean
          gst_number?: string | null
          id?: string
          invite_code?: string | null
          invite_expires_at?: string | null
          invite_max_uses?: number | null
          invite_uses_count?: number | null
          is_active?: boolean | null
          legal_name?: string | null
          live_tracking_enabled?: boolean | null
          logo_url?: string | null
          name?: string
          pan_number?: string | null
          pay_cycle?: string | null
          pay_day?: number | null
          pf_registration_number?: string | null
          pt_registration_number?: string | null
          registered_address?: string | null
          slug?: string
          tagline?: string | null
          tan_number?: string | null
          tracking_interval_seconds?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          company_logo_url: string | null
          company_name: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          default_shift_id: string | null
          id: string
          tagline: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_logo_url?: string | null
          company_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_shift_id?: string | null
          id?: string
          tagline?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_logo_url?: string | null
          company_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_shift_id?: string | null
          id?: string
          tagline?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_default_shift_id_fkey"
            columns: ["default_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_awards: {
        Row: {
          award_date: string
          award_title: string
          awarded_by: string
          created_at: string
          description: string | null
          id: string
          user_id: string
        }
        Insert: {
          award_date?: string
          award_title: string
          awarded_by: string
          created_at?: string
          description?: string | null
          id?: string
          user_id: string
        }
        Update: {
          award_date?: string
          award_title?: string
          awarded_by?: string
          created_at?: string
          description?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      employee_consent: {
        Row: {
          consented_at: string | null
          created_at: string | null
          id: string
          location_tracking_consented: boolean | null
          revoked_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          consented_at?: string | null
          created_at?: string | null
          id?: string
          location_tracking_consented?: boolean | null
          revoked_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          consented_at?: string | null
          created_at?: string | null
          id?: string
          location_tracking_consented?: boolean | null
          revoked_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      employee_feedback: {
        Row: {
          admin_response: string | null
          category: string
          created_at: string
          id: string
          is_anonymous: boolean | null
          message: string
          responded_at: string | null
          responded_by: string | null
          status: string | null
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          category?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean | null
          message: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string | null
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          category?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean | null
          message?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string | null
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employee_live_locations: {
        Row: {
          accuracy: number | null
          company_id: string | null
          created_at: string | null
          heading: number | null
          id: string
          latitude: number
          longitude: number
          recorded_at: string | null
          speed: number | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          company_id?: string | null
          created_at?: string | null
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string | null
          speed?: number | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          company_id?: string | null
          created_at?: string | null
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string | null
          speed?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_live_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_live_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      face_reference_images: {
        Row: {
          created_at: string
          embedding: Json | null
          id: string
          image_path: string
          is_active: boolean | null
          quality_score: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          embedding?: Json | null
          id?: string
          image_path: string
          is_active?: boolean | null
          quality_score?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          embedding?: Json | null
          id?: string
          image_path?: string
          is_active?: boolean | null
          quality_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      invite_usage_history: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invite_code: string
          ip_address: string | null
          joined_at: string
          user_agent: string | null
          user_email: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invite_code: string
          ip_address?: string | null
          joined_at?: string
          user_agent?: string | null
          user_email: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invite_code?: string
          ip_address?: string | null
          joined_at?: string
          user_agent?: string | null
          user_email?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_usage_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_usage_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          accrued: number
          carry_forward: number
          company_id: string | null
          created_at: string
          id: string
          leave_type: string
          opening_balance: number
          updated_at: string
          used: number
          user_id: string
          year: number
        }
        Insert: {
          accrued?: number
          carry_forward?: number
          company_id?: string | null
          created_at?: string
          id?: string
          leave_type?: string
          opening_balance?: number
          updated_at?: string
          used?: number
          user_id: string
          year?: number
        }
        Update: {
          accrued?: number
          carry_forward?: number
          company_id?: string | null
          created_at?: string
          id?: string
          leave_type?: string
          opening_balance?: number
          updated_at?: string
          used?: number
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_policies: {
        Row: {
          annual_quota: number
          carry_forward_limit: number | null
          company_id: string | null
          created_at: string
          encashment_allowed: boolean | null
          id: string
          is_active: boolean | null
          is_paid: boolean | null
          leave_type: string
          monthly_accrual: number
          updated_at: string
        }
        Insert: {
          annual_quota?: number
          carry_forward_limit?: number | null
          company_id?: string | null
          created_at?: string
          encashment_allowed?: boolean | null
          id?: string
          is_active?: boolean | null
          is_paid?: boolean | null
          leave_type: string
          monthly_accrual?: number
          updated_at?: string
        }
        Update: {
          annual_quota?: number
          carry_forward_limit?: number | null
          company_id?: string | null
          created_at?: string
          encashment_allowed?: boolean | null
          id?: string
          is_active?: boolean | null
          is_paid?: boolean | null
          leave_type?: string
          monthly_accrual?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_policies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_policies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          end_date: string
          id?: string
          leave_type?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          created_at: string
          id: string
          is_dismissed: boolean
          is_read: boolean
          notification_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_dismissed?: boolean
          is_read?: boolean
          notification_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_dismissed?: boolean
          is_read?: boolean
          notification_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      otp_rate_limits: {
        Row: {
          first_request_at: string | null
          id: string
          ip_address: string | null
          last_request_at: string | null
          phone: string
          request_count: number | null
        }
        Insert: {
          first_request_at?: string | null
          id?: string
          ip_address?: string | null
          last_request_at?: string | null
          phone: string
          request_count?: number | null
        }
        Update: {
          first_request_at?: string | null
          id?: string
          ip_address?: string | null
          last_request_at?: string | null
          phone?: string
          request_count?: number | null
        }
        Relationships: []
      }
      payroll_runs: {
        Row: {
          basic_salary: number | null
          created_at: string
          esi_employee: number | null
          esi_employer: number | null
          gross_salary: number | null
          hra: number | null
          id: string
          leave_days: number | null
          locked: boolean | null
          locked_at: string | null
          locked_by: string | null
          lop_days: number | null
          month: number
          net_salary: number | null
          other_allowances: number | null
          other_deductions_detail: Json | null
          overtime_hours: number | null
          pf_employee: number | null
          pf_employer: number | null
          present_days: number | null
          processed_at: string | null
          processed_by: string | null
          professional_tax: number | null
          special_allowance: number | null
          status: string
          tds: number | null
          total_deductions: number | null
          updated_at: string
          user_id: string
          working_days: number | null
          year: number
        }
        Insert: {
          basic_salary?: number | null
          created_at?: string
          esi_employee?: number | null
          esi_employer?: number | null
          gross_salary?: number | null
          hra?: number | null
          id?: string
          leave_days?: number | null
          locked?: boolean | null
          locked_at?: string | null
          locked_by?: string | null
          lop_days?: number | null
          month: number
          net_salary?: number | null
          other_allowances?: number | null
          other_deductions_detail?: Json | null
          overtime_hours?: number | null
          pf_employee?: number | null
          pf_employer?: number | null
          present_days?: number | null
          processed_at?: string | null
          processed_by?: string | null
          professional_tax?: number | null
          special_allowance?: number | null
          status?: string
          tds?: number | null
          total_deductions?: number | null
          updated_at?: string
          user_id: string
          working_days?: number | null
          year: number
        }
        Update: {
          basic_salary?: number | null
          created_at?: string
          esi_employee?: number | null
          esi_employer?: number | null
          gross_salary?: number | null
          hra?: number | null
          id?: string
          leave_days?: number | null
          locked?: boolean | null
          locked_at?: string | null
          locked_by?: string | null
          lop_days?: number | null
          month?: number
          net_salary?: number | null
          other_allowances?: number | null
          other_deductions_detail?: Json | null
          overtime_hours?: number | null
          pf_employee?: number | null
          pf_employer?: number | null
          present_days?: number | null
          processed_at?: string | null
          processed_by?: string | null
          professional_tax?: number | null
          special_allowance?: number | null
          status?: string
          tds?: number | null
          total_deductions?: number | null
          updated_at?: string
          user_id?: string
          working_days?: number | null
          year?: number
        }
        Relationships: []
      }
      phone_otps: {
        Row: {
          attempts: number | null
          created_at: string
          expires_at: string
          id: string
          otp_code: string
          phone: string
        }
        Insert: {
          attempts?: number | null
          created_at?: string
          expires_at: string
          id?: string
          otp_code: string
          phone: string
        }
        Update: {
          attempts?: number | null
          created_at?: string
          expires_at?: string
          id?: string
          otp_code?: string
          phone?: string
        }
        Relationships: []
      }
      professional_tax_slabs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          max_salary: number | null
          min_salary: number
          monthly_tax: number
          state: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_salary?: number | null
          min_salary?: number
          monthly_tax?: number
          state: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_salary?: number | null
          min_salary?: number
          monthly_tax?: number
          state?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bank_account_number: string | null
          bank_branch: string | null
          bank_ifsc: string | null
          bank_name: string | null
          company_id: string | null
          created_at: string
          date_of_joining: string | null
          department: string | null
          designation: string | null
          email: string
          employee_code: string | null
          face_embedding: Json | null
          face_reference_url: string | null
          full_name: string
          id: string
          is_active: boolean
          manager_id: string | null
          phone: string | null
          phone_verified: boolean
          position: string | null
          registration_status: string | null
          shift_id: string | null
          updated_at: string
          user_id: string
          work_location: string | null
        }
        Insert: {
          avatar_url?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          company_id?: string | null
          created_at?: string
          date_of_joining?: string | null
          department?: string | null
          designation?: string | null
          email: string
          employee_code?: string | null
          face_embedding?: Json | null
          face_reference_url?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          manager_id?: string | null
          phone?: string | null
          phone_verified?: boolean
          position?: string | null
          registration_status?: string | null
          shift_id?: string | null
          updated_at?: string
          user_id: string
          work_location?: string | null
        }
        Update: {
          avatar_url?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          company_id?: string | null
          created_at?: string
          date_of_joining?: string | null
          department?: string | null
          designation?: string | null
          email?: string
          employee_code?: string | null
          face_embedding?: Json | null
          face_reference_url?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          manager_id?: string | null
          phone?: string | null
          phone_verified?: boolean
          position?: string | null
          registration_status?: string | null
          shift_id?: string | null
          updated_at?: string
          user_id?: string
          work_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      regularization_requests: {
        Row: {
          admin_notes: string | null
          attendance_date: string
          company_id: string | null
          created_at: string
          id: string
          reason: string
          requested_check_in: string | null
          requested_check_out: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          attendance_date: string
          company_id?: string | null
          created_at?: string
          id?: string
          reason: string
          requested_check_in?: string | null
          requested_check_out?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          attendance_date?: string
          company_id?: string | null
          created_at?: string
          id?: string
          reason?: string
          requested_check_in?: string | null
          requested_check_out?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "regularization_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regularization_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_structures: {
        Row: {
          basic_salary: number
          created_at: string
          da: number | null
          effective_from: string
          hra: number | null
          id: string
          is_active: boolean | null
          other_allowances: number | null
          other_deductions: number | null
          pf_deduction: number | null
          special_allowance: number | null
          tax_deduction: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          basic_salary?: number
          created_at?: string
          da?: number | null
          effective_from?: string
          hra?: number | null
          id?: string
          is_active?: boolean | null
          other_allowances?: number | null
          other_deductions?: number | null
          pf_deduction?: number | null
          special_allowance?: number | null
          tax_deduction?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          basic_salary?: number
          created_at?: string
          da?: number | null
          effective_from?: string
          hra?: number | null
          id?: string
          is_active?: boolean | null
          other_allowances?: number | null
          other_deductions?: number | null
          pf_deduction?: number | null
          special_allowance?: number | null
          tax_deduction?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          created_at: string
          end_time: string
          grace_period_minutes: number | null
          id: string
          is_default: boolean | null
          name: string
          start_time: string
        }
        Insert: {
          created_at?: string
          end_time: string
          grace_period_minutes?: number | null
          id?: string
          is_default?: boolean | null
          name: string
          start_time: string
        }
        Update: {
          created_at?: string
          end_time?: string
          grace_period_minutes?: number | null
          id?: string
          is_default?: boolean | null
          name?: string
          start_time?: string
        }
        Relationships: []
      }
      statutory_profiles: {
        Row: {
          company_id: string | null
          created_at: string
          edli_rate: number | null
          eps_rate: number | null
          esi_applicable: boolean
          esi_employee_rate: number | null
          esi_employer_rate: number | null
          esi_number: string | null
          esi_wage_ceiling: number | null
          id: string
          lwf_applicable: boolean
          pf_admin_charges_rate: number | null
          pf_applicable: boolean
          pf_employee_rate: number | null
          pf_employer_rate: number | null
          pf_number: string | null
          pf_wage_ceiling: number | null
          pt_applicable: boolean
          pt_state: string | null
          uan_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          edli_rate?: number | null
          eps_rate?: number | null
          esi_applicable?: boolean
          esi_employee_rate?: number | null
          esi_employer_rate?: number | null
          esi_number?: string | null
          esi_wage_ceiling?: number | null
          id?: string
          lwf_applicable?: boolean
          pf_admin_charges_rate?: number | null
          pf_applicable?: boolean
          pf_employee_rate?: number | null
          pf_employer_rate?: number | null
          pf_number?: string | null
          pf_wage_ceiling?: number | null
          pt_applicable?: boolean
          pt_state?: string | null
          uan_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          edli_rate?: number | null
          eps_rate?: number | null
          esi_applicable?: boolean
          esi_employee_rate?: number | null
          esi_employer_rate?: number | null
          esi_number?: string | null
          esi_wage_ceiling?: number | null
          id?: string
          lwf_applicable?: boolean
          pf_admin_charges_rate?: number | null
          pf_applicable?: boolean
          pf_employee_rate?: number | null
          pf_employer_rate?: number | null
          pf_number?: string | null
          pf_wage_ceiling?: number | null
          pt_applicable?: boolean
          pt_state?: string | null
          uan_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statutory_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statutory_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_seen_updates: {
        Row: {
          id: string
          seen_at: string
          update_id: string
          user_id: string
        }
        Insert: {
          id?: string
          seen_at?: string
          update_id: string
          user_id: string
        }
        Update: {
          id?: string
          seen_at?: string
          update_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_seen_updates_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "app_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      week_offs: {
        Row: {
          created_at: string
          day_of_week: number
          id: string
          is_global: boolean | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          day_of_week: number
          id?: string
          is_global?: boolean | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          day_of_week?: number
          id?: string
          is_global?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      companies_public: {
        Row: {
          brand_color: string | null
          id: string | null
          logo_url: string | null
          name: string | null
          tagline: string | null
        }
        Insert: {
          brand_color?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          tagline?: string | null
        }
        Update: {
          brand_color?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          tagline?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_expired_challenges: { Args: never; Returns: undefined }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_company_owner: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_developer: { Args: never; Returns: boolean }
      is_hr: { Args: never; Returns: boolean }
      is_manager: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      is_payroll_team: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "employee" | "developer" | "owner" | "hr" | "manager"
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
      app_role: ["admin", "employee", "developer", "owner", "hr", "manager"],
    },
  },
} as const

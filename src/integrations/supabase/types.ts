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
      admin_audit_logs: {
        Row: {
          action_type: string
          actor_id: string | null
          actor_role: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      builder_profiles: {
        Row: {
          available: boolean | null
          avatar_url: string | null
          banner_image: string | null
          bio: string | null
          completion_rate: number | null
          created_at: string
          experience_level: string | null
          featured_projects: Json | null
          full_name: string
          github: string | null
          hourly_rate: number | null
          id: string
          linkedin: string | null
          location: string | null
          phone: string | null
          portfolio: string | null
          rating: number | null
          response_time_hours: number | null
          skills: string[] | null
          title: string | null
          total_projects: number | null
          updated_at: string
          username: string | null
          verified: boolean | null
          work_preference: string | null
        }
        Insert: {
          available?: boolean | null
          avatar_url?: string | null
          banner_image?: string | null
          bio?: string | null
          completion_rate?: number | null
          created_at?: string
          experience_level?: string | null
          featured_projects?: Json | null
          full_name: string
          github?: string | null
          hourly_rate?: number | null
          id: string
          linkedin?: string | null
          location?: string | null
          phone?: string | null
          portfolio?: string | null
          rating?: number | null
          response_time_hours?: number | null
          skills?: string[] | null
          title?: string | null
          total_projects?: number | null
          updated_at?: string
          username?: string | null
          verified?: boolean | null
          work_preference?: string | null
        }
        Update: {
          available?: boolean | null
          avatar_url?: string | null
          banner_image?: string | null
          bio?: string | null
          completion_rate?: number | null
          created_at?: string
          experience_level?: string | null
          featured_projects?: Json | null
          full_name?: string
          github?: string | null
          hourly_rate?: number | null
          id?: string
          linkedin?: string | null
          location?: string | null
          phone?: string | null
          portfolio?: string | null
          rating?: number | null
          response_time_hours?: number | null
          skills?: string[] | null
          title?: string | null
          total_projects?: number | null
          updated_at?: string
          username?: string | null
          verified?: boolean | null
          work_preference?: string | null
        }
        Relationships: []
      }
      certifications: {
        Row: {
          created_at: string
          credential_url: string | null
          id: string
          issue_date: string | null
          issuer: string | null
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credential_url?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string | null
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          credential_url?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      commission_invoices: {
        Row: {
          base_amount: number
          commission_amount: number
          commission_rate: number
          created_at: string
          due_date: string
          id: string
          invoice_number: string
          payment_record_id: string
          status: string
          updated_at: string
        }
        Insert: {
          base_amount: number
          commission_amount: number
          commission_rate?: number
          created_at?: string
          due_date: string
          id?: string
          invoice_number: string
          payment_record_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          base_amount?: number
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          due_date?: string
          id?: string
          invoice_number?: string
          payment_record_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      commission_payments: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          id: string
          invoice_id: string
          payment_provider: string | null
          provider_ref: string | null
          screenshot_url: string | null
          startup_id: string
          status: string
          submitted_at: string
          transaction_ref: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          payment_provider?: string | null
          provider_ref?: string | null
          screenshot_url?: string | null
          startup_id: string
          status?: string
          submitted_at?: string
          transaction_ref: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          payment_provider?: string | null
          provider_ref?: string | null
          screenshot_url?: string | null
          startup_id?: string
          status?: string
          submitted_at?: string
          transaction_ref?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      contract_milestones: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          order_index: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          contract_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          order_index?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          order_index?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      contract_reviews: {
        Row: {
          comment: string | null
          contract_id: string
          created_at: string
          id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          contract_id: string
          created_at?: string
          id?: string
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          contract_id?: string
          created_at?: string
          id?: string
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
        }
        Relationships: []
      }
      contract_signatures: {
        Row: {
          contract_id: string
          id: string
          ip_address: string | null
          role: string
          signed_at: string
          signed_by: string
        }
        Insert: {
          contract_id: string
          id?: string
          ip_address?: string | null
          role: string
          signed_at?: string
          signed_by: string
        }
        Update: {
          contract_id?: string
          id?: string
          ip_address?: string | null
          role?: string
          signed_at?: string
          signed_by?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          builder_id: string
          created_at: string
          document_url: string | null
          end_date: string | null
          escrow_amount: number | null
          escrow_funded: boolean | null
          founder_id: string
          id: string
          ip_assignment: boolean | null
          milestones: Json | null
          nda_included: boolean | null
          non_compete: boolean | null
          offer_id: string | null
          project_id: string
          start_date: string | null
          status: string
          terms: string | null
          updated_at: string
        }
        Insert: {
          builder_id: string
          created_at?: string
          document_url?: string | null
          end_date?: string | null
          escrow_amount?: number | null
          escrow_funded?: boolean | null
          founder_id: string
          id?: string
          ip_assignment?: boolean | null
          milestones?: Json | null
          nda_included?: boolean | null
          non_compete?: boolean | null
          offer_id?: string | null
          project_id: string
          start_date?: string | null
          status?: string
          terms?: string | null
          updated_at?: string
        }
        Update: {
          builder_id?: string
          created_at?: string
          document_url?: string | null
          end_date?: string | null
          escrow_amount?: number | null
          escrow_funded?: boolean | null
          founder_id?: string
          id?: string
          ip_assignment?: boolean | null
          milestones?: Json | null
          nda_included?: boolean | null
          non_compete?: boolean | null
          offer_id?: string | null
          project_id?: string
          start_date?: string | null
          status?: string
          terms?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          archived: boolean
          blocked: boolean
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          archived?: boolean
          blocked?: boolean
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          archived?: boolean
          blocked?: boolean
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          context_id: string | null
          context_type: string | null
          created_at: string
          created_by: string | null
          id: string
          last_message_at: string | null
          type: string
        }
        Insert: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          type?: string
        }
        Update: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          type?: string
        }
        Relationships: []
      }
      deliverables: {
        Row: {
          demo_url: string | null
          file_urls: string[] | null
          id: string
          milestone_id: string
          revision_number: number
          submitted_at: string
          submitted_by: string
          write_up: string | null
        }
        Insert: {
          demo_url?: string | null
          file_urls?: string[] | null
          id?: string
          milestone_id: string
          revision_number?: number
          submitted_at?: string
          submitted_by: string
          write_up?: string | null
        }
        Update: {
          demo_url?: string | null
          file_urls?: string[] | null
          id?: string
          milestone_id?: string
          revision_number?: number
          submitted_at?: string
          submitted_by?: string
          write_up?: string | null
        }
        Relationships: []
      }
      disputes: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          milestone_id: string | null
          raised_by: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          milestone_id?: string | null
          raised_by: string
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          milestone_id?: string | null
          raised_by?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      educations: {
        Row: {
          achievements: string | null
          created_at: string
          degree: string | null
          end_year: number | null
          grade: string | null
          id: string
          institution: string
          specialization: string | null
          start_year: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          achievements?: string | null
          created_at?: string
          degree?: string | null
          end_year?: number | null
          grade?: string | null
          id?: string
          institution: string
          specialization?: string | null
          start_year?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          achievements?: string | null
          created_at?: string
          degree?: string | null
          end_year?: number | null
          grade?: string | null
          id?: string
          institution?: string
          specialization?: string | null
          start_year?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      experiences: {
        Row: {
          achievements: string | null
          company_name: string
          created_at: string
          description: string | null
          employment_type: string | null
          end_date: string | null
          id: string
          is_current: boolean
          role: string
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          achievements?: string | null
          company_name: string
          created_at?: string
          description?: string | null
          employment_type?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean
          role: string
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          achievements?: string | null
          company_name?: string
          created_at?: string
          description?: string | null
          employment_type?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean
          role?: string
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      followed_startups: {
        Row: {
          builder_id: string
          created_at: string
          id: string
          startup_id: string
        }
        Insert: {
          builder_id: string
          created_at?: string
          id?: string
          startup_id: string
        }
        Update: {
          builder_id?: string
          created_at?: string
          id?: string
          startup_id?: string
        }
        Relationships: []
      }
      interviews: {
        Row: {
          builder_id: string
          builder_responded_at: string | null
          context_message: string | null
          created_at: string
          founder_id: string
          founder_notes: string | null
          id: string
          meeting_url: string | null
          outcome: string | null
          project_id: string
          reschedule_count: number
          scheduled_at: string | null
          status: string
          submission_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          builder_id: string
          builder_responded_at?: string | null
          context_message?: string | null
          created_at?: string
          founder_id: string
          founder_notes?: string | null
          id?: string
          meeting_url?: string | null
          outcome?: string | null
          project_id: string
          reschedule_count?: number
          scheduled_at?: string | null
          status?: string
          submission_id?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          builder_id?: string
          builder_responded_at?: string | null
          context_message?: string | null
          created_at?: string
          founder_id?: string
          founder_notes?: string | null
          id?: string
          meeting_url?: string | null
          outcome?: string | null
          project_id?: string
          reschedule_count?: number
          scheduled_at?: string | null
          status?: string
          submission_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          project_id: string | null
          read: boolean | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          project_id?: string | null
          read?: boolean | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          project_id?: string | null
          read?: boolean | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      messages_v2: {
        Row: {
          attachment_url: string | null
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          message_type: string
          metadata: Json | null
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          message_type?: string
          metadata?: Json | null
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          message_type?: string
          metadata?: Json | null
          sender_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      offer_negotiations: {
        Row: {
          counter_rate: number | null
          counter_terms: string | null
          created_at: string
          id: string
          message: string | null
          offer_id: string
          proposed_by: string
          round: number
          status: string
        }
        Insert: {
          counter_rate?: number | null
          counter_terms?: string | null
          created_at?: string
          id?: string
          message?: string | null
          offer_id: string
          proposed_by: string
          round?: number
          status?: string
        }
        Update: {
          counter_rate?: number | null
          counter_terms?: string | null
          created_at?: string
          id?: string
          message?: string | null
          offer_id?: string
          proposed_by?: string
          round?: number
          status?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          builder_id: string
          compensation: number | null
          created_at: string
          custom_terms: string | null
          duration: string | null
          expires_at: string | null
          founder_id: string
          id: string
          milestones: Json | null
          notes: string | null
          offer_type: string | null
          project_id: string
          rate_type: string | null
          start_date: string | null
          status: string
          submission_id: string | null
          updated_at: string
        }
        Insert: {
          builder_id: string
          compensation?: number | null
          created_at?: string
          custom_terms?: string | null
          duration?: string | null
          expires_at?: string | null
          founder_id: string
          id?: string
          milestones?: Json | null
          notes?: string | null
          offer_type?: string | null
          project_id: string
          rate_type?: string | null
          start_date?: string | null
          status?: string
          submission_id?: string | null
          updated_at?: string
        }
        Update: {
          builder_id?: string
          compensation?: number | null
          created_at?: string
          custom_terms?: string | null
          duration?: string | null
          expires_at?: string | null
          founder_id?: string
          id?: string
          milestones?: Json | null
          notes?: string | null
          offer_type?: string | null
          project_id?: string
          rate_type?: string | null
          start_date?: string | null
          status?: string
          submission_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          account_holder: string | null
          account_number: string | null
          bank_name: string | null
          created_at: string
          id: string
          ifsc: string | null
          is_default: boolean
          method_type: string
          updated_at: string
          upi_id: string | null
          user_id: string
          verified: boolean
        }
        Insert: {
          account_holder?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          ifsc?: string | null
          is_default?: boolean
          method_type: string
          updated_at?: string
          upi_id?: string | null
          user_id: string
          verified?: boolean
        }
        Update: {
          account_holder?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          ifsc?: string | null
          is_default?: boolean
          method_type?: string
          updated_at?: string
          upi_id?: string | null
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      payment_records: {
        Row: {
          builder_id: string
          confirmed_amount: number | null
          confirmed_at: string | null
          contract_id: string
          created_at: string
          declared_amount: number
          declared_at: string
          id: string
          milestone_id: string
          notes: string | null
          payment_method: string
          payment_provider: string | null
          provider_ref: string | null
          screenshot_url: string | null
          startup_id: string
          status: string
          transaction_ref: string
          updated_at: string
        }
        Insert: {
          builder_id: string
          confirmed_amount?: number | null
          confirmed_at?: string | null
          contract_id: string
          created_at?: string
          declared_amount: number
          declared_at?: string
          id?: string
          milestone_id: string
          notes?: string | null
          payment_method: string
          payment_provider?: string | null
          provider_ref?: string | null
          screenshot_url?: string | null
          startup_id: string
          status?: string
          transaction_ref: string
          updated_at?: string
        }
        Update: {
          builder_id?: string
          confirmed_amount?: number | null
          confirmed_at?: string | null
          contract_id?: string
          created_at?: string
          declared_amount?: number
          declared_at?: string
          id?: string
          milestone_id?: string
          notes?: string | null
          payment_method?: string
          payment_provider?: string | null
          provider_ref?: string | null
          screenshot_url?: string | null
          startup_id?: string
          status?: string
          transaction_ref?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          milestone_id: string
          payment_provider_id: string | null
          released_at: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          milestone_id: string
          payment_provider_id?: string | null
          released_at?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          milestone_id?: string
          payment_provider_id?: string | null
          released_at?: string | null
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          archived_at: string | null
          budget: number | null
          category: string | null
          contract_type: string | null
          created_at: string
          deadline: string | null
          deliverables: string | null
          description: string | null
          difficulty: string | null
          founder_id: string
          hire_locked: boolean
          id: string
          ip_agreement: boolean | null
          max_hires: number | null
          nda_required: boolean | null
          requirements: string | null
          short_description: string | null
          status: string
          tags: string[] | null
          timeline: string | null
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          archived_at?: string | null
          budget?: number | null
          category?: string | null
          contract_type?: string | null
          created_at?: string
          deadline?: string | null
          deliverables?: string | null
          description?: string | null
          difficulty?: string | null
          founder_id: string
          hire_locked?: boolean
          id?: string
          ip_agreement?: boolean | null
          max_hires?: number | null
          nda_required?: boolean | null
          requirements?: string | null
          short_description?: string | null
          status?: string
          tags?: string[] | null
          timeline?: string | null
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          archived_at?: string | null
          budget?: number | null
          category?: string | null
          contract_type?: string | null
          created_at?: string
          deadline?: string | null
          deliverables?: string | null
          description?: string | null
          difficulty?: string | null
          founder_id?: string
          hire_locked?: boolean
          id?: string
          ip_agreement?: boolean | null
          max_hires?: number | null
          nda_required?: boolean | null
          requirements?: string | null
          short_description?: string | null
          status?: string
          tags?: string[] | null
          timeline?: string | null
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      saved_builders: {
        Row: {
          builder_id: string
          created_at: string
          founder_id: string
          id: string
        }
        Insert: {
          builder_id: string
          created_at?: string
          founder_id: string
          id?: string
        }
        Update: {
          builder_id?: string
          created_at?: string
          founder_id?: string
          id?: string
        }
        Relationships: []
      }
      saved_projects: {
        Row: {
          id: string
          project_id: string
          saved_at: string
          user_id: string
        }
        Insert: {
          id?: string
          project_id: string
          saved_at?: string
          user_id: string
        }
        Update: {
          id?: string
          project_id?: string
          saved_at?: string
          user_id?: string
        }
        Relationships: []
      }
      startup_profiles: {
        Row: {
          banner_image: string | null
          bio: string | null
          company_name: string
          company_slug: string | null
          created_at: string
          founder_name: string | null
          hiring_status: string | null
          id: string
          industry: string | null
          location: string | null
          logo_url: string | null
          mission: string | null
          rating: number | null
          social_links: Json | null
          stage: string | null
          team_size: string | null
          total_projects: number | null
          updated_at: string
          website: string | null
        }
        Insert: {
          banner_image?: string | null
          bio?: string | null
          company_name: string
          company_slug?: string | null
          created_at?: string
          founder_name?: string | null
          hiring_status?: string | null
          id: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          mission?: string | null
          rating?: number | null
          social_links?: Json | null
          stage?: string | null
          team_size?: string | null
          total_projects?: number | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          banner_image?: string | null
          bio?: string | null
          company_name?: string
          company_slug?: string | null
          created_at?: string
          founder_name?: string | null
          hiring_status?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          mission?: string | null
          rating?: number | null
          social_links?: Json | null
          stage?: string | null
          team_size?: string | null
          total_projects?: number | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      submission_reviews: {
        Row: {
          created_at: string
          decided_at: string | null
          decision: string
          execution: number | null
          feasibility: number | null
          id: string
          innovation: number | null
          notes: string | null
          problem_fit: number | null
          reviewer_id: string
          score: number | null
          submission_id: string
          ux: number | null
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decision?: string
          execution?: number | null
          feasibility?: number | null
          id?: string
          innovation?: number | null
          notes?: string | null
          problem_fit?: number | null
          reviewer_id: string
          score?: number | null
          submission_id: string
          ux?: number | null
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decision?: string
          execution?: number | null
          feasibility?: number | null
          id?: string
          innovation?: number | null
          notes?: string | null
          problem_fit?: number | null
          reviewer_id?: string
          score?: number | null
          submission_id?: string
          ux?: number | null
        }
        Relationships: []
      }
      submissions: {
        Row: {
          builder_id: string
          created_at: string
          demo_url: string | null
          description: string | null
          github_url: string | null
          id: string
          live_url: string | null
          notes: string | null
          project_id: string
          score: number | null
          status: string
          tech_stack: string[] | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          builder_id: string
          created_at?: string
          demo_url?: string | null
          description?: string | null
          github_url?: string | null
          id?: string
          live_url?: string | null
          notes?: string | null
          project_id: string
          score?: number | null
          status?: string
          tech_stack?: string[] | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          builder_id?: string
          created_at?: string
          demo_url?: string | null
          description?: string | null
          github_url?: string | null
          id?: string
          live_url?: string | null
          notes?: string | null
          project_id?: string
          score?: number | null
          status?: string
          tech_stack?: string[] | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      user_status: {
        Row: {
          flagged_by: string | null
          reason: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          flagged_by?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          flagged_by?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_admin: { Args: never; Returns: boolean }
      can_delete_project: { Args: { _project_id: string }; Returns: Json }
      confirm_payment_record: {
        Args: { _confirmed_amount: number; _id: string; _screenshot?: string }
        Returns: string
      }
      create_contract_from_offer: {
        Args: { _offer_id: string }
        Returns: string
      }
      get_builder_default_payment: {
        Args: { _builder_id: string }
        Returns: {
          account_holder: string
          account_number_masked: string
          bank_name: string
          ifsc: string
          method_type: string
          upi_id: string
          verified: boolean
        }[]
      }
      get_or_create_direct_conversation: {
        Args: { _other_user: string }
        Returns: string
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      log_audit: {
        Args: {
          _action: string
          _entity_id?: string
          _entity_type?: string
          _metadata?: Json
        }
        Returns: string
      }
      mask_account: { Args: { _acc: string }; Returns: string }
      verify_commission_payment: {
        Args: { _approve: boolean; _notes?: string; _payment_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "startup" | "builder" | "super_admin"
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
      app_role: ["admin", "startup", "builder", "super_admin"],
    },
  },
} as const

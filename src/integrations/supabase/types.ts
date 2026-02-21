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
      activity_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: string
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          access_location: string | null
          address: string
          building_code: string | null
          city: string
          client_id: string
          completion_date: string | null
          created_at: string
          id: string
          inspection_date: string | null
          inspection_status: string
          inspector_id: string | null
          inspector_notes: string | null
          is_priority: boolean | null
          latitude: number | null
          lock_gate_codes: string | null
          longitude: number | null
          photo_url: string | null
          property_manager_email: string | null
          property_manager_name: string | null
          property_manager_phone: string | null
          property_name: string
          region_id: string
          requires_advance_notice: boolean | null
          requires_escort: boolean | null
          roof_access_description: string | null
          roof_access_type:
            | Database["public"]["Enums"]["roof_access_type"]
            | null
          roof_group: string | null
          scheduled_week: string | null
          special_equipment: string[] | null
          special_notes: string | null
          square_footage: number | null
          state: string
          stop_number: string | null
          updated_at: string
          upload_id: string | null
          zip_code: string
        }
        Insert: {
          access_location?: string | null
          address: string
          building_code?: string | null
          city: string
          client_id: string
          completion_date?: string | null
          created_at?: string
          id?: string
          inspection_date?: string | null
          inspection_status?: string
          inspector_id?: string | null
          inspector_notes?: string | null
          is_priority?: boolean | null
          latitude?: number | null
          lock_gate_codes?: string | null
          longitude?: number | null
          photo_url?: string | null
          property_manager_email?: string | null
          property_manager_name?: string | null
          property_manager_phone?: string | null
          property_name: string
          region_id: string
          requires_advance_notice?: boolean | null
          requires_escort?: boolean | null
          roof_access_description?: string | null
          roof_access_type?:
            | Database["public"]["Enums"]["roof_access_type"]
            | null
          roof_group?: string | null
          scheduled_week?: string | null
          special_equipment?: string[] | null
          special_notes?: string | null
          square_footage?: number | null
          state: string
          stop_number?: string | null
          updated_at?: string
          upload_id?: string | null
          zip_code: string
        }
        Update: {
          access_location?: string | null
          address?: string
          building_code?: string | null
          city?: string
          client_id?: string
          completion_date?: string | null
          created_at?: string
          id?: string
          inspection_date?: string | null
          inspection_status?: string
          inspector_id?: string | null
          inspector_notes?: string | null
          is_priority?: boolean | null
          latitude?: number | null
          lock_gate_codes?: string | null
          longitude?: number | null
          photo_url?: string | null
          property_manager_email?: string | null
          property_manager_name?: string | null
          property_manager_phone?: string | null
          property_name?: string
          region_id?: string
          requires_advance_notice?: boolean | null
          requires_escort?: boolean | null
          roof_access_description?: string | null
          roof_access_type?:
            | Database["public"]["Enums"]["roof_access_type"]
            | null
          roof_group?: string | null
          scheduled_week?: string | null
          special_equipment?: string[] | null
          special_notes?: string | null
          square_footage?: number | null
          state?: string
          stop_number?: string | null
          updated_at?: string
          upload_id?: string | null
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "buildings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buildings_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buildings_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buildings_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_buildings: {
        Row: {
          building_id: string
          campaign_id: string
          completion_date: string | null
          created_at: string
          id: string
          inspection_status: string
          inspector_id: string | null
          inspector_notes: string | null
          is_priority: boolean
          photo_url: string | null
          scheduled_week: string | null
        }
        Insert: {
          building_id: string
          campaign_id: string
          completion_date?: string | null
          created_at?: string
          id?: string
          inspection_status?: string
          inspector_id?: string | null
          inspector_notes?: string | null
          is_priority?: boolean
          photo_url?: string | null
          scheduled_week?: string | null
        }
        Update: {
          building_id?: string
          campaign_id?: string
          completion_date?: string | null
          created_at?: string
          id?: string
          inspection_status?: string
          inspector_id?: string | null
          inspector_notes?: string | null
          is_priority?: boolean
          photo_url?: string | null
          scheduled_week?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_buildings_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_buildings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "inspection_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_buildings_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspectors"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      cm_job_status_history: {
        Row: {
          changed_by: string | null
          cm_job_id: string
          created_at: string
          from_status: string | null
          id: string
          notes: string | null
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          cm_job_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          to_status: string
        }
        Update: {
          changed_by?: string | null
          cm_job_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cm_job_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_job_status_history_cm_job_id_fkey"
            columns: ["cm_job_id"]
            isOneToOne: false
            referencedRelation: "cm_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cm_job_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          statuses: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          statuses: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          statuses?: Json
        }
        Relationships: []
      }
      cm_jobs: {
        Row: {
          address: string | null
          assigned_to: string | null
          building_id: string | null
          city: string | null
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          job_type_id: string
          metadata: Json
          notes: string | null
          priority: string
          property_manager_email: string | null
          property_manager_name: string | null
          property_manager_phone: string | null
          region_id: string | null
          scheduled_date: string | null
          state: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          building_id?: string | null
          city?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          job_type_id: string
          metadata?: Json
          notes?: string | null
          priority?: string
          property_manager_email?: string | null
          property_manager_name?: string | null
          property_manager_phone?: string | null
          region_id?: string | null
          scheduled_date?: string | null
          state?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          building_id?: string | null
          city?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          job_type_id?: string
          metadata?: Json
          notes?: string | null
          priority?: string
          property_manager_email?: string | null
          property_manager_name?: string | null
          property_manager_phone?: string | null
          region_id?: string | null
          scheduled_date?: string | null
          state?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cm_jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_jobs_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_jobs_job_type_id_fkey"
            columns: ["job_type_id"]
            isOneToOne: false
            referencedRelation: "cm_job_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_jobs_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      generated_documents: {
        Row: {
          client_id: string
          created_at: string
          file_name: string
          format: string
          id: string
          inspector_id: string | null
          region_id: string
          route_plan_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          file_name: string
          format?: string
          id?: string
          inspector_id?: string | null
          region_id: string
          route_plan_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          file_name?: string
          format?: string
          id?: string
          inspector_id?: string | null
          region_id?: string
          route_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_route_plan_id_fkey"
            columns: ["route_plan_id"]
            isOneToOne: false
            referencedRelation: "route_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_campaigns: {
        Row: {
          client_id: string
          completed_buildings: number
          created_at: string
          end_date: string
          id: string
          inspection_type: string
          name: string
          notes: string | null
          region_id: string
          start_date: string
          status: string
          total_buildings: number
          updated_at: string
        }
        Insert: {
          client_id: string
          completed_buildings?: number
          created_at?: string
          end_date: string
          id?: string
          inspection_type?: string
          name: string
          notes?: string | null
          region_id: string
          start_date: string
          status?: string
          total_buildings?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          completed_buildings?: number
          created_at?: string
          end_date?: string
          id?: string
          inspection_type?: string
          name?: string
          notes?: string | null
          region_id?: string
          start_date?: string
          status?: string
          total_buildings?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_campaigns_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      inspectors: {
        Row: {
          created_at: string
          id: string
          name: string
          region_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          region_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          region_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspectors_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      mileage_approvals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          rejection_notes: string | null
          status: string
          user_id: string
          week_start: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          rejection_notes?: string | null
          status?: string
          user_id: string
          week_start: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          rejection_notes?: string | null
          status?: string
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "mileage_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mileage_approvals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mileage_logs: {
        Row: {
          created_at: string
          date: string
          id: string
          miles: number
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          miles?: number
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          miles?: number
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mileage_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          client_id: string
          created_at: string
          id: string
          name: string
          status: Database["public"]["Enums"]["region_status"]
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["region_status"]
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["region_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      route_plan_buildings: {
        Row: {
          building_id: string
          id: string
          route_plan_day_id: string
          stop_order: number
        }
        Insert: {
          building_id: string
          id?: string
          route_plan_day_id: string
          stop_order?: number
        }
        Update: {
          building_id?: string
          id?: string
          route_plan_day_id?: string
          stop_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "route_plan_buildings_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_plan_buildings_route_plan_day_id_fkey"
            columns: ["route_plan_day_id"]
            isOneToOne: false
            referencedRelation: "route_plan_days"
            referencedColumns: ["id"]
          },
        ]
      }
      route_plan_days: {
        Row: {
          day_date: string
          day_number: number
          estimated_distance_miles: number | null
          id: string
          route_plan_id: string
        }
        Insert: {
          day_date: string
          day_number: number
          estimated_distance_miles?: number | null
          id?: string
          route_plan_id: string
        }
        Update: {
          day_date?: string
          day_number?: number
          estimated_distance_miles?: number | null
          id?: string
          route_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_plan_days_route_plan_id_fkey"
            columns: ["route_plan_id"]
            isOneToOne: false
            referencedRelation: "route_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      route_plans: {
        Row: {
          buildings_per_day: number
          client_id: string
          created_at: string
          end_date: string
          id: string
          inspector_id: string
          name: string
          region_id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          buildings_per_day?: number
          client_id: string
          created_at?: string
          end_date: string
          id?: string
          inspector_id: string
          name: string
          region_id: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          buildings_per_day?: number
          client_id?: string
          created_at?: string
          end_date?: string
          id?: string
          inspector_id?: string
          name?: string
          region_id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_plans_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_plans_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduling_events: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          event_type: string
          id: string
          inspector_id: string | null
          notes: string | null
          reference_id: string | null
          reference_type: string | null
          start_date: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          event_type?: string
          id?: string
          inspector_id?: string | null
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          start_date: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          event_type?: string
          id?: string
          inspector_id?: string | null
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          start_date?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduling_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduling_events_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduling_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      uploads: {
        Row: {
          client_id: string | null
          created_at: string
          deleted_at: string | null
          file_name: string
          id: string
          row_count: number
          status: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          deleted_at?: string | null
          file_name: string
          id?: string
          row_count?: number
          status?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          deleted_at?: string | null
          file_name?: string
          id?: string
          row_count?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          inspector_id: string | null
          is_active: boolean | null
          notification_preferences: Json | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id: string
          inspector_id?: string | null
          is_active?: boolean | null
          notification_preferences?: Json | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          inspector_id?: string | null
          is_active?: boolean | null
          notification_preferences?: Json | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspectors"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["ops_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["ops_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["ops_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_ops_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["ops_role"]
      }
      has_ops_role: {
        Args: {
          _role: Database["public"]["Enums"]["ops_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      ops_role:
        | "admin"
        | "office_manager"
        | "field_ops"
        | "engineer"
        | "inspector"
        | "construction_manager"
      region_status: "not_started" | "in_progress" | "complete"
      roof_access_type:
        | "roof_hatch"
        | "exterior_ladder"
        | "interior_ladder"
        | "ground_level"
        | "other"
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
      ops_role: [
        "admin",
        "office_manager",
        "field_ops",
        "engineer",
        "inspector",
        "construction_manager",
      ],
      region_status: ["not_started", "in_progress", "complete"],
      roof_access_type: [
        "roof_hatch",
        "exterior_ladder",
        "interior_ladder",
        "ground_level",
        "other",
      ],
    },
  },
} as const

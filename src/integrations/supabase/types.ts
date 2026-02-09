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
      buildings: {
        Row: {
          access_location: string | null
          address: string
          building_code: string | null
          city: string
          client_id: string
          created_at: string
          id: string
          inspection_date: string | null
          inspector_id: string | null
          is_priority: boolean | null
          latitude: number | null
          lock_gate_codes: string | null
          longitude: number | null
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
          created_at?: string
          id?: string
          inspection_date?: string | null
          inspector_id?: string | null
          is_priority?: boolean | null
          latitude?: number | null
          lock_gate_codes?: string | null
          longitude?: number | null
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
          created_at?: string
          id?: string
          inspection_date?: string | null
          inspector_id?: string | null
          is_priority?: boolean | null
          latitude?: number | null
          lock_gate_codes?: string | null
          longitude?: number | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
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

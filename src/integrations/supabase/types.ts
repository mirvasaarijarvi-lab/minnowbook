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
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          summary: string | null
          table_name: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          summary?: string | null
          table_name: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          summary?: string | null
          table_name?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_slots: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string
          end_time: string | null
          id: string
          reason: string | null
          resource_id: string | null
          resource_type: string
          start_time: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date: string
          end_time?: string | null
          id?: string
          reason?: string | null
          resource_id?: string | null
          resource_type: string
          start_time?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          end_time?: string | null
          id?: string
          reason?: string | null
          resource_id?: string | null
          resource_type?: string
          start_time?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_slots_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_slots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      login_history: {
        Row: {
          id: string
          ip_address: string | null
          logged_in_at: string
          tenant_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          tenant_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          tenant_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          accommodation_needed: boolean | null
          acknowledgment_email_sent_at: string | null
          breakfast_included: boolean | null
          breakfast_price_per_person: number | null
          cancellation_email_sent_at: string | null
          catering_needed: boolean | null
          check_out_date: string | null
          confirmation_email_sent_at: string | null
          created_at: string | null
          created_by: string | null
          date: string
          end_time: string | null
          estimated_guests: number | null
          event_type: string | null
          guest_email: string
          guest_name: string
          guest_phone: string | null
          guests_count: number | null
          id: string
          internal_notes: string | null
          is_checked_in: boolean
          is_invoiced: boolean | null
          is_used: boolean
          language: string | null
          no_email_ack: boolean | null
          no_email_cancel: boolean | null
          no_email_confirm: boolean | null
          price_eur: number | null
          pricing_details: string | null
          reservation_type: string
          room_type: string | null
          special_requests: string | null
          staff_notes: string | null
          start_time: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          accommodation_needed?: boolean | null
          acknowledgment_email_sent_at?: string | null
          breakfast_included?: boolean | null
          breakfast_price_per_person?: number | null
          cancellation_email_sent_at?: string | null
          catering_needed?: boolean | null
          check_out_date?: string | null
          confirmation_email_sent_at?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          end_time?: string | null
          estimated_guests?: number | null
          event_type?: string | null
          guest_email: string
          guest_name: string
          guest_phone?: string | null
          guests_count?: number | null
          id?: string
          internal_notes?: string | null
          is_checked_in?: boolean
          is_invoiced?: boolean | null
          is_used?: boolean
          language?: string | null
          no_email_ack?: boolean | null
          no_email_cancel?: boolean | null
          no_email_confirm?: boolean | null
          price_eur?: number | null
          pricing_details?: string | null
          reservation_type: string
          room_type?: string | null
          special_requests?: string | null
          staff_notes?: string | null
          start_time?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          accommodation_needed?: boolean | null
          acknowledgment_email_sent_at?: string | null
          breakfast_included?: boolean | null
          breakfast_price_per_person?: number | null
          cancellation_email_sent_at?: string | null
          catering_needed?: boolean | null
          check_out_date?: string | null
          confirmation_email_sent_at?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          end_time?: string | null
          estimated_guests?: number | null
          event_type?: string | null
          guest_email?: string
          guest_name?: string
          guest_phone?: string | null
          guests_count?: number | null
          id?: string
          internal_notes?: string | null
          is_checked_in?: boolean
          is_invoiced?: boolean | null
          is_used?: boolean
          language?: string | null
          no_email_ack?: boolean | null
          no_email_cancel?: boolean | null
          no_email_confirm?: boolean | null
          price_eur?: number | null
          pricing_details?: string | null
          reservation_type?: string
          room_type?: string | null
          special_requests?: string | null
          staff_notes?: string | null
          start_time?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_images: {
        Row: {
          created_at: string | null
          id: string
          image_url: string
          resource_id: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url: string
          resource_id: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string
          resource_id?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_images_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_images_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          breakfast_price_per_person: number | null
          capacity: number | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          price_per_night: number | null
          resource_type: string
          room_type_pricing: Json | null
          tenant_id: string
        }
        Insert: {
          breakfast_price_per_person?: number | null
          capacity?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          price_per_night?: number | null
          resource_type: string
          room_type_pricing?: Json | null
          tenant_id: string
        }
        Update: {
          breakfast_price_per_person?: number | null
          capacity?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          price_per_night?: number | null
          resource_type?: string
          room_type_pricing?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_definitions: {
        Row: {
          created_at: string
          display_name: string
          hierarchy_level: number
          id: string
          is_system: boolean
          role_key: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          hierarchy_level?: number
          id?: string
          is_system?: boolean
          role_key: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          hierarchy_level?: number
          id?: string
          is_system?: boolean
          role_key?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          role_key: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          role_key: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          role_key?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          admin_response: string | null
          created_at: string | null
          id: string
          is_read_by_user: boolean
          message: string
          responded_at: string | null
          status: string
          subject: string
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          created_at?: string | null
          id?: string
          is_read_by_user?: boolean
          message: string
          responded_at?: string | null
          status?: string
          subject: string
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_response?: string | null
          created_at?: string | null
          id?: string
          is_read_by_user?: boolean
          message?: string
          responded_at?: string | null
          status?: string
          subject?: string
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_admins: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tenant_email_templates: {
        Row: {
          body_html: string
          created_at: string | null
          id: string
          is_active: boolean | null
          language: string | null
          subject: string
          template_type: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          body_html: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          subject: string
          template_type: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          body_html?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          subject?: string
          template_type?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_email_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_opening_hours: {
        Row: {
          close_time: string | null
          created_at: string | null
          day_of_week: number
          id: string
          is_closed: boolean | null
          open_time: string | null
          resource_type: string
          tenant_id: string
        }
        Insert: {
          close_time?: string | null
          created_at?: string | null
          day_of_week: number
          id?: string
          is_closed?: boolean | null
          open_time?: string | null
          resource_type: string
          tenant_id: string
        }
        Update: {
          close_time?: string | null
          created_at?: string | null
          day_of_week?: number
          id?: string
          is_closed?: boolean | null
          open_time?: string | null
          resource_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_opening_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          accent_color: string | null
          availability_thresholds: Json | null
          business_address: string | null
          business_description: string | null
          business_email: string | null
          business_name: string | null
          business_phone: string | null
          created_at: string | null
          default_language: string | null
          hero_image_url: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          tenant_id: string
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          availability_thresholds?: Json | null
          business_address?: string | null
          business_description?: string | null
          business_email?: string | null
          business_name?: string | null
          business_phone?: string | null
          created_at?: string | null
          default_language?: string | null
          hero_image_url?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          tenant_id: string
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          availability_thresholds?: Json | null
          business_address?: string | null
          business_description?: string | null
          business_email?: string | null
          business_name?: string | null
          business_phone?: string | null
          created_at?: string | null
          default_language?: string | null
          hero_image_url?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          tenant_id?: string
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          is_approved: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_approved?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_approved?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          allowed_reservation_types: string[]
          created_at: string | null
          id: string
          is_active: boolean | null
          max_staff_users: number
          name: string
          owner_user_id: string
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          tier: string
          updated_at: string | null
        }
        Insert: {
          allowed_reservation_types?: string[]
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_staff_users?: number
          name: string
          owner_user_id: string
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          tier?: string
          updated_at?: string | null
        }
        Update: {
          allowed_reservation_types?: string[]
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_staff_users?: number
          name?: string
          owner_user_id?: string
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          tier?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_tenant: {
        Args: {
          p_accent_color?: string
          p_allowed_reservation_types?: string[]
          p_business_address?: string
          p_business_description?: string
          p_business_email?: string
          p_business_phone?: string
          p_display_name?: string
          p_name: string
          p_primary_color?: string
          p_secondary_color?: string
          p_slug: string
          p_tier?: string
        }
        Returns: string
      }
      get_user_tenant_id: { Args: { p_user_id: string }; Returns: string }
      has_permission: {
        Args: { p_permission: string; p_user_id: string }
        Returns: boolean
      }
      has_tenant_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: boolean
      }
      is_system_admin: { Args: { p_user_id: string }; Returns: boolean }
      seed_tenant_roles_and_permissions: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "staff"
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
      app_role: ["owner", "admin", "staff"],
    },
  },
} as const

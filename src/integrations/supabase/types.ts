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
      access_code_redemptions: {
        Row: {
          access_code_id: string
          granted_tier: string
          granted_until: string
          id: string
          is_active: boolean
          redeemed_at: string
          redeemed_by: string
          revoked_at: string | null
          tenant_id: string
        }
        Insert: {
          access_code_id: string
          granted_tier: string
          granted_until: string
          id?: string
          is_active?: boolean
          redeemed_at?: string
          redeemed_by: string
          revoked_at?: string | null
          tenant_id: string
        }
        Update: {
          access_code_id?: string
          granted_tier?: string
          granted_until?: string
          id?: string
          is_active?: boolean
          redeemed_at?: string
          redeemed_by?: string
          revoked_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_code_redemptions_access_code_id_fkey"
            columns: ["access_code_id"]
            isOneToOne: false
            referencedRelation: "access_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_code_redemptions_access_code_id_fkey"
            columns: ["access_code_id"]
            isOneToOne: false
            referencedRelation: "access_codes_redeemed_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_code_redemptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_code_redemptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_code_redemptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      access_codes: {
        Row: {
          code_hash: string
          code_prefix: string
          created_at: string
          created_by: string
          description: string | null
          duration_days: number
          id: string
          is_active: boolean
          is_revoked: boolean
          max_uses: number | null
          revoked_at: string | null
          revoked_reason: string | null
          tier: string
          updated_at: string
          used_count: number
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code_hash: string
          code_prefix: string
          created_at?: string
          created_by: string
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          is_revoked?: boolean
          max_uses?: number | null
          revoked_at?: string | null
          revoked_reason?: string | null
          tier?: string
          updated_at?: string
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code_hash?: string
          code_prefix?: string
          created_at?: string
          created_by?: string
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          is_revoked?: boolean
          max_uses?: number | null
          revoked_at?: string | null
          revoked_reason?: string | null
          tier?: string
          updated_at?: string
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      archived_reservations: {
        Row: {
          accommodation_needed: boolean | null
          acknowledgment_email_sent_at: string | null
          archived_at: string
          breakfast_included: boolean | null
          breakfast_price_per_person: number | null
          cancellation_email_sent_at: string | null
          catering_needed: boolean | null
          check_out_date: string | null
          confirmation_email_sent_at: string | null
          created_at: string | null
          created_by: string | null
          date: string
          delivery_address: string | null
          dietary_notes: string | null
          discount_code_id: string | null
          discount_reason: string | null
          discount_type: string | null
          discount_value: number | null
          electricity_needed: boolean | null
          end_time: string | null
          equipment_needed: boolean | null
          estimated_guests: number | null
          event_type: string | null
          festival_name: string | null
          food_permits: string | null
          guest_email: string
          guest_name: string
          guest_phone: string | null
          guests_count: number | null
          id: string
          internal_notes: string | null
          is_checked_in: boolean | null
          is_invoiced: boolean | null
          is_used: boolean | null
          language: string | null
          no_email_ack: boolean | null
          no_email_cancel: boolean | null
          no_email_confirm: boolean | null
          original_price_eur: number | null
          original_reservation_id: string
          price_eur: number | null
          pricing_details: string | null
          pricing_type: string | null
          reminder_email_sent_at: string | null
          reservation_type: string
          restaurant_sub_type: string | null
          room_type: string | null
          selected_sub_services: Json | null
          site_id: string | null
          special_requests: string | null
          staff_needed: boolean | null
          staff_notes: string | null
          stall_fee: number | null
          stall_size: string | null
          start_time: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
          water_needed: boolean | null
        }
        Insert: {
          accommodation_needed?: boolean | null
          acknowledgment_email_sent_at?: string | null
          archived_at?: string
          breakfast_included?: boolean | null
          breakfast_price_per_person?: number | null
          cancellation_email_sent_at?: string | null
          catering_needed?: boolean | null
          check_out_date?: string | null
          confirmation_email_sent_at?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          delivery_address?: string | null
          dietary_notes?: string | null
          discount_code_id?: string | null
          discount_reason?: string | null
          discount_type?: string | null
          discount_value?: number | null
          electricity_needed?: boolean | null
          end_time?: string | null
          equipment_needed?: boolean | null
          estimated_guests?: number | null
          event_type?: string | null
          festival_name?: string | null
          food_permits?: string | null
          guest_email: string
          guest_name: string
          guest_phone?: string | null
          guests_count?: number | null
          id?: string
          internal_notes?: string | null
          is_checked_in?: boolean | null
          is_invoiced?: boolean | null
          is_used?: boolean | null
          language?: string | null
          no_email_ack?: boolean | null
          no_email_cancel?: boolean | null
          no_email_confirm?: boolean | null
          original_price_eur?: number | null
          original_reservation_id: string
          price_eur?: number | null
          pricing_details?: string | null
          pricing_type?: string | null
          reminder_email_sent_at?: string | null
          reservation_type: string
          restaurant_sub_type?: string | null
          room_type?: string | null
          selected_sub_services?: Json | null
          site_id?: string | null
          special_requests?: string | null
          staff_needed?: boolean | null
          staff_notes?: string | null
          stall_fee?: number | null
          stall_size?: string | null
          start_time?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
          water_needed?: boolean | null
        }
        Update: {
          accommodation_needed?: boolean | null
          acknowledgment_email_sent_at?: string | null
          archived_at?: string
          breakfast_included?: boolean | null
          breakfast_price_per_person?: number | null
          cancellation_email_sent_at?: string | null
          catering_needed?: boolean | null
          check_out_date?: string | null
          confirmation_email_sent_at?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          delivery_address?: string | null
          dietary_notes?: string | null
          discount_code_id?: string | null
          discount_reason?: string | null
          discount_type?: string | null
          discount_value?: number | null
          electricity_needed?: boolean | null
          end_time?: string | null
          equipment_needed?: boolean | null
          estimated_guests?: number | null
          event_type?: string | null
          festival_name?: string | null
          food_permits?: string | null
          guest_email?: string
          guest_name?: string
          guest_phone?: string | null
          guests_count?: number | null
          id?: string
          internal_notes?: string | null
          is_checked_in?: boolean | null
          is_invoiced?: boolean | null
          is_used?: boolean | null
          language?: string | null
          no_email_ack?: boolean | null
          no_email_cancel?: boolean | null
          no_email_confirm?: boolean | null
          original_price_eur?: number | null
          original_reservation_id?: string
          price_eur?: number | null
          pricing_details?: string | null
          pricing_type?: string | null
          reminder_email_sent_at?: string | null
          reservation_type?: string
          restaurant_sub_type?: string | null
          room_type?: string | null
          selected_sub_services?: Json | null
          site_id?: string | null
          special_requests?: string | null
          staff_needed?: boolean | null
          staff_notes?: string | null
          stall_fee?: number | null
          stall_size?: string | null
          start_time?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
          water_needed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "archived_reservations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archived_reservations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archived_reservations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archived_reservations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
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
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          page_context: string | null
          rating: number
          tenant_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          page_context?: string | null
          rating: number
          tenant_id: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          page_context?: string | null
          rating?: number
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beta_feedback_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beta_feedback_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beta_feedback_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_slots: {
        Row: {
          approval_status: string
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          date: string
          end_time: string | null
          id: string
          reason: string | null
          rejection_reason: string | null
          resource_id: string | null
          resource_type: string
          site_id: string | null
          start_time: string | null
          tenant_id: string
        }
        Insert: {
          approval_status?: string
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          end_time?: string | null
          id?: string
          reason?: string | null
          rejection_reason?: string | null
          resource_id?: string | null
          resource_type: string
          site_id?: string | null
          start_time?: string | null
          tenant_id: string
        }
        Update: {
          approval_status?: string
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          end_time?: string | null
          id?: string
          reason?: string | null
          rejection_reason?: string | null
          resource_id?: string | null
          resource_type?: string
          site_id?: string | null
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
            foreignKeyName: "blocked_slots_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_slots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_slots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_slots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          is_revoked: boolean
          reservation_id: string
          tenant_id: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          is_revoked?: boolean
          reservation_id: string
          tenant_id: string
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          is_revoked?: boolean
          reservation_id?: string
          tenant_id?: string
          token?: string
        }
        Relationships: []
      }
      booking_validation_log: {
        Row: {
          capacity_total: number | null
          created_at: string
          current_load: number | null
          guest_email: string | null
          guest_name: string | null
          guests_requested: number | null
          id: string
          outcome: string
          reasons: Json
          reservation_date: string | null
          reservation_id: string | null
          reservation_type: string | null
          site_id: string | null
          source: string
          start_time: string | null
          tenant_id: string
        }
        Insert: {
          capacity_total?: number | null
          created_at?: string
          current_load?: number | null
          guest_email?: string | null
          guest_name?: string | null
          guests_requested?: number | null
          id?: string
          outcome: string
          reasons?: Json
          reservation_date?: string | null
          reservation_id?: string | null
          reservation_type?: string | null
          site_id?: string | null
          source: string
          start_time?: string | null
          tenant_id: string
        }
        Update: {
          capacity_total?: number | null
          created_at?: string
          current_load?: number | null
          guest_email?: string | null
          guest_name?: string | null
          guests_requested?: number | null
          id?: string
          outcome?: string
          reasons?: Json
          reservation_date?: string | null
          reservation_id?: string | null
          reservation_type?: string | null
          site_id?: string | null
          source?: string
          start_time?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          applies_to: string[] | null
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_uses: number | null
          min_price_eur: number | null
          tenant_id: string
          updated_at: string
          used_count: number
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applies_to?: string[] | null
          code: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_price_eur?: number | null
          tenant_id: string
          updated_at?: string
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applies_to?: string[] | null
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_price_eur?: number | null
          tenant_id?: string
          updated_at?: string
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_codes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_codes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_codes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_send_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      guest_reviews: {
        Row: {
          comment: string | null
          created_at: string
          guest_email: string
          guest_name: string
          id: string
          is_published: boolean
          rating: number
          reservation_id: string | null
          review_token: string | null
          site_id: string | null
          tenant_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          guest_email: string
          guest_name: string
          id?: string
          is_published?: boolean
          rating: number
          reservation_id?: string | null
          review_token?: string | null
          site_id?: string | null
          tenant_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          guest_email?: string
          guest_name?: string
          id?: string
          is_published?: boolean
          rating?: number
          reservation_id?: string | null
          review_token?: string | null
          site_id?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      kitchen_menu_items: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          tenant_id: string
          unit_price_eur: number | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          tenant_id: string
          unit_price_eur?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          tenant_id?: string
          unit_price_eur?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      kitchen_orders: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          item_name: string
          notes: string | null
          quantity: number
          reservation_id: string
          sort_order: number
          status: string
          tenant_id: string
          unit_price_eur: number | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          item_name: string
          notes?: string | null
          quantity?: number
          reservation_id: string
          sort_order?: number
          status?: string
          tenant_id: string
          unit_price_eur?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          item_name?: string
          notes?: string | null
          quantity?: number
          reservation_id?: string
          sort_order?: number
          status?: string
          tenant_id?: string
          unit_price_eur?: number | null
          updated_at?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "login_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "login_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          is_used: boolean
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          is_used?: boolean
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          is_used?: boolean
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          reservation_id: string | null
          tenant_id: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          reservation_id?: string | null
          tenant_id: string
          title: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          reservation_id?: string | null
          tenant_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          end_time: string | null
          event_date: string
          event_space: string
          event_type: string | null
          guest_email: string
          guest_name: string
          guest_phone: string
          guests_count: number
          id: string
          invoicing_details: string | null
          language: string
          last_send_provider_id: string | null
          last_sent_at: string | null
          linked_reservations: Json | null
          menu: string | null
          reservation_ids: string[] | null
          special_requests: string | null
          start_time: string
          status: string
          tenant_id: string
          updated_at: string
          validity_date: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          event_date: string
          event_space?: string
          event_type?: string | null
          guest_email: string
          guest_name: string
          guest_phone: string
          guests_count: number
          id?: string
          invoicing_details?: string | null
          language?: string
          last_send_provider_id?: string | null
          last_sent_at?: string | null
          linked_reservations?: Json | null
          menu?: string | null
          reservation_ids?: string[] | null
          special_requests?: string | null
          start_time: string
          status?: string
          tenant_id: string
          updated_at?: string
          validity_date?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          event_date?: string
          event_space?: string
          event_type?: string | null
          guest_email?: string
          guest_name?: string
          guest_phone?: string
          guests_count?: number
          id?: string
          invoicing_details?: string | null
          language?: string
          last_send_provider_id?: string | null
          last_sent_at?: string | null
          linked_reservations?: Json | null
          menu?: string | null
          reservation_ids?: string[] | null
          special_requests?: string | null
          start_time?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          validity_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_blocked_slots: {
        Row: {
          approval_status: string
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          day_of_week: number
          end_time: string | null
          id: string
          is_active: boolean
          reason: string | null
          rejection_reason: string | null
          resource_id: string | null
          resource_type: string
          site_id: string | null
          start_time: string | null
          tenant_id: string
        }
        Insert: {
          approval_status?: string
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          day_of_week: number
          end_time?: string | null
          id?: string
          is_active?: boolean
          reason?: string | null
          rejection_reason?: string | null
          resource_id?: string | null
          resource_type: string
          site_id?: string | null
          start_time?: string | null
          tenant_id: string
        }
        Update: {
          approval_status?: string
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          day_of_week?: number
          end_time?: string | null
          id?: string
          is_active?: boolean
          reason?: string | null
          rejection_reason?: string | null
          resource_id?: string | null
          resource_type?: string
          site_id?: string | null
          start_time?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_blocked_slots_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_blocked_slots_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_blocked_slots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_blocked_slots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_blocked_slots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      redemption_idempotency: {
        Row: {
          created_at: string
          endpoint: string
          expires_at: string
          id: string
          idempotency_key: string
          response_body: Json
          response_status: number
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          expires_at?: string
          id?: string
          idempotency_key: string
          response_body: Json
          response_status: number
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          response_body?: Json
          response_status?: number
          user_id?: string
        }
        Relationships: []
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
          delivery_address: string | null
          dietary_notes: string | null
          discount_code_id: string | null
          discount_reason: string | null
          discount_type: string | null
          discount_value: number | null
          electricity_needed: boolean | null
          end_time: string | null
          equipment_needed: boolean | null
          estimated_guests: number | null
          event_type: string | null
          festival_name: string | null
          food_permits: string | null
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
          linked_group_id: string | null
          no_email_ack: boolean | null
          no_email_cancel: boolean | null
          no_email_confirm: boolean | null
          original_price_eur: number | null
          price_eur: number | null
          pricing_details: string | null
          pricing_type: string | null
          reminder_email_sent_at: string | null
          reservation_type: string
          restaurant_sub_type: string | null
          room_type: string | null
          selected_sub_services: Json | null
          site_id: string | null
          special_requests: string | null
          staff_needed: boolean | null
          staff_notes: string | null
          stall_fee: number | null
          stall_size: string | null
          start_time: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
          water_needed: boolean | null
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
          delivery_address?: string | null
          dietary_notes?: string | null
          discount_code_id?: string | null
          discount_reason?: string | null
          discount_type?: string | null
          discount_value?: number | null
          electricity_needed?: boolean | null
          end_time?: string | null
          equipment_needed?: boolean | null
          estimated_guests?: number | null
          event_type?: string | null
          festival_name?: string | null
          food_permits?: string | null
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
          linked_group_id?: string | null
          no_email_ack?: boolean | null
          no_email_cancel?: boolean | null
          no_email_confirm?: boolean | null
          original_price_eur?: number | null
          price_eur?: number | null
          pricing_details?: string | null
          pricing_type?: string | null
          reminder_email_sent_at?: string | null
          reservation_type: string
          restaurant_sub_type?: string | null
          room_type?: string | null
          selected_sub_services?: Json | null
          site_id?: string | null
          special_requests?: string | null
          staff_needed?: boolean | null
          staff_notes?: string | null
          stall_fee?: number | null
          stall_size?: string | null
          start_time?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
          water_needed?: boolean | null
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
          delivery_address?: string | null
          dietary_notes?: string | null
          discount_code_id?: string | null
          discount_reason?: string | null
          discount_type?: string | null
          discount_value?: number | null
          electricity_needed?: boolean | null
          end_time?: string | null
          equipment_needed?: boolean | null
          estimated_guests?: number | null
          event_type?: string | null
          festival_name?: string | null
          food_permits?: string | null
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
          linked_group_id?: string | null
          no_email_ack?: boolean | null
          no_email_cancel?: boolean | null
          no_email_confirm?: boolean | null
          original_price_eur?: number | null
          price_eur?: number | null
          pricing_details?: string | null
          pricing_type?: string | null
          reminder_email_sent_at?: string | null
          reservation_type?: string
          restaurant_sub_type?: string | null
          room_type?: string | null
          selected_sub_services?: Json | null
          site_id?: string | null
          special_requests?: string | null
          staff_needed?: boolean | null
          staff_notes?: string | null
          stall_fee?: number | null
          stall_size?: string | null
          start_time?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
          water_needed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
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
          {
            foreignKeyName: "resource_images_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_images_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_opening_hours: {
        Row: {
          close_time: string | null
          created_at: string | null
          day_of_week: number
          id: string
          is_closed: boolean | null
          open_time: string | null
          resource_id: string
          tenant_id: string
        }
        Insert: {
          close_time?: string | null
          created_at?: string | null
          day_of_week: number
          id?: string
          is_closed?: boolean | null
          open_time?: string | null
          resource_id: string
          tenant_id: string
        }
        Update: {
          close_time?: string | null
          created_at?: string | null
          day_of_week?: number
          id?: string
          is_closed?: boolean | null
          open_time?: string | null
          resource_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_opening_hours_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_opening_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_opening_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_opening_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          approval_status: string
          approved_by: string | null
          bed_configuration: Json | null
          breakfast_price_per_person: number | null
          capacity: number | null
          created_at: string | null
          custom_type_label: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          offers_catering: boolean
          offers_popup: boolean
          offers_quote: boolean
          offers_set_menu: boolean
          offers_table_reservation: boolean
          price_per_night: number | null
          rejection_reason: string | null
          resource_type: string
          room_description: string | null
          room_type: string | null
          room_type_pricing: Json | null
          site_id: string | null
          sub_services: Json
          tenant_id: string
        }
        Insert: {
          approval_status?: string
          approved_by?: string | null
          bed_configuration?: Json | null
          breakfast_price_per_person?: number | null
          capacity?: number | null
          created_at?: string | null
          custom_type_label?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          offers_catering?: boolean
          offers_popup?: boolean
          offers_quote?: boolean
          offers_set_menu?: boolean
          offers_table_reservation?: boolean
          price_per_night?: number | null
          rejection_reason?: string | null
          resource_type: string
          room_description?: string | null
          room_type?: string | null
          room_type_pricing?: Json | null
          site_id?: string | null
          sub_services?: Json
          tenant_id: string
        }
        Update: {
          approval_status?: string
          approved_by?: string | null
          bed_configuration?: Json | null
          breakfast_price_per_person?: number | null
          capacity?: number | null
          created_at?: string | null
          custom_type_label?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          offers_catering?: boolean
          offers_popup?: boolean
          offers_quote?: boolean
          offers_set_menu?: boolean
          offers_table_reservation?: boolean
          price_per_night?: number | null
          rejection_reason?: string | null
          resource_type?: string
          room_description?: string | null
          room_type?: string | null
          room_type_pricing?: Json | null
          site_id?: string | null
          sub_services?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
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
          {
            foreignKeyName: "role_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
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
          {
            foreignKeyName: "role_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          accent_color: string | null
          business_address: string | null
          business_description: string | null
          business_email: string | null
          business_name: string | null
          business_phone: string | null
          created_at: string
          hero_image_url: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          site_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          business_address?: string | null
          business_description?: string | null
          business_email?: string | null
          business_name?: string | null
          business_phone?: string | null
          created_at?: string
          hero_image_url?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          site_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          business_address?: string | null
          business_description?: string | null
          business_email?: string | null
          business_name?: string | null
          business_phone?: string | null
          created_at?: string
          hero_image_url?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          site_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_settings_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      site_users: {
        Row: {
          created_at: string
          id: string
          role: string
          site_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          site_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          site_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_users_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          location: string | null
          name: string
          slug: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
          slug: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
          slug?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_rejection_alerts: {
        Row: {
          callsite: string | null
          created_at: string
          event_count: number
          id: string
          resolved_at: string | null
          scope: string
          tenant_id: string | null
          threshold: number
          window_end: string
          window_start: string
        }
        Insert: {
          callsite?: string | null
          created_at?: string
          event_count: number
          id?: string
          resolved_at?: string | null
          scope: string
          tenant_id?: string | null
          threshold: number
          window_end: string
          window_start: string
        }
        Update: {
          callsite?: string | null
          created_at?: string
          event_count?: number
          id?: string
          resolved_at?: string | null
          scope?: string
          tenant_id?: string | null
          threshold?: number
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      storage_rejection_events: {
        Row: {
          callsite: string | null
          created_at: string
          has_backslash: boolean
          has_control_char: boolean
          has_scheme_shape: boolean
          id: string
          input_length: number
          leading_char_class: string
          reason: string
          segment_count: number | null
          tenant_id: string | null
        }
        Insert: {
          callsite?: string | null
          created_at?: string
          has_backslash?: boolean
          has_control_char?: boolean
          has_scheme_shape?: boolean
          id?: string
          input_length?: number
          leading_char_class?: string
          reason: string
          segment_count?: number | null
          tenant_id?: string | null
        }
        Update: {
          callsite?: string | null
          created_at?: string
          has_backslash?: boolean
          has_control_char?: boolean
          has_scheme_shape?: boolean
          id?: string
          input_length?: number
          leading_char_class?: string
          reason?: string
          segment_count?: number | null
          tenant_id?: string | null
        }
        Relationships: []
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
          {
            foreignKeyName: "support_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
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
          approval_status: string
          approved_by: string | null
          body_html: string
          created_at: string | null
          id: string
          is_active: boolean | null
          language: string | null
          rejection_reason: string | null
          site_id: string | null
          subject: string
          template_type: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          approval_status?: string
          approved_by?: string | null
          body_html: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          rejection_reason?: string | null
          site_id?: string | null
          subject: string
          template_type: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          approval_status?: string
          approved_by?: string | null
          body_html?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          rejection_reason?: string | null
          site_id?: string | null
          subject?: string
          template_type?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_email_templates_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_email_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_email_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_email_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_opening_hours: {
        Row: {
          approval_status: string
          approved_by: string | null
          close_time: string | null
          created_at: string | null
          day_of_week: number
          id: string
          is_closed: boolean | null
          open_time: string | null
          rejection_reason: string | null
          resource_type: string
          site_id: string | null
          tenant_id: string
        }
        Insert: {
          approval_status?: string
          approved_by?: string | null
          close_time?: string | null
          created_at?: string | null
          day_of_week: number
          id?: string
          is_closed?: boolean | null
          open_time?: string | null
          rejection_reason?: string | null
          resource_type: string
          site_id?: string | null
          tenant_id: string
        }
        Update: {
          approval_status?: string
          approved_by?: string | null
          close_time?: string | null
          created_at?: string | null
          day_of_week?: number
          id?: string
          is_closed?: boolean | null
          open_time?: string | null
          rejection_reason?: string | null
          resource_type?: string
          site_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_opening_hours_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_opening_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_opening_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_opening_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
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
          resource_type_descriptions: Json | null
          resource_type_names: Json | null
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
          resource_type_descriptions?: Json | null
          resource_type_names?: Json | null
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
          resource_type_descriptions?: Json | null
          resource_type_names?: Json | null
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
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          custom_role_key: string | null
          display_name: string | null
          id: string
          is_approved: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          custom_role_key?: string | null
          display_name?: string | null
          id?: string
          is_approved?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          custom_role_key?: string | null
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
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          allowed_reservation_types: string[]
          created_at: string | null
          discount_granted_by: string | null
          discount_percentage: number | null
          discount_reason: string | null
          id: string
          is_active: boolean | null
          name: string
          owner_user_id: string
          sample_end_date: string | null
          sample_start_date: string | null
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
          discount_granted_by?: string | null
          discount_percentage?: number | null
          discount_reason?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          owner_user_id: string
          sample_end_date?: string | null
          sample_start_date?: string | null
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
          discount_granted_by?: string | null
          discount_percentage?: number | null
          discount_reason?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          owner_user_id?: string
          sample_end_date?: string | null
          sample_start_date?: string | null
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          tier?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          guest_email: string
          guest_name: string
          guest_phone: string | null
          id: string
          notified_at: string | null
          preferred_date: string
          resource_type: string
          site_id: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          guest_email: string
          guest_name: string
          guest_phone?: string | null
          id?: string
          notified_at?: string | null
          preferred_date: string
          resource_type: string
          site_id?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          guest_email?: string
          guest_name?: string
          guest_phone?: string | null
          id?: string
          notified_at?: string | null
          preferred_date?: string
          resource_type?: string
          site_id?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      access_codes_redeemed_view: {
        Row: {
          code_prefix: string | null
          created_at: string | null
          description: string | null
          duration_days: number | null
          granted_tier: string | null
          granted_until: string | null
          id: string | null
          is_active: boolean | null
          is_revoked: boolean | null
          max_uses: number | null
          redeemed_by_tenant_id: string | null
          redemption_active: boolean | null
          revoked_at: string | null
          revoked_reason: string | null
          tier: string | null
          updated_at: string | null
          used_count: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_code_redemptions_tenant_id_fkey"
            columns: ["redeemed_by_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_code_redemptions_tenant_id_fkey"
            columns: ["redeemed_by_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_code_redemptions_tenant_id_fkey"
            columns: ["redeemed_by_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_reviews_public: {
        Row: {
          comment: string | null
          created_at: string | null
          guest_name: string | null
          id: string | null
          is_published: boolean | null
          rating: number | null
          site_id: string | null
          tenant_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          guest_name?: string | null
          id?: string | null
          is_published?: boolean | null
          rating?: number | null
          site_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          guest_name?: string | null
          id?: string | null
          is_published?: boolean | null
          rating?: number | null
          site_id?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      site_settings_public: {
        Row: {
          accent_color: string | null
          business_description: string | null
          business_name: string | null
          created_at: string | null
          hero_image_url: string | null
          id: string | null
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          site_id: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          business_description?: string | null
          business_name?: string | null
          created_at?: string | null
          hero_image_url?: string | null
          id?: string | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          site_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          business_description?: string | null
          business_name?: string | null
          created_at?: string | null
          hero_image_url?: string | null
          id?: string | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          site_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_settings_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings_public: {
        Row: {
          accent_color: string | null
          business_description: string | null
          business_name: string | null
          created_at: string | null
          default_language: string | null
          hero_image_url: string | null
          id: string | null
          logo_url: string | null
          primary_color: string | null
          resource_type_descriptions: Json | null
          resource_type_names: Json | null
          secondary_color: string | null
          tenant_id: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          business_description?: string | null
          business_name?: string | null
          created_at?: string | null
          default_language?: string | null
          hero_image_url?: string | null
          id?: string | null
          logo_url?: string | null
          primary_color?: string | null
          resource_type_descriptions?: Json | null
          resource_type_names?: Json | null
          secondary_color?: string | null
          tenant_id?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          business_description?: string | null
          business_name?: string | null
          created_at?: string | null
          default_language?: string | null
          hero_image_url?: string | null
          id?: string | null
          logo_url?: string | null
          primary_color?: string | null
          resource_type_descriptions?: Json | null
          resource_type_names?: Json | null
          secondary_color?: string | null
          tenant_id?: string | null
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
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants_public: {
        Row: {
          allowed_reservation_types: string[] | null
          id: string | null
          is_active: boolean | null
          name: string | null
          slug: string | null
        }
        Insert: {
          allowed_reservation_types?: string[] | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          slug?: string | null
        }
        Update: {
          allowed_reservation_types?: string[] | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      tenants_safe: {
        Row: {
          allowed_reservation_types: string[] | null
          created_at: string | null
          discount_granted_by: string | null
          discount_percentage: number | null
          discount_reason: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          owner_user_id: string | null
          sample_end_date: string | null
          sample_start_date: string | null
          slug: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          allowed_reservation_types?: string[] | null
          created_at?: string | null
          discount_granted_by?: string | null
          discount_percentage?: number | null
          discount_reason?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          owner_user_id?: string | null
          sample_end_date?: string | null
          sample_start_date?: string | null
          slug?: string | null
          stripe_customer_id?: never
          stripe_subscription_id?: never
          subscription_status?: string | null
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          allowed_reservation_types?: string[] | null
          created_at?: string | null
          discount_granted_by?: string | null
          discount_percentage?: number | null
          discount_reason?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          owner_user_id?: string | null
          sample_end_date?: string | null
          sample_start_date?: string | null
          slug?: string | null
          stripe_customer_id?: never
          stripe_subscription_id?: never
          subscription_status?: string | null
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_expired_redemption_idempotency: {
        Args: never
        Returns: undefined
      }
      cleanup_old_audit_logs: { Args: never; Returns: undefined }
      cleanup_old_booking_validation_logs: { Args: never; Returns: undefined }
      cleanup_storage_rejection_telemetry: { Args: never; Returns: undefined }
      copy_tenant_defaults_to_site: {
        Args: { p_site_id: string; p_tenant_id: string }
        Returns: undefined
      }
      create_access_code: {
        Args: {
          p_code: string
          p_description: string
          p_duration_days: number
          p_max_uses: number
          p_tier: string
          p_valid_from: string
          p_valid_until: string
        }
        Returns: string
      }
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      find_users_with_multiple_tenants: {
        Args: never
        Returns: {
          resolved_tenant_id: string
          tenant_count: number
          tenant_ids: string[]
          tenant_names: string[]
          user_id: string
        }[]
      }
      get_published_reviews: {
        Args: { p_site_id?: string; p_tenant_id: string }
        Returns: {
          comment: string
          created_at: string
          guest_name: string
          id: string
          rating: number
          site_id: string
          tenant_id: string
        }[]
      }
      get_tenant_membership_health: {
        Args: never
        Returns: {
          total_memberships: number
          unique_users: number
          users_with_multiple_tenants: number
          users_with_no_resolvable_tenant: number
        }[]
      }
      get_tier_max_reservation_types: {
        Args: { p_tier: string }
        Returns: number
      }
      get_tier_max_resources_total: {
        Args: { p_tier: string }
        Returns: number
      }
      get_tier_max_sites: { Args: { p_tier: string }; Returns: number }
      get_tier_max_staff_users: { Args: { p_tier: string }; Returns: number }
      get_unconfirmed_users: {
        Args: { since_date: string }
        Returns: {
          created_at: string
          email: string
          id: string
        }[]
      }
      get_user_tenant_id: { Args: { p_user_id: string }; Returns: string }
      has_permission:
        | {
            Args: { p_permission: string; p_user_id: string }
            Returns: boolean
          }
        | {
            Args: {
              p_permission: string
              p_tenant_id: string
              p_user_id: string
            }
            Returns: boolean
          }
      has_tenant_role:
        | {
            Args: {
              p_role: Database["public"]["Enums"]["app_role"]
              p_user_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_role: Database["public"]["Enums"]["app_role"]
              p_tenant_id: string
              p_user_id: string
            }
            Returns: boolean
          }
      is_system_admin: { Args: { p_user_id: string }; Returns: boolean }
      is_user_tenant_member: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: boolean
      }
      is_valid_review_token: { Args: { p_token: string }; Returns: boolean }
      is_valid_review_token_for_reservation: {
        Args: { p_reservation_id: string; p_tenant_id: string; p_token: string }
        Returns: boolean
      }
      list_tenant_scoped_tables: {
        Args: never
        Returns: {
          table_name: string
        }[]
      }
      lookup_access_code_by_plaintext: {
        Args: { p_code: string }
        Returns: {
          code_hash: string
          code_prefix: string
          created_at: string
          created_by: string
          description: string | null
          duration_days: number
          id: string
          is_active: boolean
          is_revoked: boolean
          max_uses: number | null
          revoked_at: string | null
          revoked_reason: string | null
          tier: string
          updated_at: string
          used_count: number
          valid_from: string | null
          valid_until: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "access_codes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      lookup_booking_token: {
        Args: { p_token: string }
        Returns: {
          created_at: string
          expires_at: string
          id: string
          is_revoked: boolean
          reservation_id: string
          tenant_id: string
          token: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      seed_tenant_roles_and_permissions: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "superadmin" | "owner" | "admin" | "staff"
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
      app_role: ["superadmin", "owner", "admin", "staff"],
    },
  },
} as const

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
      action_center: {
        Row: {
          agency_id: string
          assigned_to: string | null
          canonical_key: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          metadata: Json
          priority: string
          source_ref_id: string | null
          source_type: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          assigned_to?: string | null
          canonical_key?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json
          priority?: string
          source_ref_id?: string | null
          source_type: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          assigned_to?: string | null
          canonical_key?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json
          priority?: string
          source_ref_id?: string | null
          source_type?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_center_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_center_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      action_center_events: {
        Row: {
          action_id: string
          actor_id: string | null
          agency_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json
        }
        Insert: {
          action_id: string
          actor_id?: string | null
          agency_id: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
        }
        Update: {
          action_id?: string
          actor_id?: string | null
          agency_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "action_center_events_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action_center"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_center_events_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          agency_id: string
          client_id: string | null
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          agency_id: string
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          agency_id?: string
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      agencies: {
        Row: {
          created_at: string
          custom_domain: string | null
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_domain?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_domain?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      agency_briefings: {
        Row: {
          agency_id: string
          buckets: Json
          computed_at: string
        }
        Insert: {
          agency_id: string
          buckets?: Json
          computed_at?: string
        }
        Update: {
          agency_id?: string
          buckets?: Json
          computed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_briefings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_events: {
        Row: {
          agency_id: string
          completion_tokens: number
          created_at: string
          day: string
          estimated_cost_usd: number
          function_name: string
          id: string
          prompt_tokens: number
        }
        Insert: {
          agency_id: string
          completion_tokens?: number
          created_at?: string
          day?: string
          estimated_cost_usd?: number
          function_name: string
          id?: string
          prompt_tokens?: number
        }
        Update: {
          agency_id?: string
          completion_tokens?: number
          created_at?: string
          day?: string
          estimated_cost_usd?: number
          function_name?: string
          id?: string
          prompt_tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          agency_id: string
          ai_output_json: Json | null
          ai_output_text: string | null
          assigned_to: string | null
          avoid_duplicate_until: string | null
          campaign_id: string | null
          client_id: string | null
          confianca: string | null
          created_at: string
          description: string | null
          id: string
          priority: Database["public"]["Enums"]["alert_priority"]
          prompt_key: string | null
          prompt_version: string | null
          recommended_action: string | null
          requer_revisao_humana: boolean
          resolved_at: string | null
          should_create_task: boolean
          status: Database["public"]["Enums"]["alert_status"]
          status_envio: string
          task_title: string | null
          time_to_act: string | null
          title: string
          type: string
          updated_at: string
          why_line: string | null
        }
        Insert: {
          agency_id: string
          ai_output_json?: Json | null
          ai_output_text?: string | null
          assigned_to?: string | null
          avoid_duplicate_until?: string | null
          campaign_id?: string | null
          client_id?: string | null
          confianca?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["alert_priority"]
          prompt_key?: string | null
          prompt_version?: string | null
          recommended_action?: string | null
          requer_revisao_humana?: boolean
          resolved_at?: string | null
          should_create_task?: boolean
          status?: Database["public"]["Enums"]["alert_status"]
          status_envio?: string
          task_title?: string | null
          time_to_act?: string | null
          title: string
          type: string
          updated_at?: string
          why_line?: string | null
        }
        Update: {
          agency_id?: string
          ai_output_json?: Json | null
          ai_output_text?: string | null
          assigned_to?: string | null
          avoid_duplicate_until?: string | null
          campaign_id?: string | null
          client_id?: string | null
          confianca?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["alert_priority"]
          prompt_key?: string | null
          prompt_version?: string | null
          recommended_action?: string | null
          requer_revisao_humana?: boolean
          resolved_at?: string | null
          should_create_task?: boolean
          status?: Database["public"]["Enums"]["alert_status"]
          status_envio?: string
          task_title?: string | null
          time_to_act?: string | null
          title?: string
          type?: string
          updated_at?: string
          why_line?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_ai_audit_recommendation_status: {
        Row: {
          agency_id: string
          audit_id: string
          campaign_id: string
          client_id: string
          id: string
          updated_at: string
          updated_by: string | null
          user_action: string
        }
        Insert: {
          agency_id: string
          audit_id: string
          campaign_id: string
          client_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          user_action: string
        }
        Update: {
          agency_id?: string
          audit_id?: string
          campaign_id?: string
          client_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          user_action?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_ai_audit_recommendation_status_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_ai_audit_recommendation_status_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "campaign_ai_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_ai_audit_recommendation_status_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_ai_audit_recommendation_status_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_ai_audits: {
        Row: {
          agency_id: string
          client_id: string
          created_at: string
          created_by: string | null
          executive_summary_markdown: string | null
          ga4_tracking_health: string
          id: string
          model: string
          period_end: string
          period_start: string
          prompt_version: string
          result_json: Json
        }
        Insert: {
          agency_id: string
          client_id: string
          created_at?: string
          created_by?: string | null
          executive_summary_markdown?: string | null
          ga4_tracking_health: string
          id?: string
          model?: string
          period_end: string
          period_start: string
          prompt_version?: string
          result_json?: Json
        }
        Update: {
          agency_id?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          executive_summary_markdown?: string | null
          ga4_tracking_health?: string
          id?: string
          model?: string
          period_end?: string
          period_start?: string
          prompt_version?: string
          result_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "campaign_ai_audits_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_ai_audits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          agency_id: string
          client_id: string
          created_at: string
          daily_budget: number | null
          external_id: string | null
          id: string
          name: string
          objective: string | null
          platform: string
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
        }
        Insert: {
          agency_id: string
          client_id: string
          created_at?: string
          daily_budget?: number | null
          external_id?: string | null
          id?: string
          name: string
          objective?: string | null
          platform: string
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Update: {
          agency_id?: string
          client_id?: string
          created_at?: string
          daily_budget?: number | null
          external_id?: string | null
          id?: string
          name?: string
          objective?: string | null
          platform?: string
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_member_scopes: {
        Row: {
          agency_id: string
          client_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          agency_id: string
          client_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          agency_id?: string
          client_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_member_scopes_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_member_scopes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_platform_accounts: {
        Row: {
          account_external_id: string
          account_name: string | null
          agency_id: string
          client_id: string
          config: Json
          created_at: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          updated_at: string
        }
        Insert: {
          account_external_id: string
          account_name?: string | null
          agency_id: string
          client_id: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          updated_at?: string
        }
        Update: {
          account_external_id?: string
          account_name?: string | null
          agency_id?: string
          client_id?: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_platform_accounts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_platform_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_whatsapp_prefs: {
        Row: {
          agency_id: string
          client_id: string
          id: string
          mute_whatsapp_until: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          client_id: string
          id?: string
          mute_whatsapp_until?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          client_id?: string
          id?: string
          mute_whatsapp_until?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_whatsapp_prefs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_whatsapp_prefs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          agency_id: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          monthly_budget: number | null
          mrr: number | null
          name: string
          portal_slug: string | null
          responsible_id: string | null
          segment: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["client_status"]
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          monthly_budget?: number | null
          mrr?: number | null
          name: string
          portal_slug?: string | null
          responsible_id?: string | null
          segment?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          monthly_budget?: number | null
          mrr?: number | null
          name?: string
          portal_slug?: string | null
          responsible_id?: string | null
          segment?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_snapshots: {
        Row: {
          ad_count: number | null
          agency_id: string
          ai_output_json: Json | null
          ai_output_text: string | null
          captured_at: string
          client_id: string
          competitor_watchlist_id: string | null
          confianca: string | null
          headline: string | null
          id: string
          insight: string | null
          prompt_key: string | null
          prompt_version: string | null
          requer_revisao_humana: boolean
          status_envio: string
          summary: string | null
        }
        Insert: {
          ad_count?: number | null
          agency_id: string
          ai_output_json?: Json | null
          ai_output_text?: string | null
          captured_at?: string
          client_id: string
          competitor_watchlist_id?: string | null
          confianca?: string | null
          headline?: string | null
          id?: string
          insight?: string | null
          prompt_key?: string | null
          prompt_version?: string | null
          requer_revisao_humana?: boolean
          status_envio?: string
          summary?: string | null
        }
        Update: {
          ad_count?: number | null
          agency_id?: string
          ai_output_json?: Json | null
          ai_output_text?: string | null
          captured_at?: string
          client_id?: string
          competitor_watchlist_id?: string | null
          confianca?: string | null
          headline?: string | null
          id?: string
          insight?: string | null
          prompt_key?: string | null
          prompt_version?: string | null
          requer_revisao_humana?: boolean
          status_envio?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_snapshots_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_snapshots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_snapshots_competitor_watchlist_id_fkey"
            columns: ["competitor_watchlist_id"]
            isOneToOne: false
            referencedRelation: "competitor_watchlist"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_watchlist: {
        Row: {
          agency_id: string
          client_id: string
          competitor_name: string
          created_at: string
          id: string
          is_active: boolean
          source_url: string | null
        }
        Insert: {
          agency_id: string
          client_id: string
          competitor_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          source_url?: string | null
        }
        Update: {
          agency_id?: string
          client_id?: string
          competitor_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_watchlist_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_watchlist_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_assets: {
        Row: {
          agency_id: string
          client_id: string
          created_at: string
          description: string | null
          id: string
          preview_url: string | null
          status: string
          storage_path: string | null
          submitted_at: string
          submitted_by: string | null
          title: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          preview_url?: string | null
          status?: string
          storage_path?: string | null
          submitted_at?: string
          submitted_by?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          preview_url?: string | null
          status?: string
          storage_path?: string | null
          submitted_at?: string
          submitted_by?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_assets_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_reviews: {
        Row: {
          agency_id: string
          creative_asset_id: string
          decision: string
          feedback: string | null
          id: string
          reviewed_at: string
          reviewer_name: string | null
          source: string
        }
        Insert: {
          agency_id: string
          creative_asset_id: string
          decision: string
          feedback?: string | null
          id?: string
          reviewed_at?: string
          reviewer_name?: string | null
          source?: string
        }
        Update: {
          agency_id?: string
          creative_asset_id?: string
          decision?: string
          feedback?: string | null
          id?: string
          reviewed_at?: string
          reviewer_name?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_reviews_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_reviews_creative_asset_id_fkey"
            columns: ["creative_asset_id"]
            isOneToOne: false
            referencedRelation: "creative_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnoses: {
        Row: {
          amount_cents: number
          buyer_user_id: string | null
          completed_at: string | null
          created_at: string
          cta_clicked_at: string | null
          currency: string
          failed_reason: string | null
          id: string
          management_amount_cents: number
          management_business_name: string | null
          management_instagram: string | null
          management_mp_payment_id: string | null
          management_mp_preference_id: string | null
          management_paid_at: string | null
          management_status: string
          management_website: string | null
          meta_ad_account_id: string | null
          meta_user_id: string | null
          mp_payment_id: string | null
          mp_preference_id: string | null
          payer_cpf: string | null
          payer_email: string | null
          payer_name: string | null
          payer_phone: string | null
          payment_method: string | null
          pix_expires_at: string | null
          pix_qr_code: string | null
          pix_qr_code_base64: string | null
          report_version: number
          secret_slug: string
          status: string
          viewed_at: string | null
        }
        Insert: {
          amount_cents?: number
          buyer_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          cta_clicked_at?: string | null
          currency?: string
          failed_reason?: string | null
          id?: string
          management_amount_cents?: number
          management_business_name?: string | null
          management_instagram?: string | null
          management_mp_payment_id?: string | null
          management_mp_preference_id?: string | null
          management_paid_at?: string | null
          management_status?: string
          management_website?: string | null
          meta_ad_account_id?: string | null
          meta_user_id?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          payer_cpf?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          payment_method?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          report_version?: number
          secret_slug?: string
          status: string
          viewed_at?: string | null
        }
        Update: {
          amount_cents?: number
          buyer_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          cta_clicked_at?: string | null
          currency?: string
          failed_reason?: string | null
          id?: string
          management_amount_cents?: number
          management_business_name?: string | null
          management_instagram?: string | null
          management_mp_payment_id?: string | null
          management_mp_preference_id?: string | null
          management_paid_at?: string | null
          management_status?: string
          management_website?: string | null
          meta_ad_account_id?: string | null
          meta_user_id?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          payer_cpf?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          payment_method?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          report_version?: number
          secret_slug?: string
          status?: string
          viewed_at?: string | null
        }
        Relationships: []
      }
      diagnosis_reports: {
        Row: {
          analysis_json: Json | null
          diagnosis_id: string
          facts_json: Json | null
          prompt_version: string | null
          updated_at: string
        }
        Insert: {
          analysis_json?: Json | null
          diagnosis_id: string
          facts_json?: Json | null
          prompt_version?: string | null
          updated_at?: string
        }
        Update: {
          analysis_json?: Json | null
          diagnosis_id?: string
          facts_json?: Json | null
          prompt_version?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnosis_reports_diagnosis_id_fkey"
            columns: ["diagnosis_id"]
            isOneToOne: true
            referencedRelation: "diagnoses"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnosis_secrets: {
        Row: {
          access_token: string | null
          auto_login_expires_at: string | null
          auto_login_token: string | null
          diagnosis_id: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          auto_login_expires_at?: string | null
          auto_login_token?: string | null
          diagnosis_id: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          auto_login_expires_at?: string | null
          auto_login_token?: string | null
          diagnosis_id?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnosis_secrets_diagnosis_id_fkey"
            columns: ["diagnosis_id"]
            isOneToOne: true
            referencedRelation: "diagnoses"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          agency_id: string
          created_at: string
          enabled: boolean
          id: string
          key: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          key: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          key?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      ga4_campaign_daily: {
        Row: {
          agency_id: string
          campaign_id_ga4: string | null
          campaign_name: string
          client_id: string
          conversions: number
          created_at: string
          date: string
          id: string
          landing_page: string | null
          revenue: number
          sessions: number
        }
        Insert: {
          agency_id: string
          campaign_id_ga4?: string | null
          campaign_name: string
          client_id: string
          conversions?: number
          created_at?: string
          date: string
          id?: string
          landing_page?: string | null
          revenue?: number
          sessions?: number
        }
        Update: {
          agency_id?: string
          campaign_id_ga4?: string | null
          campaign_name?: string
          client_id?: string
          conversions?: number
          created_at?: string
          date?: string
          id?: string
          landing_page?: string | null
          revenue?: number
          sessions?: number
        }
        Relationships: [
          {
            foreignKeyName: "ga4_campaign_daily_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ga4_campaign_daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ga4_channel_daily: {
        Row: {
          agency_id: string
          channel: string
          client_id: string
          conversion_rate: number
          conversions: number
          created_at: string
          date: string
          id: string
          revenue: number
          revenue_per_session: number
          sessions: number
        }
        Insert: {
          agency_id: string
          channel: string
          client_id: string
          conversion_rate?: number
          conversions?: number
          created_at?: string
          date: string
          id?: string
          revenue?: number
          revenue_per_session?: number
          sessions?: number
        }
        Update: {
          agency_id?: string
          channel?: string
          client_id?: string
          conversion_rate?: number
          conversions?: number
          created_at?: string
          date?: string
          id?: string
          revenue?: number
          revenue_per_session?: number
          sessions?: number
        }
        Relationships: [
          {
            foreignKeyName: "ga4_channel_daily_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ga4_channel_daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ga4_daily: {
        Row: {
          agency_id: string
          avg_ticket: number
          client_id: string
          conversion_rate: number
          conversions: number
          created_at: string
          date: string
          id: string
          revenue: number
          sessions: number
          users_count: number
        }
        Insert: {
          agency_id: string
          avg_ticket?: number
          client_id: string
          conversion_rate?: number
          conversions?: number
          created_at?: string
          date: string
          id?: string
          revenue?: number
          sessions?: number
          users_count?: number
        }
        Update: {
          agency_id?: string
          avg_ticket?: number
          client_id?: string
          conversion_rate?: number
          conversions?: number
          created_at?: string
          date?: string
          id?: string
          revenue?: number
          sessions?: number
          users_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ga4_daily_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ga4_daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ga4_funnel_daily: {
        Row: {
          add_to_cart: number
          add_to_cart_rate: number
          agency_id: string
          begin_checkout: number
          checkout_rate: number
          client_id: string
          created_at: string
          date: string
          id: string
          purchase: number
          purchase_rate: number
          view_item: number
        }
        Insert: {
          add_to_cart?: number
          add_to_cart_rate?: number
          agency_id: string
          begin_checkout?: number
          checkout_rate?: number
          client_id: string
          created_at?: string
          date: string
          id?: string
          purchase?: number
          purchase_rate?: number
          view_item?: number
        }
        Update: {
          add_to_cart?: number
          add_to_cart_rate?: number
          agency_id?: string
          begin_checkout?: number
          checkout_rate?: number
          client_id?: string
          created_at?: string
          date?: string
          id?: string
          purchase?: number
          purchase_rate?: number
          view_item?: number
        }
        Relationships: [
          {
            foreignKeyName: "ga4_funnel_daily_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ga4_funnel_daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ga4_tracking_health_daily: {
        Row: {
          agency_id: string
          client_id: string
          connected: boolean
          conversion_event_ok: boolean
          created_at: string
          data_sufficient: boolean
          date: string
          events_ok: boolean
          id: string
          notes: string | null
          property_valid: boolean
          revenue_available: boolean
          status: string
          tracking_drop_detected: boolean
        }
        Insert: {
          agency_id: string
          client_id: string
          connected?: boolean
          conversion_event_ok?: boolean
          created_at?: string
          data_sufficient?: boolean
          date: string
          events_ok?: boolean
          id?: string
          notes?: string | null
          property_valid?: boolean
          revenue_available?: boolean
          status: string
          tracking_drop_detected?: boolean
        }
        Update: {
          agency_id?: string
          client_id?: string
          connected?: boolean
          conversion_event_ok?: boolean
          created_at?: string
          data_sufficient?: boolean
          date?: string
          events_ok?: boolean
          id?: string
          notes?: string | null
          property_valid?: boolean
          revenue_available?: boolean
          status?: string
          tracking_drop_detected?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ga4_tracking_health_daily_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ga4_tracking_health_daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      health_scores: {
        Row: {
          agency_id: string
          client_id: string
          communication_score: number | null
          engagement_score: number | null
          ga4_context: Json | null
          id: string
          optimization_score: number | null
          performance_score: number | null
          recorded_at: string
          risk: Database["public"]["Enums"]["health_risk"]
          score: number
          score_explanation: Json | null
          stability_score: number | null
        }
        Insert: {
          agency_id: string
          client_id: string
          communication_score?: number | null
          engagement_score?: number | null
          ga4_context?: Json | null
          id?: string
          optimization_score?: number | null
          performance_score?: number | null
          recorded_at?: string
          risk?: Database["public"]["Enums"]["health_risk"]
          score: number
          score_explanation?: Json | null
          stability_score?: number | null
        }
        Update: {
          agency_id?: string
          client_id?: string
          communication_score?: number | null
          engagement_score?: number | null
          ga4_context?: Json | null
          id?: string
          optimization_score?: number | null
          performance_score?: number | null
          recorded_at?: string
          risk?: Database["public"]["Enums"]["health_risk"]
          score?: number
          score_explanation?: Json | null
          stability_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "health_scores_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_scores_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          account_id: string | null
          agency_id: string
          api_key_encrypted: string | null
          config: Json | null
          created_at: string
          id: string
          last_sync_at: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          refresh_token_encrypted: string | null
          status: Database["public"]["Enums"]["integration_status"]
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          agency_id: string
          api_key_encrypted?: string | null
          config?: Json | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          refresh_token_encrypted?: string | null
          status?: Database["public"]["Enums"]["integration_status"]
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          agency_id?: string
          api_key_encrypted?: string | null
          config?: Json | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          refresh_token_encrypted?: string | null
          status?: Database["public"]["Enums"]["integration_status"]
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_reports: {
        Row: {
          agency_id: string
          agenda: string | null
          ai_output_json: Json | null
          ai_output_text: string | null
          client_id: string
          confianca: string | null
          created_at: string
          generated_by: string | null
          id: string
          next_month_plan: string | null
          period_end: string | null
          period_start: string | null
          prompt_key: string | null
          prompt_version: string | null
          requer_revisao_humana: boolean
          status_envio: string
          strategic_questions: string | null
          what_to_improve: string | null
          what_worked: string | null
        }
        Insert: {
          agency_id: string
          agenda?: string | null
          ai_output_json?: Json | null
          ai_output_text?: string | null
          client_id: string
          confianca?: string | null
          created_at?: string
          generated_by?: string | null
          id?: string
          next_month_plan?: string | null
          period_end?: string | null
          period_start?: string | null
          prompt_key?: string | null
          prompt_version?: string | null
          requer_revisao_humana?: boolean
          status_envio?: string
          strategic_questions?: string | null
          what_to_improve?: string | null
          what_worked?: string | null
        }
        Update: {
          agency_id?: string
          agenda?: string | null
          ai_output_json?: Json | null
          ai_output_text?: string | null
          client_id?: string
          confianca?: string | null
          created_at?: string
          generated_by?: string | null
          id?: string
          next_month_plan?: string | null
          period_end?: string | null
          period_start?: string | null
          prompt_key?: string | null
          prompt_version?: string | null
          requer_revisao_humana?: boolean
          status_envio?: string
          strategic_questions?: string | null
          what_to_improve?: string | null
          what_worked?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_reports_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_daily: {
        Row: {
          agency_id: string
          campaign_id: string | null
          clicks: number | null
          client_id: string
          conversions: number | null
          cpa: number | null
          created_at: string
          ctr: number | null
          data_reliability: string
          data_source: string
          date: string
          id: string
          impressions: number | null
          revenue: number | null
          roas: number | null
          spend: number | null
        }
        Insert: {
          agency_id: string
          campaign_id?: string | null
          clicks?: number | null
          client_id: string
          conversions?: number | null
          cpa?: number | null
          created_at?: string
          ctr?: number | null
          data_reliability?: string
          data_source?: string
          date: string
          id?: string
          impressions?: number | null
          revenue?: number | null
          roas?: number | null
          spend?: number | null
        }
        Update: {
          agency_id?: string
          campaign_id?: string | null
          clicks?: number | null
          client_id?: string
          conversions?: number | null
          cpa?: number | null
          created_at?: string
          ctr?: number | null
          data_reliability?: string
          data_source?: string
          date?: string
          id?: string
          impressions?: number | null
          revenue?: number | null
          roas?: number | null
          spend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metrics_daily_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metrics_daily_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metrics_daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          agency_id: string
          author_id: string | null
          client_id: string | null
          content: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          author_id?: string | null
          client_id?: string | null
          content: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          author_id?: string | null
          client_id?: string | null
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          agency_id: string
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          agency_id: string
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          agency_id?: string
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_checklist_items: {
        Row: {
          agency_id: string
          client_id: string
          completed_at: string | null
          created_at: string
          id: string
          sort_order: number
          status: string
          step_key: string
          title: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          client_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          status?: string
          step_key: string
          title: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          client_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          status?: string
          step_key?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_checklist_items_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_checklist_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          agency_id: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          has_completed_product_tour: boolean
          id: string
          is_platform_admin: boolean
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          has_completed_product_tour?: boolean
          id: string
          is_platform_admin?: boolean
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          has_completed_product_tour?: boolean
          id?: string
          is_platform_admin?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          agency_id: string
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          agency_id: string
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          agency_id?: string
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          agency_id: string
          ai_output_json: Json | null
          ai_output_text: string | null
          client_friendly_summary: string | null
          client_id: string
          confianca: string | null
          created_at: string
          executive_summary: string | null
          generated_by: string | null
          id: string
          next_steps: string | null
          opportunities: string | null
          period_end: string | null
          period_start: string | null
          positives: string | null
          problems: string | null
          prompt_key: string | null
          prompt_version: string | null
          raw_data: Json | null
          requer_revisao_humana: boolean
          status_envio: string
        }
        Insert: {
          agency_id: string
          ai_output_json?: Json | null
          ai_output_text?: string | null
          client_friendly_summary?: string | null
          client_id: string
          confianca?: string | null
          created_at?: string
          executive_summary?: string | null
          generated_by?: string | null
          id?: string
          next_steps?: string | null
          opportunities?: string | null
          period_end?: string | null
          period_start?: string | null
          positives?: string | null
          problems?: string | null
          prompt_key?: string | null
          prompt_version?: string | null
          raw_data?: Json | null
          requer_revisao_humana?: boolean
          status_envio?: string
        }
        Update: {
          agency_id?: string
          ai_output_json?: Json | null
          ai_output_text?: string | null
          client_friendly_summary?: string | null
          client_id?: string
          confianca?: string | null
          created_at?: string
          executive_summary?: string | null
          generated_by?: string | null
          id?: string
          next_steps?: string | null
          opportunities?: string | null
          period_end?: string | null
          period_start?: string | null
          positives?: string | null
          problems?: string | null
          prompt_key?: string | null
          prompt_version?: string | null
          raw_data?: Json | null
          requer_revisao_humana?: boolean
          status_envio?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      standup_snoozes: {
        Row: {
          agency_id: string
          created_at: string
          hidden_until: string
          id: string
          item_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          hidden_until: string
          id?: string
          item_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          hidden_until?: string
          id?: string
          item_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standup_snoozes_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          agency_id: string
          created_at: string
          current_period_end: string | null
          id: string
          max_alerts: number
          max_clients: number
          plan: string
          status: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          max_alerts?: number
          max_clients?: number
          plan?: string
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          max_alerts?: number
          max_clients?: number
          plan?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          agency_id: string
          client_id: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          provider: string
          status: string
        }
        Insert: {
          agency_id: string
          client_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          provider: string
          status: string
        }
        Update: {
          agency_id?: string
          client_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          provider?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_runs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          agency_id: string
          assigned_to: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_logs: {
        Row: {
          agency_id: string
          client_id: string | null
          created_at: string
          error: string | null
          id: string
          merge_variables: Json
          message: string
          pending_review: boolean
          recipient: string
          sent_at: string | null
          status: Database["public"]["Enums"]["whatsapp_status"]
          template: string | null
        }
        Insert: {
          agency_id: string
          client_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          merge_variables?: Json
          message: string
          pending_review?: boolean
          recipient: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["whatsapp_status"]
          template?: string | null
        }
        Update: {
          agency_id?: string
          client_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          merge_variables?: Json
          message?: string
          pending_review?: boolean
          recipient?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["whatsapp_status"]
          template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_logs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          agency_id: string
          body: string
          category: string
          created_at: string
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          body: string
          category?: string
          created_at?: string
          id?: string
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          body?: string
          category?: string
          created_at?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      campaign_audit_summary_by_client: {
        Row: {
          agency_id: string | null
          avg_score: number | null
          client_id: string | null
          client_name: string | null
          critical_count: number | null
          dismissed_count: number | null
          last_audit_at: string | null
          tasks_created: number | null
          total_audits: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_ai_audits_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_ai_audits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auth_is_platform_admin: { Args: never; Returns: boolean }
      count_open_alerts: { Args: { _agency: string }; Returns: number }
      current_user_agency: { Args: never; Returns: string }
      has_role: {
        Args: {
          _agency_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member_of: { Args: { _agency_id: string }; Returns: boolean }
      is_owner_or_admin: { Args: { _agency_id: string }; Returns: boolean }
      max_alerts_for_agency: { Args: { _agency: string }; Returns: number }
      platform_list_agencies_minimal: {
        Args: never
        Returns: {
          created_at: string
          id: string
          name: string
          slug: string
        }[]
      }
      platform_overview_counts: {
        Args: never
        Returns: {
          agencies_count: number
          clients_count: number
          profiles_with_agency_count: number
        }[]
      }
    }
    Enums: {
      alert_priority: "low" | "medium" | "high" | "critical"
      alert_status: "open" | "in_progress" | "resolved" | "dismissed"
      app_role: "owner" | "admin" | "member"
      campaign_status: "active" | "paused" | "archived"
      client_status: "active" | "paused" | "onboarding" | "churned"
      health_risk: "low" | "medium" | "high"
      integration_provider:
        | "meta_ads"
        | "google_ads"
        | "tiktok_ads"
        | "google_analytics"
        | "whatsapp"
        | "openai"
      integration_status: "connected" | "disconnected" | "error"
      task_status: "todo" | "in_progress" | "done"
      whatsapp_status: "queued" | "sent" | "delivered" | "failed"
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
      alert_priority: ["low", "medium", "high", "critical"],
      alert_status: ["open", "in_progress", "resolved", "dismissed"],
      app_role: ["owner", "admin", "member"],
      campaign_status: ["active", "paused", "archived"],
      client_status: ["active", "paused", "onboarding", "churned"],
      health_risk: ["low", "medium", "high"],
      integration_provider: [
        "meta_ads",
        "google_ads",
        "tiktok_ads",
        "google_analytics",
        "whatsapp",
        "openai",
      ],
      integration_status: ["connected", "disconnected", "error"],
      task_status: ["todo", "in_progress", "done"],
      whatsapp_status: ["queued", "sent", "delivered", "failed"],
    },
  },
} as const

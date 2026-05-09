export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      activities: {
        Row: {
          agency_id: string;
          client_id: string | null;
          created_at: string;
          description: string | null;
          id: string;
          metadata: Json | null;
          title: string;
          type: string;
          user_id: string | null;
        };
        Insert: {
          agency_id: string;
          client_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          metadata?: Json | null;
          title: string;
          type: string;
          user_id?: string | null;
        };
        Update: {
          agency_id?: string;
          client_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          metadata?: Json | null;
          title?: string;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "activities_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      agencies: {
        Row: {
          created_at: string;
          custom_domain: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          primary_color: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          custom_domain?: string | null;
          id?: string;
          logo_url?: string | null;
          name: string;
          primary_color?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          custom_domain?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          primary_color?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      alerts: {
        Row: {
          agency_id: string;
          assigned_to: string | null;
          campaign_id: string | null;
          client_id: string | null;
          created_at: string;
          description: string | null;
          id: string;
          priority: Database["public"]["Enums"]["alert_priority"];
          recommended_action: string | null;
          resolved_at: string | null;
          status: Database["public"]["Enums"]["alert_status"];
          title: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          agency_id: string;
          assigned_to?: string | null;
          campaign_id?: string | null;
          client_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          priority?: Database["public"]["Enums"]["alert_priority"];
          recommended_action?: string | null;
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["alert_status"];
          title: string;
          type: string;
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          assigned_to?: string | null;
          campaign_id?: string | null;
          client_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          priority?: Database["public"]["Enums"]["alert_priority"];
          recommended_action?: string | null;
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["alert_status"];
          title?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alerts_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alerts_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alerts_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      campaigns: {
        Row: {
          agency_id: string;
          client_id: string;
          created_at: string;
          daily_budget: number | null;
          external_id: string | null;
          id: string;
          name: string;
          objective: string | null;
          platform: string;
          status: Database["public"]["Enums"]["campaign_status"];
          updated_at: string;
        };
        Insert: {
          agency_id: string;
          client_id: string;
          created_at?: string;
          daily_budget?: number | null;
          external_id?: string | null;
          id?: string;
          name: string;
          objective?: string | null;
          platform: string;
          status?: Database["public"]["Enums"]["campaign_status"];
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          client_id?: string;
          created_at?: string;
          daily_budget?: number | null;
          external_id?: string | null;
          id?: string;
          name?: string;
          objective?: string | null;
          platform?: string;
          status?: Database["public"]["Enums"]["campaign_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaigns_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          agency_id: string;
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string;
          id: string;
          monthly_budget: number | null;
          mrr: number | null;
          name: string;
          portal_slug: string | null;
          responsible_id: string | null;
          segment: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["client_status"];
          tags: string[] | null;
          updated_at: string;
        };
        Insert: {
          agency_id: string;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          id?: string;
          monthly_budget?: number | null;
          mrr?: number | null;
          name: string;
          portal_slug?: string | null;
          responsible_id?: string | null;
          segment?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["client_status"];
          tags?: string[] | null;
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          id?: string;
          monthly_budget?: number | null;
          mrr?: number | null;
          name?: string;
          portal_slug?: string | null;
          responsible_id?: string | null;
          segment?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["client_status"];
          tags?: string[] | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clients_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      feature_flags: {
        Row: {
          agency_id: string;
          created_at: string;
          enabled: boolean;
          id: string;
          key: string;
        };
        Insert: {
          agency_id: string;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          key: string;
        };
        Update: {
          agency_id?: string;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feature_flags_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      health_scores: {
        Row: {
          agency_id: string;
          client_id: string;
          communication_score: number | null;
          engagement_score: number | null;
          id: string;
          optimization_score: number | null;
          performance_score: number | null;
          recorded_at: string;
          risk: Database["public"]["Enums"]["health_risk"];
          score: number;
          stability_score: number | null;
        };
        Insert: {
          agency_id: string;
          client_id: string;
          communication_score?: number | null;
          engagement_score?: number | null;
          id?: string;
          optimization_score?: number | null;
          performance_score?: number | null;
          recorded_at?: string;
          risk?: Database["public"]["Enums"]["health_risk"];
          score: number;
          stability_score?: number | null;
        };
        Update: {
          agency_id?: string;
          client_id?: string;
          communication_score?: number | null;
          engagement_score?: number | null;
          id?: string;
          optimization_score?: number | null;
          performance_score?: number | null;
          recorded_at?: string;
          risk?: Database["public"]["Enums"]["health_risk"];
          score?: number;
          stability_score?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "health_scores_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "health_scores_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      integrations: {
        Row: {
          account_id: string | null;
          agency_id: string;
          api_key_encrypted: string | null;
          config: Json | null;
          created_at: string;
          id: string;
          last_sync_at: string | null;
          provider: Database["public"]["Enums"]["integration_provider"];
          refresh_token_encrypted: string | null;
          status: Database["public"]["Enums"]["integration_status"];
          token_expires_at: string | null;
          updated_at: string;
        };
        Insert: {
          account_id?: string | null;
          agency_id: string;
          api_key_encrypted?: string | null;
          config?: Json | null;
          created_at?: string;
          id?: string;
          last_sync_at?: string | null;
          provider: Database["public"]["Enums"]["integration_provider"];
          refresh_token_encrypted?: string | null;
          status?: Database["public"]["Enums"]["integration_status"];
          token_expires_at?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string | null;
          agency_id?: string;
          api_key_encrypted?: string | null;
          config?: Json | null;
          created_at?: string;
          id?: string;
          last_sync_at?: string | null;
          provider?: Database["public"]["Enums"]["integration_provider"];
          refresh_token_encrypted?: string | null;
          status?: Database["public"]["Enums"]["integration_status"];
          token_expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integrations_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      metrics_daily: {
        Row: {
          agency_id: string;
          campaign_id: string | null;
          clicks: number | null;
          client_id: string;
          conversions: number | null;
          cpa: number | null;
          created_at: string;
          ctr: number | null;
          date: string;
          id: string;
          impressions: number | null;
          revenue: number | null;
          roas: number | null;
          spend: number | null;
        };
        Insert: {
          agency_id: string;
          campaign_id?: string | null;
          clicks?: number | null;
          client_id: string;
          conversions?: number | null;
          cpa?: number | null;
          created_at?: string;
          ctr?: number | null;
          date: string;
          id?: string;
          impressions?: number | null;
          revenue?: number | null;
          roas?: number | null;
          spend?: number | null;
        };
        Update: {
          agency_id?: string;
          campaign_id?: string | null;
          clicks?: number | null;
          client_id?: string;
          conversions?: number | null;
          cpa?: number | null;
          created_at?: string;
          ctr?: number | null;
          date?: string;
          id?: string;
          impressions?: number | null;
          revenue?: number | null;
          roas?: number | null;
          spend?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "metrics_daily_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metrics_daily_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metrics_daily_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      notes: {
        Row: {
          agency_id: string;
          author_id: string | null;
          client_id: string | null;
          content: string;
          created_at: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          agency_id: string;
          author_id?: string | null;
          client_id?: string | null;
          content: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          author_id?: string | null;
          client_id?: string | null;
          content?: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notes_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notes_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          agency_id: string;
          body: string | null;
          created_at: string;
          id: string;
          link: string | null;
          read: boolean;
          title: string;
          user_id: string;
        };
        Insert: {
          agency_id: string;
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          read?: boolean;
          title: string;
          user_id: string;
        };
        Update: {
          agency_id?: string;
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          read?: boolean;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          agency_id: string | null;
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          agency_id?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          agency_id?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          agency_id: string;
          client_friendly_summary: string | null;
          client_id: string;
          created_at: string;
          executive_summary: string | null;
          generated_by: string | null;
          id: string;
          next_steps: string | null;
          opportunities: string | null;
          period_end: string | null;
          period_start: string | null;
          positives: string | null;
          problems: string | null;
          raw_data: Json | null;
        };
        Insert: {
          agency_id: string;
          client_friendly_summary?: string | null;
          client_id: string;
          created_at?: string;
          executive_summary?: string | null;
          generated_by?: string | null;
          id?: string;
          next_steps?: string | null;
          opportunities?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          positives?: string | null;
          problems?: string | null;
          raw_data?: Json | null;
        };
        Update: {
          agency_id?: string;
          client_friendly_summary?: string | null;
          client_id?: string;
          created_at?: string;
          executive_summary?: string | null;
          generated_by?: string | null;
          id?: string;
          next_steps?: string | null;
          opportunities?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          positives?: string | null;
          problems?: string | null;
          raw_data?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "reports_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          agency_id: string;
          created_at: string;
          current_period_end: string | null;
          id: string;
          max_alerts: number;
          max_clients: number;
          plan: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          agency_id: string;
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          max_alerts?: number;
          max_clients?: number;
          plan?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          max_alerts?: number;
          max_clients?: number;
          plan?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          agency_id: string;
          assigned_to: string | null;
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          due_date: string | null;
          id: string;
          status: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          agency_id: string;
          assigned_to?: string | null;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          status?: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          assigned_to?: string | null;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          status?: Database["public"]["Enums"]["task_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          agency_id: string;
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          agency_id: string;
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          agency_id?: string;
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_logs: {
        Row: {
          agency_id: string;
          client_id: string | null;
          created_at: string;
          error: string | null;
          id: string;
          message: string;
          recipient: string;
          sent_at: string | null;
          status: Database["public"]["Enums"]["whatsapp_status"];
          template: string | null;
        };
        Insert: {
          agency_id: string;
          client_id?: string | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          message: string;
          recipient: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["whatsapp_status"];
          template?: string | null;
        };
        Update: {
          agency_id?: string;
          client_id?: string | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          message?: string;
          recipient?: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["whatsapp_status"];
          template?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_logs_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whatsapp_logs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_templates: {
        Row: {
          agency_id: string;
          body: string;
          created_at: string;
          id: string;
          name: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          agency_id: string;
          body: string;
          created_at?: string;
          id?: string;
          name: string;
          type?: string;
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          name?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_user_agency: { Args: never; Returns: string };
      has_role: {
        Args: {
          _agency_id: string;
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_member_of: { Args: { _agency_id: string }; Returns: boolean };
      is_owner_or_admin: { Args: { _agency_id: string }; Returns: boolean };
    };
    Enums: {
      alert_priority: "low" | "medium" | "high" | "critical";
      alert_status: "open" | "in_progress" | "resolved" | "dismissed";
      app_role: "owner" | "admin" | "member";
      campaign_status: "active" | "paused" | "archived";
      client_status: "active" | "paused" | "onboarding" | "churned";
      health_risk: "low" | "medium" | "high";
      integration_provider:
        | "meta_ads"
        | "google_ads"
        | "tiktok_ads"
        | "google_analytics"
        | "whatsapp"
        | "openai";
      integration_status: "connected" | "disconnected" | "error";
      task_status: "todo" | "in_progress" | "done";
      whatsapp_status: "queued" | "sent" | "delivered" | "failed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

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
} as const;

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      links: {
        Row: {
          anchor_text: string | null
          context: string | null
          created_at: string | null
          id: string
          is_internal: boolean | null
          source_page_id: string | null
          target_page_id: string | null
        }
        Insert: {
          anchor_text?: string | null
          context?: string | null
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          source_page_id?: string | null
          target_page_id?: string | null
        }
        Update: {
          anchor_text?: string | null
          context?: string | null
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          source_page_id?: string | null
          target_page_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "links_source_page_id_fkey"
            columns: ["source_page_id"]
            isOneToOne: false
            referencedRelation: "page_link_stats"
            referencedColumns: ["page_id"]
          },
          {
            foreignKeyName: "links_source_page_id_fkey"
            columns: ["source_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "links_target_page_id_fkey"
            columns: ["target_page_id"]
            isOneToOne: false
            referencedRelation: "page_link_stats"
            referencedColumns: ["page_id"]
          },
          {
            foreignKeyName: "links_target_page_id_fkey"
            columns: ["target_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      page_analysis: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          inbound_links_count: number | null
          link_score: number | null
          main_keywords: string[] | null
          outbound_links_count: number | null
          suggestions: Json | null
          title: string | null
          url: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          inbound_links_count?: number | null
          link_score?: number | null
          main_keywords?: string[] | null
          outbound_links_count?: number | null
          suggestions?: Json | null
          title?: string | null
          url: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          inbound_links_count?: number | null
          link_score?: number | null
          main_keywords?: string[] | null
          outbound_links_count?: number | null
          suggestions?: Json | null
          title?: string | null
          url?: string
        }
        Relationships: []
      }
      pages: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          last_crawled_at: string | null
          metadata: Json | null
          title: string | null
          url: string
          website_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          last_crawled_at?: string | null
          metadata?: Json | null
          title?: string | null
          url: string
          website_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          last_crawled_at?: string | null
          metadata?: Json | null
          title?: string | null
          url?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pages_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "websites"
            referencedColumns: ["id"]
          },
        ]
      }
      websites: {
        Row: {
          crawl_frequency: unknown | null
          created_at: string | null
          domain: string
          id: string
          last_crawled_at: string | null
        }
        Insert: {
          crawl_frequency?: unknown | null
          created_at?: string | null
          domain: string
          id?: string
          last_crawled_at?: string | null
        }
        Update: {
          crawl_frequency?: unknown | null
          created_at?: string | null
          domain?: string
          id?: string
          last_crawled_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      page_link_stats: {
        Row: {
          inbound_links_count: number | null
          outbound_links_count: number | null
          page_id: string | null
          title: string | null
          url: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

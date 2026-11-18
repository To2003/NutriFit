// ⚠️ Generado por `pnpm db:types` a partir de supabase/migrations. No editar a mano.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      achievements: {
        Row: {
          code: string;
          name: string;
          description: string;
          emoji: string;
          sort: number;
        };
        Insert: {
          code: string;
          name: string;
          description: string;
          emoji?: string;
          sort?: number;
        };
        Update: {
          code?: string;
          name?: string;
          description?: string;
          emoji?: string;
          sort?: number;
        };
        Relationships: [

        ];
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string;
          log_date: string;
          sport: string;
          kind: string;
          status: string;
          duration_min: number;
          intensity: string;
          met: number | null;
          kcal: number | null;
          schedule_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          log_date: string;
          sport: string;
          kind?: string;
          status?: string;
          duration_min?: number;
          intensity?: string;
          met?: number | null;
          kcal?: number | null;
          schedule_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          log_date?: string;
          sport?: string;
          kind?: string;
          status?: string;
          duration_min?: number;
          intensity?: string;
          met?: number | null;
          kcal?: number | null;
          schedule_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_logs_schedule_id_fkey";
            columns: ["schedule_id"];
            isOneToOne: false;
            referencedRelation: "weekly_schedule";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_messages: {
        Row: {
          id: string;
          user_id: string;
          kind: string;
          for_date: string;
          content: Json;
          ref: string | null;
          source: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          kind: string;
          for_date: string;
          content: Json;
          ref?: string | null;
          source?: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          kind?: string;
          for_date?: string;
          content?: Json;
          ref?: string | null;
          source?: string;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_usage: {
        Row: {
          user_id: string;
          day: string;
          calls: number;
          failures: number;
        };
        Insert: {
          user_id: string;
          day: string;
          calls?: number;
          failures?: number;
        };
        Update: {
          user_id?: string;
          day?: string;
          calls?: number;
          failures?: number;
        };
        Relationships: [
          {
            foreignKeyName: "ai_usage_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      blocks: {
        Row: {
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: {
          blocker_id?: string;
          blocked_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey";
            columns: ["blocked_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey";
            columns: ["blocker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      body_measurements: {
        Row: {
          id: string;
          user_id: string;
          log_date: string;
          waist_cm: number | null;
          hip_cm: number | null;
          chest_cm: number | null;
          arm_cm: number | null;
          thigh_cm: number | null;
          neck_cm: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          log_date: string;
          waist_cm?: number | null;
          hip_cm?: number | null;
          chest_cm?: number | null;
          arm_cm?: number | null;
          thigh_cm?: number | null;
          neck_cm?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          log_date?: string;
          waist_cm?: number | null;
          hip_cm?: number | null;
          chest_cm?: number | null;
          arm_cm?: number | null;
          thigh_cm?: number | null;
          neck_cm?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "body_measurements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      diet_preferences: {
        Row: {
          user_id: string;
          diet_type: string;
          meals_per_day: number;
          dislikes: string[];
          allergies: string;
          cooking_time: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          diet_type?: string;
          meals_per_day?: number;
          dislikes?: string[];
          allergies?: string;
          cooking_time?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          diet_type?: string;
          meals_per_day?: number;
          dislikes?: string[];
          allergies?: string;
          cooking_time?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "diet_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      exercises: {
        Row: {
          id: string;
          name: string;
          pattern: string;
          region: string;
          muscles: string[];
          equipment: string[];
          focus: string[];
          impact: string;
          level: string;
          unilateral: boolean;
          load_type: string;
          heavy_lower: boolean;
          alternatives: string[];
          instructions: string;
          common_mistakes: string;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          pattern: string;
          region: string;
          muscles?: string[];
          equipment?: string[];
          focus?: string[];
          impact?: string;
          level?: string;
          unilateral?: boolean;
          load_type?: string;
          heavy_lower?: boolean;
          alternatives?: string[];
          instructions?: string;
          common_mistakes?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          pattern?: string;
          region?: string;
          muscles?: string[];
          equipment?: string[];
          focus?: string[];
          impact?: string;
          level?: string;
          unilateral?: boolean;
          load_type?: string;
          heavy_lower?: boolean;
          alternatives?: string[];
          instructions?: string;
          common_mistakes?: string;
          created_at?: string;
        };
        Relationships: [

        ];
      };
      fitness_tests: {
        Row: {
          id: string;
          user_id: string;
          log_date: string;
          test: string;
          value: number;
          unit: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          log_date: string;
          test: string;
          value: number;
          unit: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          log_date?: string;
          test?: string;
          value?: number;
          unit?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fitness_tests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      follows: {
        Row: {
          follower_id: string;
          following_id: string;
          status: string;
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          follower_id: string;
          following_id: string;
          status?: string;
          created_at?: string;
          accepted_at?: string | null;
        };
        Update: {
          follower_id?: string;
          following_id?: string;
          status?: string;
          created_at?: string;
          accepted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey";
            columns: ["follower_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "follows_following_id_fkey";
            columns: ["following_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      food_log_items: {
        Row: {
          id: string;
          food_log_id: string;
          user_id: string;
          food_id: string | null;
          name: string;
          grams: number;
          kcal: number;
          protein_g: number;
          carbs_g: number;
          fat_g: number;
          source: string;
          confidence: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          food_log_id: string;
          user_id?: string;
          food_id?: string | null;
          name: string;
          grams: number;
          kcal: number;
          protein_g?: number;
          carbs_g?: number;
          fat_g?: number;
          source: string;
          confidence?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          food_log_id?: string;
          user_id?: string;
          food_id?: string | null;
          name?: string;
          grams?: number;
          kcal?: number;
          protein_g?: number;
          carbs_g?: number;
          fat_g?: number;
          source?: string;
          confidence?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "food_log_items_food_id_fkey";
            columns: ["food_id"];
            isOneToOne: false;
            referencedRelation: "foods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "food_log_items_food_log_id_user_id_fkey";
            columns: ["food_log_id","user_id"];
            isOneToOne: false;
            referencedRelation: "food_logs";
            referencedColumns: ["id","user_id"];
          },
        ];
      };
      food_logs: {
        Row: {
          id: string;
          user_id: string;
          log_date: string;
          meal: string;
          photo_path: string | null;
          input_text: string | null;
          origin: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          log_date: string;
          meal: string;
          photo_path?: string | null;
          input_text?: string | null;
          origin?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          log_date?: string;
          meal?: string;
          photo_path?: string | null;
          input_text?: string | null;
          origin?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "food_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      foods: {
        Row: {
          id: string;
          name: string;
          brand: string | null;
          source: string;
          external_id: string | null;
          kcal: number;
          protein_g: number;
          carbs_g: number;
          fat_g: number;
          fiber_g: number | null;
          portions: Json;
          aliases: string[];
          verified: boolean;
          created_by: string | null;
          search_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          brand?: string | null;
          source: string;
          external_id?: string | null;
          kcal: number;
          protein_g?: number;
          carbs_g?: number;
          fat_g?: number;
          fiber_g?: number | null;
          portions?: Json;
          aliases?: string[];
          verified?: boolean;
          created_by?: string | null;
          search_name?: never;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          brand?: string | null;
          source?: string;
          external_id?: string | null;
          kcal?: number;
          protein_g?: number;
          carbs_g?: number;
          fat_g?: number;
          fiber_g?: number | null;
          portions?: Json;
          aliases?: string[];
          verified?: boolean;
          created_by?: string | null;
          search_name?: never;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "foods_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      gym_preferences: {
        Row: {
          user_id: string;
          weekdays: number[];
          minutes: number;
          preferred_time: string | null;
          equipment: string[];
          experience: string;
          injuries: string;
          allow_consecutive: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          weekdays?: number[];
          minutes?: number;
          preferred_time?: string | null;
          equipment?: string[];
          experience?: string;
          injuries?: string;
          allow_consecutive?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          weekdays?: number[];
          minutes?: number;
          preferred_time?: string | null;
          equipment?: string[];
          experience?: string;
          injuries?: string;
          allow_consecutive?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gym_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_log: {
        Row: {
          id: number;
          user_id: string;
          dedupe_key: string;
          kind: string;
          sent_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          dedupe_key: string;
          kind: string;
          sent_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          dedupe_key?: string;
          kind?: string;
          sent_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_prefs: {
        Row: {
          user_id: string;
          enabled: boolean;
          water: Json;
          meals: Json;
          gym: Json;
          daily_close: Json;
          weekly_review: boolean;
          follow_requests: boolean;
          measure_reminders: boolean;
          quiet_from: string;
          quiet_to: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          enabled?: boolean;
          water?: Json;
          meals?: Json;
          gym?: Json;
          daily_close?: Json;
          weekly_review?: boolean;
          follow_requests?: boolean;
          measure_reminders?: boolean;
          quiet_from?: string;
          quiet_to?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          enabled?: boolean;
          water?: Json;
          meals?: Json;
          gym?: Json;
          daily_close?: Json;
          weekly_review?: boolean;
          follow_requests?: boolean;
          measure_reminders?: boolean;
          quiet_from?: string;
          quiet_to?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_prefs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pain_reports: {
        Row: {
          id: string;
          user_id: string;
          workout_session_id: string | null;
          exercise_id: string | null;
          log_date: string;
          zone: string;
          intensity: number;
          notes: string;
          resolved: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          workout_session_id?: string | null;
          exercise_id?: string | null;
          log_date: string;
          zone: string;
          intensity: number;
          notes?: string;
          resolved?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          workout_session_id?: string | null;
          exercise_id?: string | null;
          log_date?: string;
          zone?: string;
          intensity?: number;
          notes?: string;
          resolved?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pain_reports_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pain_reports_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pain_reports_workout_session_id_fkey";
            columns: ["workout_session_id"];
            isOneToOne: false;
            referencedRelation: "workout_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      privacy_settings: {
        Row: {
          user_id: string;
          show_streaks: boolean;
          show_training: boolean;
          show_tests: boolean;
          show_meals: boolean;
          show_body: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          show_streaks?: boolean;
          show_training?: boolean;
          show_tests?: boolean;
          show_meals?: boolean;
          show_body?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          show_streaks?: boolean;
          show_training?: boolean;
          show_tests?: boolean;
          show_meals?: boolean;
          show_body?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "privacy_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_details: {
        Row: {
          user_id: string;
          birthdate: string | null;
          sex: string | null;
          height_cm: number | null;
          goal: string | null;
          pace: string;
          lifestyle: string | null;
          focus_primary: string | null;
          focus_secondary: string | null;
          timezone: string;
          water_glass_ml: number;
          water_bottle_ml: number;
          ai_notice_accepted_at: string | null;
          onboarding_step: number;
          onboarded_at: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          birthdate?: string | null;
          sex?: string | null;
          height_cm?: number | null;
          goal?: string | null;
          pace?: string;
          lifestyle?: string | null;
          focus_primary?: string | null;
          focus_secondary?: string | null;
          timezone?: string;
          water_glass_ml?: number;
          water_bottle_ml?: number;
          ai_notice_accepted_at?: string | null;
          onboarding_step?: number;
          onboarded_at?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          birthdate?: string | null;
          sex?: string | null;
          height_cm?: number | null;
          goal?: string | null;
          pace?: string;
          lifestyle?: string | null;
          focus_primary?: string | null;
          focus_secondary?: string | null;
          timezone?: string;
          water_glass_ml?: number;
          water_bottle_ml?: number;
          ai_notice_accepted_at?: string | null;
          onboarding_step?: number;
          onboarded_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_details_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          avatar_url: string | null;
          bio: string;
          is_private: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string;
          avatar_url?: string | null;
          bio?: string;
          is_private?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string;
          avatar_url?: string | null;
          bio?: string;
          is_private?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [

        ];
      };
      program_exercises: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          exercise_id: string;
          position: number;
          sets: number;
          reps_min: number;
          reps_max: number;
          rest_s: number;
          rir: number | null;
          notes: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id?: string;
          exercise_id: string;
          position: number;
          sets: number;
          reps_min: number;
          reps_max: number;
          rest_s?: number;
          rir?: number | null;
          notes?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          exercise_id?: string;
          position?: number;
          sets?: number;
          reps_min?: number;
          reps_max?: number;
          rest_s?: number;
          rir?: number | null;
          notes?: string;
        };
        Relationships: [
          {
            foreignKeyName: "program_exercises_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "program_exercises_session_id_user_id_fkey";
            columns: ["session_id","user_id"];
            isOneToOne: false;
            referencedRelation: "program_sessions";
            referencedColumns: ["id","user_id"];
          },
        ];
      };
      program_sessions: {
        Row: {
          id: string;
          program_id: string;
          user_id: string;
          week: number;
          weekday: number;
          name: string;
          tags: string[];
          is_deload: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          program_id: string;
          user_id?: string;
          week: number;
          weekday: number;
          name: string;
          tags?: string[];
          is_deload?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          program_id?: string;
          user_id?: string;
          week?: number;
          weekday?: number;
          name?: string;
          tags?: string[];
          is_deload?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "program_sessions_program_id_user_id_fkey";
            columns: ["program_id","user_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["id","user_id"];
          },
        ];
      };
      programs: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          focus_primary: string | null;
          focus_secondary: string | null;
          start_date: string;
          weeks: number;
          status: string;
          source: string;
          copied_from: string | null;
          notes: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          focus_primary?: string | null;
          focus_secondary?: string | null;
          start_date: string;
          weeks?: number;
          status?: string;
          source?: string;
          copied_from?: string | null;
          notes?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          focus_primary?: string | null;
          focus_secondary?: string | null;
          start_date?: string;
          weeks?: number;
          status?: string;
          source?: string;
          copied_from?: string | null;
          notes?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "programs_copied_from_fkey";
            columns: ["copied_from"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "programs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
          last_success_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
          last_success_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          created_at?: string;
          last_success_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      set_logs: {
        Row: {
          id: string;
          workout_session_id: string;
          user_id: string;
          exercise_id: string;
          set_number: number;
          kg: number;
          reps: number;
          rir: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workout_session_id: string;
          user_id?: string;
          exercise_id: string;
          set_number: number;
          kg?: number;
          reps: number;
          rir?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workout_session_id?: string;
          user_id?: string;
          exercise_id?: string;
          set_number?: number;
          kg?: number;
          reps?: number;
          rir?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "set_logs_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "set_logs_workout_session_id_user_id_fkey";
            columns: ["workout_session_id","user_id"];
            isOneToOne: false;
            referencedRelation: "workout_sessions";
            referencedColumns: ["id","user_id"];
          },
        ];
      };
      tdee_proposals: {
        Row: {
          id: string;
          user_id: string;
          week_start: string;
          previous_tdee: number;
          observed_tdee: number;
          proposed_tdee: number;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          week_start: string;
          previous_tdee: number;
          observed_tdee: number;
          proposed_tdee: number;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_start?: string;
          previous_tdee?: number;
          observed_tdee?: number;
          proposed_tdee?: number;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tdee_proposals_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_achievements: {
        Row: {
          user_id: string;
          code: string;
          unlocked_at: string;
        };
        Insert: {
          user_id: string;
          code: string;
          unlocked_at?: string;
        };
        Update: {
          user_id?: string;
          code?: string;
          unlocked_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_achievements_code_fkey";
            columns: ["code"];
            isOneToOne: false;
            referencedRelation: "achievements";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_goals: {
        Row: {
          id: string;
          user_id: string;
          goal: string;
          pace: string;
          lifestyle: string;
          targets: Json;
          manual_override: boolean;
          tdee_estimate: number | null;
          expenditure_offset_kcal: number;
          effective_from: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          goal: string;
          pace: string;
          lifestyle: string;
          targets: Json;
          manual_override?: boolean;
          tdee_estimate?: number | null;
          expenditure_offset_kcal?: number;
          effective_from?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          goal?: string;
          pace?: string;
          lifestyle?: string;
          targets?: Json;
          manual_override?: boolean;
          tdee_estimate?: number | null;
          expenditure_offset_kcal?: number;
          effective_from?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_goals_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_sports: {
        Row: {
          id: string;
          user_id: string;
          sport: string;
          position: string | null;
          level: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          sport: string;
          position?: string | null;
          level?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          sport?: string;
          position?: string | null;
          level?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_sports_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_streaks: {
        Row: {
          user_id: string;
          kind: string;
          current: number;
          best: number;
          last_date: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          kind: string;
          current?: number;
          best?: number;
          last_date?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          kind?: string;
          current?: number;
          best?: number;
          last_date?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_streaks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      water_logs: {
        Row: {
          id: string;
          user_id: string;
          log_date: string;
          logged_at: string;
          ml: number;
        };
        Insert: {
          id?: string;
          user_id?: string;
          log_date: string;
          logged_at?: string;
          ml: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          log_date?: string;
          logged_at?: string;
          ml?: number;
        };
        Relationships: [
          {
            foreignKeyName: "water_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      weekly_goals: {
        Row: {
          id: string;
          user_id: string;
          week_start: string;
          text: string;
          done: boolean;
          evaluated: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          week_start: string;
          text: string;
          done?: boolean;
          evaluated?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_start?: string;
          text?: string;
          done?: boolean;
          evaluated?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "weekly_goals_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      weekly_schedule: {
        Row: {
          id: string;
          user_id: string;
          weekday: number;
          sport: string;
          kind: string;
          start_time: string | null;
          duration_min: number;
          intensity: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          weekday: number;
          sport: string;
          kind?: string;
          start_time?: string | null;
          duration_min: number;
          intensity?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          weekday?: number;
          sport?: string;
          kind?: string;
          start_time?: string | null;
          duration_min?: number;
          intensity?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "weekly_schedule_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      weight_logs: {
        Row: {
          id: string;
          user_id: string;
          log_date: string;
          kg: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          log_date: string;
          kg: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          log_date?: string;
          kg?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "weight_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          program_session_id: string | null;
          log_date: string;
          started_at: string;
          ended_at: string | null;
          duration_min: number | null;
          feeling: number | null;
          volume_kg: number | null;
          notes: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          program_session_id?: string | null;
          log_date: string;
          started_at?: string;
          ended_at?: string | null;
          duration_min?: number | null;
          feeling?: number | null;
          volume_kg?: number | null;
          notes?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          program_session_id?: string | null;
          log_date?: string;
          started_at?: string;
          ended_at?: string | null;
          duration_min?: number | null;
          feeling?: number | null;
          volume_kg?: number | null;
          notes?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_sessions_program_session_id_fkey";
            columns: ["program_session_id"];
            isOneToOne: false;
            referencedRelation: "program_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      bump_ai_usage: { Args: { failed?: boolean }; Returns: number };
      visible_sections: { Args: { owner: string }; Returns: string[] };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];

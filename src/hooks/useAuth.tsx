import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

// Fix M-4: Aligned with database ops_role enum
type OpsRole = "admin" | "office_manager" | "field_ops" | "engineer" | "inspector" | "construction_manager";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  notification_preferences: Record<string, boolean>;
  inspector_id: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: OpsRole | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<OpsRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfileAndRole = useCallback(async (userId: string) => {
    const [profileRes, roleRes] = await Promise.all([
      supabase.from("user_profiles").select("*").eq("id", userId).single(),
      supabase.rpc("get_ops_role", { _user_id: userId }),
    ]);

    if (profileRes.data) {
      setProfile(profileRes.data as unknown as UserProfile);
    }
    if (roleRes.data) {
      setRole(roleRes.data as OpsRole);
    }
  }, []);

  useEffect(() => {
    // Set up listener BEFORE getSession per Supabase best practices
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          // Use setTimeout to avoid Supabase auth deadlock
          setTimeout(() => fetchProfileAndRole(currentUser.id), 0);
        } else {
          setProfile(null);
          setRole(null);
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfileAndRole(currentUser.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfileAndRole]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, role, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

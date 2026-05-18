import { useEffect, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate, Link, useRouter } from "@tanstack/react-router";
import { ChefHat, LogOut, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getMyProfile } from "@/lib/household.functions";

export type ProfileData = Awaited<ReturnType<typeof getMyProfile>>;

export function useEnsureHousehold() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchProfileRef = useRef(fetchProfile);
  fetchProfileRef.current = fetchProfile;
  const [data, setData] = useState<ProfileData | null>(null);
  const [ready, setReady] = useState(false);
  const didRun = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    // Guard against duplicate runs for the same user
    if (didRun.current) return;
    didRun.current = true;

    fetchProfileRef.current()
      .then((r) => {
        if (!r.profile?.household_id) {
          navigate({ to: "/onboarding" });
          return;
        }
        setData(r);
        setReady(true);
      })
      .catch((err) => {
        console.error("[useEnsureHousehold] fetchProfile failed:", err);
        // Only redirect if it's genuinely an auth error, not a transient server error
        didRun.current = false; // allow retry
      });
  }, [user, loading, navigate]);

  return { data, ready };
}

export function AppHeader({ data }: { data: ProfileData }) {
  const router = useRouter();
  const isCook = data.profile?.role === "cook" || data.profile?.role === "both";
  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  }
  return (
    <header className="px-5 md:px-8 py-4 border-b bg-background/80 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
        <Link to="/app" className="flex items-center gap-2 group">
          <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-105 transition-transform">
            <ChefHat className="size-5 text-primary" />
          </div>
          <span className="font-display font-semibold tracking-tight text-lg">Cheffy</span>
        </Link>
        <div className="flex items-center gap-2">
          {data.household && (
            <span className="hidden sm:inline text-xs text-muted-foreground">
              {data.household.name} ·{" "}
              <span className="font-mono">{data.household.invite_code}</span>
            </span>
          )}
          {isCook && (
            <Link to="/cook">
              <Button variant="outline" size="sm">
                <BookOpen className="size-4 mr-1.5" />
                Cook
              </Button>
            </Link>
          )}
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

import { useEffect, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate, Link, useRouter } from "@tanstack/react-router";
import { ChefHat, LogOut, BookOpen, UserPlus, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getMyProfile, regenerateInviteCode } from "@/lib/household.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

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

    fetchProfileRef
      .current()
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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [localInviteCode, setLocalInviteCode] = useState(data.household?.invite_code);
  const isCook = data.profile?.role === "cook" || data.profile?.role === "both";
  const isCreator = data.profile?.id === data.household?.created_by;
  const regenFn = useServerFn(regenerateInviteCode);
  const [regenBusy, setRegenBusy] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  }
  return (
    <header className="px-5 md:px-8 py-4 border-b bg-background/80 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-105 transition-transform">
            <ChefHat className="size-5 text-primary" />
          </div>
          <span className="font-display font-semibold tracking-tight text-lg">Cheffy</span>
        </Link>
        <div className="flex items-center gap-2">
          {data.household && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInviteOpen(true)}
              className="hidden sm:flex hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-colors"
            >
              <UserPlus className="size-4 mr-1.5" />
              Invite
            </Button>
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

      {data.household && (
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Invite to {data.household.name}</DialogTitle>
              <DialogDescription>
                Share this code with your family members so they can join your household.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center space-x-2 mt-4">
              <div className="grid flex-1 gap-2">
                <div className="flex h-12 w-full items-center justify-center rounded-md border border-input bg-muted/50 px-3 py-2 text-3xl tracking-[0.5em] font-mono font-medium text-foreground">
                  {localInviteCode}
                </div>
              </div>
              <Button
                type="submit"
                size="icon"
                className="h-12 w-12 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(localInviteCode ?? "");
                  toast.success("Invite code copied!");
                }}
              >
                <Copy className="size-5" />
              </Button>
            </div>
            {isCreator && (
              <DialogFooter className="sm:justify-start mt-6 border-t pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  disabled={regenBusy}
                  onClick={async () => {
                    setRegenBusy(true);
                    try {
                      const res = await regenFn();
                      if (res?.household?.invite_code) {
                        setLocalInviteCode(res.household.invite_code);
                        toast.success("New invite code generated");
                      }
                    } catch (e) {
                      toast.error((e as Error).message);
                    } finally {
                      setRegenBusy(false);
                    }
                  }}
                >
                  <RefreshCw className={`size-4 mr-1.5 ${regenBusy ? "animate-spin" : ""}`} />
                  Generate new code
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}
    </header>
  );
}

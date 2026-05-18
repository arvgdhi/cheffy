import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChefHat } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { createHousehold, joinHousehold, getMyProfile } from "@/lib/household.functions";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getMyProfile);
  const createFn = useServerFn(createHousehold);
  const joinFn = useServerFn(joinHousehold);

  const [displayName, setDisplayName] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [role, setRole] = useState<"cook" | "member" | "both">("member");
  const [busy, setBusy] = useState(false);

  const fetchProfileRef = useRef(fetchProfile);
  fetchProfileRef.current = fetchProfile;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    fetchProfileRef.current()
      .then((r) => {
        if (r.profile?.household_id) navigate({ to: "/app" });
      })
      .catch(() => {});
  }, [user, loading, navigate]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createFn({ data: { name: householdName, displayName, role } });
      toast.success("Household created!");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await joinFn({ data: { inviteCode: inviteCode.toUpperCase(), displayName, role } });
      toast.success("Joined household!");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-6 flex items-center gap-2 group w-fit">
        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-105 transition-transform">
          <ChefHat className="size-6 text-primary" />
        </div>
        <span className="font-display text-2xl font-semibold tracking-tight">Cheffy</span>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-md">
          <h1 className="font-display text-3xl font-semibold">Set up your household</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            Start a new one or join with an invite code.
          </p>

          <Tabs defaultValue="create">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="create">Create</TabsTrigger>
              <TabsTrigger value="join">Join</TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="mt-6">
              <form onSubmit={onCreate} className="space-y-4">
                <Field label="Your name">
                  <Input
                    required
                    maxLength={40}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </Field>
                <Field label="Household name">
                  <Input
                    required
                    maxLength={60}
                    value={householdName}
                    onChange={(e) => setHouseholdName(e.target.value)}
                    placeholder="The Smiths"
                  />
                </Field>
                <RoleSelect role={role} setRole={setRole} />
                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? "Creating…" : "Create household"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="join" className="mt-6">
              <form onSubmit={onJoin} className="space-y-4">
                <Field label="Your name">
                  <Input
                    required
                    maxLength={40}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </Field>
                <Field label="Invite code">
                  <Input
                    required
                    maxLength={6}
                    className="uppercase tracking-widest font-mono"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                  />
                </Field>
                <RoleSelect role={role} setRole={setRole} />
                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? "Joining…" : "Join household"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function RoleSelect({
  role,
  setRole,
}: {
  role: "cook" | "member" | "both";
  setRole: (r: "cook" | "member" | "both") => void;
}) {
  return (
    <Field label="Your role">
      <Select value={role} onValueChange={(v) => setRole(v as "cook" | "member" | "both")}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="member">Family member</SelectItem>
          <SelectItem value="cook">Cook</SelectItem>
          <SelectItem value="both">Both</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

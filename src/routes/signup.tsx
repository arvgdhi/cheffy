import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell, Field } from "./login";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { emailRedirectTo: `${window.location.origin}/onboarding` },
    });
    setLoading(false);
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("already registered") || message.includes("already exists")) {
        toast.error("Email already exists. Please log in instead.");
        navigate({ to: "/login" });
        return;
      }
      return toast.error(error.message);
    }

    if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
      toast.error("Email already exists. Please log in instead.");
      navigate({ to: "/login" });
      return;
    }

    if (data.session) {
      toast.success("Account created!");
      await new Promise((r) => setTimeout(r, 150));
      navigate({ to: "/onboarding" });
      return;
    }
    setConfirmationEmail(normalizedEmail);
    toast.success("Check your email for the confirmation link.");
  }

  if (confirmationEmail) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={`We sent a confirmation link to ${confirmationEmail}.`}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Open the link to verify your email. After confirmation, Cheffy will take you to
            household setup.
          </p>
          <Link to="/login">
            <Button className="w-full">Go to login</Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create account" subtitle="Sign up to start a household or join one.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating…" : "Sign up"}
        </Button>
        <p className="text-sm text-muted-foreground text-center">
          Have an account?{" "}
          <Link to="/login" className="text-primary font-medium">
            Log in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

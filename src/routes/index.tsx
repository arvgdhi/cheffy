import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ChefHat, Utensils, Trophy, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/app", replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Background gradients */}
      <div className="absolute top-0 -translate-y-12 inset-x-0 h-[500px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] bg-accent/10 blur-[120px] rounded-full pointer-events-none" />

      <header className="px-6 md:px-10 py-6 flex items-center justify-between relative z-10 max-w-7xl mx-auto w-full">
        <Link to="/" className="flex items-center gap-2 group cursor-pointer">
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-105 transition-transform">
            <ChefHat className="size-6 text-primary" />
          </div>
          <span className="font-display text-2xl font-semibold tracking-tight">Cheffy</span>
        </Link>
        <div className="flex gap-3">
          <Link to="/login">
            <Button variant="ghost" className="font-medium hover:bg-muted/50 rounded-xl">
              Log in
            </Button>
          </Link>
          <Link to="/signup">
            <Button className="rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow">
              Sign up
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 md:px-10 max-w-5xl mx-auto py-20 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <HeartPulse className="size-4" />
          <span>The new way to plan family meals</span>
        </div>

        <h1 className="font-display text-5xl md:text-7xl font-semibold leading-[1.1] tracking-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-150">
          What's for dinner?
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60 mt-2 pb-2">
            The family decides.
          </span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300 leading-relaxed">
          Cheffy turns mealtime negotiation into a friendly leaderboard. Everyone wishlists dishes,
          the most-wanted rises to the top, and the cook picks what to make.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 w-full sm:w-auto animate-in fade-in slide-in-from-bottom-6 duration-700 delay-500">
          <Link to="/signup" className="w-full sm:w-auto">
            <Button
              size="lg"
              className="w-full sm:w-auto rounded-xl text-base h-12 px-8 shadow-xl shadow-primary/25 hover:scale-105 transition-all"
            >
              Get started for free
            </Button>
          </Link>
          <Link to="/login" className="w-full sm:w-auto">
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto rounded-xl text-base h-12 px-8 bg-background/50 backdrop-blur-sm border-border/50 hover:bg-muted/50 hover:scale-105 transition-all"
            >
              I have an account
            </Button>
          </Link>
        </div>

        <div className="mt-24 grid sm:grid-cols-3 gap-6 w-full text-left animate-in fade-in slide-in-from-bottom-8 duration-700 delay-700">
          <FeatureCard
            icon={<Utensils className="size-6" />}
            title="Wishlist any dish"
            body="Snap a dish photo, add its name, and keep optional nutrition or recipe notes."
          />
          <FeatureCard
            icon={<Trophy className="size-6" />}
            title="Weekly leaderboard"
            body="Most-wishlisted dishes rise to the top. The leaderboard resets every Saturday."
          />
          <FeatureCard
            icon={<ChefHat className="size-6" />}
            title="Cook's schedule"
            body="Cooks pick winners from the leaderboard and pin them to breakfast, lunch, or dinner."
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="group rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-6 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 hover:-translate-y-1">
      <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-5 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
        {icon}
      </div>
      <h3 className="font-semibold text-lg font-display tracking-tight text-foreground">{title}</h3>
      <p className="mt-2 text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { ChefHat, Utensils, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="px-6 md:px-10 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="size-6 text-primary" />
          <span className="font-display text-xl font-semibold">Panarchy</span>
        </div>
        <div className="flex gap-2">
          <Link to="/login">
            <Button variant="ghost">Log in</Button>
          </Link>
          <Link to="/signup">
            <Button>Sign up</Button>
          </Link>
        </div>
      </header>

      <main className="px-6 md:px-10 max-w-5xl mx-auto pt-12 md:pt-24">
        <h1 className="font-display text-5xl md:text-7xl font-semibold leading-tight tracking-tight">
          What's for dinner?
          <span className="block text-primary">The family decides.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-xl">
          Panarchy turns mealtime negotiation into a friendly leaderboard. Everyone wishlists
          dishes, the most-wanted rises to the top, and the cook picks what to make.
        </p>
        <div className="mt-8 flex gap-3">
          <Link to="/signup">
            <Button size="lg">Get started</Button>
          </Link>
          <Link to="/login">
            <Button size="lg" variant="outline">
              I have an account
            </Button>
          </Link>
        </div>

        <div className="mt-20 grid sm:grid-cols-3 gap-4">
          <FeatureCard
            icon={<Utensils className="size-5" />}
            title="Wishlist any dish"
            body="Search a huge recipe library and add what you're craving in seconds."
          />
          <FeatureCard
            icon={<Trophy className="size-5" />}
            title="Weekly leaderboard"
            body="Most-wishlisted dishes rise. Resets every Saturday."
          />
          <FeatureCard
            icon={<ChefHat className="size-5" />}
            title="Cook's schedule"
            body="Cooks pick winners and pin them to breakfast, lunch, or dinner."
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
    <div className="rounded-2xl border bg-card p-5">
      <div className="size-10 rounded-xl bg-secondary flex items-center justify-center text-primary">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

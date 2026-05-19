import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, BookOpen, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEnsureHousehold, AppHeader } from "@/components/app-shell";
import { getScheduledDishes, toggleCompleted, deleteScheduledDish } from "@/lib/schedule.functions";
import { DishDetailsDialog } from "@/components/dish-details-dialog";

export const Route = createFileRoute("/cook")({
  component: CookPage,
});

function CookPage() {
  const { data, ready } = useEnsureHousehold();
  const fetchScheduled = useServerFn(getScheduledDishes);
  const { data: sched, isLoading } = useQuery({
    queryKey: ["scheduled"],
    queryFn: () => fetchScheduled(),
    enabled: ready,
  });

  if (!ready || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isCook = data.profile?.role === "cook" || data.profile?.role === "both";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader data={data} />
      <main className="max-w-3xl mx-auto px-5 md:px-8 py-6">
        <div className="px-1">
          <h2 className="font-display text-2xl font-semibold">Cooking Schedule</h2>
          <p className="text-sm text-muted-foreground opacity-80 mt-1">
            Dishes you've planned, soonest first.
          </p>
        </div>

        {!isCook && (
          <div className="mt-6 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
            You're not a cook in this household — this is read-only.
          </div>
        )}

        <div className="mt-6 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : !sched || sched.items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <BookOpen className="size-12 mx-auto opacity-30 mb-3" />
              <p>No dishes scheduled yet.</p>
              <p className="text-xs mt-1">Schedule one from the leaderboard.</p>
            </div>
          ) : (
            sched.items.map((d) => <ScheduledCard key={d.id} dish={d} canManage={isCook} />)
          )}
        </div>
      </main>
    </div>
  );
}

function ScheduledCard({
  dish,
  canManage,
}: {
  dish: {
    id: string;
    spoonacular_id: number;
    dish_name: string;
    dish_image: string | null;
    scheduled_date: string;
    meal_type: "breakfast" | "lunch" | "dinner";
    completed: boolean;
  };
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const toggleFn = useServerFn(toggleCompleted);
  const deleteFn = useServerFn(deleteScheduledDish);
  const [recipeOpen, setRecipeOpen] = useState(false);

  async function toggle() {
    try {
      await toggleFn({ data: { id: dish.id, completed: !dish.completed } });
      qc.invalidateQueries({ queryKey: ["scheduled"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function remove() {
    try {
      await deleteFn({ data: { id: dish.id } });
      qc.invalidateQueries({ queryKey: ["scheduled"] });
      toast.success("Removed");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const dateLabel = new Date(dish.scheduled_date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className={`group rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 flex flex-col sm:flex-row sm:items-center gap-4 transition-all duration-300 hover:shadow-md hover:border-primary/20 ${dish.completed ? "opacity-60 grayscale-[0.5]" : ""}`}
    >
      <div className="size-14 rounded-lg bg-muted overflow-hidden flex-shrink-0">
        {dish.dish_image && (
          <img src={dish.dish_image} alt={dish.dish_name} className="w-full h-full object-cover" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold line-clamp-1 ${dish.completed ? "line-through" : ""}`}>
          {dish.dish_name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary">{dateLabel}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/30 capitalize">
            {dish.meal_type}
          </span>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-1.5">
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setRecipeOpen(true)}>
          Recipe
        </Button>
        {canManage && (
          <div className="flex gap-1.5 ml-auto sm:ml-0">
            <Button size="icon" variant="outline" className="rounded-xl hover:bg-primary/10 hover:text-primary transition-colors" onClick={toggle} title="Toggle done">
              <Check className="size-4" />
            </Button>
            <Button size="icon" variant="outline" className="rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={remove} title="Remove">
              <Trash2 className="size-4 text-muted-foreground hover:text-destructive transition-colors" />
            </Button>
          </div>
        )}
      </div>
      <DishDetailsDialog dishId={dish.spoonacular_id} open={recipeOpen} onOpenChange={setRecipeOpen} />
    </div>
  );
}

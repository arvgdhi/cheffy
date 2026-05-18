import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Utensils, Trophy, Search, Trash2, CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useEnsureHousehold, AppHeader } from "@/components/app-shell";
import { searchDishes, type SearchResult } from "@/lib/spoonacular.functions";
import {
  addToWishlist,
  getWishlist,
  getLeaderboard,
  removeFromWishlist,
} from "@/lib/wishlist.functions";
import { scheduleDish } from "@/lib/schedule.functions";

export const Route = createFileRoute("/app")({
  component: AppPage,
});

function AppPage() {
  const { data, ready } = useEnsureHousehold();
  if (!ready || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background">
      <AppHeader data={data} />
      <main className="max-w-3xl mx-auto px-5 md:px-8 py-6">
        <Tabs defaultValue="leaderboard">
          <TabsList className="grid grid-cols-2 w-full max-w-sm">
            <TabsTrigger value="leaderboard">
              <Trophy className="size-4 mr-1.5" />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="wishlist">
              <Utensils className="size-4 mr-1.5" />
              Wishlist
            </TabsTrigger>
          </TabsList>
          <TabsContent value="leaderboard" className="mt-6">
            <LeaderboardSection
              isCook={data.profile?.role === "cook" || data.profile?.role === "both"}
            />
          </TabsContent>
          <TabsContent value="wishlist" className="mt-6">
            <WishlistSection />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ---------- Wishlist ----------
function WishlistSection() {
  const fetchWishlist = useServerFn(getWishlist);
  const { data, isLoading } = useQuery({ queryKey: ["wishlist"], queryFn: () => fetchWishlist() });
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <section>
      <SectionHeader
        title="Your Wishlist"
        subtitle="Tap + to add a dish you're craving. Resets every Saturday."
      />
      <div className="mt-6 relative min-h-[50vh]">
        {isLoading ? (
          <div className="flex justify-center pt-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyWishlist />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {data.items.map((item) => (
              <WishlistCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
      <Button
        onClick={() => setSearchOpen(true)}
        className="fixed bottom-6 right-6 size-14 rounded-full shadow-lg"
        size="icon"
      >
        <Plus className="size-6" />
      </Button>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </section>
  );
}

function EmptyWishlist() {
  return (
    <div className="relative h-[40vh] flex flex-col items-center justify-center text-center px-4">
      <div className="size-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4 border border-border/50">
        <Utensils className="size-8 text-muted-foreground/50" />
      </div>
      <p className="text-muted-foreground font-medium text-lg tracking-tight">Your wishlist is empty</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-[200px]">Tap the + button to search and add a dish.</p>
    </div>
  );
}

function WishlistCard({
  item,
}: {
  item: {
    id: string;
    dish_name: string;
    dish_image: string | null;
    nutrition_score: number | null;
  };
}) {
  const qc = useQueryClient();
  const removeFn = useServerFn(removeFromWishlist);
  async function onRemove() {
    try {
      await removeFn({ data: { id: item.id } });
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      toast.success("Removed");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <div className="group relative rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden hover:shadow-md hover:border-primary/20 transition-all duration-300">
      <div className="aspect-square bg-muted overflow-hidden">
        {item.dish_image && (
          <img
            src={item.dish_image}
            alt={item.dish_name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm line-clamp-2">{item.dish_name}</h3>
        <div className="mt-2 flex items-center gap-1.5">
          <NutritionPie score={item.nutrition_score ?? 0} />
          <span className="text-xs text-muted-foreground">{item.nutrition_score ?? 0}/100</span>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 size-8 rounded-full bg-background/80 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-background transition-all shadow-sm cursor-pointer"
      >
        <Trash2 className="size-3.5 text-destructive" />
      </button>
    </div>
  );
}

function NutritionPie({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const angle = (clamped / 100) * 360;
  const color =
    clamped >= 70
      ? "var(--color-accent)"
      : clamped >= 40
        ? "var(--color-chart-3)"
        : "var(--color-destructive)";
  return (
    <div
      className="size-5 rounded-full"
      style={{ background: `conic-gradient(${color} ${angle}deg, var(--color-muted) 0)` }}
    />
  );
}

// ---------- Search Dialog ----------
function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const search = useServerFn(searchDishes);
  const addFn = useServerFn(addToWishlist);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setQ("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await search({ data: { query: q.trim() } });
        if (r.error) toast.error(r.error);
        setResults(r.results);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [q, search]);

  async function onPick(r: SearchResult) {
    setAdding(r.id);
    try {
      await addFn({
        data: {
          spoonacularId: r.id,
          dishName: r.title,
          dishImage: r.image ?? null,
          nutritionScore: r.nutritionScore,
        },
      });
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      toast.success(`Added ${r.title}`);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAdding(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Find a dish</DialogTitle>
          <DialogDescription>
            Search the Spoonacular library and add it to your wishlist.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            autoFocus
            className="pl-9"
            placeholder="e.g. pasta, dosa, ramen…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto -mx-2">
          {searching && (
            <div className="py-8 flex justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!searching && results.length === 0 && q && (
            <p className="text-center text-sm text-muted-foreground py-8">No dishes found.</p>
          )}
          {!searching && !q && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Start typing to search.
            </p>
          )}
          <ul>
            {results.map((r) => (
              <li key={r.id}>
                <button
                  disabled={adding !== null}
                  onClick={() => onPick(r)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-muted rounded-xl text-left transition disabled:opacity-50"
                >
                  <div className="size-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                    {r.image && (
                      <img src={r.image} alt={r.title} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm line-clamp-1">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Nutrition {r.nutritionScore}/100
                    </p>
                  </div>
                  {adding === r.id && <Loader2 className="size-4 animate-spin" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Leaderboard ----------
function LeaderboardSection({ isCook }: { isCook: boolean }) {
  const fetchLb = useServerFn(getLeaderboard);
  const { data, isLoading } = useQuery({ queryKey: ["leaderboard"], queryFn: () => fetchLb() });
  const [scheduleFor, setScheduleFor] = useState<null | {
    spoonacularId: number;
    dishName: string;
    dishImage: string | null;
  }>(null);

  return (
    <section>
      <SectionHeader
        title="This Week's Leaderboard"
        subtitle="The most wishlisted dishes rise to the top. Cooks can tap a dish to schedule it."
      />
      <div className="mt-6">
        {isLoading ? (
          <div className="flex justify-center pt-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data || data.leaderboard.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Trophy className="size-12 mx-auto opacity-30 mb-3" />
            <p>No dishes wishlisted yet this week.</p>
          </div>
        ) : (
          <ol className="space-y-2">
            {data.leaderboard.map((d, i) => (
              <li key={d.spoonacularId}>
                <button
                  disabled={!isCook}
                  onClick={() => isCook && setScheduleFor(d)}
                  className="group w-full flex items-center gap-3 p-3 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:bg-muted/50 hover:shadow-sm transition-all duration-200 text-left disabled:cursor-default disabled:hover:bg-card/50 disabled:hover:shadow-none disabled:hover:translate-y-0"
                >
                  <span
                    className={`size-9 rounded-full flex items-center justify-center font-display font-semibold ${i === 0 ? "bg-primary text-primary-foreground" : i < 3 ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}
                  >
                    {i + 1}
                  </span>
                  <div className="size-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                    {d.dishImage && (
                      <img
                        src={d.dishImage}
                        alt={d.dishName}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold line-clamp-1">{d.dishName}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.votes} {d.votes === 1 ? "wish" : "wishes"}
                    </p>
                  </div>
                  {isCook && <CalendarPlus className="size-4 text-muted-foreground" />}
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
      <ScheduleDialog dish={scheduleFor} onClose={() => setScheduleFor(null)} />
    </section>
  );
}

function ScheduleDialog({
  dish,
  onClose,
}: {
  dish: null | { spoonacularId: number; dishName: string; dishImage: string | null };
  onClose: () => void;
}) {
  const scheduleFn = useServerFn(scheduleDish);
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [meal, setMeal] = useState<"breakfast" | "lunch" | "dinner">("dinner");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDate(today);
    setMeal("dinner");
  }, [dish, today]);

  async function submit() {
    if (!dish) return;
    setBusy(true);
    try {
      await scheduleFn({
        data: {
          spoonacularId: dish.spoonacularId,
          dishName: dish.dishName,
          dishImage: dish.dishImage,
          date,
          mealType: meal,
        },
      });
      qc.invalidateQueries({ queryKey: ["scheduled"] });
      toast.success("Scheduled!");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!dish} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule {dish?.dishName}</DialogTitle>
          <DialogDescription>Pick a date and meal.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Meal</Label>
            <Select
              value={meal}
              onValueChange={(v) => setMeal(v as "breakfast" | "lunch" | "dinner")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="breakfast">Breakfast</SelectItem>
                <SelectItem value="lunch">Lunch</SelectItem>
                <SelectItem value="dinner">Dinner</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Schedule dish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Shared ----------
function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="px-1">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground opacity-80 mt-1">{subtitle}</p>
    </div>
  );
}

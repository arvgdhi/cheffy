import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  CalendarPlus,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  Trophy,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { DishDetailsDialog } from "@/components/dish-details-dialog";
import {
  addDishToWishlist,
  NUTRITION_FIELDS,
  type DishNutrition,
  type NutritionKey,
} from "@/lib/dish.functions";
import { getWishlist, getLeaderboard, removeFromWishlist } from "@/lib/wishlist.functions";
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

function WishlistSection() {
  const fetchWishlist = useServerFn(getWishlist);
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["wishlist"], queryFn: () => fetchWishlist() });
  const [addOpen, setAddOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  return (
    <section>
      <SectionHeader
        title="Your Wishlist"
        subtitle="Tap + to add a dish photo, name, and any recipe notes. Resets every Saturday."
      />
      <div className="mt-6 relative min-h-[50vh]">
        {isLoading ? (
          <div className="flex justify-center pt-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="text-center py-12 text-destructive">
            <p>Error loading wishlist: {(error as Error).message}</p>
            <p className="text-sm mt-1">Make sure you have run the database migrations.</p>
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyWishlist />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {data.items.map((item) => (
              <WishlistCard key={item.id} item={item} onClick={() => setDetailsId(item.dish_id)} />
            ))}
          </div>
        )}
      </div>
      <Button
        onClick={() => setAddOpen(true)}
        className="fixed bottom-6 right-6 size-14 rounded-full shadow-lg"
        size="icon"
        aria-label="Add dish"
      >
        <Plus className="size-6" />
      </Button>
      <AddDishDialog open={addOpen} onOpenChange={setAddOpen} />
      <DishDetailsDialog
        dishId={detailsId}
        open={detailsId !== null}
        onOpenChange={(open) => !open && setDetailsId(null)}
      />
    </section>
  );
}

function EmptyWishlist() {
  return (
    <div className="relative h-[40vh] flex flex-col items-center justify-center text-center px-4">
      <div className="size-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4 border border-border/50">
        <Utensils className="size-8 text-muted-foreground/50" />
      </div>
      <p className="text-muted-foreground font-medium text-lg tracking-tight">
        Your wishlist is empty
      </p>
      <p className="text-sm text-muted-foreground mt-1 max-w-[220px]">
        Tap the + button to add a dish from your own kitchen.
      </p>
    </div>
  );
}

function WishlistCard({
  item,
  onClick,
}: {
  item: {
    id: string;
    dish_id: string;
    dish_name: string;
    dish_image: string | null;
    nutrition: DishNutrition;
  };
  onClick: () => void;
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
    <div
      className="group relative rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden hover:shadow-md hover:border-primary/20 transition-all duration-300 cursor-pointer"
      onClick={onClick}
    >
      <div className="aspect-square bg-muted overflow-hidden flex items-center justify-center">
        {item.dish_image ? (
          <img
            src={item.dish_image}
            alt={item.dish_name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Utensils className="size-10 text-muted-foreground/40" />
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm line-clamp-2">{item.dish_name}</h3>
        <NutritionSummary nutrition={item.nutrition} />
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-2 right-2 size-8 rounded-full bg-background/80 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-background transition-all shadow-sm cursor-pointer"
        aria-label={`Remove ${item.dish_name}`}
      >
        <Trash2 className="size-3.5 text-destructive" />
      </button>
    </div>
  );
}

function NutritionSummary({ nutrition }: { nutrition: DishNutrition }) {
  if (nutritionEntries(nutrition).length === 0) return null;
  return (
    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
      <NutritionPie nutrition={nutrition} />
      <span>Nutrition mix</span>
    </div>
  );
}

function NutritionPie({ nutrition }: { nutrition: DishNutrition }) {
  const entries = nutritionEntries(nutrition);
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  if (total <= 0) return null;

  let cursor = 0;
  const stops = entries.map((entry) => {
    const start = cursor;
    cursor += (entry.value / total) * 360;
    return `${entry.color} ${start}deg ${cursor}deg`;
  });

  return (
    <div
      className="size-5 rounded-full border border-background/80 shadow-sm"
      style={{ background: `conic-gradient(${stops.join(", ")})` }}
    />
  );
}

function nutritionEntries(nutrition: DishNutrition) {
  return NUTRITION_FIELDS.map((field) => ({
    ...field,
    value: nutrition[field.key] ?? 0,
  })).filter((entry) => entry.value > 0);
}

const EMPTY_NUTRITION: Record<NutritionKey, string> = {
  protein: "",
  fat: "",
  carbohydrates: "",
  fiber: "",
  vitamins: "",
  minerals: "",
};

function AddDishDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addDish = useServerFn(addDishToWishlist);
  const qc = useQueryClient();
  const [dishName, setDishName] = useState("");
  const [dishImage, setDishImage] = useState<string | null>(null);
  const [nutrition, setNutrition] = useState<Record<NutritionKey, string>>({
    ...EMPTY_NUTRITION,
  });
  const [recipe, setRecipe] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setDishName("");
      setDishImage(null);
      setNutrition({ ...EMPTY_NUTRITION });
      setRecipe("");
      setBusy(false);
      setImageBusy(false);
    }
  }, [open]);

  async function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageBusy(true);
    try {
      setDishImage(await resizeImage(file));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setImageBusy(false);
    }
  }

  function buildNutrition(): DishNutrition | null {
    const out: DishNutrition = {};
    for (const field of NUTRITION_FIELDS) {
      const raw = nutrition[field.key].trim();
      if (!raw) continue;
      const value = Number(raw);
      if (Number.isFinite(value) && value > 0) out[field.key] = value;
    }
    return Object.keys(out).length > 0 ? out : null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = dishName.trim();
    if (!name) return;
    if (!dishImage) {
      toast.error("Add a photo of the dish first.");
      return;
    }

    setBusy(true);
    try {
      await addDish({
        data: {
          dishName: name,
          dishImage,
          nutrition: buildNutrition(),
          recipe: recipe.trim() || null,
        },
      });
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      toast.success(`Added ${name}`);
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a dish</DialogTitle>
          <DialogDescription>
            Take a photo, name the dish, and add nutrition or recipe details if you have them.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Dish photo</Label>
            <div className="grid sm:grid-cols-[160px_1fr] gap-3">
              <div className="aspect-square rounded-xl bg-muted border border-border/60 overflow-hidden flex items-center justify-center">
                {dishImage ? (
                  <img src={dishImage} alt="Dish preview" className="h-full w-full object-cover" />
                ) : imageBusy ? (
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                ) : (
                  <ImagePlus className="size-8 text-muted-foreground/50" />
                )}
              </div>
              <div className="space-y-2">
                <Input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={onImageChange}
                  disabled={busy || imageBusy}
                />
                <p className="text-xs text-muted-foreground">
                  On a phone, this opens the camera. Photos are resized before saving.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dish-name">Dish name</Label>
            <Input
              id="dish-name"
              required
              maxLength={200}
              value={dishName}
              onChange={(e) => setDishName(e.target.value)}
              placeholder="e.g. paneer tikka, ramen, pasta bake"
            />
          </div>

          <div className="space-y-3">
            <div>
              <Label>Nutrition data</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Optional estimates for the pie chart.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {NUTRITION_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {field.label} ({field.unit})
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    value={nutrition[field.key]}
                    onChange={(e) =>
                      setNutrition((current) => ({
                        ...current,
                        [field.key]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dish-recipe">Recipe</Label>
            <Textarea
              id="dish-recipe"
              value={recipe}
              maxLength={6000}
              onChange={(e) => setRecipe(e.target.value)}
              placeholder="Ingredients, instructions, family notes..."
              className="min-h-32"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={busy || imageBusy}>
              {busy ? (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              ) : (
                <Camera className="size-4 mr-1.5" />
              )}
              Add dish
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function resizeImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Choose an image file."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Could not load the image."));
      image.onload = () => {
        const maxSide = 900;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not prepare the image."));
          return;
        }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function LeaderboardSection({ isCook }: { isCook: boolean }) {
  const fetchLb = useServerFn(getLeaderboard);
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["leaderboard"], queryFn: () => fetchLb() });
  const [scheduleFor, setScheduleFor] = useState<null | {
    dishId: string;
    dishName: string;
    dishImage: string | null;
  }>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);

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
        ) : isError ? (
          <div className="text-center py-12 text-destructive">
            <p>Error loading leaderboard: {(error as Error).message}</p>
          </div>
        ) : !data || data.leaderboard.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Trophy className="size-12 mx-auto opacity-30 mb-3" />
            <p>No dishes wishlisted yet this week.</p>
          </div>
        ) : (
          <ol className="space-y-2">
            {data.leaderboard.map((dish, index) => (
              <li key={dish.dishId}>
                <div
                  onClick={() => setDetailsId(dish.dishId)}
                  className="group w-full flex items-center gap-3 p-3 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:bg-muted/50 hover:shadow-sm transition-all duration-200 text-left cursor-pointer"
                >
                  <span
                    className={`size-9 rounded-full flex items-center justify-center font-display font-semibold ${index === 0 ? "bg-primary text-primary-foreground" : index < 3 ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}
                  >
                    {index + 1}
                  </span>
                  <div className="size-12 rounded-lg bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {dish.dishImage ? (
                      <img
                        src={dish.dishImage}
                        alt={dish.dishName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Utensils className="size-6 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold line-clamp-1">{dish.dishName}</p>
                    <p className="text-xs text-muted-foreground">
                      {dish.votes} {dish.votes === 1 ? "wish" : "wishes"}
                    </p>
                  </div>
                  {isCook && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="ml-auto shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setScheduleFor(dish);
                      }}
                    >
                      <CalendarPlus className="size-4 mr-1.5 hidden sm:inline" />
                      <span className="hidden sm:inline">Schedule</span>
                      <CalendarPlus className="size-4 sm:hidden" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <ScheduleDialog dish={scheduleFor} onClose={() => setScheduleFor(null)} />
      <DishDetailsDialog
        dishId={detailsId}
        open={detailsId !== null}
        onOpenChange={(open) => !open && setDetailsId(null)}
      />
    </section>
  );
}

function ScheduleDialog({
  dish,
  onClose,
}: {
  dish: null | { dishId: string; dishName: string; dishImage: string | null };
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
          dishId: dish.dishId,
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
    <Dialog open={!!dish} onOpenChange={(isOpen) => !isOpen && onClose()}>
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
              onValueChange={(value) => setMeal(value as "breakfast" | "lunch" | "dinner")}
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
            {busy ? "Saving..." : "Schedule dish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="px-1">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground opacity-80 mt-1">{subtitle}</p>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDishDetails,
  updateDish,
  deleteDish,
  NUTRITION_FIELDS,
  type DishNutrition,
  type NutritionKey,
} from "@/lib/dish.functions";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Utensils,
  Pencil,
  Trash2,
  Check,
  X,
  ImagePlus,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function nutritionEntries(nutrition: DishNutrition | null | undefined) {
  return NUTRITION_FIELDS.map((field) => ({
    ...field,
    value: nutrition?.[field.key] ?? 0,
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

function nutritionToStrings(n: DishNutrition | null | undefined): Record<NutritionKey, string> {
  const out = { ...EMPTY_NUTRITION };
  for (const field of NUTRITION_FIELDS) {
    const v = n?.[field.key];
    if (v !== undefined && v !== null) out[field.key] = String(v);
  }
  return out;
}

function stringsToNutrition(s: Record<NutritionKey, string>): DishNutrition {
  const out: DishNutrition = {};
  for (const field of NUTRITION_FIELDS) {
    const raw = s[field.key].trim();
    if (!raw) continue;
    const v = Number(raw);
    if (Number.isFinite(v) && v > 0) out[field.key] = v;
  }
  return out;
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) { reject(new Error("Choose an image file.")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image."));
      img.onload = () => {
        const max = 900;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas unavailable.")); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function DishDetailsDialog({
  dishId,
  open,
  onOpenChange,
}: {
  dishId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fetchDetails = useServerFn(getDishDetails);
  const updateFn = useServerFn(updateDish);
  const deleteFn = useServerFn(deleteDish);
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);

  // Edit state
  const [name, setName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [nutrition, setNutrition] = useState<Record<NutritionKey, string>>({ ...EMPTY_NUTRITION });
  const [recipe, setRecipe] = useState("");



  const { data, isLoading, error } = useQuery({
    queryKey: ["dish", dishId],
    queryFn: () => (dishId ? fetchDetails({ data: { id: dishId } }) : null),
    enabled: !!dishId && open,
  });

  // Sync edit state when data loads
  useEffect(() => {
    if (data) {
      setName(data.title);
      setImage(data.image);
      setNutrition(nutritionToStrings(data.nutrition));
      setRecipe(data.recipe ?? "");
    }
  }, [data]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setEditing(false);
      setConfirmDelete(false);
      setBusy(false);
    }
  }, [open]);

  async function handleImageFile(file: File) {
    setImageBusy(true);
    try { setImage(await resizeImage(file)); }
    catch (e) { toast.error((e as Error).message); }
    finally { setImageBusy(false); }
  }

  async function handleSave() {
    if (!dishId) return;
    setBusy(true);
    try {
      await updateFn({
        data: {
          id: dishId,
          name: name.trim() || undefined,
          image: image && image !== data?.image ? image : undefined,
          nutrition: stringsToNutrition(nutrition),
          recipe: recipe.trim() || null,
        },
      });
      qc.invalidateQueries({ queryKey: ["dish", dishId] });
      qc.invalidateQueries({ queryKey: ["dishlist"] });
      toast.success("Dish updated!");
      setEditing(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!dishId) return;
    setBusy(true);
    try {
      await deleteFn({ data: { id: dishId } });
      qc.invalidateQueries({ queryKey: ["dishlist"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      qc.invalidateQueries({ queryKey: ["selections"] });
      toast.success("Dish deleted");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  const nutrients = nutritionEntries(data?.nutrition);
  const editNutrients = nutritionEntries(stringsToNutrition(nutrition));

  const displayImage = editing ? image : data?.image;
  const displayNutrients = editing ? editNutrients : nutrients;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Dish Details</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex justify-center items-center py-32">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive font-medium">
            Failed to load dish. Please try again.
          </div>
        ) : data ? (
          <>
            {/* Hero image */}
            <div className="relative h-48 sm:h-56 shrink-0 bg-muted">
              {displayImage ? (
                <img src={displayImage} alt={data.title} className="w-full h-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <Utensils className="size-14 text-muted-foreground/40" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />

              {/* Image change button (edit mode only) */}
              {editing && (
                <div className="absolute bottom-4 left-4 z-10">
                  <label className="relative cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
                    />
                    <Button type="button" size="sm" variant="secondary" className="pointer-events-none shadow-md">
                      {imageBusy ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <ImagePlus className="size-4 mr-1.5" />}
                      Choose Photo
                    </Button>
                  </label>
                </div>
              )}

              {/* Title (view) or name input (edit) */}
              <div className="absolute bottom-4 left-6 right-6 z-10">
                {editing ? (
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-xl font-display font-semibold bg-background/80 backdrop-blur-sm border-background/40"
                    placeholder="Dish name"
                  />
                ) : (
                  <h2 className="text-2xl sm:text-3xl font-display font-semibold tracking-tight text-foreground">
                    {data.title}
                  </h2>
                )}
              </div>

              {/* Action buttons top-right */}
              <div className="absolute top-3 right-3 flex gap-2 z-10">
                {editing ? (
                  <>
                    <Button size="icon" variant="secondary" className="size-9 shadow" onClick={handleSave} disabled={busy}>
                      {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    </Button>
                    <Button size="icon" variant="secondary" className="size-9 shadow" onClick={() => { setEditing(false); setConfirmDelete(false); }}>
                      <X className="size-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="icon" variant="secondary" className="size-9 shadow bg-background/70 backdrop-blur-sm" onClick={() => setEditing(true)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="secondary" className="size-9 shadow bg-background/70 backdrop-blur-sm text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => setConfirmDelete(true)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Delete confirm banner */}
            {confirmDelete && !editing && (
              <div className="flex items-center gap-3 bg-destructive/10 border-b border-destructive/20 px-6 py-3 shrink-0">
                <p className="flex-1 text-sm font-medium text-destructive">Delete this dish permanently?</p>
                <Button size="sm" variant="destructive" onClick={handleDelete} disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            )}

            <ScrollArea className="flex-1 px-6 py-6 bg-card">
              <div className="grid md:grid-cols-5 gap-8">
                {/* Nutrition */}
                <div className="md:col-span-2 space-y-4">
                  <h3 className="font-semibold text-lg font-display tracking-tight border-b pb-2">Nutrition</h3>
                  {editing ? (
                    <div className="grid grid-cols-2 gap-3">
                      {NUTRITION_FIELDS.map((field) => (
                        <div key={field.key} className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{field.label} ({field.unit})</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            inputMode="decimal"
                            value={nutrition[field.key]}
                            onChange={(e) => setNutrition((n) => ({ ...n, [field.key]: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  ) : displayNutrients.length > 0 ? (
                    <>
                      <div className="h-48 w-full -ml-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={displayNutrients} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none">
                              {displayNutrients.map((entry) => (
                                <Cell key={entry.key} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              formatter={(value, _name, props) => {
                                const p = props.payload as { unit?: string; label?: string };
                                return [`${Math.round(Number(value) * 10) / 10}${p.unit ?? ""}`, p.label ?? "Nutrition"];
                              }}
                              contentStyle={{ borderRadius: "8px", border: "1px solid var(--color-border)", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm pt-2">
                        {displayNutrients.map((entry) => (
                          <div key={entry.key} className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md">
                            <div className="size-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-muted-foreground">
                              {entry.label}
                              <span className="text-foreground font-medium ml-1">{Math.round(entry.value * 10) / 10}{entry.unit}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-xl">No nutrition data added.</p>
                  )}
                </div>

                {/* Recipe */}
                <div className="md:col-span-3 space-y-4">
                  <h3 className="font-semibold text-lg font-display tracking-tight border-b pb-2">Recipe</h3>
                  {editing ? (
                    <Textarea
                      value={recipe}
                      maxLength={6000}
                      onChange={(e) => setRecipe(e.target.value)}
                      placeholder="Ingredients, steps, family notes..."
                      className="min-h-48 text-sm"
                    />
                  ) : data.recipe ? (
                    <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{data.recipe}</div>
                  ) : (
                    <p className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-xl">No recipe added.</p>
                  )}
                </div>
              </div>

              {editing && (
                <DialogFooter className="mt-8 pt-4 border-t">
                  <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                  <Button onClick={handleSave} disabled={busy}>
                    {busy ? <Loader2 className="size-4 animate-spin mr-2" /> : <Check className="size-4 mr-2" />}
                    Save changes
                  </Button>
                </DialogFooter>
              )}
            </ScrollArea>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

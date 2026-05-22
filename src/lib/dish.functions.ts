import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";

export const NUTRITION_FIELDS = [
  { key: "protein", label: "Protein", unit: "g", color: "var(--color-primary)" },
  { key: "fat", label: "Fat", unit: "g", color: "var(--color-destructive)" },
  { key: "carbohydrates", label: "Carbs", unit: "g", color: "var(--color-accent)" },
  { key: "fiber", label: "Fiber", unit: "g", color: "var(--color-chart-3)" },
  { key: "vitamins", label: "Vitamins", unit: "mg", color: "var(--color-chart-4)" },
  { key: "minerals", label: "Minerals", unit: "mg", color: "var(--color-chart-5)" },
] as const;

export type NutritionKey = (typeof NUTRITION_FIELDS)[number]["key"];
export type DishNutrition = Partial<Record<NutritionKey, number>>;

const NutritionSchema = z
  .object({
    protein: z.number().min(0).max(1000).nullable().optional(),
    fat: z.number().min(0).max(1000).nullable().optional(),
    carbohydrates: z.number().min(0).max(1000).nullable().optional(),
    fiber: z.number().min(0).max(1000).nullable().optional(),
    vitamins: z.number().min(0).max(10000).nullable().optional(),
    minerals: z.number().min(0).max(10000).nullable().optional(),
  })
  .partial();

const DishInputSchema = z.object({
  dishName: z.string().trim().min(1).max(200),
  dishImage: z
    .string()
    .min(1, "Dish photo is required")
    .max(950_000)
    .refine((value) => value.startsWith("data:image/") || value.startsWith("http"), {
      message: "Dish photo must be an image",
    }),
  nutrition: NutritionSchema.nullable(),
  recipe: z.string().trim().max(6000).nullable(),
});

type HouseholdDishRow = Database["public"]["Tables"]["household_dishes"]["Row"];

function normalizeDishName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function compactNutrition(input: z.infer<typeof NutritionSchema> | null | undefined) {
  const out: DishNutrition = {};
  for (const field of NUTRITION_FIELDS) {
    const value = input?.[field.key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      out[field.key] = Math.round(value * 10) / 10;
    }
  }
  return out;
}

function isRecord(value: Json): value is Record<string, Json> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function readDishNutrition(value: Json | null | undefined): DishNutrition {
  if (!value || !isRecord(value)) return {};
  const out: DishNutrition = {};
  for (const field of NUTRITION_FIELDS) {
    const raw = value[field.key];
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
      out[field.key] = raw;
    }
  }
  return out;
}

export const addDishToWishlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DishInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("household_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.household_id) throw new Error("You must join a household first");

    const nutrition = compactNutrition(data.nutrition);
    const normalizedName = normalizeDishName(data.dishName);
    const recipe = data.recipe?.trim() || null;

    let dish: HouseholdDishRow | null = null;
    const { data: insertedDish, error: insertError } = await supabase
      .from("household_dishes")
      .insert({
        household_id: profile.household_id,
        created_by: userId,
        name: data.dishName,
        normalized_name: normalizedName,
        image: data.dishImage,
        nutrition: nutrition as Json,
        recipe,
      })
      .select(
        "id, household_id, created_by, name, normalized_name, image, nutrition, recipe, created_at, updated_at",
      )
      .single();

    if (insertError) {
      if (insertError.code !== "23505") throw new Error(insertError.message);
      const { data: existingDish, error: findError } = await supabase
        .from("household_dishes")
        .select(
          "id, household_id, created_by, name, normalized_name, image, nutrition, recipe, created_at, updated_at",
        )
        .eq("household_id", profile.household_id)
        .eq("normalized_name", normalizedName)
        .single();
      if (findError) throw new Error(findError.message);
      dish = existingDish;
    } else {
      dish = insertedDish;
    }

    const patch: Database["public"]["Tables"]["household_dishes"]["Update"] = {};
    if (data.dishImage && data.dishImage !== dish.image) patch.image = data.dishImage;
    if (Object.keys(nutrition).length > 0) {
      const currentNutrition = readDishNutrition(dish.nutrition);
      patch.nutrition = { ...currentNutrition, ...nutrition } as Json;
    }
    if (recipe && recipe !== dish.recipe) patch.recipe = recipe;

    if (Object.keys(patch).length > 0) {
      const { data: updatedDish, error: updateError } = await supabase
        .from("household_dishes")
        .update(patch)
        .eq("id", dish.id)
        .select(
          "id, household_id, created_by, name, normalized_name, image, nutrition, recipe, created_at, updated_at",
        )
        .single();
      if (updateError) throw new Error(updateError.message);
      dish = updatedDish;
    }

    const weekStart = currentWeekStart();
    const { error: wishError } = await supabase.from("wishlist_items").insert({
      household_id: profile.household_id,
      user_id: userId,
      dish_id: dish.id,
      dish_name: dish.name,
      dish_image: dish.image,
      week_start: weekStart,
    });
    if (wishError) {
      if (wishError.code === "23505") throw new Error("You've already added this dish this week.");
      throw new Error(wishError.message);
    }

    return { ok: true, dish };
  });

export const getDishDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: dish, error } = await supabase
      .from("household_dishes")
      .select("id, name, image, nutrition, recipe, created_at")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return {
      id: dish.id,
      title: dish.name,
      image: dish.image,
      nutrition: readDishNutrition(dish.nutrition),
      recipe: dish.recipe,
      createdAt: dish.created_at,
    };
  });

function currentWeekStart(): string {
  const now = new Date();
  const dow = now.getUTCDay();
  const daysSinceSat = (dow + 1) % 7;
  const sat = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceSat),
  );
  return sat.toISOString().slice(0, 10);
}

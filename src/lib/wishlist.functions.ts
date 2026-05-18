import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function currentWeekStart(): string {
  // Most recent Saturday (UTC) as YYYY-MM-DD
  const now = new Date();
  const dow = now.getUTCDay(); // Sun=0 ... Sat=6
  const daysSinceSat = (dow + 1) % 7;
  const sat = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceSat),
  );
  return sat.toISOString().slice(0, 10);
}

export const addToWishlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        spoonacularId: z.number().int().positive(),
        dishName: z.string().min(1).max(200),
        dishImage: z.string().url().nullable(),
        nutritionScore: z.number().int().min(0).max(100).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("household_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.household_id) throw new Error("You must join a household first");

    const weekStart = currentWeekStart();
    const { error } = await supabase.from("wishlist_items").insert({
      household_id: profile.household_id,
      user_id: userId,
      spoonacular_id: data.spoonacularId,
      dish_name: data.dishName,
      dish_image: data.dishImage,
      nutrition_score: data.nutritionScore,
      week_start: weekStart,
    });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const getWishlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const weekStart = currentWeekStart();
    const { data, error } = await supabase
      .from("wishlist_items")
      .select("id, spoonacular_id, dish_name, dish_image, nutrition_score, user_id, created_at")
      .eq("week_start", weekStart)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: data ?? [], weekStart };
  });

export const removeFromWishlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("wishlist_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const weekStart = currentWeekStart();
    const { data, error } = await supabase
      .from("wishlist_items")
      .select("spoonacular_id, dish_name, dish_image, nutrition_score")
      .eq("week_start", weekStart);
    if (error) throw new Error(error.message);

    type Agg = {
      spoonacularId: number;
      dishName: string;
      dishImage: string | null;
      nutritionScore: number | null;
      votes: number;
    };
    const map = new Map<number, Agg>();
    for (const row of data ?? []) {
      const existing = map.get(row.spoonacular_id);
      if (existing) existing.votes++;
      else
        map.set(row.spoonacular_id, {
          spoonacularId: row.spoonacular_id,
          dishName: row.dish_name,
          dishImage: row.dish_image,
          nutritionScore: row.nutrition_score,
          votes: 1,
        });
    }
    const leaderboard = Array.from(map.values()).sort((a, b) => b.votes - a.votes);
    return { leaderboard, weekStart };
  });

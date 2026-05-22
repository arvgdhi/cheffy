import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readDishNutrition } from "@/lib/dish.functions";

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

export const getWishlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const weekStart = currentWeekStart();
    const { data, error } = await supabase
      .from("wishlist_items")
      .select(
        "id, dish_id, dish_name, dish_image, user_id, created_at, household_dishes(nutrition)",
      )
      .eq("week_start", weekStart)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const items =
      data?.map((row) => {
        const dish = row.household_dishes as { nutrition?: unknown } | null;
        return {
          id: row.id,
          dish_id: row.dish_id,
          dish_name: row.dish_name,
          dish_image: row.dish_image,
          user_id: row.user_id,
          created_at: row.created_at,
          nutrition: readDishNutrition(dish?.nutrition ?? null),
        };
      }) ?? [];
    return { items, weekStart };
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
      .select("dish_id, dish_name, dish_image, household_dishes(nutrition)")
      .eq("week_start", weekStart);
    if (error) throw new Error(error.message);

    type Agg = {
      dishId: string;
      dishName: string;
      dishImage: string | null;
      nutrition: ReturnType<typeof readDishNutrition>;
      votes: number;
    };
    const map = new Map<string, Agg>();
    for (const row of data ?? []) {
      const existing = map.get(row.dish_id);
      if (existing) existing.votes++;
      else {
        const dish = row.household_dishes as { nutrition?: unknown } | null;
        map.set(row.dish_id, {
          dishId: row.dish_id,
          dishName: row.dish_name,
          dishImage: row.dish_image,
          nutrition: readDishNutrition(dish?.nutrition ?? null),
          votes: 1,
        });
      }
    }
    const leaderboard = Array.from(map.values()).sort((a, b) => b.votes - a.votes);
    return { leaderboard, weekStart };
  });

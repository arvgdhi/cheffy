import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readDishNutrition } from "@/lib/dish.functions";

function getLocalDateString(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const getMySelections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("household_id")
      .eq("id", userId)
      .maybeSingle();
      
    if (!profile?.household_id) throw new Error("No household");

    const { data: selData, error } = await supabase
      .from("selections")
      .select("id, dish_id")
      .eq("user_id", userId)
      .eq("date_for", data.date);
      
    if (error) throw new Error(error.message);
    
    return { selections: selData ?? [] };
  });

export const saveSelections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ 
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dishIds: z.array(z.string().uuid()).min(5, "You must select at least 5 dishes")
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    
    // Time check: If trying to edit today's selections after 7 AM, block it.
    const now = new Date();
    const todayStr = getLocalDateString(now);
    if (data.date === todayStr && now.getHours() >= 7) {
      throw new Error("You cannot edit today's selections after 7:00 AM.");
    }
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("household_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.household_id) throw new Error("No household");

    // Delete old selections for this date
    await supabase
      .from("selections")
      .delete()
      .eq("user_id", userId)
      .eq("date_for", data.date);

    // Insert new ones
    const inserts = data.dishIds.map(dish_id => ({
      user_id: userId,
      household_id: profile.household_id,
      dish_id,
      date_for: data.date
    }));

    const { error } = await supabase.from("selections").insert(inserts);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const getDailyLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("household_id")
      .eq("id", userId)
      .maybeSingle();
      
    if (!profile?.household_id) throw new Error("No household");

    // Get selections
    const { data: selData, error } = await supabase
      .from("selections")
      .select("dish_id, household_dishes(id, name, image, nutrition)")
      .eq("household_id", profile.household_id)
      .eq("date_for", data.date);
      
    if (error) throw new Error(error.message);

    // Get scheduled dishes for today to mark them
    const { data: schedData } = await supabase
      .from("scheduled_dishes")
      .select("dish_id")
      .eq("household_id", profile.household_id)
      .eq("scheduled_date", data.date);

    const scheduledSet = new Set(schedData?.map(s => s.dish_id) ?? []);

    type Agg = {
      dishId: string;
      dishName: string;
      dishImage: string | null;
      nutrition: ReturnType<typeof readDishNutrition>;
      votes: number;
      isScheduled: boolean;
    };
    
    const map = new Map<string, Agg>();
    for (const row of selData ?? []) {
      const existing = map.get(row.dish_id);
      if (existing) {
        existing.votes++;
      } else {
        const dish = row.household_dishes as { id: string, name: string, image: string, nutrition?: unknown } | null;
        if (!dish) continue;
        map.set(row.dish_id, {
          dishId: dish.id,
          dishName: dish.name,
          dishImage: dish.image,
          nutrition: readDishNutrition(dish.nutrition ?? null),
          votes: 1,
          isScheduled: scheduledSet.has(dish.id)
        });
      }
    }
    const leaderboard = Array.from(map.values()).sort((a, b) => b.votes - a.votes);
    return { leaderboard };
  });

export const getHouseholdDishlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("household_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.household_id) throw new Error("No household");

    const { data, error } = await supabase
      .from("household_dishes")
      .select("id, name, image, nutrition")
      .eq("household_id", profile.household_id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    
    const items = data.map(row => ({
      id: row.id,
      dish_id: row.id,
      dish_name: row.name,
      dish_image: row.image,
      nutrition: readDishNutrition(row.nutrition)
    }));
    
    return { items };
  });

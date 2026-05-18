import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MealEnum = z.enum(["breakfast", "lunch", "dinner"]);

export const scheduleDish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        spoonacularId: z.number().int().positive(),
        dishName: z.string().min(1).max(200),
        dishImage: z.string().url().nullable(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        mealType: MealEnum,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("household_id, role")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.household_id) throw new Error("No household");
    if (profile.role !== "cook" && profile.role !== "both") {
      throw new Error("Only cooks can schedule dishes");
    }
    const { error } = await supabase.from("scheduled_dishes").insert({
      household_id: profile.household_id,
      spoonacular_id: data.spoonacularId,
      dish_name: data.dishName,
      dish_image: data.dishImage,
      scheduled_date: data.date,
      meal_type: data.mealType,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getScheduledDishes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("scheduled_dishes")
      .select("id, spoonacular_id, dish_name, dish_image, scheduled_date, meal_type, completed")
      .order("scheduled_date", { ascending: true })
      .order("meal_type", { ascending: true });
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const toggleCompleted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), completed: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("scheduled_dishes")
      .update({ completed: data.completed })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteScheduledDish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("scheduled_dishes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const addDish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        name: z.string().min(1).max(100),
        imageBase64: z.string().optional(),
        calories: z.number().nullable(),
        protein: z.number().nullable(),
        carbs: z.number().nullable(),
        fat: z.number().nullable(),
        ingredients: z.array(z.string()).default([]),
        instructions: z.array(z.string()).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Get the user's household
    const { data: profile } = await supabase
      .from("profiles")
      .select("household_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.household_id) throw new Error("Must be in a household to add a dish.");

    let imageUrl = null;

    if (data.imageBase64) {
      // Upload image to Supabase Storage if base64 provided
      try {
        const matches = data.imageBase64.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, "base64");
          const fileName = `${userId}-${Date.now()}.${ext}`;

          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from("dishes")
            .upload(fileName, buffer, {
              contentType: `image/${ext}`,
            });

          if (uploadErr) {
            console.error("Image upload failed:", uploadErr);
          } else if (uploadData) {
            const { data: publicUrlData } = supabase.storage
              .from("dishes")
              .getPublicUrl(uploadData.path);
            imageUrl = publicUrlData.publicUrl;
          }
        }
      } catch (e) {
        console.error("Failed to parse/upload image", e);
      }
    }

    const { data: dish, error } = await supabase
      .from("dishes")
      .insert({
        created_by: userId,
        household_id: profile.household_id,
        name: data.name,
        image_url: imageUrl,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat,
        ingredients: data.ingredients,
        instructions: data.instructions,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    return { dishId: dish.id };
  });

export const getDishDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: dish, error } = await supabase
      .from("dishes")
      .select("*")
      .eq("id", data.id)
      .single();

    if (error) throw new Error("Dish not found: " + error.message);

    return { dish };
  });

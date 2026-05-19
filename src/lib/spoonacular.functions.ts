import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BASE = "https://api.spoonacular.com";

function key() {
  const k = process.env.SPOONACULAR_API_KEY;
  if (!k) throw new Error("SPOONACULAR_API_KEY is not configured");
  return k;
}

export const searchDishes = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ query: z.string().min(1).max(100) }).parse(input))
  .handler(async ({ data }) => {
    const url = new URL(`${BASE}/recipes/complexSearch`);
    url.searchParams.set("query", data.query);
    url.searchParams.set("number", "12");
    url.searchParams.set("addRecipeNutrition", "true");
    url.searchParams.set("apiKey", key());

    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      console.error("Spoonacular search failed", res.status, text);
      return { results: [] as SearchResult[], error: `Spoonacular error ${res.status}` };
    }
    const json = (await res.json()) as { results: SpoonRecipe[] };
    const results: SearchResult[] = (json.results ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      image: r.image,
      nutritionScore: extractHealthScore(r),
    }));
    return { results, error: null as string | null };
  });

export const getDishDetails = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const url = new URL(`${BASE}/recipes/${data.id}/information`);
    url.searchParams.set("includeNutrition", "true");
    url.searchParams.set("apiKey", key());

    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      console.error("Spoonacular details failed", res.status, text);
      throw new Error(`Spoonacular error ${res.status}`);
    }
    const r = (await res.json()) as SpoonRecipeFull;
    return {
      id: r.id,
      title: r.title,
      image: r.image,
      summary: r.summary ?? "",
      readyInMinutes: r.readyInMinutes ?? null,
      servings: r.servings ?? null,
      sourceUrl: r.sourceUrl ?? null,
      ingredients:
        r.extendedIngredients?.map((i) => ({
          name: i.name,
          amount: i.amount,
          unit: i.unit,
          original: i.original,
        })) ?? [],
      instructions:
        r.analyzedInstructions?.[0]?.steps?.map((s) => ({
          number: s.number,
          step: s.step,
        })) ?? [],
      nutritionScore: extractHealthScore(r),
      nutrients:
        r.nutrition?.nutrients
          ?.filter((n) => ["Calories", "Fat", "Carbohydrates", "Protein"].includes(n.name))
          .map((n) => ({
            name: n.name,
            amount: n.amount,
            unit: n.unit,
          })) ?? [],
    };
  });

type SpoonRecipe = {
  id: number;
  title: string;
  image: string;
  healthScore?: number;
  nutrition?: { nutrients?: { name: string; amount: number; unit: string }[] };
};

type SpoonRecipeFull = SpoonRecipe & {
  summary?: string;
  readyInMinutes?: number;
  servings?: number;
  sourceUrl?: string;
  extendedIngredients?: { name: string; amount: number; unit: string; original: string }[];
  analyzedInstructions?: { steps: { number: number; step: string }[] }[];
};

export type SearchResult = {
  id: number;
  title: string;
  image: string;
  nutritionScore: number;
};

function extractHealthScore(r: SpoonRecipe): number {
  if (typeof r.healthScore === "number") return Math.round(r.healthScore);
  return 50;
}

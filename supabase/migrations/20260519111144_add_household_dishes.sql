CREATE TABLE public.household_dishes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  image TEXT,
  nutrition JSONB NOT NULL DEFAULT '{}'::jsonb,
  recipe TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, normalized_name)
);

CREATE INDEX idx_household_dishes_household ON public.household_dishes (household_id);

ALTER TABLE public.wishlist_items
  ADD COLUMN dish_id UUID REFERENCES public.household_dishes(id) ON DELETE CASCADE;

ALTER TABLE public.scheduled_dishes
  ADD COLUMN dish_id UUID REFERENCES public.household_dishes(id) ON DELETE CASCADE;

WITH source_dishes AS (
  SELECT
    household_id,
    user_id AS created_by,
    dish_name AS name,
    lower(trim(regexp_replace(dish_name, '\s+', ' ', 'g'))) AS normalized_name,
    dish_image AS image
  FROM public.wishlist_items
  UNION ALL
  SELECT
    household_id,
    created_by,
    dish_name AS name,
    lower(trim(regexp_replace(dish_name, '\s+', ' ', 'g'))) AS normalized_name,
    dish_image AS image
  FROM public.scheduled_dishes
),
deduped_dishes AS (
  SELECT DISTINCT ON (household_id, normalized_name)
    household_id,
    created_by,
    name,
    normalized_name,
    image
  FROM source_dishes
  ORDER BY household_id, normalized_name, image IS NULL, name
)
INSERT INTO public.household_dishes (household_id, created_by, name, normalized_name, image)
SELECT household_id, created_by, name, normalized_name, image
FROM deduped_dishes
ON CONFLICT (household_id, normalized_name) DO NOTHING;

UPDATE public.wishlist_items wi
SET dish_id = hd.id
FROM public.household_dishes hd
WHERE wi.household_id = hd.household_id
  AND lower(trim(regexp_replace(wi.dish_name, '\s+', ' ', 'g'))) = hd.normalized_name;

UPDATE public.scheduled_dishes sd
SET dish_id = hd.id
FROM public.household_dishes hd
WHERE sd.household_id = hd.household_id
  AND lower(trim(regexp_replace(sd.dish_name, '\s+', ' ', 'g'))) = hd.normalized_name;

WITH duplicate_wishes AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY household_id, user_id, dish_id, week_start
      ORDER BY created_at ASC, id ASC
    ) AS row_number
  FROM public.wishlist_items
  WHERE dish_id IS NOT NULL
)
DELETE FROM public.wishlist_items wi
USING duplicate_wishes dw
WHERE wi.id = dw.id
  AND dw.row_number > 1;

ALTER TABLE public.wishlist_items
  ALTER COLUMN dish_id SET NOT NULL;

ALTER TABLE public.scheduled_dishes
  ALTER COLUMN dish_id SET NOT NULL;

ALTER TABLE public.wishlist_items
  DROP CONSTRAINT IF EXISTS wishlist_items_household_id_user_id_spoonacular_id_week_start_key;

ALTER TABLE public.wishlist_items
  ADD CONSTRAINT wishlist_items_household_user_dish_week_key
  UNIQUE (household_id, user_id, dish_id, week_start);

ALTER TABLE public.wishlist_items
  DROP COLUMN IF EXISTS spoonacular_id,
  DROP COLUMN IF EXISTS nutrition_score;

ALTER TABLE public.scheduled_dishes
  DROP COLUMN IF EXISTS spoonacular_id;

CREATE TRIGGER update_household_dishes_updated_at
BEFORE UPDATE ON public.household_dishes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.household_dishes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members view dishes" ON public.household_dishes
  FOR SELECT TO authenticated USING (household_id = public.current_household_id());

CREATE POLICY "Household members create dishes" ON public.household_dishes
  FOR INSERT TO authenticated WITH CHECK (
    household_id = public.current_household_id()
    AND created_by = auth.uid()
  );

CREATE POLICY "Household members update dishes" ON public.household_dishes
  FOR UPDATE TO authenticated USING (household_id = public.current_household_id())
  WITH CHECK (household_id = public.current_household_id());


-- Enum for roles
CREATE TYPE public.user_role AS ENUM ('cook', 'member', 'both');
CREATE TYPE public.meal_type AS ENUM ('breakfast', 'lunch', 'dinner');

-- Households
CREATE TABLE public.households (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  role public.user_role,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wishlist items
CREATE TABLE public.wishlist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  spoonacular_id INTEGER NOT NULL,
  dish_name TEXT NOT NULL,
  dish_image TEXT,
  nutrition_score INTEGER,
  week_start DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, user_id, spoonacular_id, week_start)
);

CREATE INDEX idx_wishlist_household_week ON public.wishlist_items (household_id, week_start);

-- Scheduled dishes
CREATE TABLE public.scheduled_dishes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  spoonacular_id INTEGER NOT NULL,
  dish_name TEXT NOT NULL,
  dish_image TEXT,
  scheduled_date DATE NOT NULL,
  meal_type public.meal_type NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_household_date ON public.scheduled_dishes (household_id, scheduled_date);

-- Helper: current user's household_id (SECURITY DEFINER avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.current_household_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT household_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Helper: current user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- Helper: compute most recent Saturday midnight (UTC) as the week_start
CREATE OR REPLACE FUNCTION public.current_week_start()
RETURNS DATE
LANGUAGE SQL
STABLE
AS $$
  -- Postgres dow: Sat = 6. Subtract days since last Saturday.
  SELECT (CURRENT_DATE - ((EXTRACT(DOW FROM CURRENT_DATE)::int + 1) % 7))::date
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_dishes ENABLE ROW LEVEL SECURITY;

-- Households policies
CREATE POLICY "Authenticated can lookup households" ON public.households
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create households" ON public.households
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Members can update own household" ON public.households
  FOR UPDATE TO authenticated USING (id = public.current_household_id());

-- Profiles policies
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR household_id = public.current_household_id());
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- Wishlist policies
CREATE POLICY "Household members view wishlist" ON public.wishlist_items
  FOR SELECT TO authenticated USING (household_id = public.current_household_id());
CREATE POLICY "Users add own wishlist" ON public.wishlist_items
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND household_id = public.current_household_id()
  );
CREATE POLICY "Users delete own wishlist" ON public.wishlist_items
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Scheduled dishes policies
CREATE POLICY "Household members view schedule" ON public.scheduled_dishes
  FOR SELECT TO authenticated USING (household_id = public.current_household_id());
CREATE POLICY "Cooks schedule dishes" ON public.scheduled_dishes
  FOR INSERT TO authenticated WITH CHECK (
    household_id = public.current_household_id()
    AND created_by = auth.uid()
    AND public.current_user_role() IN ('cook', 'both')
  );
CREATE POLICY "Cooks update scheduled dishes" ON public.scheduled_dishes
  FOR UPDATE TO authenticated USING (
    household_id = public.current_household_id()
    AND public.current_user_role() IN ('cook', 'both')
  );
CREATE POLICY "Cooks delete scheduled dishes" ON public.scheduled_dishes
  FOR DELETE TO authenticated USING (
    household_id = public.current_household_id()
    AND public.current_user_role() IN ('cook', 'both')
  );

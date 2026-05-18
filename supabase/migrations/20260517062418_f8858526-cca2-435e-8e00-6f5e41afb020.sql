
-- Set search_path on current_week_start
CREATE OR REPLACE FUNCTION public.current_week_start()
RETURNS DATE
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  SELECT (CURRENT_DATE - ((EXTRACT(DOW FROM CURRENT_DATE)::int + 1) % 7))::date
$$;

-- Revoke public/anon execute on helper SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.current_household_id() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_week_start() FROM public, anon;

GRANT EXECUTE ON FUNCTION public.current_household_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_week_start() TO authenticated;


CREATE OR REPLACE FUNCTION public.builder_payment_status(_builder_id uuid)
RETURNS TABLE(has_method boolean, is_verified boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    auth.uid() = _builder_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.builder_id = _builder_id
        AND (c.founder_id = auth.uid() OR c.builder_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.builder_id = _builder_id AND o.founder_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    EXISTS(SELECT 1 FROM public.payment_methods pm WHERE pm.user_id = _builder_id) AS has_method,
    COALESCE(
      (SELECT bool_or(pm.verified) FROM public.payment_methods pm
       WHERE pm.user_id = _builder_id AND pm.is_default = true),
      false
    ) AS is_verified;
END;
$$;

GRANT EXECUTE ON FUNCTION public.builder_payment_status(uuid) TO authenticated;

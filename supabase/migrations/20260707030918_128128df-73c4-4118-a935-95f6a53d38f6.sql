DROP POLICY IF EXISTS cr_select_all ON public.contract_reviews;

CREATE POLICY "cr_select_parties_or_admin"
ON public.contract_reviews
FOR SELECT
TO authenticated
USING (
  auth.uid() = reviewer_id
  OR auth.uid() = reviewee_id
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_reviews.contract_id
      AND (c.founder_id = auth.uid() OR c.builder_id = auth.uid())
  )
);
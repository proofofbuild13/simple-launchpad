ALTER TABLE public.community_challenges ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

CREATE POLICY "Startups can create challenges"
ON public.community_challenges FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'startup') AND (created_by = auth.uid() OR created_by IS NULL));

CREATE POLICY "Startups can update own challenges"
ON public.community_challenges FOR UPDATE TO authenticated
USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
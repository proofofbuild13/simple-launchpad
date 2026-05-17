-- Add DELETE policy for submissions so builders can delete their own submissions
CREATE POLICY "subs_delete_builder" ON public.submissions FOR DELETE TO authenticated USING (auth.uid() = builder_id);

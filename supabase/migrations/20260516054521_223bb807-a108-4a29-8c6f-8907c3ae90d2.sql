
-- EDUCATIONS
CREATE TABLE public.educations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  institution text NOT NULL,
  degree text,
  specialization text,
  start_year int,
  end_year int,
  grade text,
  achievements text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.educations ENABLE ROW LEVEL SECURITY;
CREATE POLICY edu_select_all ON public.educations FOR SELECT TO authenticated USING (true);
CREATE POLICY edu_insert_own ON public.educations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY edu_update_own ON public.educations FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY edu_delete_own ON public.educations FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER edu_touch BEFORE UPDATE ON public.educations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- EXPERIENCES
CREATE TABLE public.experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_name text NOT NULL,
  role text NOT NULL,
  employment_type text,
  start_date date,
  end_date date,
  is_current boolean NOT NULL DEFAULT false,
  description text,
  achievements text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY exp_select_all ON public.experiences FOR SELECT TO authenticated USING (true);
CREATE POLICY exp_insert_own ON public.experiences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY exp_update_own ON public.experiences FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY exp_delete_own ON public.experiences FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER exp_touch BEFORE UPDATE ON public.experiences FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- CERTIFICATIONS
CREATE TABLE public.certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  issuer text,
  issue_date date,
  credential_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY cert_select_all ON public.certifications FOR SELECT TO authenticated USING (true);
CREATE POLICY cert_insert_own ON public.certifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY cert_update_own ON public.certifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY cert_delete_own ON public.certifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- PAYMENT METHODS
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  method_type text NOT NULL CHECK (method_type IN ('upi','bank')),
  upi_id text,
  bank_name text,
  account_number text,
  ifsc text,
  account_holder text,
  is_default boolean NOT NULL DEFAULT false,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY pm_select_own_or_admin ON public.payment_methods FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY pm_insert_own ON public.payment_methods FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY pm_update_own_or_admin ON public.payment_methods FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY pm_delete_own ON public.payment_methods FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER pm_touch BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Helper: mask account number
CREATE OR REPLACE FUNCTION public.mask_account(_acc text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN _acc IS NULL OR length(_acc) <= 4 THEN _acc
    ELSE repeat('•', greatest(length(_acc)-4,0)) || right(_acc,4) END;
$$;

-- Helper: get builder's default payment method (masked) for a counter-party in an active contract
CREATE OR REPLACE FUNCTION public.get_builder_default_payment(_builder_id uuid)
RETURNS TABLE (method_type text, upi_id text, bank_name text, account_number_masked text, ifsc text, account_holder text, verified boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.contracts
    WHERE builder_id = _builder_id
      AND (founder_id = auth.uid() OR builder_id = auth.uid()
           OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  ) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT pm.method_type, pm.upi_id, pm.bank_name,
         public.mask_account(pm.account_number) AS account_number_masked,
         pm.ifsc, pm.account_holder, pm.verified
  FROM public.payment_methods pm
  WHERE pm.user_id = _builder_id AND pm.is_default = true
  LIMIT 1;
END; $$;

-- Trigger: notify founders when builder's default payment method changes
CREATE OR REPLACE FUNCTION public.notify_payment_method_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_default = true THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT DISTINCT c.founder_id, 'payment_method_updated',
      'Builder updated payment details',
      'A builder on one of your active contracts updated their preferred payment method.',
      '/contracts/' || c.id
    FROM public.contracts c
    WHERE c.builder_id = NEW.user_id
      AND c.status NOT IN ('cancelled','completed');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER pm_notify_default AFTER INSERT OR UPDATE ON public.payment_methods
FOR EACH ROW EXECUTE FUNCTION public.notify_payment_method_change();

-- Ensure single default per user
CREATE OR REPLACE FUNCTION public.enforce_single_default_pm()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.payment_methods SET is_default = false
    WHERE user_id = NEW.user_id AND id <> NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER pm_single_default BEFORE INSERT OR UPDATE ON public.payment_methods
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_default_pm();

-- builder_profiles: add phone
ALTER TABLE public.builder_profiles ADD COLUMN IF NOT EXISTS phone text;

CREATE INDEX IF NOT EXISTS idx_educations_user ON public.educations(user_id);
CREATE INDEX IF NOT EXISTS idx_experiences_user ON public.experiences(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON public.payment_methods(user_id);

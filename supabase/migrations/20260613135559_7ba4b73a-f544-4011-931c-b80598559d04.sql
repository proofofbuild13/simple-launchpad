
-- Part 1: Fix user_roles RLS so super_admin can read all roles
DROP POLICY IF EXISTS roles_select_own ON public.user_roles;
CREATE POLICY roles_select_own ON public.user_roles
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

DROP POLICY IF EXISTS roles_admin_all ON public.user_roles;
CREATE POLICY roles_admin_all ON public.user_roles
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- Part 2A: admin_get_user_full
CREATE OR REPLACE FUNCTION public.admin_get_user_full(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  user_role text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT role::text INTO user_role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;

  SELECT jsonb_build_object(
    'identity', (
      SELECT jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'avatar_url', p.avatar_url,
        'created_at', p.created_at,
        'updated_at', p.updated_at,
        'email', u.email,
        'email_confirmed_at', u.email_confirmed_at,
        'last_sign_in_at', u.last_sign_in_at,
        'auth_created_at', u.created_at,
        'banned_until', u.banned_until,
        'phone', u.phone
      )
      FROM public.profiles p
      LEFT JOIN auth.users u ON u.id = p.id
      WHERE p.id = _user_id
    ),
    'role', user_role,
    'status', (SELECT to_jsonb(s) FROM public.user_status s WHERE s.user_id = _user_id),
    'builder_profile', CASE WHEN user_role = 'builder' THEN (
      SELECT jsonb_build_object(
        'profile', to_jsonb(bp) - 'phone',
        'experiences', COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.start_date DESC NULLS LAST) FROM public.experiences e WHERE e.builder_id = _user_id), '[]'::jsonb),
        'educations', COALESCE((SELECT jsonb_agg(to_jsonb(ed) ORDER BY ed.start_year DESC NULLS LAST) FROM public.educations ed WHERE ed.builder_id = _user_id), '[]'::jsonb),
        'certifications', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM public.certifications c WHERE c.builder_id = _user_id), '[]'::jsonb),
        'payment_methods', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', pm.id, 'method_type', pm.method_type, 'upi_id', pm.upi_id,
          'bank_name', pm.bank_name, 'account_number_masked', public.mask_account(pm.account_number),
          'ifsc', pm.ifsc, 'account_holder', pm.account_holder, 'is_default', pm.is_default,
          'verified', pm.verified, 'created_at', pm.created_at)) FROM public.payment_methods pm WHERE pm.user_id = _user_id), '[]'::jsonb),
        'submissions_count', (SELECT count(*) FROM public.submissions WHERE builder_id = _user_id),
        'saved_projects_count', (SELECT count(*) FROM public.saved_projects WHERE user_id = _user_id)
      ) FROM public.builder_profiles bp WHERE bp.id = _user_id
    ) ELSE NULL END,
    'startup_profile', CASE WHEN user_role = 'startup' THEN (
      SELECT jsonb_build_object(
        'profile', to_jsonb(sp),
        'projects_count', (SELECT count(*) FROM public.projects WHERE founder_id = _user_id),
        'projects', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'title', title, 'status', status, 'created_at', created_at) ORDER BY created_at DESC) FROM public.projects WHERE founder_id = _user_id LIMIT 50), '[]'::jsonb),
        'invitations_sent', (SELECT count(*) FROM public.project_invitations pi JOIN public.projects pr ON pr.id = pi.project_id WHERE pr.founder_id = _user_id),
        'followers_count', (SELECT count(*) FROM public.followed_startups WHERE startup_id = _user_id)
      ) FROM public.startup_profiles sp WHERE sp.id = _user_id
    ) ELSE NULL END,
    'contracts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'status', c.status, 'escrow_amount', c.escrow_amount,
        'escrow_balance', c.escrow_balance, 'escrow_funded', c.escrow_funded,
        'founder_id', c.founder_id, 'builder_id', c.builder_id,
        'project_id', c.project_id, 'created_at', c.created_at) ORDER BY c.created_at DESC)
      FROM public.contracts c WHERE c.founder_id = _user_id OR c.builder_id = _user_id
    ), '[]'::jsonb),
    'offers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', o.id, 'status', o.status, 'compensation', o.compensation,
        'founder_id', o.founder_id, 'builder_id', o.builder_id, 'created_at', o.created_at) ORDER BY o.created_at DESC)
      FROM public.offers o WHERE o.founder_id = _user_id OR o.builder_id = _user_id
    ), '[]'::jsonb),
    'payment_records', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', pr.id, 'status', pr.status,
        'declared_amount', pr.declared_amount, 'confirmed_amount', pr.confirmed_amount,
        'contract_id', pr.contract_id, 'declared_at', pr.declared_at) ORDER BY pr.declared_at DESC)
      FROM public.payment_records pr WHERE pr.startup_id = _user_id OR pr.builder_id = _user_id
    ), '[]'::jsonb),
    'commission_invoices', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', ci.id, 'invoice_number', ci.invoice_number,
        'commission_amount', ci.commission_amount, 'status', ci.status, 'due_date', ci.due_date) ORDER BY ci.created_at DESC)
      FROM public.commission_invoices ci
      JOIN public.payment_records pr ON pr.id = ci.payment_record_id
      WHERE pr.startup_id = _user_id OR pr.builder_id = _user_id
    ), '[]'::jsonb),
    'placement_fees', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', pf.id, 'invoice_number', pf.invoice_number,
        'fee_amount', pf.fee_amount, 'status', pf.status, 'due_date', pf.due_date) ORDER BY pf.created_at DESC)
      FROM public.placement_fees pf WHERE pf.startup_id = _user_id OR pf.builder_id = _user_id
    ), '[]'::jsonb),
    'disputes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', d.id, 'status', d.status, 'reason', d.reason,
        'contract_id', d.contract_id, 'raised_by', d.raised_by, 'created_at', d.created_at) ORDER BY d.created_at DESC)
      FROM public.disputes d
      WHERE d.raised_by = _user_id
         OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = d.contract_id AND (c.founder_id = _user_id OR c.builder_id = _user_id))
    ), '[]'::jsonb),
    'interviews', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', i.id, 'status', i.status, 'scheduled_at', i.scheduled_at,
        'founder_id', i.founder_id, 'builder_id', i.builder_id) ORDER BY i.scheduled_at DESC NULLS LAST)
      FROM public.interviews i WHERE i.founder_id = _user_id OR i.builder_id = _user_id
    ), '[]'::jsonb),
    'counts', jsonb_build_object(
      'notifications', (SELECT count(*) FROM public.notifications WHERE user_id = _user_id),
      'messages', (SELECT count(*) FROM public.messages_v2 WHERE sender_id = _user_id)
    ),
    'audit_as_actor', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'action_type', action_type, 'entity_type', entity_type,
        'entity_id', entity_id, 'metadata', metadata, 'created_at', created_at) ORDER BY created_at DESC)
      FROM (SELECT * FROM public.admin_audit_logs WHERE actor_id = _user_id ORDER BY created_at DESC LIMIT 100) sub
    ), '[]'::jsonb),
    'audit_as_entity', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'action_type', action_type, 'entity_type', entity_type,
        'actor_id', actor_id, 'actor_role', actor_role, 'metadata', metadata, 'created_at', created_at) ORDER BY created_at DESC)
      FROM (SELECT * FROM public.admin_audit_logs WHERE entity_id = _user_id ORDER BY created_at DESC LIMIT 100) sub
    ), '[]'::jsonb)
  ) INTO result;

  INSERT INTO public.admin_audit_logs (actor_id, actor_role, action_type, entity_type, entity_id, metadata)
  VALUES (auth.uid(),
    CASE WHEN public.has_role(auth.uid(),'super_admin') THEN 'super_admin' ELSE 'admin' END,
    'admin_view_user_full', 'profiles', _user_id, '{}'::jsonb);

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_user_full(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_user_full(uuid) TO authenticated;

-- Part 2B: admin_update_user_profile
CREATE OR REPLACE FUNCTION public.admin_update_user_profile(_user_id uuid, _patch jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  profile_keys text[] := ARRAY['full_name','avatar_url'];
  builder_keys text[] := ARRAY['username','title','domain','location','bio','linkedin','github','portfolio','skills','experience_level','hourly_rate','work_preference','open_to_full_time','available','verified','banner_image'];
  startup_keys text[] := ARRAY['company_name','founder_name','website','industry','stage','bio','mission','hiring_status','team_size','location','logo_url','banner_image'];
  k text;
  set_clauses text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT role::text INTO user_role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;

  -- profiles
  IF _patch ? 'full_name' THEN
    UPDATE public.profiles SET full_name = _patch->>'full_name', updated_at = now() WHERE id = _user_id;
  END IF;
  IF _patch ? 'avatar_url' THEN
    UPDATE public.profiles SET avatar_url = _patch->>'avatar_url', updated_at = now() WHERE id = _user_id;
  END IF;

  -- builder_profiles patch (only whitelisted keys)
  IF user_role = 'builder' THEN
    UPDATE public.builder_profiles SET
      username = COALESCE(_patch->>'username', username),
      title = COALESCE(_patch->>'title', title),
      domain = COALESCE(_patch->>'domain', domain),
      location = COALESCE(_patch->>'location', location),
      bio = COALESCE(_patch->>'bio', bio),
      linkedin = COALESCE(_patch->>'linkedin', linkedin),
      github = COALESCE(_patch->>'github', github),
      portfolio = COALESCE(_patch->>'portfolio', portfolio),
      experience_level = COALESCE(_patch->>'experience_level', experience_level),
      work_preference = COALESCE(_patch->>'work_preference', work_preference),
      banner_image = COALESCE(_patch->>'banner_image', banner_image),
      hourly_rate = COALESCE((_patch->>'hourly_rate')::numeric, hourly_rate),
      open_to_full_time = COALESCE((_patch->>'open_to_full_time')::boolean, open_to_full_time),
      available = COALESCE((_patch->>'available')::boolean, available),
      verified = COALESCE((_patch->>'verified')::boolean, verified),
      skills = COALESCE(CASE WHEN _patch ? 'skills' THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'skills')) END, skills),
      updated_at = now()
    WHERE id = _user_id;
  END IF;

  IF user_role = 'startup' THEN
    UPDATE public.startup_profiles SET
      company_name = COALESCE(_patch->>'company_name', company_name),
      founder_name = COALESCE(_patch->>'founder_name', founder_name),
      website = COALESCE(_patch->>'website', website),
      industry = COALESCE(_patch->>'industry', industry),
      stage = COALESCE(_patch->>'stage', stage),
      bio = COALESCE(_patch->>'bio', bio),
      mission = COALESCE(_patch->>'mission', mission),
      hiring_status = COALESCE(_patch->>'hiring_status', hiring_status),
      team_size = COALESCE(_patch->>'team_size', team_size),
      location = COALESCE(_patch->>'location', location),
      logo_url = COALESCE(_patch->>'logo_url', logo_url),
      banner_image = COALESCE(_patch->>'banner_image', banner_image),
      updated_at = now()
    WHERE id = _user_id;
  END IF;

  INSERT INTO public.admin_audit_logs (actor_id, actor_role, action_type, entity_type, entity_id, metadata)
  VALUES (auth.uid(),
    CASE WHEN public.has_role(auth.uid(),'super_admin') THEN 'super_admin' ELSE 'admin' END,
    'admin_update_user_profile', 'profiles', _user_id,
    jsonb_build_object('patch', _patch, 'role', user_role));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_user_profile(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user_profile(uuid, jsonb) TO authenticated;

-- Part 2C: admin_delete_user (DB side; removes domain data, blocks on active commitments)
CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reasons text[] := ARRAY[]::text[];
  active_contracts int;
  unsettled_payments int;
  open_disputes int;
  unpaid_invoices int;
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'super_admin only';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete yourself';
  END IF;

  SELECT count(*) INTO active_contracts FROM public.contracts
    WHERE (founder_id = _user_id OR builder_id = _user_id)
      AND status NOT IN ('cancelled','completed');
  SELECT count(*) INTO unsettled_payments FROM public.payment_records
    WHERE (startup_id = _user_id OR builder_id = _user_id)
      AND status NOT IN ('settled','cancelled');
  SELECT count(*) INTO open_disputes FROM public.disputes d
    WHERE d.status = 'open'
      AND (d.raised_by = _user_id
           OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = d.contract_id AND (c.founder_id = _user_id OR c.builder_id = _user_id)));
  SELECT count(*) INTO unpaid_invoices FROM public.commission_invoices ci
    JOIN public.payment_records pr ON pr.id = ci.payment_record_id
    WHERE (pr.startup_id = _user_id OR pr.builder_id = _user_id)
      AND ci.status IN ('generated','overdue');

  IF active_contracts > 0 THEN reasons := array_append(reasons, active_contracts||' active contract(s)'); END IF;
  IF unsettled_payments > 0 THEN reasons := array_append(reasons, unsettled_payments||' unsettled payment(s)'); END IF;
  IF open_disputes > 0 THEN reasons := array_append(reasons, open_disputes||' open dispute(s)'); END IF;
  IF unpaid_invoices > 0 THEN reasons := array_append(reasons, unpaid_invoices||' unpaid commission invoice(s)'); END IF;

  IF array_length(reasons,1) > 0 THEN
    RETURN jsonb_build_object('blocked', true, 'reasons', to_jsonb(reasons));
  END IF;

  -- snapshot for audit
  INSERT INTO public.admin_audit_logs (actor_id, actor_role, action_type, entity_type, entity_id, metadata)
  VALUES (auth.uid(),'super_admin','admin_delete_user','profiles',_user_id,
    jsonb_build_object(
      'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = _user_id),
      'role', (SELECT role::text FROM public.user_roles WHERE user_id = _user_id LIMIT 1)
    ));

  -- delete domain rows (auth.users row is removed by edge function)
  DELETE FROM public.saved_projects WHERE user_id = _user_id;
  DELETE FROM public.saved_builders WHERE user_id = _user_id OR builder_id = _user_id;
  DELETE FROM public.followed_startups WHERE follower_id = _user_id OR startup_id = _user_id;
  DELETE FROM public.payment_methods WHERE user_id = _user_id;
  DELETE FROM public.certifications WHERE builder_id = _user_id;
  DELETE FROM public.experiences WHERE builder_id = _user_id;
  DELETE FROM public.educations WHERE builder_id = _user_id;
  DELETE FROM public.notifications WHERE user_id = _user_id;
  DELETE FROM public.user_status WHERE user_id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.builder_profiles WHERE id = _user_id;
  DELETE FROM public.startup_profiles WHERE id = _user_id;
  DELETE FROM public.profiles WHERE id = _user_id;

  RETURN jsonb_build_object('blocked', false, 'deleted', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

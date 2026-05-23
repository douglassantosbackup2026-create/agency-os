
ALTER TABLE public.diagnoses
  ADD COLUMN IF NOT EXISTS buyer_user_id uuid;

ALTER TABLE public.diagnosis_secrets
  ADD COLUMN IF NOT EXISTS auto_login_token text,
  ADD COLUMN IF NOT EXISTS auto_login_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_email_lower_idx
  ON public.profiles (lower(email));

CREATE INDEX IF NOT EXISTS diagnoses_buyer_user_id_idx
  ON public.diagnoses (buyer_user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_agency_id UUID;
  agency_name TEXT;
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
  v_account_type TEXT;
BEGIN
  v_account_type := NEW.raw_user_meta_data->>'account_type';

  -- Comprador de diagnóstico: somente profile simples, sem agência/role.
  IF v_account_type = 'diagnosis_buyer' THEN
    INSERT INTO public.profiles (id, agency_id, display_name, email)
    VALUES (
      NEW.id,
      NULL,
      COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
      NEW.email
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END IF;

  agency_name := COALESCE(NEW.raw_user_meta_data->>'agency_name', split_part(NEW.email, '@', 1) || ' agency');
  base_slug := lower(regexp_replace(agency_name, '[^a-z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN base_slug := 'agency'; END IF;
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.agencies WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  INSERT INTO public.agencies (name, slug)
  VALUES (agency_name, final_slug)
  RETURNING id INTO new_agency_id;

  INSERT INTO public.profiles (id, agency_id, display_name, email)
  VALUES (NEW.id, new_agency_id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)), NEW.email);

  INSERT INTO public.user_roles (user_id, agency_id, role)
  VALUES (NEW.id, new_agency_id, 'owner');

  RETURN NEW;
END;
$function$;

-- Tabela para gerir assinaturas recorrentes do MP (Preapproval).
CREATE TABLE public.management_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id uuid NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  mp_preapproval_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  frequency integer NOT NULL DEFAULT 1,
  frequency_type text NOT NULL DEFAULT 'months',
  payer_email text,
  card_last4 text,
  next_payment_date timestamptz,
  last_charge_at timestamptz,
  last_charge_status text,
  last_event_at timestamptz,
  last_payload jsonb,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_management_subscriptions_diagnosis_id
  ON public.management_subscriptions(diagnosis_id);
CREATE INDEX idx_management_subscriptions_status
  ON public.management_subscriptions(status);

GRANT ALL ON public.management_subscriptions TO service_role;
-- sem grants a anon/authenticated: leitura pública passa pela edge function management-payment-status (service role + secret_slug)

ALTER TABLE public.management_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access management_subscriptions"
  ON public.management_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER trg_management_subscriptions_updated_at
  BEFORE UPDATE ON public.management_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela para registar cada cobrança recorrente individual (auditoria + alerts).
CREATE TABLE public.management_subscription_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.management_subscriptions(id) ON DELETE CASCADE,
  diagnosis_id uuid NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  mp_payment_id text UNIQUE,
  status text NOT NULL,
  amount_cents integer NOT NULL,
  charged_at timestamptz,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_management_subscription_charges_sub
  ON public.management_subscription_charges(subscription_id);
CREATE INDEX idx_management_subscription_charges_diagnosis
  ON public.management_subscription_charges(diagnosis_id);

GRANT ALL ON public.management_subscription_charges TO service_role;

ALTER TABLE public.management_subscription_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access management_subscription_charges"
  ON public.management_subscription_charges
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Permite distinguir assinaturas (cartão) de pagamentos únicos (Pix) na coluna existente.
COMMENT ON COLUMN public.diagnoses.management_payment_method IS
  'Método: ''card'' (assinatura recorrente via Preapproval) ou ''pix'' (1ª mensalidade única; renovação manual).';
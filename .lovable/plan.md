# Conta automática pós-pagamento + definição de senha

## Fluxo final

1. Cliente paga (cartão ou PIX) no `/checkout`.
2. Webhook do Mercado Pago confirma pagamento → cria conta no Supabase Auth.
3. Cliente é redirecionado para `/obrigado?diagnosis=…` e vê um cartão **"Defina sua senha de acesso"** já logado (via magic link/token).
4. Cliente cria senha → entra direto no diagnóstico/portal dele.

## Decisões assumidas

- Criação **após pagamento confirmado** (sem contas órfãs).
- Conta tipo **"cliente final" simples**: somente `auth.users` + linha em `profiles` com `agency_id = NULL`. Não dispara o trigger atual `handle_new_user` (que cria agência).
- E-mail duplicado → **vincula** o diagnóstico ao `user_id` existente (sem criar nova conta, sem alterar senha).
- Tela de **definir senha aparece imediatamente** no `/obrigado` (sessão já iniciada — sem precisar clicar em link do e-mail).

## Mudanças

### 1. Banco de dados
- Ajustar trigger `handle_new_user` para **pular** criação de agência quando `raw_user_meta_data->>'account_type' = 'diagnosis_buyer'`. Nesse caso só cria `profiles` (com `agency_id = NULL`, `display_name`, `email`).
- Adicionar coluna `diagnoses.buyer_user_id uuid` (nullable) para vincular o diagnóstico à conta criada.
- Índice em `profiles(email)` para lookup rápido por e-mail (case-insensitive via `lower(email)`).

### 2. Webhook (`supabase/functions/mercadopago-webhook/index.ts`)
Quando `status = approved` (ou PIX pago):
- Buscar diagnóstico pelo `mp_payment_id`.
- Procurar usuário existente por `payer_email` (via `supabaseAdmin.auth.admin.listUsers` filtrado / lookup em `profiles`).
- Se **não existe**: `supabaseAdmin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { account_type: 'diagnosis_buyer', display_name: payer_name, phone: payer_phone, cpf: payer_cpf } })`.
- Atualizar `diagnoses.buyer_user_id`.
- Gerar **action link** (`generateLink({ type: 'magiclink' })`) e guardar hash em `diagnosis_secrets` (campo novo `auto_login_token` + `auto_login_expires_at`, TTL 30 min, single-use).

### 3. Redirect pós-pagamento
- `process-diagnosis-payment` (cartão aprovado na hora) e a polling do PIX (`diagnosis-payment-status`) passam a retornar `auto_login_url` quando disponível.
- Frontend redireciona para `/obrigado?diagnosis=…&token=…` em vez do atual fluxo.

### 4. Página `/obrigado` (`src/routes/obrigado.tsx`)
- Ao carregar com `?token=…`: consumir o token via nova server fn `consume-auto-login` → chama `supabase.auth.verifyOtp({ type: 'magiclink', token_hash })` no client → sessão ativa.
- Mostrar cartão **"Defina sua senha"** (campo senha + confirmar, validação mínima 8 chars) → `supabase.auth.updateUser({ password })`.
- Após salvar: CTA "Ver meu diagnóstico" → `/diagnostico/$diagnosisId`.
- Se usuário já tinha conta (sem token de auto-login): mostrar mensagem "Compra adicionada à sua conta" + CTA "Entrar".

### 5. Acesso ao diagnóstico
- A rota `/diagnostico/$diagnosisId` passa a aceitar acesso por sessão autenticada quando `auth.uid() = diagnoses.buyer_user_id` (além do `secret_slug` atual, mantido para retrocompat).

## Pontos técnicos

- `auth.admin.createUser` precisa do **service role** — só no webhook/server fn, nunca no cliente.
- E-mail de boas-vindas do Supabase fica **desativado** para esse fluxo (passamos `email_confirm: true`) — o cliente só recebe o nosso e-mail transacional opcional (fora do escopo desta tarefa).
- Token de auto-login: 1 uso, expira em 30 min, invalidado após `updateUser({ password })`.
- Se webhook rodar 2x (retries do MP), `createUser` falha por e-mail duplicado → tratar como "já existe, vincular".

## Não incluído nesta tarefa

- E-mail de boas-vindas custom (auth email templates).
- Portal/área "Meus diagnósticos" para o comprador.
- Fluxo de upgrade do comprador para conta de agência.

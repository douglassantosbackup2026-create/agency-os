## Objetivo
Transformar `/gestao-trafego-obrigado` numa página de conversão rápida: comunicar que só há **3 vagas neste mês**, ancorar o preço em **R$ 4.997/mês** e empurrar o lead para fechar agora.

## Contexto técnico
O checkout transparente (`/gestao-checkout`) exige `diagnosisId + secretSlug` de um diagnóstico concluído. O lead que chega em `gestao-trafego-obrigado` **não tem** esses parâmetros — logo o botão principal de conversão precisa ser o **WhatsApp**, com copy de urgência + preço. (Se no futuro quiser um checkout direto sem diagnóstico, é outro escopo.)

## Alterações — arquivo único: `src/routes/gestao-trafego-obrigado.tsx`

1. **Headline / subheadline** mais assertivas:
   - H1: "Proposta recebida — falta só garantir sua vaga"
   - Sub: "Douglas abre apenas **3 vagas por mês** para operações de e-commerce que querem escalar. Já temos leads na fila — quem confirma primeiro entra."

2. **Bloco de urgência (novo, destacado)** acima do CTA:
   - Badge/pill: "Apenas 3 vagas este mês"
   - Linha de preço grande: **"R$ 4.997/mês · sem fidelidade"**
   - Micro-copy: "Onboarding em até 24h úteis após confirmação."

3. **CTA primário** (substitui o atual):
   - Label: **"Quero garantir minha vaga agora"** (ícone WhatsApp)
   - Mensagem pré-preenchida no wa.me:
     "Olá! Acabei de enviar a proposta no site e quero **garantir uma das 3 vagas deste mês** para a gestão de tráfego (R$ 4.997/mês). Podemos começar?"
   - Mantém `target="_blank"` e tracking existente.

4. **Reforço de escassez logo abaixo do botão**:
   - Linha pequena: "Vagas confirmadas por ordem de pagamento. Sem resposta em 24h = vaga liberada para o próximo."

5. **Prova rápida (opcional, 1 linha)**:
   - "ROAS médio dos últimos 6 meses: 15,59× · +R$ 30M gerenciados em escala"

6. **Manter**: link "Voltar para a página de gestão" e referência do lead.

## Fora de escopo
- Não altero `/gestao-checkout` nem a lógica de pagamento.
- Não crio fluxo de checkout sem diagnóstico (avisar se quiser esse caminho depois).
- Não mexo em outras páginas do funil.

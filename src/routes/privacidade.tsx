import { createFileRoute, Link } from "@tanstack/react-router";
import { diagnosisContactEmail } from "@/content/diagnosis-landing";

export const Route = createFileRoute("/privacidade")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Diagnóstico Meta Ads" },
      {
        name: "description",
        content:
          "Como coletamos, usamos e protegemos seus dados ao usar o Diagnóstico Meta Ads.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
});

function PrivacyPage() {
  const email = diagnosisContactEmail();
  const updatedAt = "23 de maio de 2026";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar
        </Link>
        <h1 className="mt-6 text-3xl font-semibold sm:text-4xl">
          Política de Privacidade
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: {updatedAt}
        </p>

        <div className="prose prose-neutral dark:prose-invert mt-10 max-w-none text-sm leading-relaxed">
          <h2 className="mt-8 text-xl font-semibold">1. Quem somos</h2>
          <p>
            O Diagnóstico Meta Ads é um serviço de auditoria técnica de contas
            do Meta Ads operado por Douglas Santos. Esta política descreve como
            tratamos os dados pessoais e dados de conta de anúncios coletados
            durante o uso do serviço.
          </p>

          <h2 className="mt-8 text-xl font-semibold">2. Dados que coletamos</h2>
          <ul className="list-disc pl-6">
            <li>
              <strong>Dados de pagamento:</strong> processados pelo Mercado
              Pago. Não armazenamos dados de cartão de crédito.
            </li>
            <li>
              <strong>Dados da conta Meta Ads:</strong> ao autorizar a conexão,
              acessamos apenas dados de leitura (<code>ads_read</code>) da conta
              de anúncios selecionada — métricas, estrutura de campanhas,
              criativos e configurações.
            </li>
            <li>
              <strong>Dados de contato:</strong> e-mail e telefone, quando você
              os fornece voluntariamente para suporte.
            </li>
            <li>
              <strong>Dados técnicos:</strong> logs de uso, identificadores de
              sessão e informações do dispositivo, para segurança e operação do
              serviço.
            </li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold">
            3. Como usamos seus dados
          </h2>
          <ul className="list-disc pl-6">
            <li>Gerar o diagnóstico técnico solicitado.</li>
            <li>Processar pagamentos e emitir comprovantes.</li>
            <li>Prestar suporte e responder a dúvidas.</li>
            <li>Melhorar o serviço com base em métricas agregadas.</li>
          </ul>
          <p>
            Não vendemos seus dados. Não compartilhamos dados da sua conta de
            anúncios com terceiros fora dos processadores estritamente
            necessários (Meta, Mercado Pago, provedores de infraestrutura).
          </p>

          <h2 className="mt-8 text-xl font-semibold">
            4. Base legal (LGPD)
          </h2>
          <p>
            Tratamos seus dados com base em (i) execução de contrato — para
            entregar o diagnóstico, (ii) cumprimento de obrigação legal — para
            registros fiscais, e (iii) legítimo interesse — para segurança e
            prevenção a fraude.
          </p>

          <h2 className="mt-8 text-xl font-semibold">5. Retenção</h2>
          <p>
            Dados do diagnóstico e da conta de anúncios são mantidos por até 12
            meses após a geração do relatório. Você pode solicitar a exclusão
            antes desse prazo a qualquer momento.
          </p>

          <h2 className="mt-8 text-xl font-semibold">
            6. Seus direitos
          </h2>
          <p>
            Você pode solicitar acesso, correção, exclusão, portabilidade ou
            revogação do consentimento entrando em contato pelo e-mail abaixo.
            Atendemos solicitações em até 15 dias.
          </p>

          <h2 className="mt-8 text-xl font-semibold">7. Segurança</h2>
          <p>
            Usamos criptografia em trânsito (TLS), controle de acesso baseado em
            função e isolamento por tenant. O token de acesso Meta é armazenado
            de forma cifrada e revogável a qualquer momento.
          </p>

          <h2 className="mt-8 text-xl font-semibold">
            8. Cookies
          </h2>
          <p>
            Usamos cookies essenciais para autenticação e preferências.
            Cookies analíticos só são utilizados quando estritamente
            necessários e de forma agregada.
          </p>

          <h2 className="mt-8 text-xl font-semibold">9. Contato</h2>
          <p>
            Encarregado de dados (DPO):{" "}
            {email ? (
              <a
                href={`mailto:${email}`}
                className="text-primary hover:underline"
              >
                {email}
              </a>
            ) : (
              "indisponível no momento"
            )}
            .
          </p>
        </div>

        <div className="mt-12 border-t border-border/60 pt-6 text-sm text-muted-foreground">
          Veja também:{" "}
          <Link to="/termos" className="text-primary hover:underline">
            Termos de Serviço
          </Link>
          .
        </div>
      </div>
    </div>
  );
}

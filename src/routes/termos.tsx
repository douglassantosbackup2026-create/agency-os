import { createFileRoute, Link } from "@tanstack/react-router";
import { diagnosisContactEmail } from "@/content/diagnosis-landing";
import { buildPublicPageHead } from "@/lib/site-seo";

export const Route = createFileRoute("/termos")({
  component: TermsPage,
  head: () =>
    buildPublicPageHead({
      title: "Termos de Serviço — Agency Opus",
      description:
        "Termos e condições de uso dos serviços Agency Opus, incluindo diagnóstico Meta Ads e gestão de tráfego.",
      path: "/termos",
    }),
});

function TermsPage() {
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
          Termos de Serviço
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: {updatedAt}
        </p>

        <div className="prose prose-neutral dark:prose-invert mt-10 max-w-none text-sm leading-relaxed">
          <h2 className="mt-8 text-xl font-semibold">1. Aceitação</h2>
          <p>
            Ao adquirir e utilizar o Diagnóstico Meta Ads, você concorda com
            estes Termos de Serviço e com a{" "}
            <Link to="/privacidade" className="text-primary hover:underline">
              Política de Privacidade
            </Link>
            .
          </p>

          <h2 className="mt-8 text-xl font-semibold">2. O serviço</h2>
          <p>
            O Diagnóstico Meta Ads é uma auditoria técnica automatizada,
            apoiada por IA, sobre uma conta de anúncios Meta autorizada pelo
            usuário. O resultado é um relatório com score, problemas
            identificados e plano de ação. Não há gestão ativa de campanhas.
          </p>

          <h2 className="mt-8 text-xl font-semibold">3. Preço e pagamento</h2>
          <p>
            O serviço é cobrado pelo valor exibido na página de checkout, em
            transação única, processada pelo Mercado Pago. A entrega ocorre
            após a confirmação do pagamento e da autorização de leitura na
            conta Meta.
          </p>

          <h2 className="mt-8 text-xl font-semibold">
            4. Garantia de 7 dias
          </h2>
          <p>
            Se o relatório não for útil para você, basta solicitar reembolso
            em até 7 dias após a geração do diagnóstico. Reembolso é integral
            e processado em até 7 dias úteis.
          </p>

          <h2 className="mt-8 text-xl font-semibold">5. Responsabilidades</h2>
          <ul className="list-disc pl-6">
            <li>
              Você é responsável por possuir autorização para conectar a conta
              Meta Ads analisada.
            </li>
            <li>
              O diagnóstico é uma recomendação técnica. Decisões de mídia,
              investimento e operação são de sua responsabilidade.
            </li>
            <li>
              Não garantimos resultados específicos de desempenho de campanhas
              após a aplicação das recomendações.
            </li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold">
            6. Propriedade intelectual
          </h2>
          <p>
            Os relatórios são licenciados para uso interno do contratante. É
            vedada a redistribuição comercial sem autorização expressa.
          </p>

          <h2 className="mt-8 text-xl font-semibold">7. Limitação de responsabilidade</h2>
          <p>
            Na máxima extensão permitida pela lei, a responsabilidade total do
            serviço fica limitada ao valor pago pelo diagnóstico.
          </p>

          <h2 className="mt-8 text-xl font-semibold">8. Suspensão e cancelamento</h2>
          <p>
            Podemos suspender o acesso em caso de uso indevido, fraude ou
            violação destes termos. Você pode revogar a conexão com a Meta a
            qualquer momento pelas configurações da sua conta Meta Business.
          </p>

          <h2 className="mt-8 text-xl font-semibold">9. Alterações</h2>
          <p>
            Estes termos podem ser atualizados. Alterações relevantes serão
            comunicadas por e-mail ou na própria plataforma.
          </p>

          <h2 className="mt-8 text-xl font-semibold">10. Lei aplicável</h2>
          <p>
            Estes termos são regidos pelas leis da República Federativa do
            Brasil. Fica eleito o foro do domicílio do contratante para
            dirimir quaisquer controvérsias.
          </p>

          <h2 className="mt-8 text-xl font-semibold">11. Contato</h2>
          <p>
            Dúvidas sobre estes termos:{" "}
            {email ? (
              <a
                href={`mailto:${email}`}
                className="text-primary hover:underline"
              >
                {email}
              </a>
            ) : (
              "contato indisponível no momento"
            )}
            .
          </p>
        </div>

        <div className="mt-12 border-t border-border/60 pt-6 text-sm text-muted-foreground">
          Veja também:{" "}
          <Link to="/privacidade" className="text-primary hover:underline">
            Política de Privacidade
          </Link>
          .
        </div>
      </div>
    </div>
  );
}

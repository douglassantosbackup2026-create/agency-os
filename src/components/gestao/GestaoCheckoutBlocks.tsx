import { ShieldCheck, MessageCircle, Mail, Rocket, Quote } from "lucide-react";
import {
  GESTAO_GUARANTEE,
  GESTAO_NEXT_STEPS,
  GESTAO_OPERATOR,
  GESTAO_TESTIMONIAL,
} from "@/content/gestao-checkout";

export function GestaoOperatorCard() {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
        {GESTAO_OPERATOR.initials}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight">
          {GESTAO_OPERATOR.name}
        </p>
        <p className="text-xs text-muted-foreground">{GESTAO_OPERATOR.role}</p>
        <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
          {GESTAO_OPERATOR.credentialLine}
        </p>
      </div>
    </div>
  );
}

export function GestaoSocialProof() {
  return (
    <figure className="rounded-xl border bg-card p-4">
      <Quote className="h-4 w-4 text-primary" />
      <blockquote className="mt-2 text-sm leading-relaxed">
        "{GESTAO_TESTIMONIAL.quote}"
      </blockquote>
      <figcaption className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span className="font-medium">
          {GESTAO_TESTIMONIAL.author}{" "}
          <span className="text-muted-foreground">— {GESTAO_TESTIMONIAL.role}</span>
        </span>
        <span className="font-semibold text-success">
          {GESTAO_TESTIMONIAL.metric}
        </span>
      </figcaption>
    </figure>
  );
}

export function GestaoGuaranteeBlock() {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex gap-2 text-sm">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>{GESTAO_GUARANTEE}</p>
      </div>
    </div>
  );
}

const STEP_ICONS = [Mail, MessageCircle, Rocket];

export function GestaoNextSteps() {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="text-sm font-semibold">Depois do pagamento</h3>
      <ol className="mt-3 space-y-3">
        {GESTAO_NEXT_STEPS.map((step, i) => {
          const Icon = STEP_ICONS[i] ?? Mail;
          return (
            <li key={step.title} className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{step.title}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

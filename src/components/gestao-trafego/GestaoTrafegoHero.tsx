import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, Loader2, AlertCircle, ShieldCheck, Clock, XCircle, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  landingEyebrowClass,
  landingPrimaryCtaLargeClass,
  landingSurfaceCardClass,
} from "@/lib/landing-ui";
import { form, hero } from "@/content/gestao-trafego";
import { useEcommerceLeadSubmit } from "@/hooks/use-ecommerce-lead-submit";

const FORM_ID = "lead-form";

function onlyDigits(s: string) {
  return s.replace(/\D+/g, "");
}

function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d)/, "($1) $2-$3").trim();
  return d.replace(/(\d{2})(\d{5})(\d)/, "($1) $2-$3").trim();
}

function websiteValid(v: string) {
  const trimmed = v.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("@")) return trimmed.length > 2;
  try {
    new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return true;
  } catch {
    return false;
  }
}

const step1Schema = z.object({
  phone: z.string().trim().refine((v) => onlyDigits(v).length >= 10, {
    message: form.errors.phone,
  }),
  monthlyAdBudgetRange: z.enum(["<5k", "5k-15k", "15k-50k", ">50k"], {
    message: form.errors.required,
  }),
});

const formSchema = z.object({
  name: z.string().trim().min(2, form.errors.required).max(120),
  email: z.string().trim().email(form.errors.email).max(255),
  phone: z.string().trim().refine((v) => onlyDigits(v).length >= 10, {
    message: form.errors.phone,
  }),
  storeName: z.string().trim().min(2, form.errors.required).max(120),
  website: z.string().trim().refine(websiteValid, { message: form.errors.url }),
  monthlyAdBudgetRange: z.enum(["<5k", "5k-15k", "15k-50k", ">50k"], {
    message: form.errors.required,
  }),
  challenge: z.string().trim().max(1000).optional(),
  consent: z.boolean().refine((v) => v === true, {
    message: form.errors.required,
  }),
});

type FormData = z.infer<typeof formSchema>;

export function GestaoTrafegoHero() {
  const search = useSearch({ from: "/gestao-trafego" });
  const utm = useMemo(
    () => ({
      source: String(search.utm_source ?? ""),
      campaign: String(search.utm_campaign ?? ""),
      adset: String(search.utm_adset ?? ""),
      ad: String(search.utm_ad ?? ""),
    }),
    [search],
  );
  const { submit, status } = useEcommerceLeadSubmit(utm);
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    storeName: "",
    website: "",
    monthlyAdBudgetRange: "" as FormData["monthlyAdBudgetRange"],
    challenge: "",
    consent: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [touched, setTouched] = useState<Record<keyof FormData, boolean>>({
    name: false,
    email: false,
    phone: false,
    storeName: false,
    website: false,
    monthlyAdBudgetRange: false,
    challenge: false,
    consent: false,
  });

  useEffect(() => {
    if (status.stage === "success") {
      navigate({
        to: "/gestao-trafego-obrigado",
        search: { lead: status.leadId, s: status.accessSlug },
      });
    }
  }, [status, navigate]);

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (errors[field]) {
      const copy = { ...errors };
      delete copy[field];
      setErrors(copy);
    }
  };

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = step1Schema.safeParse({
      phone: values.phone,
      monthlyAdBudgetRange: values.monthlyAdBudgetRange,
    });
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof FormData, string>> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0] as keyof FormData;
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      });
      setErrors(nextErrors);
      setTouched((prev) => ({ ...prev, phone: true, monthlyAdBudgetRange: true }));
      return;
    }
    setStep(2);
    // scroll form into view on mobile
    requestAnimationFrame(() => {
      const el = document.getElementById(FORM_ID);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof FormData, string>> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0] as keyof FormData;
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      });
      setErrors(nextErrors);
      setTouched({
        name: true,
        email: true,
        phone: true,
        storeName: true,
        website: true,
        monthlyAdBudgetRange: true,
        challenge: true,
        consent: true,
      });
      return;
    }
    await submit(parsed.data);
  };

  const isLoading = status.stage === "loading";
  const errorMessage = status.stage === "error" ? status.message : null;
  const phoneDigits = onlyDigits(values.phone);
  const phoneValid = phoneDigits.length >= 10;
  const showLowBudgetHint = values.monthlyAdBudgetRange === "<5k";

  return (
    <section id="top" className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="max-w-xl">
            <span className={landingEyebrowClass}>{hero.eyebrow}</span>
            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              {hero.headline.split(hero.headlineHighlight)[0]}
              <span className="text-primary">{hero.headlineHighlight}</span>
              {hero.headline.split(hero.headlineHighlight)[1]}
            </h1>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-success">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              {hero.microProof}
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {hero.subheadline}
            </p>
            <ul className="mt-6 space-y-3">
              {hero.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2.5 text-sm sm:text-base">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              {hero.badges.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                >
                  <Check className="h-3 w-3 text-success" aria-hidden />
                  {label}
                </span>
              ))}
            </div>
            <p className="mt-5 text-xs text-muted-foreground">{hero.footnote}</p>
          </div>

          <div id={FORM_ID} className={cn(landingSurfaceCardClass, "p-5 sm:p-6")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{form.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{form.subtitle}</p>
              </div>
              <span className="shrink-0 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {step === 1 ? form.stepLabels.one : form.stepLabels.two}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: step === 1 ? "50%" : "100%" }}
                aria-hidden
              />
            </div>

            {/* Trust badges */}
            <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
                {form.trustBadges[0].label}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-primary" aria-hidden />
                {form.trustBadges[1].label}
              </span>
              <span className="inline-flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5 text-primary" aria-hidden />
                {form.trustBadges[2].label}
              </span>
            </div>

            {errorMessage ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            ) : null}

            {step === 1 ? (
              <form onSubmit={handleContinue} className="mt-5 space-y-4" noValidate>
                <Field
                  label={form.fields.phone.label}
                  value={maskPhone(values.phone)}
                  onChange={(v) => updateField("phone", onlyDigits(v))}
                  error={touched.phone ? errors.phone : undefined}
                  placeholder={form.fields.phone.placeholder}
                  disabled={isLoading}
                  inputMode="tel"
                  autoComplete="tel"
                  valid={phoneValid}
                />
                <div className="space-y-1.5">
                  <Label htmlFor="budget">{form.fields.budget.label}</Label>
                  <Select
                    value={values.monthlyAdBudgetRange || undefined}
                    onValueChange={(v) => updateField("monthlyAdBudgetRange", v as FormData["monthlyAdBudgetRange"])}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="budget" className={cn(errors.monthlyAdBudgetRange && "border-destructive")}>
                      <SelectValue placeholder={form.fields.budget.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {form.budgetOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {touched.monthlyAdBudgetRange && errors.monthlyAdBudgetRange ? (
                    <p className="text-xs text-destructive">{errors.monthlyAdBudgetRange}</p>
                  ) : null}
                  {showLowBudgetHint ? (
                    <div className="mt-2 flex items-start gap-2 rounded-md border border-primary/25 bg-primary/[0.06] p-2.5 text-xs text-foreground/80">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                      <span>
                        {form.budgetHint.low}{" "}
                        <Link to="/" className="font-medium text-primary underline-offset-2 hover:underline">
                          Ver diagnóstico R$37
                        </Link>
                      </span>
                    </div>
                  ) : null}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={cn(landingPrimaryCtaLargeClass, "w-full")}
                >
                  <span className="inline-flex items-center gap-2">
                    {form.step1Cta}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label={form.fields.name.label}
                    value={values.name}
                    onChange={(v) => updateField("name", v)}
                    error={touched.name ? errors.name : undefined}
                    placeholder={form.fields.name.placeholder}
                    disabled={isLoading}
                    autoComplete="name"
                  />
                  <Field
                    label={form.fields.email.label}
                    type="email"
                    value={values.email}
                    onChange={(v) => updateField("email", v)}
                    error={touched.email ? errors.email : undefined}
                    placeholder={form.fields.email.placeholder}
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>

                <Field
                  label={form.fields.storeName.label}
                  value={values.storeName}
                  onChange={(v) => updateField("storeName", v)}
                  error={touched.storeName ? errors.storeName : undefined}
                  placeholder={form.fields.storeName.placeholder}
                  disabled={isLoading}
                  autoComplete="organization"
                />

                <Field
                  label={form.fields.website.label}
                  value={values.website}
                  onChange={(v) => updateField("website", v)}
                  error={touched.website ? errors.website : undefined}
                  placeholder={form.fields.website.placeholder}
                  disabled={isLoading}
                  autoComplete="url"
                />

                <div className="space-y-1.5">
                  <Label htmlFor="challenge">{form.fields.challenge.label}</Label>
                  <Textarea
                    id="challenge"
                    value={values.challenge}
                    onChange={(e) => updateField("challenge", e.target.value)}
                    placeholder={form.fields.challenge.placeholder}
                    rows={3}
                    disabled={isLoading}
                  />
                </div>

                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id="consent"
                    checked={values.consent}
                    onCheckedChange={(v) => updateField("consent", v === true)}
                    disabled={isLoading}
                    className={cn("mt-0.5", touched.consent && errors.consent && "border-destructive")}
                  />
                  <label htmlFor="consent" className="cursor-pointer text-xs leading-snug text-muted-foreground">
                    {form.consent}{" "}
                    <Link
                      to="/privacidade"
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {form.privacyLinkLabel}
                    </Link>
                    .
                  </label>
                </div>
                {touched.consent && errors.consent ? (
                  <p className="text-xs text-destructive">{errors.consent}</p>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={cn(landingPrimaryCtaLargeClass, "w-full flex-1")}
                  >
                    {isLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {hero.ctaLoading}
                      </span>
                    ) : (
                      hero.cta
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={isLoading}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-4 text-sm font-medium text-muted-foreground transition hover:bg-muted/60 disabled:opacity-50 sm:w-auto"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    {form.step2Back}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
  disabled,
  inputMode,
  autoComplete,
  valid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  inputMode?: React.HTMLProps<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  valid?: boolean;
}) {
  const id = useMemo(() => label.toLowerCase().replace(/[^a-z]+/g, "-"), [label]);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(error && "border-destructive", valid && !error && "pr-9")}
        />
        {valid && !error ? (
          <Check
            className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-success"
            aria-hidden
          />
        ) : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function scrollToLeadForm() {
  const el = document.getElementById(FORM_ID);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export const LEAD_FORM_ID = FORM_ID;

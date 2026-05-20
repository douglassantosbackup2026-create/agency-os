import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ClipboardCopy, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MetaTestSecretsConfig } from "@/types/meta";
import {
  META_TEST_SECRET_FIELDS,
  buildSupabaseSecretsCli,
  checkMetaTestSecrets,
  defaultMetaTestSecrets,
  loadMetaTestSecrets,
  metaOAuthRedirectUri,
  normalizePublicSiteUrl,
  saveMetaTestSecrets,
  validateMetaTestSecretsLocal,
} from "@/lib/meta-api-test";

type Props = {
  onSaved?: () => void;
};

export function MetaTestSecretsForm({ onSaved }: Props) {
  const [form, setForm] = useState<MetaTestSecretsConfig>(() =>
    loadMetaTestSecrets(),
  );
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [remoteMissing, setRemoteMissing] = useState<string[] | null>(null);
  const [remoteSource, setRemoteSource] = useState<string | null>(null);

  const localMissing = validateMetaTestSecretsLocal(form);
  const localOk = localMissing.length === 0;

  const refreshRemoteCheck = useCallback(
    async (config?: MetaTestSecretsConfig) => {
      setChecking(true);
      try {
        const res = await checkMetaTestSecrets(config ?? form);
        setRemoteMissing(res.missing);
        setRemoteSource(res.source);
      } catch (e) {
        setRemoteMissing(null);
        setRemoteSource(null);
        toast.error(
          e instanceof Error ? e.message : "Não foi possível validar secrets",
        );
      } finally {
        setChecking(false);
      }
    },
    [form],
  );

  useEffect(() => {
    void refreshRemoteCheck(loadMetaTestSecrets());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na montagem
  }, []);

  const update = (key: keyof MetaTestSecretsConfig, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const normalized = {
      ...form,
      public_site_url: normalizePublicSiteUrl(form.public_site_url),
    };
    const missing = validateMetaTestSecretsLocal(normalized);
    if (missing.length > 0) {
      toast.error(`Preencha: ${missing.join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      setForm(normalized);
      saveMetaTestSecrets(normalized);
      toast.success("Secrets guardados no localStorage deste browser.");
      onSaved?.();
      await refreshRemoteCheck(normalized);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyCli = async () => {
    const missing = validateMetaTestSecretsLocal(form);
    if (missing.length > 0) {
      toast.error("Complete o formulário antes de copiar os comandos CLI.");
      return;
    }
    await navigator.clipboard.writeText(buildSupabaseSecretsCli(form));
    toast.success("Comandos supabase secrets set copiados.");
  };

  const callbackUrl = metaOAuthRedirectUri();
  const publicSiteOrigin =
    normalizePublicSiteUrl(form.public_site_url) || "http://localhost:5173";
  const frontendReturnUrl = new URL(
    "/test-meta-oauth/callback",
    publicSiteOrigin,
  ).toString();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Secrets do harness</CardTitle>
          {localOk ? (
            <Badge className="bg-emerald-600 hover:bg-emerald-600">
              Formulário OK
            </Badge>
          ) : (
            <Badge variant="secondary">Incompleto</Badge>
          )}
          {remoteSource && (
            <Badge variant="outline">Edge: {remoteSource}</Badge>
          )}
        </div>
        <CardDescription>
          Cadastre aqui os valores usados pela Edge Function{" "}
          <code className="text-xs">meta-api-test</code>. Guardados em{" "}
          <code className="text-xs">localStorage</code> (só dev). Também pode
          configurar no Supabase Dashboard → Edge Functions → Secrets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {META_TEST_SECRET_FIELDS.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                type={field.type}
                value={form[field.key]}
                placeholder={field.placeholder}
                onChange={(e) => update(field.key, e.target.value)}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">{field.hint}</p>
            </div>
          ))}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="meta_api_version">
              META_API_VERSION (opcional)
            </Label>
            <Input
              id="meta_api_version"
              value={form.meta_api_version ?? "v21.0"}
              placeholder="v21.0"
              onChange={(e) => update("meta_api_version", e.target.value)}
            />
          </div>
        </div>

        <Alert>
          <AlertTitle>Redirect URI na Meta Developers</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Registe esta URL em Valid OAuth Redirect URIs:</p>
            <code className="block break-all rounded bg-muted px-2 py-1 text-xs">
              {callbackUrl}
            </code>
            <p className="text-xs text-muted-foreground">
              <strong>PUBLIC_SITE_URL</strong> = só origem{" "}
              <code className="text-xs">{publicSiteOrigin}</code> (sem path).
              Após autorizar, redirect para{" "}
              <code className="text-xs">{frontendReturnUrl}</code>.
            </p>
          </AlertDescription>
        </Alert>

        {localMissing.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>Campos em falta</AlertTitle>
            <AlertDescription>{localMissing.join(" · ")}</AlertDescription>
          </Alert>
        )}

        {remoteMissing && remoteMissing.length === 0 && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Edge Function pronta</AlertTitle>
            <AlertDescription>
              Todos os secrets reconhecidos (env Supabase e/ou formulário).
            </AlertDescription>
          </Alert>
        )}

        {remoteMissing && remoteMissing.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>Edge Function — em falta</AlertTitle>
            <AlertDescription>{remoteMissing.join(" · ")}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar secrets
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setForm(defaultMetaTestSecrets())}
          >
            Restaurar defaults
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCopyCli()}
          >
            <ClipboardCopy className="mr-2 h-4 w-4" />
            Copiar CLI Supabase
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={checking}
            onClick={() => void refreshRemoteCheck(form)}
          >
            {checking ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Verificar Edge Function
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Dispara process-diagnosis (fire-and-forget) com log em falha — não bloqueia a resposta HTTP. */
export function triggerProcessDiagnosis(source: string): void {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret) {
    console.warn(`${source}: CRON_SECRET ausente — process-diagnosis não disparado`);
    return;
  }
  const base = Deno.env.get("SUPABASE_URL")!.replace(/\/+$/, "");
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  fetch(`${base}/functions/v1/process-diagnosis`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(
          `${source}: process-diagnosis respondeu ${res.status}`,
          body.slice(0, 500),
        );
      }
    })
    .catch((err) => {
      console.error(`${source}: falha ao chamar process-diagnosis`, err);
    });
}

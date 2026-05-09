/**
 * Gera public/landing/*.webp + *.png a partir de SVG (fallback quando não há PNG brutos).
 * Para screenshots reais: copie PNGs para landing-raw-png/ e rode process-landing-screenshots.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT = path.join(process.cwd(), "public", "landing");

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

/** SVG 1600×980 — cockpit clientes */
function svgHero() {
  const rows = [
    ["Boutique Azul", "78", "0", "Sem sync"],
    ["TechFlow", "85", "0", "Sem sync"],
    ["EduMax", "76", "0", "Sem sync"],
    ["FitLife Pro", "88", "0", "Sem sync"],
    ["Casa Nova Imóveis", "72", "0", "Sem sync"],
    ["Clínica Vita", "57", "0", "Sem sync"],
  ];
  const rowY = (i) => 320 + i * 52;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="980" viewBox="0 0 1600 980">
  <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fafafa"/><stop offset="100%" stop-color="#f4f4f5"/></linearGradient></defs>
  <rect width="1600" height="980" fill="url(#bg)"/>
  <rect x="48" y="40" width="1504" height="56" rx="12" fill="#fff" stroke="#e4e4e7"/>
  <text x="72" y="78" font-family="system-ui,sans-serif" font-size="22" font-weight="700" fill="#18181b">Clientes</text>
  <text x="72" y="102" font-family="system-ui,sans-serif" font-size="13" fill="#71717a">8 cliente(s) na operação</text>
  <rect x="1320" y="52" width="200" height="36" rx="8" fill="#7c3aed"/>
  <text x="1398" y="76" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="600" fill="#fff">+ Novo cliente</text>
  <text x="1380" y="130" text-anchor="end" font-family="system-ui,sans-serif" font-size="11" fill="#a1a1aa">⌘ K · 🔔</text>
  <text x="72" y="168" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#a1a1aa" letter-spacing="0.08em">COCKPIT OPERACIONAL</text>
  <text x="72" y="194" font-family="system-ui,sans-serif" font-size="14" fill="#52525b">Health, ações abertas, último sync e auditoria IA — útil para stand-up.</text>
  <rect x="1360" y="172" width="160" height="32" rx="8" fill="#fff" stroke="#e4e4e7"/>
  <text x="1440" y="193" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="#52525b">Exportar CSV</text>
  <rect x="48" y="232" width="1504" height="700" rx="14" fill="#fff" stroke="#e4e4e7"/>
  <text x="72" y="276" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#71717a">CLIENTE</text>
  <text x="620" y="276" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#71717a">HEALTH</text>
  <text x="820" y="276" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#71717a">AÇÕES</text>
  <text x="1040" y="276" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#71717a">ÚLTIMO SYNC</text>
  <text x="1260" y="276" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#71717a">AUDITORIA IA</text>
  <line x1="56" y1="292" x2="1544" y2="292" stroke="#f4f4f5" stroke-width="2"/>
  ${rows
    .map(
      ([name, h, a, sync], i) => `
  <text x="72" y="${rowY(i) + 18}" font-family="system-ui,sans-serif" font-size="15" font-weight="600" fill="#18181b">${esc(name)}</text>
  <circle cx="632" cy="${rowY(i) + 8}" r="6" fill="${Number(h) >= 75 ? "#22c55e" : Number(h) >= 65 ? "#eab308" : "#ef4444"}"/>
  <text x="648" y="${rowY(i) + 18}" font-family="system-ui,sans-serif" font-size="14" fill="#3f3f46">${esc(h)}</text>
  <text x="820" y="${rowY(i) + 18}" font-family="system-ui,sans-serif" font-size="14" fill="#52525b">${esc(a)}</text>
  <text x="1040" y="${rowY(i) + 18}" font-family="system-ui,sans-serif" font-size="13" fill="#a1a1aa">${esc(sync)}</text>
  <text x="1260" y="${rowY(i) + 18}" font-family="system-ui,sans-serif" font-size="14" fill="#d4d4d8">—</text>
  <line x1="56" y1="${rowY(i) + 28}" x2="1544" y2="${rowY(i) + 28}" stroke="#fafafa" stroke-width="1"/>`,
    )
    .join("")}
</svg>`;
}

function svgAlerts() {
  const items = [
    ["CPA subiu acima do alvo", "Casa Nova Imóveis", "Pausar adsets ineficientes", "#3b82f6"],
    ["Criativo fadigado", "Clínica Vita", "Subir 3 novas variações", "#3b82f6"],
    ["Campanha parou de entregar", "Boutique Azul", "Verificar saldo e pixel", "#ef4444"],
    ["ROAS caiu nas últimas 48h", "FitLife Pro", "Revisar campanhas −25%", "#eab308"],
  ];
  let y = 220;
  const blocks = items
    .map(([t, c, d, col]) => {
      const block = `
  <rect x="64" y="${y}" width="1472" height="108" rx="12" fill="#fff" stroke="#e4e4e7"/>
  <circle cx="92" cy="${y + 36}" r="8" fill="${col}"/>
  <text x="116" y="${y + 40}" font-family="system-ui,sans-serif" font-size="17" font-weight="700" fill="#18181b">${esc(t)}</text>
  <text x="116" y="${y + 66}" font-family="system-ui,sans-serif" font-size="13" fill="#71717a">${esc(c)}</text>
  <text x="116" y="${y + 92}" font-family="system-ui,sans-serif" font-size="13" fill="#52525b">Detectado → ${esc(d)}</text>
  <text x="1480" y="${y + 40}" text-anchor="end" font-family="system-ui,sans-serif" font-size="12" fill="#a1a1aa">há 4min</text>`;
      y += 124;
      return block;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <rect width="1600" height="900" fill="#fafafa"/>
  <text x="64" y="72" font-family="system-ui,sans-serif" font-size="26" font-weight="700" fill="#18181b">Central de alertas</text>
  <text x="64" y="104" font-family="system-ui,sans-serif" font-size="14" fill="#71717a">15 exibidos · priorize execução rápida</text>
  <rect x="1180" y="52" width="100" height="36" rx="8" fill="#7c3aed"/>
  <text x="1230" y="76" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="600" fill="#fff">Abertos</text>
  ${blocks}
</svg>`;
}

function svgHealth() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="880" viewBox="0 0 1600 880">
  <rect width="1600" height="880" fill="#fafafa"/>
  <text x="64" y="72" font-family="system-ui,sans-serif" font-size="26" font-weight="700" fill="#18181b">Health Score</text>
  <text x="64" y="104" font-family="system-ui,sans-serif" font-size="14" fill="#71717a">Risco de churn por cliente — performance, otimização, comunicação.</text>
  <rect x="64" y="140" width="470" height="680" rx="14" fill="#fff" stroke="#fecaca"/>
  <text x="88" y="180" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#dc2626">● Alto risco · 1</text>
  <text x="88" y="230" font-family="system-ui,sans-serif" font-size="15" font-weight="600" fill="#18181b">Maré Cosméticos</text>
  <text x="88" y="256" font-family="system-ui,sans-serif" font-size="13" fill="#71717a">45 · R$ 5k MRR</text>
  <rect x="88" y="272" width="200" height="8" rx="4" fill="#fecaca"/>
  <rect x="566" y="140" width="470" height="680" rx="14" fill="#fff" stroke="#fde047"/>
  <text x="590" y="180" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#ca8a04">● Risco médio · 3</text>
  <text x="590" y="230" font-family="system-ui,sans-serif" font-size="14" fill="#3f3f46">Casa Nova · Clínica Vita · Studio</text>
  <rect x="1068" y="140" width="468" height="680" rx="14" fill="#fff" stroke="#86efac"/>
  <text x="1092" y="180" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#16a34a">● Saudáveis · 4</text>
  <text x="1092" y="230" font-family="system-ui,sans-serif" font-size="14" fill="#3f3f46">Boutique · TechFlow · EduMax · FitLife</text>
</svg>`;
}

function svgFeed() {
  const lines = [
    "Relatório semanal enviado — TechFlow",
    "Budget +20% — Studio Mídia",
    "Call de alinhamento — Clínica Vita",
    "3 criativos novos — FitLife Pro",
  ];
  let y = 200;
  const rows = lines
    .map((line, i) => {
      const r = `
  <text x="96" y="${y}" font-family="system-ui,sans-serif" font-size="15" font-weight="600" fill="#18181b">${esc(line)}</text>
  <text x="1460" y="${y}" text-anchor="end" font-family="system-ui,sans-serif" font-size="12" fill="#a1a1aa">${i === 0 ? "há 4min" : "há 1d"}</text>
  <line x1="80" y1="${y + 16}" x2="1520" y2="${y + 16}" stroke="#f4f4f5"/>`;
      y += 64;
      return r;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="780" viewBox="0 0 1400 780">
  <rect width="1400" height="780" fill="#fafafa"/>
  <text x="64" y="72" font-family="system-ui,sans-serif" font-size="26" font-weight="700" fill="#18181b">Feed operacional</text>
  <text x="64" y="104" font-family="system-ui,sans-serif" font-size="14" fill="#71717a">Histórico completo da operação.</text>
  <rect x="64" y="140" width="1272" height="580" rx="14" fill="#fff" stroke="#e4e4e7"/>
  ${rows}
</svg>`;
}

function svgOnboarding() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="920" viewBox="0 0 1400 920">
  <rect width="1400" height="920" fill="#fafafa"/>
  <text x="64" y="64" font-family="system-ui,sans-serif" font-size="24" font-weight="700" fill="#18181b">Configuração inicial</text>
  <text x="64" y="96" font-family="system-ui,sans-serif" font-size="14" fill="#71717a">Cockpit pronto em menos de 10 minutos.</text>
  <text x="64" y="140" font-family="system-ui,sans-serif" font-size="12" fill="#7c3aed" font-weight="600">1 ● 2 ○ 3 ○ 4 ○ 5 ○  Primeiro cliente → Integração → Marca → Time → Explorar</text>
  <rect x="64" y="176" width="1272" height="200" rx="12" fill="#fff" stroke="#e4e4e7"/>
  <text x="88" y="212" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="#18181b">Passo 1 · Adicione seu primeiro cliente</text>
  <rect x="88" y="236" width="320" height="40" rx="8" fill="#f4f4f5" stroke="#e4e4e7"/>
  <text x="100" y="262" font-family="system-ui,sans-serif" font-size="13" fill="#71717a">Nome do cliente *</text>
  <rect x="88" y="300" width="280" height="44" rx="8" fill="#7c3aed"/>
  <text x="228" y="328" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="600" fill="#fff">Criar cliente e ir ao cockpit →</text>
  <rect x="64" y="392" width="1272" height="120" rx="12" fill="#fff" stroke="#e4e4e7"/>
  <text x="88" y="428" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="#18181b">Passo 2 · Conecte 1 integração</text>
  <text x="88" y="454" font-family="system-ui,sans-serif" font-size="13" fill="#52525b">Meta Ads ou GA4 — uma integração já ajuda.</text>
  <rect x="64" y="528" width="1272" height="120" rx="12" fill="#fff" stroke="#e4e4e7"/>
  <text x="88" y="564" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="#18181b">Passo 3 · Marca &amp; portal white-label</text>
  <text x="88" y="592" font-family="system-ui,sans-serif" font-size="13" fill="#71717a">Portal público para o cliente acompanhar.</text>
</svg>`;
}

function svgCentralAcoes() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="760" viewBox="0 0 1400 760">
  <rect width="1400" height="760" fill="#fafafa"/>
  <text x="64" y="72" font-family="system-ui,sans-serif" font-size="26" font-weight="700" fill="#18181b">Central de Ações</text>
  <text x="64" y="104" font-family="system-ui,sans-serif" font-size="14" fill="#71717a">Priorize execução por cliente e origem (IA ou manual).</text>
  <rect x="64" y="140" width="120" height="32" rx="8" fill="#fff" stroke="#e4e4e7"/><text x="124" y="161" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="#52525b">Pendente</text>
  <rect x="196" y="140" width="140" height="32" rx="8" fill="#fff" stroke="#e4e4e7"/><text x="266" y="161" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="#52525b">Todas origens</text>
  <rect x="348" y="140" width="120" height="32" rx="8" fill="#fff" stroke="#e4e4e7"/><text x="408" y="161" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="#52525b">Cliente</text>
  <rect x="64" y="220" width="1272" height="420" rx="14" fill="#fff" stroke="#e4e4e7"/>
  <text x="700" y="450" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" fill="#a1a1aa">Nenhuma ação para os filtros.</text>
  <rect x="628" y="472" width="144" height="36" rx="8" fill="#f4f4f5" stroke="#e4e4e7"/>
  <text x="700" y="496" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" fill="#52525b">Limpar filtros</text>
</svg>`;
}

function svgRelatorios() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="780" viewBox="0 0 1400 780">
  <rect width="1400" height="780" fill="#fafafa"/>
  <text x="64" y="56" font-family="system-ui,sans-serif" font-size="22" font-weight="700" fill="#18181b">Relatórios IA</text>
  <rect x="64" y="88" width="360" height="640" rx="12" fill="#fff" stroke="#e4e4e7"/>
  <text x="88" y="124" font-family="system-ui,sans-serif" font-size="13" fill="#71717a">Período · Cliente · Busca no resumo</text>
  <rect x="88" y="520" width="300" height="44" rx="8" fill="#7c3aed"/>
  <text x="238" y="548" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="600" fill="#fff">✨ Gerar novo relatório</text>
  <rect x="448" y="88" width="888" height="640" rx="12" fill="#fff" stroke="#e4e4e7"/>
  <text x="892" y="400" text-anchor="middle" font-family="system-ui,sans-serif" font-size="15" fill="#a1a1aa">Selecione um relatório ou gere um novo</text>
</svg>`;
}

function svgIntel() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="760" viewBox="0 0 1400 760">
  <rect width="1400" height="760" fill="#fafafa"/>
  <text x="64" y="64" font-family="system-ui,sans-serif" font-size="24" font-weight="700" fill="#18181b">Inteligência de concorrentes</text>
  <text x="64" y="92" font-family="system-ui,sans-serif" font-size="13" fill="#71717a">Monitoramento com snapshots semanais.</text>
  <rect x="1120" y="48" width="200" height="40" rx="8" fill="#7c3aed"/>
  <text x="1220" y="74" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="600" fill="#fff">Rodar coleta agora</text>
  <rect x="64" y="132" width="1272" height="160" rx="12" fill="#fff" stroke="#e4e4e7"/>
  <text x="88" y="168" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#18181b">Watchlist</text>
  <text x="88" y="220" font-family="system-ui,sans-serif" font-size="14" fill="#a1a1aa">Adicione concorrentes por cliente.</text>
  <rect x="64" y="312" width="1272" height="200" rx="12" fill="#fff" stroke="#e4e4e7"/>
  <text x="88" y="352" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#18181b">Snapshots recentes</text>
  <text x="88" y="400" font-family="system-ui,sans-serif" font-size="14" fill="#a1a1aa">Sem snapshots ainda — rode a primeira coleta.</text>
</svg>`;
}

const SPECS = [
  { base: "hero-cockpit-clientes", svg: svgHero, maxW: 1600 },
  { base: "central-alertas", svg: svgAlerts, maxW: 1400 },
  { base: "health-score", svg: svgHealth, maxW: 1400 },
  { base: "feed-operacional", svg: svgFeed, maxW: 1400 },
  { base: "onboarding-config", svg: svgOnboarding, maxW: 1400 },
  { base: "central-acoes", svg: svgCentralAcoes, maxW: 1400 },
  { base: "relatorios-ia", svg: svgRelatorios, maxW: 1400 },
  { base: "intel-concorrentes", svg: svgIntel, maxW: 1400 },
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = {};

  for (const { base, svg, maxW } of SPECS) {
    const buf = Buffer.from(svg());
    const resized = sharp(buf).resize({ width: maxW, withoutEnlargement: true });
    await resized.clone().webp({ quality: 88 }).toFile(path.join(OUT, `${base}.webp`));
    await resized.clone().png({ compressionLevel: 9 }).toFile(path.join(OUT, `${base}.png`));
    const meta = await sharp(path.join(OUT, `${base}.webp`)).metadata();
    manifest[base] = {
      webp: `/landing/${base}.webp`,
      png: `/landing/${base}.png`,
      width: meta.width,
      height: meta.height,
    };
    console.log(`${base}: ${meta.width}x${meta.height}`);
  }

  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("Written public/landing/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

## Plano: Resolver erro 403 do Facebook Sharing Debugger

### Diagnóstico

Testei agora a URL pública com `User-Agent: facebookexternalhit/1.1` e o site responde **HTTP 200** (servido por Cloudflare). O 403 mostrado pelo Debugger foi provavelmente:

1. Transiente (challenge do Cloudflare antes de "aprender" o bot), **ou**
2. Causado por **falta de `robots.txt`** — o Debugger reporta isso de forma genérica como "could be due to a robots.txt block".

O projeto **não tem `public/robots.txt`** (verificado: só existem `landing/`, `manifest.webmanifest`, `sw.js`).

### Mudanças

**1. Criar `public/robots.txt`** com allow explícito para `facebookexternalhit` (e amigos):

```
User-agent: *
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: facebookcatalog
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: LinkedInBot
Allow: /

User-agent: WhatsApp
Allow: /

Sitemap: https://opus-retention-os.lovable.app/sitemap.xml
```

Isto remove qualquer ambiguidade para o crawler e satisfaz a recomendação literal da mensagem do Debugger ("allowlist facebookexternalhit").

**2. (Opcional, recomendo) Verificar OG tags em `src/routes/index.tsx`**

Para o preview do link sair bonito no Facebook/WhatsApp, a homepage deve ter no `head()`:
- `og:title`, `og:description`, `og:url`, `og:type: website`
- `og:image` (1200×630, absoluta) — sem ela o preview fica sem imagem.

Se já existem, não toco. Se faltar `og:image`, pergunto se queres gerar uma ou usar uma existente em `landing-raw-png/` / `public/landing/`.

### Próximo passo após o deploy

1. Publicar.
2. No Facebook Sharing Debugger clicar **"Extrair novamente"** (Scrape Again) — Facebook tem cache agressivo (~24h) e precisa ser forçado.
3. Confirmar 200 + preview com imagem.

### Escopo

- Cria apenas `public/robots.txt`.
- Eventualmente edita `src/routes/index.tsx` para OG tags (a confirmar contigo após eu ler o ficheiro).
- Não toca em código de runtime, server functions, ou `__root.tsx`.

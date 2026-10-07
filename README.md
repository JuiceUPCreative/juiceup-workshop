# JuiceUP Workshop

Jednoduchá webová aplikace pro workshopy. Lektor promítne QR kód, účastníci na mobilu odpoví na otázky
(vždy jedna správná odpověď) a lektor v administraci vidí, které otázky šly dobře a které hůř.

- **Účastník:** `/s/KÓD`, případně zadá kód na úvodní stránce. Nevyplňuje jméno a nemá časový limit. Vidí jednu otázku
  na obrazovce, mezi otázkami může přeskakovat tečkami a výběr může až do odeslání měnit. Rozpracované odpovědi zůstanou
  zachované i po obnovení stránky. Po odeslání uvidí doporučené odpovědi s vysvětlením.
- **Lektor:** `/admin` s jedním heslem. Spouští workshopy (otázky se kopírují z ukázkové sady nebo z předchozího
  workshopu), upravuje otázky (pořadí, texty, správná odpověď, vysvětlení) a sleduje živý souhrn: kolik lidí
  vyplňování zahájilo a kolik odeslalo, úspěšnost u jednotlivých otázek a rozložení odpovědí. Může exportovat CSV,
  uzavřít sběr a promítnout QR (zavírá se klávesou Esc). QR jde stáhnout jako SVG nebo PNG.

Každý workshop má vlastní kód, QR, kopii otázek i výsledky. Úprava jednoho workshopu proto nezmění výsledky ostatních.
Odeslání je jednorázové: opakované nebo souběžné odeslání stejného účastníka se započítá jen jednou. Správné odpovědi
a vysvětlení posílá server účastníkovi až po odeslání.

Vizuál vychází z prototypu ve složce `ChatGPT/` (tmavá `#1F1C25`, mentolová `#63E8C6`, růžová `#FF67AA`).
Logo je oficiální wordmark z juiceup.cz. Firemní písmo Europa Grotesk nahrazuje Archivo.

## Lokální vývoj

```bash
npm install
npm run dev
```

Lokálně se data ukládají do `data/db.json` a heslo do administrace je `admin` (pokud nenastavíš `ADMIN_PASSWORD`).

## Nasazení na Cloudflare Workers

Produkce: https://juiceup-workshop.engagement-2bd.workers.dev

Aplikace běží na Cloudflare Workers přes [OpenNext](https://opennext.js.org/cloudflare) a data ukládá do Cloudflare D1
(databáze `juiceup-workshop`, schéma v `migrations/`). Next.js je zafixovaný na 16.3.x, protože OpenNext zatím
nepodporuje 16.4. Režimy `cacheComponents` a PPR jsou vypnuté, protože s nimi worker na stránkách visí.

**Heslo lektora** (zadáváte ho do terminálu, do kódu se nedostane):

```bash
npx wrangler secret put ADMIN_PASSWORD
```

**Ruční nasazení:** `npm run deploy` (build, migrace D1 a nasazení).

**Automatické nasazení z GitHubu:** v Cloudflare otevřete **Workers & Pages → juiceup-workshop → Settings → Build**,
připojte repozitář `JuiceUPCreative/juiceup-workshop` (větev `main`) a nastavte:

- Build command: `npx opennextjs-cloudflare build`
- Deploy command: `npx wrangler d1 migrations apply DB --remote && npx opennextjs-cloudflare deploy`

QR kód se generuje z adresy, na které je administrace otevřená. Před promítáním proto otevřete admin na produkční
doméně, ne na `localhost`.

**Lokální test v prostředí Cloudflare:**

```bash
npx wrangler d1 migrations apply DB --local
echo 'ADMIN_PASSWORD=test' > .dev.vars
npm run preview
```

## Struktura

- `app/s/[code]`: průchod pro účastníky (`components/Quiz.tsx`)
- `app/admin`: administrace (`components/admin/*`)
- `app/api`: API (`/api/s/[code]` je veřejné, `/api/admin/*` vyžaduje přihlášení)
- `lib/store.ts`: úložiště (D1 na Cloudflare, lokálně JSON v `data/`)
- `migrations/`: schéma databáze D1
- `lib/sessions.ts`: logika workshopů a výpočet statistik

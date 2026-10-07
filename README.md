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

## Nasazení na Vercel

1. Nahraj repozitář na GitHub a v [Vercelu](https://vercel.com/new) ho importuj (framework se rozpozná sám).
2. **Databáze:** v projektu na Vercelu otevři **Storage → Create Database → Upstash for Redis** (tarif zdarma stačí)
   a připoj ji k projektu. Vercel sám přidá proměnné `KV_REST_API_URL` a `KV_REST_API_TOKEN`.
   Bez databáze by se odpovědi na Vercelu neukládaly a administrace na to upozorní.
3. **Heslo:** v **Settings → Environment Variables** přidej `ADMIN_PASSWORD` s heslem pro lektory.
4. Spusť **Redeploy**, aby se proměnné načetly.

QR kód se generuje z adresy, na které je administrace otevřená. Před promítáním proto otevři admin
na produkční doméně, ne na `localhost`.

## Proměnné prostředí

| Proměnná | Popis |
| --- | --- |
| `ADMIN_PASSWORD` | Heslo do administrace (v produkci povinné). |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis, doplní je Vercel. Alternativně `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. |

## Struktura

- `app/s/[code]`: průchod pro účastníky (`components/Quiz.tsx`)
- `app/admin`: administrace (`components/admin/*`)
- `app/api`: API (`/api/s/[code]` je veřejné, `/api/admin/*` vyžaduje přihlášení)
- `lib/store.ts`: úložiště (Redis, nebo lokální JSON)
- `lib/sessions.ts`: logika workshopů a výpočet statistik

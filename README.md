# JuiceUP Workshop

Jednoduchá webová aplikace pro workshopy. Lektor promítne QR kód, účastníci na mobilu odpoví na otázky
(vždy jedna správná odpověď) a lektor v administraci vidí, které otázky šly dobře a které hůř.

- **Účastníci:** `/s/KÓD` (nebo zadání kódu na úvodní stránce). Na konci uvidí své skóre a správné odpovědi.
- **Lektor:** `/admin`. Přihlašuje se jedním heslem. Spravuje workshopy, upravuje otázky (pořadí, texty, správná odpověď),
  sleduje živé výsledky, exportuje CSV a promítá QR kód v prezentačním režimu.

Každý workshop má vlastní kód, QR, kopii otázek i výsledky. Nový workshop jde vytvořit zkopírováním otázek z předchozího.

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

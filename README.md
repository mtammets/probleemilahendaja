# Probleemilahendaja

## Seadistus

1. Paigalda sõltuvused:

```bash
npm install
```

2. Ava Supabase SQL Editor ja käivita fail [supabase/schema.sql](/Users/marektammets/Desktop/probleemilahendaja/supabase/schema.sql).

3. Lisa vajalikud võtmed faili `.env`:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_PUBLIC_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
SUPABASE_EDITORIAL_BUCKET=editorial-media
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_MODEL=gpt-5-mini
```

Näidisväärtused on failis `.env.example`.

`OPENAI_MODEL` on valikuline. Kui seda ei lisa, kasutatakse vaikimisi `gpt-5-mini`.
`SUPABASE_SERVICE_ROLE_KEY` on vajalik selleks, et server saaks OpenAI loodud lood ja pildid kirjutada Supabase'i ning võtta avalehele sealt avaldatud sisu.

4. Käivita arendusserver:

```bash
npm run dev
```

See käivitab nüüd korraga:

- Vite frontendi aadressil `http://localhost:5173`
- OpenAI API serveri taustal pordil `8787`

5. Ava rakendus arvutis aadressil `http://localhost:5173`.
6. Ava sama rakendus telefonis sama WiFi-võrgu peal aadressil `http://SINU_ARVUTI_IP:5173`.

Mac-is saad oma lokaalse IP teada käsuga:

```bash
ipconfig getifaddr en0
```

Kui telefon ei saa ühendust, siis kontrolli, et arvuti ja telefon oleksid samas võrgus ning macOS tulemüür ei blokeeriks Node.js ühendusi.

## OpenAI raportid

- raporti sisu koostatakse serveris OpenAI Responses API kaudu
- `OPENAI_API_KEY` jääb ainult backendi ega leki brauserisse
- kui OpenAI päring ebaõnnestub, kasutab frontend olemasolevat fallback-raportit, et flow ei katkeks

## Production / build

Frontend build:

```bash
npm run build
```

Valmis buildi ja API serveri käivitamine ühest protsessist:

```bash
npm run start
```

## Päevase sisu ettevalmistus

Supabase-põhise editorial voo korral on mõistlik päeva lood ette genereerida:

```bash
npm run backfill:content
```

See loob või uuendab Supabase'is viimaste päevade kaanelood, artiklid, persoonilood, nende AI-pildid, tänase horoskoobi ja vaikimisi ilmapildi. Server teeb lisaks käivitumisel tänase numbri automaatse warmup'i, aga professionaalses seadistuses tasub see ikkagi panna cron'i või Supabase Scheduled Functioni taha.

## Mida Supabase teeb

- salvestab probleemiraportid tabelisse `reports`
- salvestab rahuloluhinnangud tabelisse `report_ratings`
- hoiab päris koguloendurit tabelis `app_metrics`
- salvestab AI-ajakirja sisu tabelisse `editorial_items`
- salvestab OpenAI genereeritud pildid Supabase Storage bucketisse `editorial-media`
- salvestab pildi metaandmed tabelisse `media_assets`
- salvestab uudiskirja liitumised tabelisse `newsletter_signups`

Kui Supabase võtmed puuduvad või SQL skeem pole veel käivitatud, töötab rakendus edasi kohaliku fallback-loogikaga.

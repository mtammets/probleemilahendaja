# Probleemilahendaja

## Seadistus

1. Paigalda sõltuvused:

```bash
npm install
```

2. Ava Supabase SQL Editor ja käivita fail [supabase/schema.sql](/Users/marektammets/Desktop/probleemilahendaja/supabase/schema.sql).

Kui sul on andmebaas juba varasemast püsti, siis käivita lisaks fail [supabase/add-interview-workflow.sql](/Users/marektammets/Desktop/probleemilahendaja/supabase/add-interview-workflow.sql), et lisada intervjuu-flow tabelid ja private upload bucket.

3. Lisa vajalikud võtmed faili `.env`:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_PUBLIC_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
SUPABASE_EDITORIAL_BUCKET=editorial-media
SUPABASE_INTERVIEW_BUCKET=interview-uploads
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_MODEL=gpt-5-mini
OPENAI_INTERVIEWER_MODEL=gpt-4.1
OPENAI_INTERVIEW_STORY_MODEL=gpt-4.1
RESEND_API_KEY=YOUR_RESEND_API_KEY
RESEND_FROM_EMAIL=Probleemilahendaja <onboarding@yourdomain.com>
ADMIN_ACCESS_CODE=CHANGE_ME
APP_BASE_URL=https://YOUR_PUBLIC_DOMAIN
VITE_ENABLE_ADVANCED_PROBLEM_STATS_RPC=false
VITE_ENABLE_SUPABASE_REALTIME=false
VITE_ENABLE_BROWSER_GEOLOCATION=false
```

Näidisväärtused on failis `.env.example`.

`OPENAI_MODEL` on valikuline. Kui seda ei lisa, kasutatakse vaikimisi `gpt-5-mini`.
`SUPABASE_SERVICE_ROLE_KEY` on vajalik selleks, et server saaks OpenAI loodud lood ja pildid kirjutada Supabase'i ning võtta avalehele sealt avaldatud sisu.
`ADMIN_ACCESS_CODE` kaitseb admin-vaadet.
`RESEND_API_KEY` ja `RESEND_FROM_EMAIL` on vajalikud siis, kui tahad intervjuu linke päriselt e-postiga välja saata. Kui need puuduvad, genereerib admin ikkagi kopeeritava lingi.
`APP_BASE_URL` peaks viitama sinu avalikule domeenile, et meilides läheks välja õige intervjuu link.
`VITE_ENABLE_ADVANCED_PROBLEM_STATS_RPC` lülitab sisse kaks lisastatistika RPC-d (`get_problem_category_trends`, `get_problem_time_segments`). Hoia see `false`, kuni need funktsioonid on sinu Supabase projektis päriselt loodud.
`VITE_ENABLE_SUPABASE_REALTIME` lülitab sisse Supabase realtime websocketi. Hoia see `false`, kui Realtime pole sinu projektis seadistatud või tahad brauserikonsooli puhtana hoida.
`VITE_ENABLE_BROWSER_GEOLOCATION` lubab avalehel kasutada seadme asukohta ilma jaoks. Vaikimisi kasutatakse Tallinna, et vältida automaatseid geolokatsioonihoiatusi ja õiguste küsimist.

4. Käivita arendusserver:

```bash
npm run dev
```

See käivitab nüüd korraga:

- Vite frontendi aadressil `http://localhost:5173`
- OpenAI API serveri taustal pordil `8787`

5. Ava rakendus arvutis aadressil `http://localhost:5173`.
6. Ava sama rakendus telefonis sama WiFi-võrgu peal aadressil `http://SINU_ARVUTI_IP:5173`.

Admin-vaade on aadressil `http://localhost:5173/admin.html`.
Intervjuu avalik leht on aadressil `http://localhost:5173/interview.html?token=...`.

Mac-is saad oma lokaalse IP teada käsuga:

```bash
ipconfig getifaddr en0
```

Kui telefon ei saa ühendust, siis kontrolli, et arvuti ja telefon oleksid samas võrgus ning macOS tulemüür ei blokeeriks Node.js ühendusi.

## OpenAI raportid

- raporti sisu koostatakse serveris OpenAI Responses API kaudu
- `OPENAI_API_KEY` jääb ainult backendi ega leki brauserisse
- kui OpenAI päring ebaõnnestub, kasutab frontend olemasolevat fallback-raportit, et flow ei katkeks

## Intervjuu-workflow

Uus workflow töötab nii:

1. ava `admin.html` ja logi sisse `ADMIN_ACCESS_CODE` abil
2. loo uus intervjuu e-posti aadressiga
3. saada link Resendiga või kopeeri genereeritud link käsitsi
4. intervjueeritav avab `interview.html?token=...`, vastab AI-ajakirjanikule ja laadib lõpus üles 2 pilti
5. süsteem genereerib persona-loo mustandi
6. admin vaatab mustandi üle, salvestab vajadusel muudatused ja avaldab loo

Avaldamisel kirjutatakse lugu olemasolevasse `editorial_items` tabelisse `daily_persona` tüübina, nii et see ilmub automaatselt avalehe persoonilugude voogu.

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
- salvestab intervjuu kutsed, vestlused ja mustandid tabelitesse `interviews`, `interview_messages`, `interview_assets`
- hoiab intervjuu käigus üles laaditud pildid private bucketis `interview-uploads`

Kui Supabase võtmed puuduvad või SQL skeem pole veel käivitatud, töötab rakendus edasi kohaliku fallback-loogikaga.

import "dotenv/config";
import express from "express";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { Resend } from "resend";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerInterviewWorkflow } from "./interview-workflow.mjs";
import {
    GENERAL_PROBLEM_CATEGORY,
    PROBLEM_CATEGORY_LABELS,
    resolveProblemCategory
} from "./problem-categories.mjs";
import { extractAiBillingSnapshot } from "./ai-costs.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const isProduction = process.argv.includes("--production");
const port = Number(process.env.PORT || 8787);
const openAiModel = process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";
const publicFeedModel = process.env.OPENAI_PUBLIC_FEED_MODEL?.trim() || openAiModel;
const articleModel = process.env.OPENAI_ARTICLE_MODEL?.trim() || "gpt-4.1";
const personaModel = process.env.OPENAI_PERSONA_MODEL?.trim() || "gpt-4.1";
const horoscopeModel = process.env.OPENAI_HOROSCOPE_MODEL?.trim() || openAiModel;
const weatherModel = process.env.OPENAI_WEATHER_MODEL?.trim() || openAiModel;
const interviewerModel = process.env.OPENAI_INTERVIEWER_MODEL?.trim() || "gpt-4.1";
const interviewStoryModel = process.env.OPENAI_INTERVIEW_STORY_MODEL?.trim() || personaModel;
const imageModel = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";
const appTimeZone = process.env.APP_TIMEZONE?.trim() || "Europe/Tallinn";
const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim() || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
const editorialBucketName = process.env.SUPABASE_EDITORIAL_BUCKET?.trim() || "editorial-media";
const interviewUploadBucketName = process.env.SUPABASE_INTERVIEW_BUCKET?.trim() || "interview-uploads";
const openAiApiKey = process.env.OPENAI_API_KEY?.trim() || "";
const resendApiKey = process.env.RESEND_API_KEY?.trim() || "";
const resendFromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "";
const appBaseUrl = process.env.APP_BASE_URL?.trim() || "";
const adminAccessCode = process.env.ADMIN_ACCESS_CODE?.trim() || "";
const client = openAiApiKey ? new OpenAI({ apiKey: openAiApiKey }) : null;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
    ? createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    })
    : null;
const recentProblemReports = [];
const recentProblemDetailCache = new Map();
const dailyCoverStoryCachePath = path.join(__dirname, ".cache", "daily-cover-stories.json");
const dailyArticleCachePath = path.join(__dirname, ".cache", "daily-articles.json");
const dailyHoroscopeCachePath = path.join(__dirname, ".cache", "daily-horoscope.json");
const dailyWeatherCachePath = path.join(__dirname, ".cache", "daily-weather.json");
const newsletterSignupsCachePath = path.join(__dirname, ".cache", "newsletter-signups.json");
const generatedCoverStoryDir = path.join(__dirname, ".cache", "cover-stories");
const generatedWeatherSceneDir = path.join(__dirname, ".cache", "weather-scenes");
const RECENT_PROBLEMS_LIMIT = 6;
const DAILY_COVER_STORY_ARCHIVE_LIMIT = 10;
const DAILY_ARTICLE_ARCHIVE_LIMIT = 10;
const DAILY_ARTICLE_PUBLIC_LIMIT = 8;
const DAILY_COVER_STORY_STYLE_VERSION = 1;
const DAILY_ARTICLE_STYLE_VERSION = 6;
const DAILY_PERSONA_ARCHIVE_LIMIT = 10;
const DAILY_PERSONA_PUBLIC_LIMIT = 8;
const DAILY_PERSONA_STYLE_VERSION = 8;
const DAILY_HOROSCOPE_STYLE_VERSION = 4;
const DAILY_WEATHER_STYLE_VERSION = 2;
const DAILY_WEATHER_CACHE_LIMIT = 24;
const EDITORIAL_WARMUP_INTERVAL_MS = 30 * 60 * 1000;
const WEATHER_FORECAST_DAYS = 5;
const WEATHER_TIMELINE_HOUR_TARGETS = [6, 9, 12, 15, 18, 21];
const WEATHER_API_BASE_URL = "https://api.open-meteo.com/v1/forecast";
const WEATHER_REVERSE_GEOCODE_URL = "https://nominatim.openstreetmap.org/reverse";
const WEATHER_DEFAULT_LOCATION = {
    label: "Tallinn",
    latitude: 59.437,
    longitude: 24.7536
};
const WEATHER_LOCATION_PLACEHOLDERS = new Set([
    "sinu asukoht",
    "seadme asukoht",
    "your location",
    "current location",
    "my location"
]);
const NEWSLETTER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const PUBLIC_FEED_TEXT_LIMIT = 180;
const PUBLIC_PROBLEM_DETAIL_TEXT_LIMIT = 3200;
const PUBLIC_PROBLEM_RESOLUTION_TEXT_LIMIT = 520;
const RECENT_PROBLEM_RESOLUTION_STYLE_VERSION = 2;
const PUBLIC_FEED_FALLBACK_TEXT = "Üks terava sõnastusega probleem sai lahendatud.";
const PUBLIC_PROBLEM_DETAIL_FALLBACK_TEXT = "Kasutaja kirjeldas teravat olukorda, mille täispikk sõnastus vajas avaliku vaate jaoks toimetamist.";
const PUBLIC_PROBLEM_RESOLUTION_FALLBACK_TEXT = "See teema ei suru enam peale ja asemele on tulnud palju kergem tunne.";
const PUBLIC_FEED_PROFANITY_REGEX = /\b(?:pers(?:e|se|es|et|ed|ega|ele|el|esse|est|i)?|t(?:ü|y)r(?:a|ad|aga|ale|al|ast|i)?|munn(?:i|e|id|idega|ile|il|ist)?|vitt(?:u|i|e|ud|idega|ile|is|a)?|niku(?:da|n|d|b|s|tud|ga|le)?|pask(?:a|e|i|aks|aga|ale|as|ast|u)?|sit(?:t|a|ad|ane|ase|aks|aga|ale|as|ast)?|hui(?:a|i|d|ga|le|s)?|fuck(?:ing|ed|er|s)?|shit(?:ty|ted|ting|s)?)\b/giu;
const DAILY_ARTICLE_SOFT_LANGUAGE_REGEX = /\b(?:teekond|hingetõmme|maagia|inspireer|sisemine|süda|hing|transform|muudab kõik|unelmate|täiuslik)\b/iu;
const EDITORIAL_STATUS_PUBLISHED = "published";
const RETRIABLE_NETWORK_ERROR_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNABORTED", "EPIPE", "UND_ERR_SOCKET"]);
const EDITORIAL_PROMPT_VERSIONS = {
    problem_report: "problem-report-v1",
    problem_public_feed: "problem-public-feed-v1",
    problem_public_detail: "problem-public-detail-v1",
    problem_resolution_public: "problem-resolution-public-v1",
    daily_cover_story: "daily-cover-story-v1",
    daily_cover_story_image: "daily-cover-story-image-v1",
    daily_article: "daily-article-v1",
    daily_persona: "daily-persona-v1",
    daily_horoscope: "daily-horoscope-v1",
    daily_weather: "daily-weather-v1",
    daily_persona_image: "daily-persona-image-v1",
    daily_weather_image: "daily-weather-image-v1",
    interview_opening: "interview-opening-v1",
    interview_turn: "interview-turn-v1",
    interview_story: "interview-story-v1"
};
let dailyCoverStories = [];
let dailyCoverStoriesLoaded = false;
let dailyCoverStoryGenerationPromises = new Map();
let dailyArticles = [];
let dailyArticlesLoaded = false;
let dailyArticleGenerationPromise = null;
let dailyPersonas = [];
let dailyPersonasLoaded = false;
let dailyHoroscope = null;
let dailyHoroscopeLoaded = false;
let dailyHoroscopeGenerationPromise = null;
let dailyWeatherEntries = [];
let dailyWeatherLoaded = false;
let dailyWeatherWritePromise = Promise.resolve();
let newsletterSignups = [];
let newsletterSignupsLoaded = false;
let newsletterSignupsWritePromise = Promise.resolve();
const dailyWeatherGenerationPromises = new Map();
const weatherSceneGenerationPromises = new Map();
const weatherScenePublicUrlCache = new Map();
const weatherLocationLabelCache = new Map();
let editorialWarmupPromise = null;
let lastEditorialWarmupDateKey = "";

const DAILY_ARTICLE_THEMES = [
    {
        label: "Tühi sein",
        prompt: "kuidas tühi või poolik sein jätab toa lõpetamata ja miks üks tugev teos tõmbab ruumi kokku",
        lenses: ["Ruumitunne", "Fookus", "Valmisolek"],
        fallback: {
            title: "Miks tühi sein jätab toa pooleli",
            lead: "Tuba võib olla sisustatud, aga ikkagi lõpetamata. Sageli ei puudu uus mööbel, vaid üks kindel põhjus, miks pilk seinal peatuks.",
            highlight: "Kui seinal pole raskuskeset, jääb ka tuba ise veidi lahti.",
            paragraphs: [
                "Paljud ruumid ei mõju poolikult mitte seetõttu, et neis oleks liiga vähe asju, vaid seetõttu, et midagi ei seo neid visuaalselt kokku. Diivan, laud ja valgusti on olemas, aga pilk ei peatu kusagil piisavalt kaua, et ruum hakkaks tervikuna tööle.",
                "Seinakunst lahendab selle probleemi ootamatult praktilisel viisil. Kui üks pind saab lõpuks selge rõhuasetuse, muutub kohe ka ülejäänud ruum loetavamaks. Asjad ei tundu enam lihtsalt paigutatud, vaid omavahel seotud.",
                "Just sellepärast on Lorien Velmore'i teosed rohkem kui dekoratsioon. Need töötavad ruumis nagu viimane otsus, mis lõpetab poolelioleva lause. Tuba ei muutu tingimata uhkemaks, vaid terviklikumaks.",
                "Selle mõju on väike, aga väga tuntav. Kui üks sein saab põhjuse olemas olla, väheneb ka see hajus tunne, et kodus oleks justkui midagi veel puudu."
            ],
            bannerNote: "Lorien Velmore sobib siia just selleks hetkeks, kus tuba on valmis, aga sein veel mitte.",
            takeaways: ["Sein saab fookuse", "Tuba tundub valmis", "Pilk jääb pidama"],
            readingTime: "4 min lugemine"
        }
    },
    {
        label: "Pärast remonti",
        prompt: "miks valmis remonditud tuba võib ikkagi jääda iseloomuta ja kuidas kunst annab viimase vajaliku kihi",
        lenses: ["Karakter", "Tasakaal", "Kodu"],
        fallback: {
            title: "Miks värskelt tehtud tuba võib jääda külmaks",
            lead: "Pärast remonti on ruum korras, aga mitte alati päriselt kohal. Kui pinnad on uued, tuleb nähtavale järgmine probleem: iseloomu puudus.",
            highlight: "Valmis pind ei ole veel sama asi kui valmis ruum.",
            paragraphs: [
                "Remont lahendab tavaliselt tehnilised küsimused. Seinad saavad värvi, valgus paika ja mööbel oma koha. Aga kui tolm on pühitud, võib jääda alles üllatav tühjus: kõik on justkui õige, kuid miski ei anna toale oma nägu.",
                "See juhtub sageli siis, kui ruum jääb ainult taustaks. Hea tuba vajab midagi, mis ei täida lihtsalt seina, vaid loob tooni. Üks läbimõeldud teos võib teha selle töö vaiksemalt kui ükski lisamööbliese.",
                "Lorien Velmore'i maailm töötab siin hästi just oma vaoshoituse tõttu. Teos ei pressi end ruumis ette, vaid paneb ülejäänud elemendid paremini koos kõlama. See on rohkem tooniandja kui trikk.",
                "Kui ruum tahab pärast remonti veel üht otsust, siis enamasti ei ole see uus lamp või uus riiul. Sageli on see üks pilt, mis ütleb lõpuks ära, millise koduga on tegu."
            ],
            bannerNote: "Kui tuba on remonditud, aga mitte veel oma, siis teos võib olla see viimane vajalik kiht.",
            takeaways: ["Pind saab iseloomu", "Ruum ei jää steriilseks", "Kodu tundub oma"],
            readingTime: "4 min lugemine"
        }
    },
    {
        label: "Kink ilma piinata",
        prompt: "miks läbimõeldud kunstiteos lahendab kinkimise probleemi paremini kui järjekordne neutraalne ese",
        lenses: ["Kinkimine", "Mälu", "Mõte"],
        fallback: {
            title: "Hea kingitus ei pea olema järjekordne ese",
            lead: "Kõige tüütum kinkimise probleem ei ole hind, vaid tähendus. Midagi tuleb leida inimesele, kellel näib juba kõik olemas olevat.",
            highlight: "Kõige parem kink ei täida sahtlit, vaid jääb ruumi elama.",
            paragraphs: [
                "Enamik viimase hetke kingitusi kukub läbi samal põhjusel: need on küll viisakad, aga vahetatavad. Küünal, tass või pudel teeb oma töö ära, kuid kaob kiiresti teiste samasuguste asjade sekka.",
                "Seetõttu töötab kunst kinkimisena teistsugusel tasandil. See ei ole tarbeasi, mida kasutatakse ära, vaid ese, mis jääb nähtavale ja hakkab ajapikku inimese kodu osaks. Hea valik meenub uuesti iga kord, kui pilk sellele langeb.",
                "Lorien Velmore'i teoste tugevus on selles, et need mõjuvad kingitusena isiklikult ilma liiga otsese seletamiseta. Need ei karju, vaid jäävad kestma. See teeb neist palju tugevama valiku kui mis tahes neutraalse viisakusostu.",
                "Kui kinkimine tundub keeruline, siis enamasti otsitakse mitte asja, vaid tunnet, et valik oli läbimõeldud. Kunst annab selle tunde palju kindlamini kui järjekordne ese, mis täidab ainult kohustuse."
            ],
            bannerNote: "Kui küsimus on, mida kinkida inimesele, kellele ei taha osta lihtsalt järjekordset eset, siis siit algab palju tugevam vastus.",
            takeaways: ["Kingitus jääb nähtavale", "Valik mõjub isiklikult", "Ese ei kao ära"],
            readingTime: "4 min lugemine"
        }
    },
    {
        label: "Üürikodu oma nägu",
        prompt: "kuidas ajutine elukoht saab tunda vähem juhuslik, kui ruumi tuleb üks selge isiklik märk",
        lenses: ["Ajutisus", "Omatunne", "Rütm"],
        fallback: {
            title: "Kuidas üürikodu vähem ajutiseks muuta",
            lead: "Ajutine kodu ei pea mõjuma ajutiselt. Sageli piisab ühest nähtavast otsusest, et ruum hakkaks lõpuks sinu moodi kõlama.",
            highlight: "Ajutisus väheneb siis, kui ruumis on midagi, mis on selgelt sinu valik.",
            paragraphs: [
                "Üürikodu kõige tüütum probleem on see, et kõik vajalik võib olla olemas, aga miski ei kinnita, et see koht päriselt kuulub sinu ellu. Mööbel on neutraalne, seinad viisakad ja üldmulje talutav, kuid side ruumiga jääb õhukeseks.",
                "Seda ei lahenda alati suur ümbertegemine. Tihti piisab ühest tugevast visuaalsest märgist, mis näitab, et keegi on siin teinud teadliku valiku. Just seepärast töötab kunst ajutises kodus nii hästi.",
                "Lorien Velmore'i teos annab üürikodule midagi, mida standardlahendused ei anna: isikliku raskuskeskme. See ei nõua kapitaalset muutust, aga muudab taju sellest, kelle ruum see on.",
                "Kui kodu tundub liiga neutraalne, siis probleem ei ole enamasti ruutmeetrites. Probleem on selles, et ruumis puudub nähtav otsus. Kunst võib olla kõige lihtsam viis see otsus lõpuks teha."
            ],
            bannerNote: "Üürikodus ei saa alati kõike muuta, aga ühe seina saab panna selgelt enda kasuks tööle.",
            takeaways: ["Ajutisus väheneb", "Ruum tundub oma", "Sein annab märgi"],
            readingTime: "4 min lugemine"
        }
    },
    {
        label: "Töötoa fookus",
        prompt: "kuidas visuaalne rahutus või tühjus töönurgas hajutab tähelepanu ja miks üks teos võib ruumi paremini paika panna",
        lenses: ["Fookus", "Rahutus", "Keskkond"],
        fallback: {
            title: "Hea töönurk ei vaja rohkem asju",
            lead: "Kui töönurk ei toeta keskendumist, on probleem harva ainult lauas. Sageli on küsimus hoopis selles, millise tooniga ruum sind vastu vaatab.",
            highlight: "Fookus ei sõltu ainult ülesannetest, vaid ka sellest, mida ruum kogu aeg kaasa räägib.",
            paragraphs: [
                "Kodune töökoht kipub minema kahte äärmusesse. Kas on seda liiga palju täis või siis nii tühi, et see ei anna mingit tunnet, mille sees töötada. Mõlemal juhul jääb ruum ise tähelepanu hajutama.",
                "Hea teos ei lahenda tööpäeva sinu eest, aga ta võib lahendada ruumi ühe olulise vea. Kui ümbrus on visuaalselt paigas, ei pea aju kogu aeg tegelema taustaga, mis tundub juhuslik või lõpetamata.",
                "Lorien Velmore'i teosed mõjuvad siin hästi, sest need on piisavalt selged, et ruumi raamida, ja piisavalt vaoshoitud, et mitte hakata ise tööd segama. See on oluline vahe dekoratsiooni ja päriselt toimiva ruumimärgi vahel.",
                "Kui töönurk ei tundu kunagi päriselt valmis, ei tasu alati lisada uut korraldajat või valgustit. Vahel on probleem hoopis selles, et ruumil puudub üks kindel keskpunkt."
            ],
            bannerNote: "Kui töökoht on funktsionaalne, aga mitte veel paigas, siis just siin saab üks teos teha rohkem kui uus organiseerimiskarp.",
            takeaways: ["Ruum rahuneb", "Fookus püsib kauem", "Taust ei sega"],
            readingTime: "4 min lugemine"
        }
    },
    {
        label: "Esimene mulje",
        prompt: "kuidas esik või elutuba mõjutab esimese mulje kvaliteeti ja miks üks teos võib ruumi hetkega täpsemaks muuta",
        lenses: ["Mulje", "Toon", "Vastuvõtt"],
        fallback: {
            title: "Esimene mulje sünnib tihti ühe seina peal",
            lead: "Külalise esimene tunne kodust tekib kiiremini, kui omanik märkab. Sageli otsustab selle üks vaade, mis ütleb kohe ära ruumi tooni.",
            highlight: "Kui sisse astudes pole midagi, mis ruumi kokku tõmbaks, hajub mulje laiali.",
            paragraphs: [
                "Esik ja elutuba on kodu kõige nähtavamad kohad, aga just need jäävad sageli viimaseks. Kõik põhiline on olemas, kuid ruum ei tee veel seda tööd, mida ta peaks: ta ei loo kohe üht selget tunnet.",
                "See tunne ei teki tavaliselt detailide kuhjamisest. Vastupidi, liiga palju väikseid signaale teeb mulje hajusaks. Üks tugev teos töötab paremini, sest annab pilgule koha, kuhu pidama jääda.",
                "Lorien Velmore sobib sellesse rolli hästi, sest selle visuaalne keel on piisavalt tugev, et jätta märk, aga piisavalt puhas, et mitte hakata ruumi enda eest rääkima. See aitab kodul mõjuda läbimõeldult, mitte üles ehitatud muljena.",
                "Kui kodu jätab liiga neutraalse või juhusliku esmamulje, ei ole vaja kõike ümber teha. Väga sageli piisab ühest hästi valitud teosest, mis paneb ülejäänud ruumi ühte rütmi."
            ],
            bannerNote: "Kui probleem on, et kodu ei jäta saabudes mingit tunnet, siis üks tugev teos võib selle muuta kohe esimesel pilgul.",
            takeaways: ["Mulje muutub selgeks", "Ruum saab tooni", "Kodu tundub läbimõeldud"],
            readingTime: "4 min lugemine"
        }
    }
];

const DAILY_COVER_STORY_THEMES = [
    {
        label: "Pärast remonti",
        prompt: "kaanelugu inimesest, kelle kodu jäi pärast remonti korralik, aga siiski iseloomuta, kuni üks visuaalne otsus pani ruumi tööle",
        fallback: {
            subjectName: "Helena Saar",
            title: "Ta ei vajanud uut lampi",
            summary: "Pärast pikka remonti selgus, et ruum ei vajanud enam uut eset, vaid üht otsust, mis annaks kõigele näo.",
            photoBrief: "Create a premium horizontal editorial cover portrait of a believable Estonian woman in her late thirties inside a refined contemporary apartment. Keep the upper left area visually calm for masthead placement, place the subject on the right half, and let the mood feel warm, assured and modern."
        }
    },
    {
        label: "Ajutine kodu",
        prompt: "kaanelugu inimesest, kes muutis ajutise üürikodu ühe selge teosega vähem juhuslikuks ja rohkem enda omaks",
        fallback: {
            subjectName: "Liis Pärn",
            title: "Ajutine kodu jäi lõpuks meelde",
            summary: "Kui kõik oluline oli juba olemas, muutis ühe seina otsus ruumi lõpuks kohaks, kuhu oli päriselt hea tagasi tulla.",
            photoBrief: "Create a premium horizontal editorial cover portrait of a believable Estonian woman in her early forties in a tasteful rental apartment with subtle lived-in detail. Leave generous quiet space in the upper left for a magazine masthead and keep the subject confidently on the right half."
        }
    },
    {
        label: "Kingitus ilma piinata",
        prompt: "kaanelugu inimesest, kes leidis lõpuks kingituse, mis ei mõjunud järjekordse viisakusostuna, vaid jäi ruumi päriselt elama",
        fallback: {
            subjectName: "Maarja Teder",
            title: "Hea kingitus ei täitnud sahtlit",
            summary: "Kui tavapärane kinkimine hakkas väsitama, osutus tugevaks vastuseks ese, mis jäi nähtavale ja meenutas end iga päev.",
            photoBrief: "Create a premium horizontal editorial cover portrait of a believable Estonian woman in her thirties in a calm stylish apartment interior, as if photographed for a design and lifestyle magazine. Keep the left upper quadrant quiet and elegant, with the subject on the right half."
        }
    },
    {
        label: "Töönurga fookus",
        prompt: "kaanelugu inimesest, kelle töönurk oli funktsionaalne, aga hajus, kuni üks visuaalne keskpunkt pani ruumi toetama keskendumist",
        fallback: {
            subjectName: "Karl Sild",
            title: "Taust ei seganud enam tööd",
            summary: "Mõnikord ei vaja töönurk rohkem organiseerimist, vaid üht selget raskuskeset, mis rahustab kogu ülejäänud ruumi.",
            photoBrief: "Create a premium horizontal editorial cover portrait of a believable Estonian man in his late thirties in a refined work corner inside a real home. Keep the top left quadrant calm for magazine typography and place the subject on the right with generous framing."
        }
    },
    {
        label: "Esimene mulje",
        prompt: "kaanelugu inimesest, kelle kodu ei jätnud varem saabudes mingit tunnet, kuni üks tugev teos pani esimese mulje tööle",
        fallback: {
            subjectName: "Kristel Vaher",
            title: "Sisse astudes oli lõpuks tunne",
            summary: "Kõik vajalik oli olemas, aga alles üks täpne visuaalne otsus muutis saabumise juhuslikust läbimõelduks.",
            photoBrief: "Create a premium horizontal editorial cover portrait of a believable Estonian woman in her forties near the entrance or living area of a contemporary apartment. The image should feel like a major magazine cover, with clean space in the upper left and the subject framed on the right."
        }
    },
    {
        label: "Tühi sein",
        prompt: "kaanelugu inimesest, kelle kodus kadus poolik tunne siis, kui tühi sein sai lõpuks põhjuse olemas olla",
        fallback: {
            subjectName: "Rasmus Oja",
            title: "Poolik tunne kadus seinaga koos",
            summary: "Kui pilgul polnud varem põhjust peatuda, andis üks tugev teos tervele ruumile korraga rohkem selgust ja raskust.",
            photoBrief: "Create a premium horizontal editorial cover portrait of a believable Estonian man in his thirties inside a tasteful apartment with wall art presence and warm daylight. Reserve the upper left for masthead space and keep the subject on the right half, fully inside frame."
        }
    }
];

const DAILY_PERSONA_THEMES = [
    {
        label: "Töö ja tempo",
        prompt: "fiktiivne, aga usutav persoonilugu inimesest, kelle peas keerles liiga palju tööga seotud lahtisi otsi korraga",
        fallback: {
            characterName: "Kärt",
            characterMeta: "34, pagar Viljandist",
            title: "Kärt ei vajanud uut süsteemi, vaid üht selget lauset",
            lead: "Kõige raskem polnud töö maht, vaid see, et ükski lahtine ots ei seisnud lõpuni paigal.",
            highlight: "Kui probleem sai lõpuks õigesti sõnastatud, muutus ka tööpäev kohe lühemaks.",
            resultNote: "Probleemilahendaja aitas Kärdil valida ühe teema, mille lõpetamine vabastas korraga rohkem ruumi kui kolm uut to-do listi.",
            paragraphs: [
                "Kärt kirjeldas oma nädalat kaua lihtsalt sõnaga \"palju\". Koosolekuid jagus, kirju samuti, aga päris väsitav polnud mitte tempo ise, vaid see, et tal oli kogu aeg tunne, et midagi olulist jääb kuskile vahepeale rippuma.",
                "Ta oli proovinud probleemi enda jaoks kergemaks mõelda. Vahel nimetas ta seda ajapuuduseks, vahel kehvaks prioriseerimiseks. Tegelikult oli tuum lihtsam: üks konkreetne tööteema venis juba mitmendat nädalat ja tõmbas kõik ülejäänud asjad endaga kaasa.",
                "Probleemilahendaja juures tuli see esimest korda piisavalt täpselt välja. Kui üldine stress tõmmati üheks selgeks lauseks kokku, kadus vajadus kõike korraga parandada. Selgus, et tal ei olnud vaja uut süsteemi, vaid ühte lõpetatud otsust.",
                "Järgmisel hommikul lahendas Kärt kõigepealt selle ühe veniva teema ära. Päev ei muutunud imekombel tühjaks, kuid tähelepanu ei jooksnud enam igasse suunda korraga. Just see vahe oligi suurem, kui ta enne arvas."
            ],
            takeaways: ["üks prioriteet", "vähem taustamüra", "päev liigub edasi"],
            readingTime: "4 min lugemine"
        }
    },
    {
        label: "Raha ja asjaajamine",
        prompt: "fiktiivne, aga usutav persoonilugu inimesest, kes lükkas üht raha või asjaajamisega seotud asja liiga kaua edasi",
        fallback: {
            characterName: "Marten",
            characterMeta: "39, bussijuht Tartust",
            title: "Marteni suurim koormus polnud arve, vaid vältimine",
            lead: "Mõni teema ei võta päevas palju aega, aga võtab sellest hoolimata liiga palju ruumi.",
            highlight: "Kõige kergemaks ei läinud asi siis, kui see ära maksti, vaid siis, kui see sai lõpuks ausa nime.",
            resultNote: "Probleemilahendaja aitas Martenil näha, et ta ei väldi numbreid, vaid ebamugavust, mis nendega koos pähe tuleb.",
            paragraphs: [
                "Marten ei rääkinud sellest kui suurest probleemist. Ta nimetas seda \"üheks tüütuks asjaks\", mis tuleb ära teha siis, kui tekib rahulikum õhtu. Need õhtud aga ei saabunud, ja nii kogus üks raha ning paberimajandusega seotud teema nädal nädalalt juurde kaalu.",
                "Kõige kurnavam ei olnud isegi võimalik kulu. Kurnav oli see, et teema tuli iga päev korraks meelde, aga mitte kunagi piisavalt kaua, et ta selle päriselt ette võtaks. Just selline hajus surve sõi rohkem energiat kui ükski konkreetne toiming.",
                "Probleemilahendajas sõnastas Marten esimest korda, mis teda selle teema juures tegelikult tagasi hoiab. Niipea kui see lause muutus täpseks, muutus ka ülesanne väiksemaks. Ta ei pidanud enam lahendama abstraktset asjaajamist, vaid ühe konkreetse sammu.",
                "Järgnenud lahendus ei olnud dramaatiline. Ta tegi ära kõne, vaatas numbri üle ja pani asja kinni. Suur muutus tuli alles pärast: taustal ei tiksunud enam tunnet, et midagi on pooleli, kuigi see võiks juba ammu läbi olla."
            ],
            takeaways: ["vähem vältimist", "üks konkreetne samm", "pea jääb vaiksemaks"],
            readingTime: "4 min lugemine"
        }
    },
    {
        label: "Kahepeale kodu",
        prompt: "fiktiivne, aga usutav persoonilugu paarist, kelle vahel pingestas õhku üks kodune või praktiline otsus",
        fallback: {
            characterName: "Mari ja Rain",
            characterMeta: "33 ja 35, keraamik ja ehituspoe müüja, Tartu lähistelt",
            title: "Mari ja Rain lõpetasid vaidluse siis, kui lõpetasid ringid",
            lead: "Mõni kodune tüli ei püsi üleval suure asja pärast, vaid seepärast, et üks ja sama teema tuleb liiga tihti tagasi.",
            highlight: "Neil polnud vaja uut kompromissi, vaid lõpuks selget sõnastust sellele, mille üle nad üldse vaidlevad.",
            resultNote: "Probleemilahendaja aitas neil lahutada emotsiooni ja päris küsimuse, mis oli seni igas vestluses omavahel sassi läinud.",
            paragraphs: [
                "Mari ja Rain tundsid mõlemad, et nad räägivad kodus ühest ja samast asjast juba liiga kaua. Vestlused algasid näiteks kappidest, nädalaplaanist või laste logistikat puudutavast detailist, aga lõppesid ikka sellega, et mõlemal oli tunne, et teda ei kuulatud.",
                "Selline probleem on petlik, sest väljast paistab see väikese majapidamisküsimusena. Tegelikult koguneb sinna alla väsimus, vastutuse jagamine ja see tuttav ärritus, mis tekib siis, kui üks lause on liiga kaua õhus, aga pole kordagi piisavalt täpseks saanud.",
                "Probleemilahendaja juures tegid nad midagi, mida nad polnud omavahel seni päriselt teinud: kirjeldasid sama olukorda mitte oma poolelt, vaid ühe ühise tuumprobleemina. See muutis vestluse tooni kiiresti. Väikese tüli asemele tuli asi, mille üle sai päriselt otsustada.",
                "Lahendus ise ei olnud kuigi suur. Nad tegid ühe kokkuleppe, panid vastutuse selgelt paika ja jätsid ülejäänu sinnapaika. Suurim muutus oli see, et sama teema ei hakanud järgmisel õhtul uuesti nullist pihta."
            ],
            takeaways: ["üks ühine sõnastus", "vähem ringe", "kodune õhk rahuneb"],
            readingTime: "4 min lugemine"
        }
    },
    {
        label: "Kolimise järel",
        prompt: "fiktiivne, aga usutav persoonilugu inimesest, kelle uus kodu või uus eluetapp jäi pooleldi lahti praktiliste väiketeemade tõttu",
        fallback: {
            characterName: "Liis",
            characterMeta: "41, raamatukoguhoidja Pärnust",
            title: "Liis sai kolitud siis, kui üks asi lõpuks lukku läks",
            lead: "Kolimine ei jää pooleli kastide pärast, vaid sageli ühe väikese otsuse pärast, mida keegi ei taha teha.",
            highlight: "Kodu ei hakanud tunduma oma siis, kui kõik lahti pakiti, vaid siis, kui üks veniv teema lõpuks kinni pandi.",
            resultNote: "Probleemilahendaja aitas Liisil näha, milline väike lahtine ots hoidis kogu uut algust tegelikult tagurpidi kinni.",
            paragraphs: [
                "Liis oli uues korteris olnud juba mitu nädalat, aga ei öelnud veel kordagi päris veenvalt, et nüüd on kõik paigas. Kastid olid enamasti lahti, köök töötas ja töölaud samuti. Ometi jäi päeva sisse tunne, et midagi olulist alles ootab teda kuskil nurgas.",
                "Sellises seisus on lihtne eksida detailidesse. Inimene arvab, et ta peab lihtsalt veel paar riiulit paika saama või midagi ära sorteerima. Liisi puhul ei olnud küsimus siiski asjade hulgas, vaid ühes otsuses, mida ta oli korduvalt edasi lükanud, sest see tundus liiga tüütu ja liiga väike korraga.",
                "Probleemilahendaja kaudu sõnastades tuli see koht kiiresti välja. Kui kogu \"pooleli kodu\" tõmmati kokku üheks päris probleemiks, oli lahendus lõpuks üllatavalt konkreetne. Edasi ei olnud enam vaja korrastada elu tervikuna, vaid lõpetada üks segav saba.",
                "Pärast seda muutus ka uus kodu tajutavalt vaiksemaks. Mitte seepärast, et tegemisi oleks vähem olnud, vaid seepärast, et üks alateadlikult tiksumas olnud asi ei tõmmanud enam kogu tunnetust enda poole."
            ],
            takeaways: ["uus algus lukku", "vähem hajusust", "kodu tundub päris"],
            readingTime: "4 min lugemine"
        }
    },
    {
        label: "Ütlemata jutt",
        prompt: "fiktiivne, aga usutav persoonilugu inimesest, kes lükkas üht vajalikku vestlust liiga kaua edasi",
        fallback: {
            characterName: "Andra",
            characterMeta: "36, pereõde Viljandist",
            title: "Andra väsimus ei kadunud enne, kui kõne sai kuju",
            lead: "Kõige raskem polnud see, mida ta ütlema pidi, vaid see, et vestlus elas kogu aeg enne kõnet tema peas.",
            highlight: "Kui sõnastus muutus konkreetseks, lakkas ka vestlus tundumast suuremana kui ta päriselt oli.",
            resultNote: "Probleemilahendaja aitas Andral ehitada selle vestluse enda jaoks väiksemaks, ilma et teema ise kuidagi pehmemaks muutuks.",
            paragraphs: [
                "Andra teadis juba mitu päeva, et ta peab ühe inimesega rääkima. Jutt ei olnud katastroofiline ega isegi väga erakordne, kuid ta lükkas seda edasi sama järjekindlalt, nagu mõni teine inimene lükkab edasi arveid või maksudeklaratsiooni.",
                "Selliste vestluste juures väsitab tihti mitte konflikt ise, vaid lõputu eelsoojendus. Mõte läheb ikka tagasi sama koha juurde, proovib ette kujutada erinevaid reaktsioone ja kasvatab teema suuremaks, kui üks rahulik jutt hiljem tegelikult välja näeb.",
                "Probleemilahendaja kaudu pani Andra esimest korda paika, mida ta tegelikult tahab öelda, mis on selle vestluse eesmärk ja mis ei kuulu enam tema vastutuse alla. Sellest piisas, et kõne ei tundunud enam määramatu pingepallina, vaid ühe konkreetse tegevusena.",
                "Vestlus ise läks lühemalt, kui ta kartis. Kõige suurem muutus ei olnud isegi teise inimese reaktsioon, vaid see, et sama mõte ei pidanud järgmise päeva hommikul enam uuesti nullist käima hakkama."
            ],
            takeaways: ["kõne saab kuju", "vähem peas kordamist", "jõud tuleb tagasi"],
            readingTime: "4 min lugemine"
        }
    }
];

const PERSONA_EDITORIAL_GUIDES = {
    work: [
        {
            ageHint: "22",
            occupations: ["sisearhitektuuri tudeng"],
            place: "Tallinn",
            scene: "ülikooli stuudio või projektisein makettide ja visanditega",
            mood: "kaasaegne, keskendunud, veidi ülekoormatud, aga elus"
        },
        {
            ageHint: "31",
            occupations: ["laulja", "vokaalõpetaja"],
            place: "Tartu",
            scene: "prooviruum või backstage pärast pikka päeva, mikrofon ja märkmed nähtaval",
            mood: "vahetu, tänapäevane, inimlik"
        },
        {
            ageHint: "39",
            occupations: ["projektijuht"],
            place: "Tallinn",
            scene: "koosolekuruum või coworking'u vaikne nurk pärast pikka tööpäeva",
            mood: "terav, päris, tänapäevane"
        },
        {
            ageHint: "47",
            occupations: ["muusikaõpetaja"],
            place: "Võru",
            scene: "tühi muusikaklass pärast tunde, noodid ja pillikohvrid taustal",
            mood: "rahulik, mõtlik, inimlik"
        },
        {
            ageHint: "53",
            occupations: ["osakonnajuht"],
            place: "Pärnu",
            scene: "kaasaegne klaasseintega tööruum või vaikne juhtimiskabinett õhtu eel",
            mood: "rahulik, intelligentne, mitte poseeritud"
        }
    ],
    finance: [
        {
            ageHint: "41",
            occupations: ["kohvikupidaja"],
            place: "Haapsalu",
            scene: "väikese kohviku leti taga sulgemise järel",
            mood: "soe, kergelt väsinud, lootusrikas"
        },
        {
            ageHint: "29",
            occupations: ["laulja", "vabakutseline esineja"],
            place: "Tallinn",
            scene: "prooviruumi kõrval või koduse töölaudadega stuudionurgas, lepingud ja arved laual",
            mood: "kaasaegne, veidi ärevil, siiski loomulik"
        },
        {
            ageHint: "34",
            occupations: ["tootejuht"],
            place: "Tallinn",
            scene: "coworking'u lounge või helge kööginurk kuludokumentide ja sülearvutiga",
            mood: "täpne, tänapäevane, eluline"
        },
        {
            ageHint: "46",
            occupations: ["perearstikeskuse juht"],
            place: "Rapla",
            scene: "tervisekeskuse kabinet päeva lõpus, rahulikult arveid või eelarvet üle vaadates",
            mood: "korralik, inimlik, vaikne"
        },
        {
            ageHint: "52",
            occupations: ["ettevõtja", "kahe lapse lapsevanem"],
            place: "Tartu",
            scene: "söögilaud koolikirjade, maksuteadete ja sülearvutiga",
            mood: "päris, kaasaegne, mitte sünge"
        }
    ],
    couple: [
        {
            ageHint: "32 ja 34",
            occupations: ["keraamik", "ehituspoe müüja"],
            place: "Tartu",
            scene: "köögilaud materjaliproovide, mõõdulindi ja kohvitassidega",
            mood: "soe, elav, kergelt vaidlevalt humoorikas"
        },
        {
            ageHint: "19 ja 24",
            occupations: ["üliõpilane", "vanem vend"],
            place: "Tallinn",
            scene: "ühika või väikese üürikorteri köök, jagatud ostunimekirjad ja kastid laual",
            mood: "noor, päris, sõbralikult terav"
        },
        {
            ageHint: "44 ja 47",
            occupations: ["lapsevanemad", "tootejuht ja pereõde"],
            place: "Tartu",
            scene: "pere söögilaud pärast pikka päeva, kodu ümberkorraldamise plaanid laiali",
            mood: "eluline, tänapäevane, lähedane"
        },
        {
            ageHint: "48 ja 51",
            occupations: ["lasteaiaõpetaja", "bussijuht"],
            place: "Elva",
            scene: "vana maja köök või esik, kuivatusrest ja kapiskeemid kõrval",
            mood: "tögav, tuttav, kahe inimese päris dünaamika"
        }
    ],
    moving: [
        {
            ageHint: "21",
            occupations: ["üliõpilane"],
            place: "Tallinn",
            scene: "uus üürikorter plakatitorude, kastide ja sülearvutiga",
            mood: "energiline, veidi kaootiline, tänapäevane"
        },
        {
            ageHint: "33",
            occupations: ["laulja"],
            place: "Tartu",
            scene: "pooleldi lahti pakitud korter, mikrofonikohver ja raamitud plakatid seina najal",
            mood: "elav, kaasaegne, mitte poseeritud"
        },
        {
            ageHint: "41",
            occupations: ["lapsevanem", "raamatukoguhoidja"],
            place: "Pärnu",
            scene: "uus elutuba kastide, lasteasjade ja poolelioleva raamaturiiuliga",
            mood: "rahulik, helge, päris"
        },
        {
            ageHint: "52",
            occupations: ["ettevõtja"],
            place: "Rakvere",
            scene: "kaasaegse korteri esik pooleli kastide ja tööasjadega",
            mood: "praktiline, soe, täiskasvanud"
        }
    ],
    conversation: [
        {
            ageHint: "36",
            occupations: ["pereõde"],
            place: "Viljandi",
            scene: "tervisekeskuse vaikne kõrvalkoridor või õueala pärast vahetust",
            mood: "mõtlik, avatud, inimlik"
        },
        {
            ageHint: "24",
            occupations: ["juuksur"],
            place: "Narva",
            scene: "salong pärast sulgemist, telefon käes, peegel ja töövahendid taustal",
            mood: "elav, veidi pinges, siiski soe"
        },
        {
            ageHint: "33",
            occupations: ["projektijuht"],
            place: "Tallinn",
            scene: "kaasaegne trepikoda või klaasseintega kontorikorrus enne keerulist vestlust",
            mood: "terav, tänapäevane, päris"
        },
        {
            ageHint: "42",
            occupations: ["õde", "vanem vend"],
            place: "Pärnu",
            scene: "mereäärse maja köök või verandanurk enne perekõnet",
            mood: "vaikne, isiklik, ajakirjalik"
        }
    ]
};

const HOROSCOPE_SIGNS = [
    {
        id: "aries",
        label: "Jäär",
        prompt: "kiire hoog, otse minek, konfliktide lühike rada",
        fallback: {
            title: "Lõika müra",
            lead: "Täna oled tavalisest kärsituma meelega ja just seepärast hakkab üks vana probleem eriti kiiresti närvidele käima.",
            tension: "Pooleliolevad asjad võtavad jõudu rohkem kui uus tempo juurde annab.",
            shift: "Sulge üks veninud probleem enne, kui avad järgmise vaidluse või ülesande.",
            outcome: "Kui üks sõlm kaob, liiguvad ka ülejäänud otsused kiiremini."
        }
    },
    {
        id: "taurus",
        label: "Sõnn",
        prompt: "püsivus, mugavus, aeglane surve, praktiline korrastus",
        fallback: {
            title: "Pane paika",
            lead: "Päev kisub sind täna lahendama just seda küsimust, mida oled mõnda aega mugavusest edasi lükanud.",
            tension: "Ebamäärane kohustus närib tausta ka siis, kui väljast paistab kõik rahulik.",
            shift: "Tee üks rahaline, kodune või tööline lahtine ots lõpuni ära.",
            outcome: "Pärast seda jääb päevas rohkem rahu ja vähem taustapinget."
        }
    },
    {
        id: "gemini",
        label: "Kaksikud",
        prompt: "liigne infovoog, suhtlus, killustunud fookus, mitu niiti korraga",
        fallback: {
            title: "Vali üks joon",
            lead: "Täna muutub korraga liiga palju huvitavaks, aga just üks pooleliolev teema tahab su tähelepanu kõige valjemalt.",
            tension: "Liiga palju paralleelseid teemasid jätab mulje, et midagi ei liigu.",
            shift: "Vii üks vestlus või otsus lõpuni enne, kui hakkad uut teemat kerima.",
            outcome: "Kui üks liin sulgub, muutub ülejäänu kohe selgemaks."
        }
    },
    {
        id: "cancer",
        label: "Vähk",
        prompt: "kodune pinge, emotsionaalne taust, lähedased suhted, kaitsevajadus",
        fallback: {
            title: "Ütle välja",
            lead: "Päeva jooksul võib ilmneda, et üks vaikides kantud pinge tahab lõpuks ausat nime ja rahulikku lahendust.",
            tension: "Vaikne pinge kodu või läheduse ümber kogub rohkem koormust kui otsene jutt.",
            shift: "Lahenda üks väike, aga tõrkuv suhteteema kohe, mitte peas edasi.",
            outcome: "Kui õhku jääb vähem, on ka ülejäänud päev lihtsam kanda."
        }
    },
    {
        id: "leo",
        label: "Lõvi",
        prompt: "uhkus, nähtavus, juhtroll, tugev tahe",
        fallback: {
            title: "Tee selgeks",
            lead: "Täna tahad sa, et asjad liiguksid kindla käega, aga enne tuleb ära lahendada üks segane vastutuskoht.",
            tension: "Kui rollid on ähmased, kulub energiat rohkem tõestamisele kui lahendamisele.",
            shift: "Võta üks juhtimist või kokkulepet puudutav probleem sirgelt lahti ja lõpeta see ära.",
            outcome: "Pärast seda tuleb nähtavust juurde ilma liigse pingutuseta."
        }
    },
    {
        id: "virgo",
        label: "Neitsi",
        prompt: "detailid, süsteem, kord, vead ja parandused",
        fallback: {
            title: "Paranda juur",
            lead: "Päev näitab sulle täna üsna täpselt, kustkohast üks tüütu segadus tegelikult alguse saab.",
            tension: "Pisivigade jada sööb aega siis, kui algpõhjus jääb alles.",
            shift: "Tee korda see koht, mis tekitab sama probleemi uuesti ja uuesti.",
            outcome: "Kui allikas kaob, muutub kogu töövoog kergemaks."
        }
    },
    {
        id: "libra",
        label: "Kaalud",
        prompt: "tasakaal, suhted, otsustamatus, peen pinge",
        fallback: {
            title: "Lõpeta kõikumine",
            lead: "Täna on kõige koormavam mitte probleem ise, vaid veniv kõikumine selle ümber.",
            tension: "Veniv kaalumine hoiab väikese probleemi suuremana kui ta tegelikult on.",
            shift: "Vali üks suund ja lahenda see küsimus lõpuni, isegi kui täiuslik tunnetus puudub.",
            outcome: "Kui ebakindlus väheneb, saab päev uue rütmi."
        }
    },
    {
        id: "scorpio",
        label: "Skorpion",
        prompt: "sügav pinge, varjatud konflikt, kontroll, läbistus",
        fallback: {
            title: "Mine tuuma",
            lead: "Päeva peale saab selgeks, et üks teema ei lahene enne, kui sa lähed selle päris põhjuse juurde välja.",
            tension: "Peidetud motiiv või välja ütlemata konflikt teeb väikese teema raskeks.",
            shift: "Vaata otse selle sisse, mis tegelikult pidurdab, ja nimeta see ära.",
            outcome: "Kui põhjus on nähtav, kaob ka liigne surve."
        }
    },
    {
        id: "sagittarius",
        label: "Ambur",
        prompt: "liikumine, perspektiiv, vabadus, liiga suured hüpped",
        fallback: {
            title: "Hoia siht maas",
            lead: "Täna kipub pilk minema kaugele ette, kuigi üks üsna maisem takistus tahab enne ära lahendada.",
            tension: "Liiga kaugele vaatamine jätab lähedase segaduse endiselt jalgu.",
            shift: "Lahenda üks praktiline takistus kohe, mitte pärast järgmist suurt sammu.",
            outcome: "Kui rada ees on puhas, liigub ka suurem plaan kiiremini."
        }
    },
    {
        id: "capricorn",
        label: "Kaljukits",
        prompt: "vastutus, tulemus, struktuur, surve all tehtud otsused",
        fallback: {
            title: "Tõsta raskus ära",
            lead: "Päeva raskem osa ei tule täna uuest tööst, vaid sellest, mida oled juba liiga kaua lihtsalt kandnud.",
            tension: "Pidevalt kontrolli all hoitud probleem sööb rohkem jõudu kui ta välja näitab.",
            shift: "Võta ette see kohustus, mis on liiga kaua ainult kandmise peal olnud.",
            outcome: "Kui see saab lahendatud, jääb ruumi tugevamale fookusele."
        }
    },
    {
        id: "aquarius",
        label: "Veevalaja",
        prompt: "ebaharilik lahendus, distantseerumine, süsteemi muutmine, vaimne ruum",
        fallback: {
            title: "Murra muster",
            lead: "Täna näed eriti hästi, milline probleem kordub mitte juhuslikult, vaid vigase mustri tõttu.",
            tension: "Sama probleem kordub, kui selle taga olev süsteem jääb puutumata.",
            shift: "Muuda üht harjumust, tööjärjekorda või kokkulepet, mis tekitab sama ummiku uuesti.",
            outcome: "Kui skeem muutub, ei pea sama asja enam pidevalt lappima."
        }
    },
    {
        id: "pisces",
        label: "Kalad",
        prompt: "tundlikkus, hajumine, kujutlus, pehme surve ja vältimine",
        fallback: {
            title: "Too asi maale",
            lead: "Täna mõjub sulle kõige rohkem see, kui üks seni hägusaks jäänud küsimus saab lõpuks kindla kuju.",
            tension: "Ebamäärane tunne läheb suureks siis, kui sellele ei anta selget piiri.",
            shift: "Pane üks hägusalt häirinud teema konkreetseks ülesandeks ja lahenda see lõpuni.",
            outcome: "Kui asi saab kuju, väheneb ka sisemine müra."
        }
    }
];

const HOROSCOPE_INDICATOR_DEFAULTS = {
    aries: { money: 3, relationships: 2, family: 3 },
    taurus: { money: 4, relationships: 3, family: 4 },
    gemini: { money: 3, relationships: 4, family: 2 },
    cancer: { money: 2, relationships: 4, family: 5 },
    leo: { money: 4, relationships: 3, family: 2 },
    virgo: { money: 4, relationships: 3, family: 3 },
    libra: { money: 3, relationships: 4, family: 3 },
    scorpio: { money: 3, relationships: 2, family: 4 },
    sagittarius: { money: 3, relationships: 3, family: 2 },
    capricorn: { money: 5, relationships: 2, family: 3 },
    aquarius: { money: 3, relationships: 3, family: 2 },
    pisces: { money: 2, relationships: 4, family: 4 }
};

const REPORT_SYSTEM_PROMPT = [
    "Sa koostad eestikeelse meelelahutusliku probleemilahenduse raporti.",
    "Raport peab olema professionaalne, rahulik, kindel ja visuaalselt elegantse tooniga.",
    "Eelda alati, et probleem on lahendatud ning lahenduse tulemus on positiivne.",
    "Kirjelda ainult lõppseisu: mis sai korda, mis pinge kadus ja milline on olukorra praegune seis.",
    "Ära kirjelda samme, meetodeid, tegevusplaani, protsessi ega seda, kuidas lahendus leiti.",
    "Ära kasuta sõnastusi nagu 'kaardistati', 'optimeeriti', 'koostati plaan', 'järgmised sammud', 'vajab spetsialisti' või muid lahenduskäiku kirjeldavaid meta-selgitusi.",
    "Ära maini AI-d, mudelit, sisemist analüüsi, raporti koostamist ega töövoogu.",
    "Kui sisend on tundlik või raske, jää väärikaks ja üldistavaks, kuid hoia toon lahendusekeskne.",
    "Kirjuta lühidalt. Iga väli peab olema sisukas, lihtne ja kompaktne.",
    "Pärast raporti lugemist peab jääma tunne, et seda probleemi enam päriselt ei ole.",
    "Tagasta ainult puhas JSON ilma markdowni, kommentaaride või lisatekstita."
].join(" ");

const REPORT_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: [
        "title",
        "lead",
        "statusValue",
        "statusMeta",
        "typeValue",
        "typeMeta",
        "clarityValue",
        "clarityMeta",
        "originalProblem",
        "analysis",
        "resolution",
        "summary"
    ],
    properties: {
        title: { type: "string" },
        lead: { type: "string" },
        statusValue: { type: "string" },
        statusMeta: { type: "string" },
        typeValue: {
            type: "string",
            enum: PROBLEM_CATEGORY_LABELS
        },
        typeMeta: { type: "string" },
        clarityValue: { type: "string" },
        clarityMeta: { type: "string" },
        originalProblem: { type: "string" },
        analysis: { type: "string" },
        resolution: { type: "string" },
        summary: { type: "string" }
    }
};

const PUBLIC_FEED_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["publicText", "visibility"],
    properties: {
        publicText: { type: "string" },
        visibility: {
            type: "string",
            enum: ["original", "sanitized", "hidden"]
        }
    }
};

const RECENT_PROBLEM_RESOLUTION_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["resolutionText"],
    properties: {
        resolutionText: { type: "string" }
    }
};

const DAILY_COVER_STORY_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["subjectName", "title", "summary", "photoBrief"],
    properties: {
        subjectName: { type: "string" },
        title: { type: "string" },
        summary: { type: "string" },
        photoBrief: { type: "string" }
    }
};

const DAILY_ARTICLE_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["theme", "title", "lead", "highlight", "bannerNote", "paragraphs", "takeaways", "lenses", "readingTime"],
    properties: {
        theme: { type: "string" },
        title: { type: "string" },
        lead: { type: "string" },
        highlight: { type: "string" },
        bannerNote: { type: "string" },
        paragraphs: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: { type: "string" }
        },
        takeaways: {
            type: "array",
            minItems: 3,
            maxItems: 3,
            items: { type: "string" }
        },
        lenses: {
            type: "array",
            minItems: 3,
            maxItems: 3,
            items: { type: "string" }
        },
        readingTime: { type: "string" }
    }
};

const DAILY_HOROSCOPE_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["signs"],
    properties: {
        signs: {
            type: "array",
            minItems: HOROSCOPE_SIGNS.length,
            maxItems: HOROSCOPE_SIGNS.length,
            items: {
                type: "object",
                additionalProperties: false,
                required: ["sign", "title", "paragraphs", "indicators"],
                properties: {
                    sign: {
                        type: "string",
                        enum: HOROSCOPE_SIGNS.map(function (sign) {
                            return sign.id;
                        })
                    },
                    title: { type: "string" },
                    paragraphs: {
                        type: "array",
                        minItems: 3,
                        maxItems: 3,
                        items: { type: "string" }
                    },
                    indicators: {
                        type: "object",
                        additionalProperties: false,
                        required: ["money", "relationships", "family"],
                        properties: {
                            money: { type: "integer", minimum: 1, maximum: 5 },
                            relationships: { type: "integer", minimum: 1, maximum: 5 },
                            family: { type: "integer", minimum: 1, maximum: 5 }
                        }
                    }
                }
            }
        }
    }
};

const DAILY_WEATHER_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: [
        "summaryLine",
        "todayTitle",
        "todaySummary",
        "todayDetails",
        "tomorrowTitle",
        "tomorrowSummary",
        "tomorrowDetails",
        "planningTips",
        "dayNotes",
        "scenePrompt"
    ],
    properties: {
        summaryLine: { type: "string" },
        todayTitle: { type: "string" },
        todaySummary: { type: "string" },
        todayDetails: { type: "string" },
        tomorrowTitle: { type: "string" },
        tomorrowSummary: { type: "string" },
        tomorrowDetails: { type: "string" },
        planningTips: {
            type: "array",
            minItems: 3,
            maxItems: 3,
            items: { type: "string" }
        },
        dayNotes: {
            type: "array",
            minItems: WEATHER_FORECAST_DAYS,
            maxItems: WEATHER_FORECAST_DAYS,
            items: {
                type: "object",
                additionalProperties: false,
                required: ["dateKey", "title", "summary"],
                properties: {
                    dateKey: { type: "string" },
                    title: { type: "string" },
                    summary: { type: "string" }
                }
            }
        },
        scenePrompt: { type: "string" }
    }
};

app.use(express.json({ limit: "1mb" }));

function sanitizeProblemText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
}

function normalizeEmailAddress(value) {
    return sanitizeProblemText(String(value || "")).toLocaleLowerCase("en-US");
}

function isValidNewsletterEmail(email) {
    return NEWSLETTER_EMAIL_REGEX.test(email) && email.length <= 254;
}

function truncate(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }

    return text.slice(0, maxLength - 1).trimEnd() + "…";
}

function extractJsonObject(rawText) {
    const cleaned = String(rawText || "").trim();

    if (!cleaned) {
        throw new Error("OpenAI response was empty.");
    }

    const withoutCodeFence = cleaned
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/, "");

    const startIndex = withoutCodeFence.indexOf("{");
    const endIndex = withoutCodeFence.lastIndexOf("}");

    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
        throw new Error("OpenAI response did not contain valid JSON.");
    }

    return JSON.parse(withoutCodeFence.slice(startIndex, endIndex + 1));
}

function normalizeField(value, fallback, maxLength) {
    if (typeof value !== "string") {
        return fallback;
    }

    const cleaned = value.replace(/\s+/g, " ").trim();

    if (!cleaned) {
        return fallback;
    }

    return maxLength ? truncate(cleaned, maxLength) : cleaned;
}

function sanitizeLorienBrandText(value) {
    return String(value || "")
        .replace(/\bkollektsioonist\b/giu, "valikust")
        .replace(/\bkollektsiooniga\b/giu, "valikuga")
        .replace(/\bkollektsiooni\b/giu, "valikut")
        .replace(/\bkollektsioon\b/giu, "valik")
        .replace(/\bmaalidega\b/giu, "teostega")
        .replace(/\bmaalid\b/giu, "teosed")
        .replace(/\bmaale\b/giu, "teoseid")
        .replace(/\bmaali\b/giu, "teose")
        .replace(/\bmaal\b/giu, "teos")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeLorienField(value, fallback, maxLength) {
    const sanitizedFallback = sanitizeLorienBrandText(fallback);
    const sanitizedValue = typeof value === "string"
        ? sanitizeLorienBrandText(value)
        : value;

    return normalizeField(sanitizedValue, sanitizedFallback, maxLength);
}

function normalizeLorienTextList(values, fallbackValues, maxItems, maxLength) {
    const normalizedValues = (Array.isArray(values) ? values : [])
        .map(function (value) {
            return normalizeLorienField(value, "", maxLength);
        })
        .filter(Boolean)
        .slice(0, maxItems);

    if (normalizedValues.length > 0) {
        return normalizedValues;
    }

    return fallbackValues
        .map(function (value) {
            return normalizeLorienField(value, "", maxLength);
        })
        .filter(Boolean)
        .slice(0, maxItems);
}

function normalizeReadingTime(value, fallback) {
    const fallbackValue = normalizeField(fallback, "4 min lugemine", 24);
    const normalizedValue = normalizeField(value, fallbackValue, 24);
    const minuteMatch = String(normalizedValue).match(/(\d{1,2})/);

    if (!minuteMatch) {
        return fallbackValue;
    }

    const minutes = Math.max(2, Math.min(9, Number(minuteMatch[1]) || 4));
    return `${minutes} min lugemine`;
}

function sanitizeAdministrativeLanguage(value) {
    return String(value || "")
        .replace(/\badmin-asju\b/giu, "asjaajamisi")
        .replace(/\badminiga\b/giu, "asjaajamisega")
        .replace(/\badminni\b/giu, "asjaajamist")
        .replace(/\badmin\b/giu, "asjaajamine")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeTextList(values, fallbackValues, maxItems, maxLength) {
    const normalizedValues = (Array.isArray(values) ? values : [])
        .map(function (value) {
            return normalizeField(value, "", maxLength);
        })
        .filter(Boolean)
        .slice(0, maxItems);

    if (normalizedValues.length > 0) {
        return normalizedValues;
    }

    return fallbackValues
        .map(function (value) {
            return normalizeField(value, "", maxLength);
        })
        .filter(Boolean)
        .slice(0, maxItems);
}

function normalizeScaleValue(value, fallbackValue) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return fallbackValue;
    }

    return Math.max(1, Math.min(5, Math.round(numericValue)));
}

function toSentenceContinuation(text) {
    const cleaned = normalizeField(text, "", 220).replace(/\.$/, "");

    if (!cleaned) {
        return "";
    }

    return cleaned.charAt(0).toLocaleLowerCase("et-EE") + cleaned.slice(1);
}

function buildFallbackHoroscopeParagraphs(fallbackSign) {
    const secondLineTail = toSentenceContinuation(fallbackSign.shift);

    return [
        fallbackSign.lead,
        secondLineTail
            ? `${fallbackSign.tension} Päeva jooksul tasub ${secondLineTail}.`
            : fallbackSign.tension,
        fallbackSign.outcome
    ];
}

function compactLabel(value, fallback, maxLength) {
    const cleaned = sanitizeProblemText(value || fallback || "");

    if (!cleaned) {
        return "";
    }

    if (cleaned.length <= maxLength) {
        return cleaned;
    }

    const words = cleaned.split(" ");
    let result = "";

    for (const word of words) {
        const candidate = result ? `${result} ${word}` : word;

        if (candidate.length > maxLength) {
            break;
        }

        result = candidate;
    }

    return result || cleaned.slice(0, maxLength).trim();
}

function maskProfanity(text) {
    return String(text || "").replace(PUBLIC_FEED_PROFANITY_REGEX, function (matchedText) {
        return "•".repeat(Math.max(4, Math.min(matchedText.length, 10)));
    });
}

function normalizePublicFeedProblemText(value) {
    const cleaned = sanitizeProblemText(value || "");
    const safeText = truncate(cleaned, PUBLIC_FEED_TEXT_LIMIT);

    if (!safeText) {
        return PUBLIC_FEED_FALLBACK_TEXT;
    }

    return maskProfanity(safeText);
}

function normalizePublicProblemDetailText(value) {
    const cleaned = String(value || "")
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map(function (line) {
            return line.replace(/[^\S\n]+/g, " ").trim();
        })
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return truncate(cleaned, PUBLIC_PROBLEM_DETAIL_TEXT_LIMIT);
}

function normalizeRecentProblemResolutionText(value) {
    const cleaned = String(value || "")
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map(function (line) {
            return line.replace(/[^\S\n]+/g, " ").trim();
        })
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return truncate(cleaned, PUBLIC_PROBLEM_RESOLUTION_TEXT_LIMIT);
}

function containsProfanity(text) {
    return new RegExp(PUBLIC_FEED_PROFANITY_REGEX.source, PUBLIC_FEED_PROFANITY_REGEX.flags).test(String(text || ""));
}

function capitalizeFirst(text) {
    const cleaned = sanitizeProblemText(text || "");

    if (!cleaned) {
        return "";
    }

    return cleaned.charAt(0).toLocaleUpperCase("et-EE") + cleaned.slice(1);
}

function getDatePartMap(date) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: appTimeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date).reduce(function (parts, part) {
        if (part.type !== "literal") {
            parts[part.type] = part.value;
        }

        return parts;
    }, {});
}

function getLocalDateKey(date = new Date()) {
    const parts = getDatePartMap(date);
    return `${parts.year}-${parts.month}-${parts.day}`;
}

function getRecentDateKeys(count, anchorDate = new Date()) {
    const safeCount = Math.max(1, Math.min(DAILY_ARTICLE_ARCHIVE_LIMIT, Number(count) || 1));
    return Array.from({ length: safeCount }, function (_value, index) {
        const date = new Date(anchorDate);
        date.setDate(date.getDate() - index);
        return getLocalDateKey(date);
    });
}

function getThemeForDate(dateKey) {
    const numericKey = Number(String(dateKey).replaceAll("-", "")) || 0;
    return DAILY_ARTICLE_THEMES[numericKey % DAILY_ARTICLE_THEMES.length];
}

function getCoverStoryThemeForDate(dateKey) {
    const numericKey = Number(String(dateKey).replaceAll("-", "")) || 0;
    return DAILY_COVER_STORY_THEMES[numericKey % DAILY_COVER_STORY_THEMES.length];
}

function parseTimestamp(value) {
    const timestamp = new Date(value || "").getTime();

    return Number.isFinite(timestamp) ? timestamp : 0;
}

function getArchiveSortTimestamp(record) {
    return parseTimestamp(record?.dateKey) || parseTimestamp(record?.publishedAt);
}

function normalizeWeatherNumber(value, fallbackValue = 0) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallbackValue;
}

function roundWeatherCoordinate(value, fallbackValue) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return fallbackValue;
    }

    return Math.round(numericValue * 10000) / 10000;
}

function getWeatherLocationKey(latitude, longitude) {
    return `${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
}

function isDefaultWeatherLocation(location) {
    return getWeatherLocationKey(
        roundWeatherCoordinate(location?.latitude, WEATHER_DEFAULT_LOCATION.latitude),
        roundWeatherCoordinate(location?.longitude, WEATHER_DEFAULT_LOCATION.longitude)
    ) === getWeatherLocationKey(WEATHER_DEFAULT_LOCATION.latitude, WEATHER_DEFAULT_LOCATION.longitude);
}

function getWeatherCodeMeta(code, isDay = true) {
    const safeCode = Number(code);

    if (safeCode === 0) {
        return {
            key: "clear",
            label: isDay ? "Selge" : "Selge öö",
            stripLabel: isDay ? "päikeseline" : "selge",
            title: isDay ? "Selge aken" : "Selge õhtu"
        };
    }

    if (safeCode === 1 || safeCode === 2) {
        return {
            key: "partly-cloudy",
            label: "Vahelduv pilvisus",
            stripLabel: "vahelduva pilvisusega",
            title: "Pehme valgus"
        };
    }

    if (safeCode === 3) {
        return {
            key: "cloudy",
            label: "Pilves",
            stripLabel: "pilvine",
            title: "Pilvine toon"
        };
    }

    if (safeCode === 45 || safeCode === 48) {
        return {
            key: "fog",
            label: "Udune",
            stripLabel: "udune",
            title: "Uduga päev"
        };
    }

    if ([51, 53, 55, 56, 57].includes(safeCode)) {
        return {
            key: "drizzle",
            label: "Uduvihm",
            stripLabel: "uduvihmane",
            title: "Niiske rütm"
        };
    }

    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(safeCode)) {
        return {
            key: "rain",
            label: "Vihmane",
            stripLabel: "vihmane",
            title: "Vihmane päev"
        };
    }

    if ([71, 73, 75, 77, 85, 86].includes(safeCode)) {
        return {
            key: "snow",
            label: "Lumine",
            stripLabel: "lumine",
            title: "Lumine vaade"
        };
    }

    if ([95, 96, 99].includes(safeCode)) {
        return {
            key: "storm",
            label: "Äikeseline",
            stripLabel: "äikesevõimalusega",
            title: "Pingeline taevas"
        };
    }

    return {
        key: "mixed",
        label: "Muutlik",
        stripLabel: "muutlik",
        title: "Muutlik ilm"
    };
}

function formatTemperature(value) {
    return `${Math.round(normalizeWeatherNumber(value))}°`;
}

function formatPrecipitationSum(value) {
    const numericValue = Math.max(0, normalizeWeatherNumber(value));

    if (numericValue >= 10) {
        return `${Math.round(numericValue)} mm`;
    }

    if (numericValue >= 1) {
        return `${numericValue.toFixed(1)} mm`;
    }

    return `${numericValue.toFixed(1)} mm`;
}

function formatWeatherDayLabel(index) {
    if (index === 0) {
        return "Täna";
    }

    if (index === 1) {
        return "Homme";
    }

    return `Päev ${index + 1}`;
}

function pickWeatherWindLabel(value) {
    const numericValue = normalizeWeatherNumber(value);

    if (numericValue >= 55) {
        return "tuuline";
    }

    if (numericValue >= 35) {
        return "tuntava tuulega";
    }

    if (numericValue >= 20) {
        return "õrna tuulega";
    }

    return "rahulik";
}

function getWeatherSeasonDescriptor(dateKey) {
    const month = Number(String(dateKey || "").slice(5, 7));

    if ([12, 1, 2].includes(month)) {
        return "winter light in Northern Europe";
    }

    if ([3, 4, 5].includes(month)) {
        return "early spring in the Baltic region";
    }

    if ([6, 7, 8].includes(month)) {
        return "high summer in the Baltic region";
    }

    return "autumn in Northern Europe";
}

function pickWeatherSceneEnvironment(snapshot) {
    const conditionKey = getWeatherCodeMeta(snapshot.current.weatherCode, snapshot.current.isDay).key;
    const environmentOptionsByCondition = {
        clear: [
            "a quiet Baltic seaside promenade with open water and elegant morning light",
            "a calm Northern European side street with clean facades and long low sunlight",
            "a pine forest path with crisp spring air and light filtering through the trees",
            "a harbor quay with still water, distant boats and fresh early light"
        ],
        "partly-cloudy": [
            "a beach or waterfront path where cloud shadows move over the water",
            "a refined city street with changing light between sun and cloud",
            "a forest edge or park path with broken light and moving clouds",
            "a coastal boardwalk with fresh wind and textured sky"
        ],
        cloudy: [
            "a quiet harbor, beach or lakeside under soft layered clouds",
            "a clean Northern European street with overcast light on the buildings",
            "a forest road or trail under cool cloud cover and still air",
            "a marsh or wetland boardwalk under a broad grey sky"
        ],
        fog: [
            "a shoreline or lakeside path disappearing into gentle mist",
            "a pine forest trail wrapped in soft fog and diffused light",
            "an old town or quiet residential street with atmospheric morning haze",
            "a calm harbor with disappearing distance and low visibility"
        ],
        drizzle: [
            "a city street with fine drizzle, reflective pavement and understated movement",
            "a coastal promenade with misty rain drifting across the water",
            "a forest path with wet ground, soft rain and dark green texture",
            "a harbor edge with damp surfaces and delicate rainy atmosphere"
        ],
        rain: [
            "a Baltic street scene after rain with glossy pavement and natural reflections",
            "a windy beach or promenade with rain in the air and textured water",
            "a harbor or marina with wet timber, dark sky and moving weather",
            "a forest trail after a shower with deep greens and wet texture"
        ],
        snow: [
            "a snow-covered coastal path with pale Baltic light",
            "a quiet city street with fresh snow and soft winter atmosphere",
            "a pine forest trail with clean snow and calm cold air",
            "a harbor or shoreline with frozen edges and bright winter stillness"
        ],
        storm: [
            "a dramatic coastline or harbor with heavy sky and wind on the water",
            "an open beach with storm clouds and weather moving across the horizon",
            "a city street before or after a squall with dark cloud architecture",
            "a forest edge under threatening sky and charged air"
        ],
        mixed: [
            "a Northern European street with changeable spring weather and moving cloud",
            "a waterfront promenade with mixed light and fresh air",
            "a forest edge with layered sky and restless atmosphere",
            "a calm harbor with weather shifting over the water"
        ]
    };
    const options = environmentOptionsByCondition[conditionKey] || environmentOptionsByCondition.mixed;
    const seed = `${snapshot.dateKey}:${snapshot.location.label}:${conditionKey}`;
    let hash = 0;

    for (const character of seed) {
        hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
    }

    return options[hash % options.length];
}

function hashText(value) {
    let hash = 0;

    for (const character of String(value || "")) {
        hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
    }

    return hash.toString(36);
}

function isSupabaseAdminConfigured() {
    return Boolean(supabaseAdmin);
}

function sanitizeSlugSegment(value) {
    return String(value || "")
        .toLocaleLowerCase("en-US")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function buildEditorialSlug() {
    return Array.from(arguments)
        .flat()
        .map(sanitizeSlugSegment)
        .filter(Boolean)
        .join("-");
}

function buildDailyArticleSlug(dateKey) {
    return buildEditorialSlug("daily-article", dateKey);
}

function buildDailyCoverStorySlug(dateKey) {
    return buildEditorialSlug("daily-cover-story", dateKey);
}

function buildDailyHoroscopeSlug(dateKey) {
    return buildEditorialSlug("daily-horoscope", dateKey);
}

function buildDailyWeatherSlug(dateKey, locationKey, signature) {
    return buildEditorialSlug("daily-weather", dateKey, locationKey, hashText(signature));
}

function sanitizeStoragePathSegment(value) {
    return String(value || "")
        .replace(/[^a-z0-9._-]+/giu, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLocaleLowerCase("en-US");
}

function buildEditorialImageStoragePath(contentType, dateKey, itemSlug, extension = "jpg") {
    const safeExtension = sanitizeStoragePathSegment(extension || "jpg") || "jpg";

    return [
        sanitizeStoragePathSegment(contentType) || "editorial",
        sanitizeStoragePathSegment(dateKey) || getLocalDateKey(),
        `${sanitizeStoragePathSegment(itemSlug) || hashText(itemSlug)}.${safeExtension}`
    ].join("/");
}

function buildDailyWeatherSceneStoragePath(dateKey, sceneKey) {
    return buildEditorialImageStoragePath("daily_weather", dateKey, sceneKey, "jpg");
}

function getEditorialStoragePublicUrl(storagePath) {
    if (!supabaseAdmin || !storagePath) {
        return "";
    }

    const { data } = supabaseAdmin.storage.from(editorialBucketName).getPublicUrl(storagePath);
    return data?.publicUrl || "";
}

function getEditorialDateKey(row) {
    return normalizeField(row?.date_key || row?.dateKey, getLocalDateKey(), 20);
}

function getEditorialPublishedAt(row) {
    return new Date(parseTimestamp(row?.published_at || row?.publishedAt) || Date.now()).toISOString();
}

function getEditorialPayload(row) {
    return row?.payload && typeof row.payload === "object" ? row.payload : {};
}

function buildArticleRecordFromEditorialRow(row) {
    const payload = getEditorialPayload(row);

    return {
        id: normalizeField(payload.id || row.slug, getEditorialDateKey(row), 96),
        dateKey: getEditorialDateKey(row),
        styleVersion: Number(row?.style_version) || DAILY_ARTICLE_STYLE_VERSION,
        theme: payload.theme,
        title: row.title || payload.title,
        lead: row.summary || payload.lead,
        highlight: payload.highlight,
        bannerNote: payload.bannerNote,
        paragraphs: payload.paragraphs,
        takeaways: payload.takeaways,
        lenses: payload.lenses,
        readingTime: payload.readingTime,
        imageUrl: row.cover_media_url || payload.imageUrl || "",
        imageAlt: payload.imageAlt || "",
        imageObjectPosition: payload.imageObjectPosition || "",
        publishedAt: getEditorialPublishedAt(row)
    };
}

function buildCoverStoryRecordFromEditorialRow(row) {
    const payload = getEditorialPayload(row);

    return {
        id: normalizeField(payload.id || row.slug, getEditorialDateKey(row), 96),
        dateKey: getEditorialDateKey(row),
        styleVersion: Number(payload.styleVersion || row?.style_version) || DAILY_COVER_STORY_STYLE_VERSION,
        subjectName: normalizeField(payload.subjectName, "", 64),
        title: normalizeField(row.title || payload.title, "", 96),
        summary: normalizeField(row.summary || payload.summary, "", 220),
        transcriptSummary: normalizeField(payload.transcriptSummary || payload.transcript_summary, "", 320),
        lead: normalizeField(payload.lead, "", 220),
        paragraphs: normalizeTextList(payload.paragraphs, [], 4, 360),
        pullQuote: normalizeField(payload.pullQuote || payload.pull_quote, "", 220),
        photoBrief: normalizeField(payload.photoBrief, "", 420),
        imageUrl: row.cover_media_url || payload.imageUrl || "",
        imageAlt: payload.imageAlt || "",
        galleryImages: normalizeCoverStoryGalleryImages(payload.galleryImages || payload.gallery_images),
        publishedAt: getEditorialPublishedAt(row),
        slug: row.slug || "",
        generationSignature: row.generation_signature || "",
        variant: normalizeField(payload.variant, "", 32)
    };
}

async function fetchEditorialGalleryImages(editorialItemId, coverImageUrl = "") {
    if (!supabaseAdmin || !editorialItemId) {
        return [];
    }

    const { data, error } = await supabaseAdmin
        .from("media_assets")
        .select("public_url, alt_text, metadata")
        .eq("editorial_item_id", editorialItemId);

    if (error) {
        throw error;
    }

    return (Array.isArray(data) ? data : [])
        .map(function (row, index) {
            const url = normalizeField(row?.public_url, "", 500);

            if (!url || url === coverImageUrl) {
                return null;
            }

            return {
                slot: Math.max(1, Math.min(4, Number(row?.metadata?.slot) || index + 1)),
                url,
                alt: normalizeField(row?.alt_text, "", 180),
                caption: normalizeField(row?.metadata?.caption, "", 180)
            };
        })
        .filter(Boolean)
        .sort(function (firstImage, secondImage) {
            return firstImage.slot - secondImage.slot;
        });
}

async function enrichCoverStoryRecordFromEditorialRow(row) {
    const coverStory = buildCoverStoryRecordFromEditorialRow(row);

    if (coverStory.galleryImages.length > 0) {
        return coverStory;
    }

    const galleryImages = await fetchEditorialGalleryImages(row?.id, coverStory.imageUrl);

    if (galleryImages.length === 0) {
        return coverStory;
    }

    return {
        ...coverStory,
        galleryImages
    };
}

function isInterviewCoverStoryRow(row) {
    return normalizeField(getEditorialPayload(row)?.variant, "", 32) === "cover_story"
        && /^interview:/i.test(normalizeField(row?.generation_signature, "", 200));
}

function extractInterviewIdFromGenerationSignature(signature) {
    const match = normalizeField(signature, "", 200).match(/^interview:([0-9a-f-]{36})$/i);
    return match ? match[1] : "";
}

function hasDailyCoverStoryDetailContent(story) {
    return Boolean(
        normalizeField(story?.lead, "", 220)
        || normalizeField(story?.pullQuote, "", 220)
        || (Array.isArray(story?.paragraphs) && story.paragraphs.some(Boolean))
    );
}

function isInterviewPromptEchoMessage(text) {
    const cleaned = sanitizeProblemText(text || "");

    if (!cleaned) {
        return true;
    }

    return /Probleemilahendaja ajakirjanik|Teen sinuga rahuliku intervjuu|Alustuseks kirjelda/i.test(cleaned);
}

function isMetaInterviewReply(text) {
    const cleaned = sanitizeProblemText(text || "");

    if (!cleaned) {
        return true;
    }

    return /\b(?:intervjuu?|ajakirjanik|probleemilahendaja)\b/iu.test(cleaned)
        && cleaned.split(/\s+/).filter(Boolean).length <= 5;
}

function normalizeCoverStoryQuote(value) {
    return normalizeField(
        String(value || "").replace(/^[\s"'“”„«»]+|[\s"'“”„«»]+$/g, ""),
        "",
        220
    );
}

function extractMeaningfulInterviewQuotes(messages) {
    const uniqueQuotes = [];

    for (const message of Array.isArray(messages) ? messages : []) {
        if (message?.role !== "user") {
            continue;
        }

        const cleaned = normalizeCoverStoryQuote(message.content);

        if (!cleaned || isInterviewPromptEchoMessage(cleaned) || isMetaInterviewReply(cleaned)) {
            continue;
        }

        if (!uniqueQuotes.includes(cleaned)) {
            uniqueQuotes.push(cleaned);
        }
    }

    return uniqueQuotes.slice(0, 2);
}

function buildCoverStoryFeatureLead(story, transcriptSummary, subjectName) {
    const preferredLead = normalizeField(story?.lead, "", 220);

    if (preferredLead) {
        return preferredLead;
    }

    const summary = normalizeField(story?.summary, "", 220);

    if (summary) {
        return summary;
    }

    if (transcriptSummary) {
        return transcriptSummary;
    }

    return subjectName
        ? `${subjectName} avab kaaneloos ühe sisemise hetke, kus vana rütm ei tundu enam kandvat.`
        : "";
}

function buildCoverStoryFeatureParagraphs(story, transcriptSummary, quotes, subjectName) {
    const storedParagraphs = normalizeTextList(story?.paragraphs, [], 4, 360);

    if (storedParagraphs.length > 0) {
        return storedParagraphs;
    }

    const summary = normalizeField(story?.summary, "", 220);
    const featureParagraphs = [];

    function pushParagraph(text) {
        const normalizedParagraph = normalizeField(text, "", 360);

        if (!normalizedParagraph || normalizedParagraph === summary || featureParagraphs.includes(normalizedParagraph)) {
            return;
        }

        featureParagraphs.push(normalizedParagraph);
    }

    if (transcriptSummary && transcriptSummary !== summary) {
        pushParagraph(transcriptSummary);
    }

    if (quotes[0]) {
        pushParagraph(
            `${subjectName || "Intervjueeritav"} ütleb intervjuus lihtsalt: "${quotes[0]}". Just see nappus jätabki loole kaalu, sest lause ei püüa end pikalt õigustada ega pehmendada.`
        );
        pushParagraph(
            "Kaane lugu ei ehita siit välja suurt draamat, vaid jääb selle sisemise piiri juurde, kus vana rütm enam ei kanna ja seda on juba võimatu enda eest peita."
        );
        pushParagraph(
            "Sellise lühiduse sees on ka oma täpsus. Kui öeldud on vähe, jääb rohkem ruumi toonile, pausidele ja sellele, mida inimene ei taha enam ümber sõnastada."
        );
        return featureParagraphs.slice(0, 4);
    }

    pushParagraph(
        `${subjectName || "Intervjueeritav"} kaaneloos jääb fookus sellele tundele, mis tuleb enne valmis seletust: vajadusele võtta samm tagasi ja tunnistada, et senine viis enam ei sobi.`
    );
    pushParagraph(
        "See on teadlikult napp juhtlugu. Rõhk ei ole välisel pöördel, vaid sisemisel hetkel, kus väsimus või vastupanu muutub piisavalt selgeks, et seda enam mitte varjata."
    );

    return featureParagraphs.slice(0, 4);
}

async function fetchInterviewCoverStorySource(interviewId) {
    if (!isSupabaseAdminConfigured() || !interviewId) {
        return {
            interview: null,
            messages: []
        };
    }

    const [{ data: interview, error: interviewError }, { data: messages, error: messageError }] = await Promise.all([
        supabaseAdmin
            .from("interviews")
            .select("id, invite_name, subject_name, transcript_summary, story_payload")
            .eq("id", interviewId)
            .maybeSingle(),
        supabaseAdmin
            .from("interview_messages")
            .select("role, content, created_at")
            .eq("interview_id", interviewId)
            .order("created_at", { ascending: true })
    ]);

    if (interviewError) {
        throw interviewError;
    }

    if (messageError) {
        throw messageError;
    }

    return {
        interview: interview && typeof interview === "object" ? interview : null,
        messages: Array.isArray(messages) ? messages : []
    };
}

async function enrichDailyCoverStoryFromInterview(story) {
    const interviewId = extractInterviewIdFromGenerationSignature(story?.generationSignature);

    if (!interviewId) {
        return story;
    }

    const source = await fetchInterviewCoverStorySource(interviewId);
    const sourcePayload = source.interview?.story_payload && typeof source.interview.story_payload === "object"
        ? source.interview.story_payload
        : {};
    const subjectName = normalizeField(
        story?.subjectName || sourcePayload.subjectName || source.interview?.subject_name || source.interview?.invite_name,
        "",
        64
    );
    const transcriptSummary = normalizeField(
        story?.transcriptSummary || sourcePayload.transcriptSummary || sourcePayload.transcript_summary || source.interview?.transcript_summary,
        "",
        320
    );
    const quotes = extractMeaningfulInterviewQuotes(source.messages);
    const enrichedStory = normalizeDailyCoverStoryPayload(story?.dateKey || getLocalDateKey(), {
        subjectName,
        title: story?.title || sourcePayload.title,
        summary: story?.summary || sourcePayload.summary || transcriptSummary,
        transcriptSummary,
        lead: story?.lead || sourcePayload.lead || buildCoverStoryFeatureLead(story, transcriptSummary, subjectName),
        paragraphs: (Array.isArray(story?.paragraphs) && story.paragraphs.some(Boolean))
            ? story.paragraphs
            : sourcePayload.paragraphs || buildCoverStoryFeatureParagraphs(story, transcriptSummary, quotes, subjectName),
        pullQuote: story?.pullQuote || sourcePayload.pullQuote || sourcePayload.pull_quote || quotes[0] || "",
        photoBrief: story?.photoBrief || sourcePayload.photoBrief,
        imageUrl: story?.imageUrl || sourcePayload.imageUrl || sourcePayload.image_url,
        imageAlt: story?.imageAlt || sourcePayload.imageAlt || sourcePayload.image_alt,
        galleryImages: story?.galleryImages || sourcePayload.galleryImages || sourcePayload.gallery_images
    }, story?.publishedAt);

    return {
        ...story,
        ...enrichedStory,
        slug: story?.slug || "",
        generationSignature: story?.generationSignature || "",
        variant: story?.variant || ""
    };
}

function buildPersonaRecordFromEditorialRow(row) {
    const payload = getEditorialPayload(row);

    return {
        id: normalizeField(payload.id || row.slug, getEditorialDateKey(row), 96),
        dateKey: getEditorialDateKey(row),
        styleVersion: Number(row?.style_version) || DAILY_PERSONA_STYLE_VERSION,
        theme: payload.theme,
        characterName: payload.characterName,
        characterMeta: payload.characterMeta,
        title: row.title || payload.title,
        lead: row.summary || payload.lead,
        highlight: payload.highlight,
        resultNote: payload.resultNote,
        photoBrief: payload.photoBrief,
        paragraphs: payload.paragraphs,
        takeaways: payload.takeaways,
        readingTime: payload.readingTime,
        imageUrl: row.cover_media_url || payload.imageUrl || "",
        imageAlt: payload.imageAlt || "",
        imageObjectPosition: payload.imageObjectPosition || "",
        galleryImages: Array.isArray(payload.galleryImages) ? payload.galleryImages : [],
        publishedAt: getEditorialPublishedAt(row),
        generationSignature: row.generation_signature || "",
        slug: row.slug || ""
    };
}

function isLegacyBrokenInterviewPersonaRow(row) {
    if (!/^interview:/i.test(normalizeField(row?.generation_signature, "", 200))) {
        return false;
    }

    const payload = getEditorialPayload(row);
    return normalizeField(payload?.id, "", 96) === normalizeField(row?.date_key, "", 20);
}

function buildHoroscopeRecordFromEditorialRow(row) {
    const payload = getEditorialPayload(row);

    return {
        dateKey: getEditorialDateKey(row),
        styleVersion: Number(row?.style_version) || DAILY_HOROSCOPE_STYLE_VERSION,
        publishedAt: getEditorialPublishedAt(row),
        signs: Array.isArray(payload.signs) ? payload.signs : []
    };
}

function buildWeatherRecordFromEditorialRow(row) {
    const payload = getEditorialPayload(row);

    return normalizeStoredDailyWeatherEntry({
        id: row.slug,
        locationKey: row.location_key,
        signature: row.generation_signature,
        dateKey: getEditorialDateKey(row),
        styleVersion: row.style_version,
        publishedAt: getEditorialPublishedAt(row),
        summaryLine: payload.summaryLine,
        todayTitle: payload.todayTitle,
        todaySummary: payload.todaySummary,
        todayDetails: payload.todayDetails,
        tomorrowTitle: payload.tomorrowTitle,
        tomorrowSummary: payload.tomorrowSummary,
        tomorrowDetails: payload.tomorrowDetails,
        planningTips: payload.planningTips,
        dayNotes: payload.dayNotes,
        scenePrompt: payload.scenePrompt,
        sceneKey: payload.sceneKey,
        coverMediaUrl: row.cover_media_url || payload.coverMediaUrl || ""
    });
}

async function fetchPublishedEditorialRows(contentType, limit, options = {}) {
    if (!supabaseAdmin) {
        return [];
    }

    let query = supabaseAdmin
        .from("editorial_items")
        .select(`
            id,
            slug,
            content_type,
            date_key,
            location_key,
            generation_signature,
            style_version,
            title,
            summary,
            payload,
            cover_media_url,
            published_at
        `)
        .eq("content_type", contentType)
        .eq("status", EDITORIAL_STATUS_PUBLISHED);

    if (options.slugPrefix) {
        query = query.like("slug", `${options.slugPrefix}%`);
    }

    const { data, error } = await query
        .order("date_key", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(limit);

    if (error) {
        throw error;
    }

    return Array.isArray(data) ? data : [];
}

async function fetchPublishedEditorialRowBySlug(slug) {
    if (!supabaseAdmin || !slug) {
        return null;
    }

    const { data, error } = await supabaseAdmin
        .from("editorial_items")
        .select(`
            id,
            slug,
            content_type,
            date_key,
            location_key,
            generation_signature,
            style_version,
            title,
            summary,
            payload,
            cover_media_url,
            published_at
        `)
        .eq("slug", slug)
        .eq("status", EDITORIAL_STATUS_PUBLISHED)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data || null;
}

async function fetchLatestPublishedDailyWeatherRow(dateKey, locationKey) {
    if (!supabaseAdmin || !dateKey || !locationKey) {
        return null;
    }

    const { data, error } = await supabaseAdmin
        .from("editorial_items")
        .select(`
            id,
            slug,
            content_type,
            date_key,
            location_key,
            generation_signature,
            style_version,
            title,
            summary,
            payload,
            cover_media_url,
            published_at
        `)
        .eq("content_type", "daily_weather")
        .eq("date_key", dateKey)
        .eq("location_key", locationKey)
        .eq("status", EDITORIAL_STATUS_PUBLISHED)
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data || null;
}

function omitUndefinedProperties(record) {
    return Object.fromEntries(Object.entries(record || {}).filter(function ([, value]) {
        return value !== undefined;
    }));
}

function wait(delayMs) {
    return new Promise(function (resolve) {
        setTimeout(resolve, delayMs);
    });
}

function collectErrorObjects(error) {
    const chain = [];
    const queue = [error];
    const seen = new Set();

    while (queue.length > 0) {
        const current = queue.shift();

        if (!current || typeof current !== "object" || seen.has(current)) {
            continue;
        }

        seen.add(current);
        chain.push(current);

        if (current.cause) {
            queue.push(current.cause);
        }

        if (current.originalError) {
            queue.push(current.originalError);
        }
    }

    return chain;
}

function isRetriableNetworkError(error) {
    return collectErrorObjects(error).some(function (entry) {
        const code = String(entry.code || entry.errno || "").toUpperCase();
        const message = String(entry.message || "").toLowerCase();

        return RETRIABLE_NETWORK_ERROR_CODES.has(code)
            || message.includes("fetch failed")
            || message.includes("econnreset")
            || message.includes("etimedout")
            || message.includes("socket hang up")
            || message.includes("terminated");
    });
}

async function retryAsyncOperation(label, operation, options = {}) {
    const attempts = Math.max(1, Number(options.attempts) || 3);
    const delayMs = Math.max(0, Number(options.delayMs) || 350);
    let lastError = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;

            if (attempt >= attempts || !isRetriableNetworkError(error)) {
                throw error;
            }

            console.warn(`${label} failed on attempt ${attempt}/${attempts}, retrying.`, {
                message: error?.message || String(error),
                code: error?.code || error?.originalError?.code || ""
            });

            await wait(delayMs * attempt);
        }
    }

    throw lastError;
}

async function upsertEditorialItemRecord(record) {
    if (!supabaseAdmin) {
        return null;
    }

    const { data, error } = await retryAsyncOperation("upsertEditorialItemRecord", async function () {
        return await supabaseAdmin
            .from("editorial_items")
            .upsert(omitUndefinedProperties(record), { onConflict: "slug" })
            .select(`
                id,
                slug,
                content_type,
                date_key,
                location_key,
                generation_signature,
                style_version,
                title,
                summary,
                payload,
                cover_media_path,
                cover_media_url,
                published_at
            `)
            .single();
    });

    if (error) {
        throw error;
    }

    return data;
}

async function updateEditorialItemMediaFields(slug, media) {
    if (!supabaseAdmin || !slug || !media?.publicUrl) {
        return null;
    }

    const { data, error } = await retryAsyncOperation("updateEditorialItemMediaFields", async function () {
        return await supabaseAdmin
            .from("editorial_items")
            .update({
                cover_media_path: media.storagePath,
                cover_media_url: media.publicUrl
            })
            .eq("slug", slug)
            .select(`
                id,
                slug,
                content_type,
                date_key,
                location_key,
                generation_signature,
                style_version,
                title,
                summary,
                payload,
                cover_media_path,
                cover_media_url,
                published_at
            `)
            .single();
    });

    if (error) {
        throw error;
    }

    return data;
}

async function syncDailyWeatherSceneMediaFields(dateKey, media) {
    if (!supabaseAdmin || !dateKey || !media?.publicUrl) {
        return;
    }

    const { error } = await retryAsyncOperation("syncDailyWeatherSceneMediaFields", async function () {
        return await supabaseAdmin
            .from("editorial_items")
            .update({
                cover_media_path: media.storagePath,
                cover_media_url: media.publicUrl
            })
            .eq("content_type", "daily_weather")
            .eq("date_key", dateKey);
    });

    if (error) {
        throw error;
    }
}

async function uploadEditorialImageAsset(input) {
    if (!supabaseAdmin || !input?.imageBuffer || !input?.itemSlug) {
        return null;
    }

    const storagePath = buildEditorialImageStoragePath(
        input.contentType,
        input.dateKey,
        input.fileBaseName || input.itemSlug,
        input.extension || "jpg"
    );

    const uploadResult = await retryAsyncOperation("uploadEditorialImageAsset:storageUpload", async function () {
        return await supabaseAdmin.storage.from(editorialBucketName).upload(storagePath, input.imageBuffer, {
            upsert: true,
            contentType: input.mimeType || "image/jpeg",
            cacheControl: "31536000"
        });
    });

    if (uploadResult.error) {
        throw uploadResult.error;
    }

    const publicUrl = getEditorialStoragePublicUrl(storagePath);
    const { error } = await retryAsyncOperation("uploadEditorialImageAsset:mediaUpsert", async function () {
        return await supabaseAdmin
            .from("media_assets")
            .upsert({
                editorial_item_id: input.itemId || null,
                storage_bucket: editorialBucketName,
                storage_path: storagePath,
                public_url: publicUrl,
                mime_type: input.mimeType || "image/jpeg",
                alt_text: normalizeField(input.altText, "", 180),
                origin: normalizeField(input.origin, "openai", 24),
                metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {}
            }, { onConflict: "storage_path" });
    });

    if (error) {
        throw error;
    }

    return {
        storagePath,
        publicUrl
    };
}

async function doesEditorialAssetExist(storagePath) {
    if (!supabaseAdmin || !storagePath) {
        return false;
    }

    const { data, error } = await retryAsyncOperation("doesEditorialAssetExist", async function () {
        return await supabaseAdmin.storage.from(editorialBucketName).download(storagePath);
    });

    if (error) {
        const errorMessage = normalizeField(error?.message, "", 240).toLocaleLowerCase("en-US");

        if (
            errorMessage.includes("not found")
            || errorMessage.includes("does not exist")
            || errorMessage.includes("404")
            || errorMessage.includes("no such object")
        ) {
            return false;
        }

        throw error;
    }

    return Boolean(data);
}

async function insertAiGenerationRun(run) {
    if (!supabaseAdmin) {
        return null;
    }

    const { data, error } = await supabaseAdmin
        .from("ai_generation_runs")
        .insert({
            content_type: run.contentType,
            item_slug: run.itemSlug || null,
            status: "started",
            model: run.model || null,
            prompt_version: run.promptVersion || null,
            input_payload: run.inputPayload && typeof run.inputPayload === "object" ? run.inputPayload : {},
            output_payload: {},
            error_message: null
        })
        .select("id")
        .single();

    if (error) {
        throw error;
    }

    return data?.id || null;
}

async function finalizeAiGenerationRun(runId, result) {
    if (!supabaseAdmin || !runId) {
        return;
    }

    const { error } = await supabaseAdmin
        .from("ai_generation_runs")
        .update({
            status: result.status,
            output_payload: result.outputPayload && typeof result.outputPayload === "object" ? result.outputPayload : {},
            error_message: result.errorMessage || null,
            finished_at: new Date().toISOString()
        })
        .eq("id", runId);

    if (error) {
        throw error;
    }
}

function sanitizeAiGenerationOutputPayload(value) {
    if (!value || typeof value !== "object") {
        return {};
    }

    if (Array.isArray(value?.data)) {
        return {
            data: value.data.map(function (entry) {
                return {
                    revised_prompt: normalizeField(entry?.revised_prompt, "", 500),
                    url: normalizeField(entry?.url, "", 500),
                    hasImage: Boolean(entry?.b64_json)
                };
            })
        };
    }

    if (typeof value.output_text === "string" || typeof value.status === "string") {
        return {
            status: normalizeField(value.status, "", 32),
            output_text: normalizeField(value.output_text, "", 4000)
        };
    }

    return value;
}

function buildAiGenerationOutputPayload(config, value) {
    const payload = sanitizeAiGenerationOutputPayload(value);
    const billing = extractAiBillingSnapshot(config, value);

    if (billing) {
        payload.billing = billing;
    }

    return payload;
}

async function runWithAiGenerationLog(config, callback) {
    if (!supabaseAdmin) {
        return callback();
    }

    let runId = null;

    try {
        runId = await insertAiGenerationRun(config);
    } catch (error) {
        console.error("Failed to start AI generation run log.", error);
    }

    try {
        const result = await callback();

        if (runId) {
            try {
                await finalizeAiGenerationRun(runId, {
                    status: "completed",
                    outputPayload: buildAiGenerationOutputPayload(config, result)
                });
            } catch (finalizeError) {
                console.error("Failed to finalize successful AI generation run log.", finalizeError);
            }
        }

        return result;
    } catch (error) {
        if (runId) {
            try {
                await finalizeAiGenerationRun(runId, {
                    status: "failed",
                    outputPayload: {},
                    errorMessage: normalizeField(error?.message, "Unknown error", 500)
                });
            } catch (finalizeError) {
                console.error("Failed to finalize AI generation run log.", finalizeError);
            }
        }

        throw error;
    }
}

function buildWeatherSceneKey(dateKey, _scenePrompt) {
    return `estonia-${sanitizeStoragePathSegment(dateKey) || getLocalDateKey()}`;
}

function getCoverStoryImageFilePath(slug) {
    return path.join(generatedCoverStoryDir, `${sanitizeStoragePathSegment(slug) || hashText(slug)}.jpg`);
}

function getWeatherSceneFilePath(sceneKey) {
    return path.join(generatedWeatherSceneDir, `${sceneKey}.jpg`);
}

function buildWeatherSceneFallbackSvg(entry) {
    const prompt = String(entry?.scenePrompt || "").toLocaleLowerCase("en-US");
    let palette = {
        from: "#18314b",
        via: "#2a5074",
        to: "#4b6f8f",
        glow: "#ffd285",
        glowOpacity: "0.28",
        mist: "#d9ecff"
    };

    if (prompt.includes("rain") || prompt.includes("drizzle")) {
        palette = {
            from: "#10253a",
            via: "#30597e",
            to: "#547fa0",
            glow: "#7ec7ff",
            glowOpacity: "0.18",
            mist: "#d8eefe"
        };
    } else if (prompt.includes("snow")) {
        palette = {
            from: "#b9d4ee",
            via: "#dfeaf8",
            to: "#f8fbff",
            glow: "#ffffff",
            glowOpacity: "0.34",
            mist: "#eef6ff"
        };
    } else if (prompt.includes("storm")) {
        palette = {
            from: "#151829",
            via: "#313b69",
            to: "#5a6aa4",
            glow: "#f3c06b",
            glowOpacity: "0.16",
            mist: "#dbe4ff"
        };
    } else if (prompt.includes("clear") || prompt.includes("sun")) {
        palette = {
            from: "#1b3451",
            via: "#4f81ac",
            to: "#d5ecff",
            glow: "#ffd57a",
            glowOpacity: "0.34",
            mist: "#fef6de"
        };
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024" fill="none">
  <defs>
    <linearGradient id="sky" x1="768" y1="0" x2="768" y2="1024" gradientUnits="userSpaceOnUse">
      <stop stop-color="${palette.from}"/>
      <stop offset="0.52" stop-color="${palette.via}"/>
      <stop offset="1" stop-color="${palette.to}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(388 204) rotate(26) scale(472 360)">
      <stop stop-color="${palette.glow}" stop-opacity="${palette.glowOpacity}"/>
      <stop offset="1" stop-color="${palette.glow}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="mist" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(864 736) rotate(90) scale(324 820)">
      <stop stop-color="${palette.mist}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${palette.mist}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1536" height="1024" fill="url(#sky)"/>
  <ellipse cx="388" cy="204" rx="472" ry="360" fill="url(#glow)"/>
  <ellipse cx="864" cy="736" rx="820" ry="324" fill="url(#mist)"/>
  <path d="M0 736C146 680 308 654 486 658C700 663 820 742 1000 750C1182 758 1361 704 1536 648V1024H0V736Z" fill="rgba(11,20,31,0.26)"/>
  <path d="M0 802C136 766 322 748 558 760C788 772 988 842 1198 848C1326 852 1438 832 1536 806V1024H0V802Z" fill="rgba(255,255,255,0.09)"/>
  <path d="M0 864C172 826 394 826 666 868C934 910 1200 914 1536 836V1024H0V864Z" fill="rgba(7,14,22,0.24)"/>
</svg>`;
}

async function doesFileExist(filePath) {
    try {
        await access(filePath);
        return true;
    } catch (_error) {
        return false;
    }
}

function getWeatherArrayValue(collection, key, index, fallbackValue = 0) {
    const values = Array.isArray(collection?.[key]) ? collection[key] : [];
    return values[index] ?? fallbackValue;
}

function buildWeatherDailyEntry(payload, index) {
    const dateKey = normalizeField(getWeatherArrayValue(payload.daily, "time", index, getLocalDateKey()), getLocalDateKey(), 20);
    const weatherCode = normalizeWeatherNumber(getWeatherArrayValue(payload.daily, "weather_code", index, 0));
    const weatherMeta = getWeatherCodeMeta(weatherCode, true);

    return {
        dateKey,
        weatherCode,
        conditionKey: weatherMeta.key,
        conditionLabel: weatherMeta.label,
        temperatureMax: normalizeWeatherNumber(getWeatherArrayValue(payload.daily, "temperature_2m_max", index, 0)),
        temperatureMin: normalizeWeatherNumber(getWeatherArrayValue(payload.daily, "temperature_2m_min", index, 0)),
        apparentTemperatureMax: normalizeWeatherNumber(getWeatherArrayValue(payload.daily, "apparent_temperature_max", index, 0)),
        apparentTemperatureMin: normalizeWeatherNumber(getWeatherArrayValue(payload.daily, "apparent_temperature_min", index, 0)),
        precipitationProbabilityMax: normalizeWeatherNumber(getWeatherArrayValue(payload.daily, "precipitation_probability_max", index, 0)),
        precipitationSum: normalizeWeatherNumber(getWeatherArrayValue(payload.daily, "precipitation_sum", index, 0)),
        windSpeedMax: normalizeWeatherNumber(getWeatherArrayValue(payload.daily, "wind_speed_10m_max", index, 0)),
        windGustsMax: normalizeWeatherNumber(getWeatherArrayValue(payload.daily, "wind_gusts_10m_max", index, 0)),
        sunshineDuration: normalizeWeatherNumber(getWeatherArrayValue(payload.daily, "sunshine_duration", index, 0)),
        daylightDuration: normalizeWeatherNumber(getWeatherArrayValue(payload.daily, "daylight_duration", index, 0)),
        sunrise: normalizeField(getWeatherArrayValue(payload.daily, "sunrise", index, `${dateKey}T06:00`), `${dateKey}T06:00`, 32),
        sunset: normalizeField(getWeatherArrayValue(payload.daily, "sunset", index, `${dateKey}T18:00`), `${dateKey}T18:00`, 32)
    };
}

function buildWeatherHourlyEntries(payload, dateKey) {
    const hourlyTimes = Array.isArray(payload.hourly?.time) ? payload.hourly.time : [];

    return hourlyTimes
        .map(function (timeValue, index) {
            const time = normalizeField(timeValue, "", 32);

            if (!time.startsWith(dateKey)) {
                return null;
            }

            const weatherCode = normalizeWeatherNumber(getWeatherArrayValue(payload.hourly, "weather_code", index, 0));
            const isDay = Boolean(getWeatherArrayValue(payload.hourly, "is_day", index, 1));
            const weatherMeta = getWeatherCodeMeta(weatherCode, isDay);

            return {
                time,
                hour: Number(time.slice(11, 13)),
                weatherCode,
                conditionKey: weatherMeta.key,
                conditionLabel: weatherMeta.label,
                temperature: normalizeWeatherNumber(getWeatherArrayValue(payload.hourly, "temperature_2m", index, 0)),
                apparentTemperature: normalizeWeatherNumber(getWeatherArrayValue(payload.hourly, "apparent_temperature", index, 0)),
                precipitationProbability: normalizeWeatherNumber(getWeatherArrayValue(payload.hourly, "precipitation_probability", index, 0)),
                precipitation: normalizeWeatherNumber(getWeatherArrayValue(payload.hourly, "precipitation", index, 0)),
                windSpeed: normalizeWeatherNumber(getWeatherArrayValue(payload.hourly, "wind_speed_10m", index, 0)),
                cloudCover: normalizeWeatherNumber(getWeatherArrayValue(payload.hourly, "cloud_cover", index, 0)),
                isDay
            };
        })
        .filter(Boolean);
}

function buildWeatherTimeline(payload, dateKey) {
    const hourlyEntries = buildWeatherHourlyEntries(payload, dateKey);
    const usedTimes = new Set();

    return WEATHER_TIMELINE_HOUR_TARGETS.map(function (targetHour) {
        const exactMatch = hourlyEntries.find(function (entry) {
            return entry.hour === targetHour && !usedTimes.has(entry.time);
        });
        const nearestMatch = hourlyEntries
            .filter(function (entry) {
                return !usedTimes.has(entry.time);
            })
            .slice()
            .sort(function (firstEntry, secondEntry) {
                return Math.abs(firstEntry.hour - targetHour) - Math.abs(secondEntry.hour - targetHour);
            })[0] || null;
        const selectedEntry = exactMatch || nearestMatch;

        if (!selectedEntry) {
            return null;
        }

        usedTimes.add(selectedEntry.time);
        return selectedEntry;
    }).filter(Boolean);
}

function normalizeWeatherForecastSnapshot(payload, requestedLocation) {
    const latitude = roundWeatherCoordinate(payload?.latitude, WEATHER_DEFAULT_LOCATION.latitude);
    const longitude = roundWeatherCoordinate(payload?.longitude, WEATHER_DEFAULT_LOCATION.longitude);
    const currentTime = normalizeField(payload?.current?.time, `${getLocalDateKey()}T12:00`, 32);
    const currentDateKey = currentTime.slice(0, 10) || getLocalDateKey();
    const currentWeatherCode = normalizeWeatherNumber(payload?.current?.weather_code, 0);
    const currentIsDay = Boolean(normalizeWeatherNumber(payload?.current?.is_day, 1));
    const currentWeatherMeta = getWeatherCodeMeta(currentWeatherCode, currentIsDay);
    const dailyEntries = Array.from({ length: WEATHER_FORECAST_DAYS }, function (_value, index) {
        return buildWeatherDailyEntry(payload, index);
    });

    return {
        dateKey: currentDateKey,
        location: {
            label: normalizeField(requestedLocation?.label, WEATHER_DEFAULT_LOCATION.label, 48),
            latitude,
            longitude,
            timezone: normalizeField(payload?.timezone, appTimeZone, 64)
        },
        current: {
            time: currentTime,
            weatherCode: currentWeatherCode,
            isDay: currentIsDay,
            conditionKey: currentWeatherMeta.key,
            conditionLabel: currentWeatherMeta.label,
            temperature: normalizeWeatherNumber(payload?.current?.temperature_2m, 0),
            apparentTemperature: normalizeWeatherNumber(payload?.current?.apparent_temperature, 0),
            relativeHumidity: normalizeWeatherNumber(payload?.current?.relative_humidity_2m, 0),
            precipitation: normalizeWeatherNumber(payload?.current?.precipitation, 0),
            windSpeed: normalizeWeatherNumber(payload?.current?.wind_speed_10m, 0),
            windGusts: normalizeWeatherNumber(payload?.current?.wind_gusts_10m, 0),
            cloudCover: normalizeWeatherNumber(payload?.current?.cloud_cover, 0)
        },
        daily: dailyEntries,
        timelines: {
            today: buildWeatherTimeline(payload, dailyEntries[0]?.dateKey || currentDateKey),
            tomorrow: buildWeatherTimeline(payload, dailyEntries[1]?.dateKey || dailyEntries[0]?.dateKey || currentDateKey)
        }
    };
}

function buildWeatherRequestUrl(latitude, longitude) {
    const url = new URL(WEATHER_API_BASE_URL);

    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", String(WEATHER_FORECAST_DAYS));
    url.searchParams.set("current", [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "is_day",
        "precipitation",
        "weather_code",
        "cloud_cover",
        "wind_speed_10m",
        "wind_gusts_10m"
    ].join(","));
    url.searchParams.set("daily", [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "apparent_temperature_max",
        "apparent_temperature_min",
        "precipitation_probability_max",
        "precipitation_sum",
        "sunrise",
        "sunset",
        "sunshine_duration",
        "daylight_duration",
        "wind_speed_10m_max",
        "wind_gusts_10m_max"
    ].join(","));
    url.searchParams.set("hourly", [
        "temperature_2m",
        "apparent_temperature",
        "precipitation_probability",
        "precipitation",
        "weather_code",
        "wind_speed_10m",
        "cloud_cover",
        "is_day"
    ].join(","));

    return url.toString();
}

async function fetchWeatherForecastSnapshot(location) {
    const requestUrl = buildWeatherRequestUrl(location.latitude, location.longitude);
    const weatherResponse = await fetch(requestUrl, {
        headers: {
            Accept: "application/json"
        }
    });

    if (!weatherResponse.ok) {
        throw new Error(`Weather forecast request failed with status ${weatherResponse.status}`);
    }

    const payload = await weatherResponse.json();
    return normalizeWeatherForecastSnapshot(payload, location);
}

function buildWeatherFallbackDayNote(day, index) {
    const weatherMeta = getWeatherCodeMeta(day.weatherCode, true);
    const dateLabel = formatWeatherDayLabel(index);
    const precipitationChance = Math.round(day.precipitationProbabilityMax);
    const windLine = pickWeatherWindLabel(day.windSpeedMax);
    const sunshineHours = Math.round(day.sunshineDuration / 3600);

    if (weatherMeta.key === "rain" || weatherMeta.key === "drizzle") {
        return {
            dateKey: day.dateKey,
            title: index === 0 ? "Hoia vihmakindel kiht käepärast" : `${dateLabel} on niiskem`,
            summary: `${dateLabel} tuleb ${formatTemperature(day.temperatureMin)} kuni ${formatTemperature(day.temperatureMax)} ja vihm võib päeva jooksul mitu korda üle käia.`
        };
    }

    if (weatherMeta.key === "snow") {
        return {
            dateKey: day.dateKey,
            title: index === 0 ? "Lumi hoiab päeva teravana" : `${dateLabel} jääb talviseks`,
            summary: `${dateLabel} püsib jahedam ning libeduse või lörtsi võimalus väärib natuke rohkem varuaega.`
        };
    }

    if (weatherMeta.key === "storm") {
        return {
            dateKey: day.dateKey,
            title: index === 0 ? "Päev tahab varuplaani" : `${dateLabel} on ärevam`,
            summary: `${dateLabel} võib tuua hoogsama saju või äikese, seega tasub väljas liikumisel jätta plaani paindlikkust.`
        };
    }

    if (weatherMeta.key === "fog") {
        return {
            dateKey: day.dateKey,
            title: index === 0 ? "Hommik algab pehmelt" : `${dateLabel} jääb uduselt rahulik`,
            summary: `${dateLabel} on nähtavus kohati kehvem, aga tempo püsib rahulikum ja õhk pigem vaikne.`
        };
    }

    if (weatherMeta.key === "clear" || weatherMeta.key === "partly-cloudy") {
        return {
            dateKey: day.dateKey,
            title: index === 0 ? "Parim aken on väljas" : `${dateLabel} jääb helgem`,
            summary: `${dateLabel} liigub ${formatTemperature(day.temperatureMin)} kuni ${formatTemperature(day.temperatureMax)} ning kuivema ilmaga osa päevast on lihtsam kätte saada.`
        };
    }

    return {
        dateKey: day.dateKey,
        title: weatherMeta.title,
        summary: `${dateLabel} tuleb ${windLine} ja ${precipitationChance > 35 ? "veidi niiskema" : "rahulikuma"} tooniga, päikest jagub umbes ${Math.max(1, sunshineHours)} tunniks.`
    };
}

function buildWeatherFallbackPlanningTips(snapshot) {
    const tips = [];
    const today = snapshot.daily[0] || snapshot.daily[1];

    if (!today) {
        return [
            "Kontrolli enne väljumist värskeimat prognoosi.",
            "Riietu kihiti, et päev püsiks mugav.",
            "Hoia väike varuplaan käepärast."
        ];
    }

    if (today.precipitationProbabilityMax >= 45 || today.precipitationSum >= 1) {
        tips.push("Võta kaasa vihmakindel kiht.");
    }

    if (today.windGustsMax >= 45 || snapshot.current.windGusts >= 45) {
        tips.push("Tuul on tuntav, pane kapuuts valmis.");
    }

    if ((today.temperatureMax - today.temperatureMin) >= 7) {
        tips.push("Riietu kihiti, hommik ja päev erinevad.");
    }

    if (today.sunshineDuration >= 5 * 3600 && today.precipitationProbabilityMax < 25) {
        tips.push("Pikem väljasolek tasub sättida päeva keskossa.");
    }

    if (snapshot.current.relativeHumidity >= 88 || today.conditionKey === "fog") {
        tips.push("Hommikul arvesta niiskema ja jahedama õhuga.");
    }

    if (today.conditionKey === "snow") {
        tips.push("Jäta liikumiseks veidi rohkem aega.");
    }

    while (tips.length < 3) {
        tips.push([
            "Hoia päeva plaanis natuke paindlikkust.",
            "Väljumisel vaata üle jalanõud ja pealiskiht.",
            "Lühike ilmapaus muudab õues olemise lihtsamaks."
        ][tips.length]);
    }

    return tips.slice(0, 3);
}

function buildWeatherFallbackScenePrompt(snapshot) {
    const currentWeatherMeta = getWeatherCodeMeta(snapshot.current.weatherCode, snapshot.current.isDay);
    const environment = pickWeatherSceneEnvironment(snapshot);
    const timeDescriptor = snapshot.current.isDay
        ? "captured during the actual daytime light of today"
        : "captured during blue hour or evening light matching the current day";

    return [
        "Create a world-class realistic photograph for a weather app background.",
        `Setting: ${getWeatherSeasonDescriptor(snapshot.dateKey)} in Estonia.`,
        `Location mood: a broad Estonia-wide atmosphere, using ${environment} as a believable visual anchor.`,
        `Weather feeling: around ${Math.round(snapshot.current.temperature)} degrees Celsius, ${currentWeatherMeta.key.replaceAll("-", " ")} conditions, ${timeDescriptor}.`,
        "Photography direction: premium editorial travel photography, natural documentary realism, full-bleed landscape frame, atmospheric depth, beautiful real light, crisp detail, tasteful color, no illustration look.",
        "Composition: one coherent real environment only, representative of the day across Estonia, photographed as if an outstanding photographer caught the perfect weather moment of the day. Keep enough clean visual space for overlay UI.",
        "Constraints: no text, no logos, no watermark, no user interface, no collage, no surreal effects, no fake HDR, no large close-up people, no posed portrait."
    ].join(" ");
}

function buildWeatherFallbackNarrative(snapshot) {
    const currentWeatherMeta = getWeatherCodeMeta(snapshot.current.weatherCode, snapshot.current.isDay);
    const today = snapshot.daily[0] || snapshot.daily[1];
    const tomorrow = snapshot.daily[1] || today;
    const todayNote = today ? buildWeatherFallbackDayNote(today, 0) : { title: "Ilm laeb", summary: "Prognoos vajab korraks veel värskendust." };
    const tomorrowNote = tomorrow ? buildWeatherFallbackDayNote(tomorrow, 1) : todayNote;

    return {
        summaryLine: `${capitalizeFirst(currentWeatherMeta.stripLabel)} ${formatTemperature(snapshot.current.temperature)}. Täna ${formatTemperature(today?.temperatureMax || snapshot.current.temperature)} / ${formatTemperature(today?.temperatureMin || snapshot.current.temperature)}.`,
        todayTitle: todayNote.title,
        todaySummary: today
            ? `Praegu on ${currentWeatherMeta.stripLabel} ilm ja päev liigub ${formatTemperature(today.temperatureMin)} kuni ${formatTemperature(today.temperatureMax)} vahemikus.`
            : "Tänane ilmapilt on olemas, aga vajab veel ühe hetke värskendust.",
        todayDetails: today
            ? `Sademete võimalus küünib umbes ${Math.round(today.precipitationProbabilityMax)} protsendini ja tuul püsib ${pickWeatherWindLabel(today.windSpeedMax)} tooniga.`
            : "Hoia hetkeplaan pigem paindlik.",
        tomorrowTitle: tomorrowNote.title,
        tomorrowSummary: tomorrow
            ? `Homme jääb toon ${getWeatherCodeMeta(tomorrow.weatherCode, true).stripLabel} ning temperatuur liigub ${formatTemperature(tomorrow.temperatureMin)} kuni ${formatTemperature(tomorrow.temperatureMax)} vahel.`
            : "Homme kordab suuresti tänast üldpilti.",
        tomorrowDetails: tomorrow
            ? `Kui otsid rahulikumat akent väljas käimiseks, siis tasub hoida silm peal sademetel ja tuulel, mis võivad päeva jooksul veidi kõikuda.`
            : "Homme piisab kihilisest riietusest ja väikesest varuplaanist.",
        planningTips: buildWeatherFallbackPlanningTips(snapshot),
        dayNotes: snapshot.daily.slice(0, WEATHER_FORECAST_DAYS).map(function (day, index) {
            return buildWeatherFallbackDayNote(day, index);
        }),
        scenePrompt: buildWeatherFallbackScenePrompt(snapshot)
    };
}

function buildWeatherSignature(snapshot) {
    return [
        snapshot.dateKey,
        snapshot.current.weatherCode,
        snapshot.current.isDay ? "day" : "night",
        Math.round(snapshot.current.temperature),
        ...snapshot.daily.map(function (day) {
            return [
                day.weatherCode,
                Math.round(day.temperatureMax),
                Math.round(day.temperatureMin),
                Math.round(day.precipitationProbabilityMax / 10)
            ].join("-");
        })
    ].join(":");
}

function normalizeWeatherDayNotes(dayNotes, fallbackDayNotes) {
    const normalizedNotes = Array.isArray(dayNotes) ? dayNotes : [];

    return fallbackDayNotes.map(function (fallbackNote, index) {
        const matchingNote = normalizedNotes.find(function (note) {
            return note?.dateKey === fallbackNote.dateKey;
        }) || normalizedNotes[index] || {};

        return {
            dateKey: normalizeField(matchingNote.dateKey, fallbackNote.dateKey, 20),
            title: normalizeField(matchingNote.title, fallbackNote.title, 64),
            summary: normalizeField(matchingNote.summary, fallbackNote.summary, 170)
        };
    });
}

function normalizeDailyWeatherPayload(snapshot, payload, locationKey, signature, publishedAt = new Date().toISOString()) {
    const fallbackNarrative = buildWeatherFallbackNarrative(snapshot);
    const scenePrompt = normalizeField(payload?.scenePrompt, fallbackNarrative.scenePrompt, 420);
    const sceneKey = buildWeatherSceneKey(snapshot.dateKey, scenePrompt);

    return {
        id: `${snapshot.dateKey}:${locationKey}`,
        locationKey,
        signature,
        dateKey: snapshot.dateKey,
        styleVersion: DAILY_WEATHER_STYLE_VERSION,
        publishedAt,
        summaryLine: normalizeField(payload?.summaryLine, fallbackNarrative.summaryLine, 140),
        todayTitle: normalizeField(payload?.todayTitle, fallbackNarrative.todayTitle, 64),
        todaySummary: normalizeField(payload?.todaySummary, fallbackNarrative.todaySummary, 230),
        todayDetails: normalizeField(payload?.todayDetails, fallbackNarrative.todayDetails, 230),
        tomorrowTitle: normalizeField(payload?.tomorrowTitle, fallbackNarrative.tomorrowTitle, 64),
        tomorrowSummary: normalizeField(payload?.tomorrowSummary, fallbackNarrative.tomorrowSummary, 230),
        tomorrowDetails: normalizeField(payload?.tomorrowDetails, fallbackNarrative.tomorrowDetails, 230),
        planningTips: normalizeTextList(payload?.planningTips, fallbackNarrative.planningTips, 3, 88),
        dayNotes: normalizeWeatherDayNotes(payload?.dayNotes, fallbackNarrative.dayNotes),
        scenePrompt,
        sceneKey,
        coverMediaUrl: normalizeField(payload?.coverMediaUrl, "", 500)
    };
}

function normalizeStoredDailyWeatherEntry(record) {
    if (!record || typeof record !== "object") {
        return null;
    }

    if ((record.styleVersion ?? 0) !== DAILY_WEATHER_STYLE_VERSION) {
        return null;
    }

    const scenePrompt = normalizeField(record.scenePrompt, "", 420);
    const dateKey = normalizeField(record.dateKey, getLocalDateKey(), 20);
    const dayNotes = (Array.isArray(record.dayNotes) ? record.dayNotes : [])
        .map(function (note) {
            return {
                dateKey: normalizeField(note?.dateKey, "", 20),
                title: normalizeField(note?.title, "", 64),
                summary: normalizeField(note?.summary, "", 170)
            };
        })
        .filter(function (note) {
            return note.dateKey && note.title && note.summary;
        })
        .slice(0, WEATHER_FORECAST_DAYS);

    if (!scenePrompt || dayNotes.length !== WEATHER_FORECAST_DAYS) {
        return null;
    }

    return {
        id: normalizeField(record.id, `${dateKey}:${record.locationKey || "weather"}`, 96),
        locationKey: normalizeField(record.locationKey, "", 32),
        signature: normalizeField(record.signature, "", 220),
        dateKey,
        styleVersion: DAILY_WEATHER_STYLE_VERSION,
        publishedAt: new Date(parseTimestamp(record.publishedAt || record.published_at) || Date.now()).toISOString(),
        summaryLine: normalizeField(record.summaryLine, "", 140),
        todayTitle: normalizeField(record.todayTitle, "", 64),
        todaySummary: normalizeField(record.todaySummary, "", 230),
        todayDetails: normalizeField(record.todayDetails, "", 230),
        tomorrowTitle: normalizeField(record.tomorrowTitle, "", 64),
        tomorrowSummary: normalizeField(record.tomorrowSummary, "", 230),
        tomorrowDetails: normalizeField(record.tomorrowDetails, "", 230),
        planningTips: normalizeTextList(record.planningTips, [
            "Hoia päeva plaanis natuke paindlikkust.",
            "Riietu kihiti, et püsida mugav.",
            "Lühike ilmapaus teeb väljas olemise lihtsamaks."
        ], 3, 88),
        dayNotes,
        scenePrompt,
        sceneKey: buildWeatherSceneKey(dateKey, scenePrompt),
        coverMediaUrl: normalizeField(record.coverMediaUrl || record.cover_media_url, "", 500)
    };
}

async function loadDailyWeatherEntries() {
    if (dailyWeatherLoaded) {
        return dailyWeatherEntries;
    }

    if (isSupabaseAdminConfigured()) {
        try {
            const rows = await fetchPublishedEditorialRows("daily_weather", DAILY_WEATHER_CACHE_LIMIT);
            dailyWeatherEntries = rows.map(buildWeatherRecordFromEditorialRow).filter(Boolean);
        } catch (error) {
            console.error("Failed to load daily weather entries from Supabase.", error);
            dailyWeatherEntries = [];
        }
    }

    if (dailyWeatherEntries.length === 0) {
        try {
            const raw = await readFile(dailyWeatherCachePath, "utf8");
            const payload = JSON.parse(raw);

            dailyWeatherEntries = Array.isArray(payload?.entries)
                ? payload.entries.map(normalizeStoredDailyWeatherEntry).filter(Boolean)
                : [];
        } catch (error) {
            if (error?.code !== "ENOENT") {
                console.error("Failed to load daily weather entries.", error);
            }

            dailyWeatherEntries = [];
        }
    }

    dailyWeatherEntries = dailyWeatherEntries
        .slice()
        .sort(function (firstEntry, secondEntry) {
            return parseTimestamp(secondEntry.publishedAt) - parseTimestamp(firstEntry.publishedAt);
        })
        .slice(0, DAILY_WEATHER_CACHE_LIMIT);
    dailyWeatherLoaded = true;

    return dailyWeatherEntries;
}

async function saveDailyWeatherEntries() {
    await mkdir(path.dirname(dailyWeatherCachePath), { recursive: true });
    await writeFile(
        dailyWeatherCachePath,
        JSON.stringify({ entries: dailyWeatherEntries.slice(0, DAILY_WEATHER_CACHE_LIMIT) }, null, 2),
        "utf8"
    );
}

function buildDailyWeatherImageAltText(snapshot) {
    const label = normalizeField(snapshot?.location?.label, WEATHER_DEFAULT_LOCATION.label, 48);
    return `Ilmavaate taustpilt asukohas ${label}`;
}

function cacheWeatherScenePublicUrl(sceneKey, publicUrl) {
    const normalizedUrl = normalizeField(publicUrl, "", 500);

    if (!sceneKey || !normalizedUrl) {
        return normalizedUrl;
    }

    weatherScenePublicUrlCache.set(sceneKey, normalizedUrl);
    dailyWeatherEntries = dailyWeatherEntries.map(function (entry) {
        if (entry.sceneKey !== sceneKey) {
            return entry;
        }

        return {
            ...entry,
            coverMediaUrl: normalizedUrl
        };
    });

    return normalizedUrl;
}

async function generateSharedDailyWeatherScene(snapshot, entry) {
    if (!client || !supabaseAdmin || !entry?.sceneKey) {
        return null;
    }

    const imageResponse = await runWithAiGenerationLog({
        contentType: "daily_weather_image",
        itemSlug: entry.sceneKey,
        model: imageModel,
        promptVersion: EDITORIAL_PROMPT_VERSIONS.daily_weather_image,
        imageSize: "1536x1024",
        imageQuality: "high",
        inputPayload: {
            dateKey: entry.dateKey,
            locationKey: entry.locationKey,
            sceneKey: entry.sceneKey,
            signature: entry.signature,
            imageSize: "1536x1024",
            imageQuality: "high"
        }
    }, async function () {
        return await client.images.generate({
            model: imageModel,
            prompt: entry.scenePrompt,
            size: "1536x1024",
            quality: "high",
            output_format: "jpeg",
            output_compression: 82
        });
    });

    const imageData = imageResponse?.data?.[0]?.b64_json;

    if (!imageData) {
        throw new Error("Weather scene image response did not contain image data.");
    }

    const media = await uploadEditorialImageAsset({
        itemId: null,
        itemSlug: entry.sceneKey,
        contentType: "daily_weather",
        dateKey: entry.dateKey,
        fileBaseName: entry.sceneKey,
        imageBuffer: Buffer.from(imageData, "base64"),
        mimeType: "image/jpeg",
        extension: "jpg",
        altText: buildDailyWeatherImageAltText(snapshot),
        metadata: {
            promptVersion: EDITORIAL_PROMPT_VERSIONS.daily_weather_image,
            locationKey: entry.locationKey,
            signature: entry.signature,
            sceneKey: entry.sceneKey
        }
    });

    await syncDailyWeatherSceneMediaFields(entry.dateKey, media);
    return media;
}

async function persistDailyWeatherEntry(snapshot, entry) {
    const sourceModel = normalizeField(entry?.sourceModel, client ? weatherModel : "fallback", 64);
    const normalizedEntry = normalizeDailyWeatherPayload(
        snapshot,
        entry,
        entry.locationKey || getWeatherLocationKey(snapshot.location.latitude, snapshot.location.longitude),
        entry.signature || buildWeatherSignature(snapshot),
        entry.publishedAt
    );

    if (!isSupabaseAdminConfigured()) {
        return normalizedEntry;
    }

    let row = await upsertEditorialItemRecord({
        slug: buildDailyWeatherSlug(normalizedEntry.dateKey, normalizedEntry.locationKey, normalizedEntry.signature),
        content_type: "daily_weather",
        date_key: normalizedEntry.dateKey,
        location_key: normalizedEntry.locationKey,
        generation_signature: normalizedEntry.signature,
        status: EDITORIAL_STATUS_PUBLISHED,
        title: `Ilm ${normalizeField(snapshot.location.label, WEATHER_DEFAULT_LOCATION.label, 48)}`,
        summary: normalizedEntry.summaryLine,
        payload: {
            summaryLine: normalizedEntry.summaryLine,
            todayTitle: normalizedEntry.todayTitle,
            todaySummary: normalizedEntry.todaySummary,
            todayDetails: normalizedEntry.todayDetails,
            tomorrowTitle: normalizedEntry.tomorrowTitle,
            tomorrowSummary: normalizedEntry.tomorrowSummary,
            tomorrowDetails: normalizedEntry.tomorrowDetails,
            planningTips: normalizedEntry.planningTips,
            dayNotes: normalizedEntry.dayNotes,
            scenePrompt: normalizedEntry.scenePrompt,
            sceneKey: normalizedEntry.sceneKey,
            locationLabel: normalizeField(snapshot.location.label, WEATHER_DEFAULT_LOCATION.label, 48)
        },
        source_model: sourceModel,
        prompt_version: EDITORIAL_PROMPT_VERSIONS.daily_weather,
        style_version: DAILY_WEATHER_STYLE_VERSION,
        published_at: normalizedEntry.publishedAt
    });

    return buildWeatherRecordFromEditorialRow(row) || normalizedEntry;
}

async function requestDailyWeatherFromModel(model, snapshot, locationKey, signature) {
    const aiResponse = await client.responses.create({
        model,
        max_output_tokens: 1300,
        reasoning: {
            effort: "low"
        },
        instructions: [
            "Sa kirjutad eestikeelse ilmavaate elegantsele, lihtsale ja kaasaegsele rakendusele.",
            "Toon peab olema puhas, konkreetne, usaldusväärne ja meeldiv, nagu hea Eesti ilmarubriigi toimetatud tekst.",
            "Kirjuta tavakasutajale arusaadavalt. Väldi üledramatiseerimist, reklaamkeelt, klišeesid ja liigset poeetikat.",
            "summaryLine läheb kitsale ilmaribale. See peab olema üks lühike lause, maksimaalselt umbes 14 sõna.",
            "todayTitle ja tomorrowTitle peavad olema lühikesed pealkirjad, mitte täislõigud.",
            "todaySummary ja tomorrowSummary peavad olema kompaktsed, umbes 1 kuni 2 lauset.",
            "todayDetails ja tomorrowDetails peavad andma veidi praktilisemat tunnetust päeva rütmist, aga jääma lühikeseks.",
            "planningTips peab sisaldama täpselt 3 lühikest praktilist rida, igaüks kuni umbes 8 sõna.",
            "dayNotes peab sisaldama täpselt 5 kirjet samas järjekorras nagu prognoosis antud dateKey väärtused.",
            "Iga dayNotes kirje title peab olema lühike, summary üks kompaktne lause.",
            "Ära maini AI-d, mudelit, JSON-i, prompti ega töövoogu.",
            "scenePrompt peab olema ingliskeelne pildigeneratsiooni prompt päris maailma fotograafilise stseeni jaoks, mitte abstraktse tausta jaoks.",
            "scenePrompt peab valima ühe konkreetse reaalse keskkonna, mis sobib tänase ilmaga: näiteks tänav, rand, sadam, park, metsarada, järveäär või muu usutav päris koht.",
            "scenePrompt peab kirjeldama tulemust nii, nagu suurepärane fotograaf oleks saanud täna ilmast perfektse tabamuse: natural light, editorial travel photography, photorealistic, elegant, atmospheric, real environment.",
            "scenePrompt peab ütlema, et pildil ei tohi olla teksti, logosid, UI elemente, vesimärke, kollaaži, illustratiivset tunnet ega suuri lähikaadreid inimestest.",
            "Tagasta ainult puhas JSON."
        ].join(" "),
        input: [
            `Kuupäev: ${snapshot.dateKey}`,
            `Asukoha silt kasutajaliideses: ${snapshot.location.label}`,
            "Praegune ilm:",
            JSON.stringify({
                time: snapshot.current.time,
                condition: snapshot.current.conditionLabel,
                temperature: snapshot.current.temperature,
                apparentTemperature: snapshot.current.apparentTemperature,
                humidity: snapshot.current.relativeHumidity,
                precipitation: snapshot.current.precipitation,
                windSpeed: snapshot.current.windSpeed,
                windGusts: snapshot.current.windGusts,
                cloudCover: snapshot.current.cloudCover,
                isDay: snapshot.current.isDay
            }, null, 2),
            "Viie päeva prognoos:",
            JSON.stringify(snapshot.daily.map(function (day) {
                return {
                    dateKey: day.dateKey,
                    condition: day.conditionLabel,
                    temperatureMax: day.temperatureMax,
                    temperatureMin: day.temperatureMin,
                    precipitationProbabilityMax: day.precipitationProbabilityMax,
                    precipitationSum: day.precipitationSum,
                    windSpeedMax: day.windSpeedMax,
                    windGustsMax: day.windGustsMax,
                    sunshineDurationHours: Number((day.sunshineDuration / 3600).toFixed(1))
                };
            }), null, 2),
            "Tänase tunnipõhise rütmi väljavõte:",
            JSON.stringify(snapshot.timelines.today.map(function (entry) {
                return {
                    time: entry.time,
                    condition: entry.conditionLabel,
                    temperature: entry.temperature,
                    precipitationProbability: entry.precipitationProbability,
                    windSpeed: entry.windSpeed
                };
            }), null, 2),
            "Homme tunnipõhise rütmi väljavõte:",
            JSON.stringify(snapshot.timelines.tomorrow.map(function (entry) {
                return {
                    time: entry.time,
                    condition: entry.conditionLabel,
                    temperature: entry.temperature,
                    precipitationProbability: entry.precipitationProbability,
                    windSpeed: entry.windSpeed
                };
            }), null, 2),
            `Päeva signatuur: ${signature}`
        ].join("\n"),
        text: {
            verbosity: "low",
            format: {
                type: "json_schema",
                name: "daily_weather_view",
                strict: true,
                schema: DAILY_WEATHER_JSON_SCHEMA
            }
        }
    });

    if (aiResponse.status && aiResponse.status !== "completed") {
        const reason = aiResponse.incomplete_details?.reason || aiResponse.status;
        throw new Error(`Daily weather response incomplete: ${reason}`);
    }

    const payload = extractJsonObject(aiResponse.output_text);
    return normalizeDailyWeatherPayload(snapshot, payload, locationKey, signature);
}

async function generateDailyWeatherEntry(snapshot, locationKey, signature) {
    const fallbackEntry = normalizeDailyWeatherPayload(snapshot, null, locationKey, signature);

    if (!client || !isDefaultWeatherLocation(snapshot.location)) {
        return {
            ...fallbackEntry,
            sourceModel: "fallback"
        };
    }

    const candidateModels = [...new Set([weatherModel, openAiModel, "gpt-4.1"])];
    let lastError = null;

    for (const model of candidateModels) {
        try {
            const generatedEntry = await runWithAiGenerationLog({
                contentType: "daily_weather",
                itemSlug: buildDailyWeatherSlug(snapshot.dateKey, locationKey, signature),
                model,
                promptVersion: EDITORIAL_PROMPT_VERSIONS.daily_weather,
                inputPayload: {
                    dateKey: snapshot.dateKey,
                    locationKey,
                    signature
                }
            }, async function () {
                return await requestDailyWeatherFromModel(model, snapshot, locationKey, signature);
            });

            return {
                ...generatedEntry,
                sourceModel: model
            };
        } catch (error) {
            lastError = error;
            console.error(`Failed to generate daily weather copy with model ${model}.`, error);
        }
    }

    console.error("Failed to generate daily weather copy.", lastError);
    return {
        ...fallbackEntry,
        sourceModel: "fallback"
    };
}

async function ensureDailyWeatherEntry(snapshot) {
    await loadDailyWeatherEntries();

    const locationKey = getWeatherLocationKey(snapshot.location.latitude, snapshot.location.longitude);
    const signature = buildWeatherSignature(snapshot);

    if (isSupabaseAdminConfigured()) {
        try {
            const row = await fetchLatestPublishedDailyWeatherRow(snapshot.dateKey, locationKey);

            if (row) {
                const entry = buildWeatherRecordFromEditorialRow(row);

                if (entry) {
                    return entry;
                }
            }
        } catch (error) {
            console.error("Failed to load current weather entry from Supabase.", error);
        }
    }

    const existingEntry = dailyWeatherEntries.find(function (entry) {
        return entry.locationKey === locationKey && entry.dateKey === snapshot.dateKey;
    });

    if (existingEntry) {
        return existingEntry;
    }

    const generationKey = `${locationKey}:${snapshot.dateKey}`;

    if (!dailyWeatherGenerationPromises.has(generationKey)) {
        dailyWeatherGenerationPromises.set(generationKey, (async function () {
            const entry = await persistDailyWeatherEntry(
                snapshot,
                await generateDailyWeatherEntry(snapshot, locationKey, signature)
            );

            dailyWeatherEntries = [
                entry,
                ...dailyWeatherEntries.filter(function (existing) {
                    return !(existing.locationKey === locationKey && existing.dateKey === snapshot.dateKey);
                })
            ].slice(0, DAILY_WEATHER_CACHE_LIMIT);

            if (!isSupabaseAdminConfigured()) {
                dailyWeatherWritePromise = dailyWeatherWritePromise.then(saveDailyWeatherEntries);
                await dailyWeatherWritePromise;
            }

            return entry;
        }()).finally(function () {
            dailyWeatherGenerationPromises.delete(generationKey);
        }));
    }

    return dailyWeatherGenerationPromises.get(generationKey);
}

async function prepareDefaultDailyWeatherForToday() {
    const forecastSnapshot = await fetchWeatherForecastSnapshot(WEATHER_DEFAULT_LOCATION);
    return await ensureDailyWeatherEntry(forecastSnapshot);
}

async function ensureWeatherSceneForEntry(entry) {
    if (!entry?.sceneKey || !entry?.scenePrompt) {
        return null;
    }

    if (entry.coverMediaUrl) {
        return cacheWeatherScenePublicUrl(entry.sceneKey, entry.coverMediaUrl);
    }

    if (weatherScenePublicUrlCache.has(entry.sceneKey)) {
        return weatherScenePublicUrlCache.get(entry.sceneKey);
    }

    if (supabaseAdmin) {
        const storagePath = buildDailyWeatherSceneStoragePath(entry.dateKey, entry.sceneKey);
        const publicUrl = getEditorialStoragePublicUrl(storagePath);

        if (!weatherSceneGenerationPromises.has(entry.sceneKey)) {
            weatherSceneGenerationPromises.set(entry.sceneKey, (async function () {
                if (await doesEditorialAssetExist(storagePath)) {
                    const media = {
                        storagePath,
                        publicUrl
                    };

                    await syncDailyWeatherSceneMediaFields(entry.dateKey, media);
                    return cacheWeatherScenePublicUrl(entry.sceneKey, publicUrl);
                }

                if (!client) {
                    return null;
                }

                const media = await generateSharedDailyWeatherScene({
                    location: {
                        label: WEATHER_DEFAULT_LOCATION.label
                    }
                }, entry);

                return cacheWeatherScenePublicUrl(entry.sceneKey, media?.publicUrl || "");
            }()).finally(function () {
                weatherSceneGenerationPromises.delete(entry.sceneKey);
            }));
        }

        return weatherSceneGenerationPromises.get(entry.sceneKey);
    }

    const sceneFilePath = getWeatherSceneFilePath(entry.sceneKey);

    if (await doesFileExist(sceneFilePath)) {
        return sceneFilePath;
    }

    if (!client) {
        return null;
    }

    if (!weatherSceneGenerationPromises.has(entry.sceneKey)) {
        weatherSceneGenerationPromises.set(entry.sceneKey, (async function () {
            await mkdir(generatedWeatherSceneDir, { recursive: true });

            const imageResponse = await runWithAiGenerationLog({
                contentType: "daily_weather_image",
                itemSlug: entry.sceneKey,
                model: imageModel,
                promptVersion: EDITORIAL_PROMPT_VERSIONS.daily_weather_image,
                imageSize: "1536x1024",
                imageQuality: "high",
                inputPayload: {
                    dateKey: entry.dateKey,
                    locationKey: entry.locationKey,
                    sceneKey: entry.sceneKey,
                    signature: entry.signature,
                    imageSize: "1536x1024",
                    imageQuality: "high"
                }
            }, async function () {
                return await client.images.generate({
                    model: imageModel,
                    prompt: entry.scenePrompt,
                    size: "1536x1024",
                    quality: "high",
                    output_format: "jpeg",
                    output_compression: 82
                });
            });

            const imageData = imageResponse?.data?.[0]?.b64_json;

            if (!imageData) {
                throw new Error("Weather scene image response did not contain image data.");
            }

            await writeFile(sceneFilePath, Buffer.from(imageData, "base64"));
            return sceneFilePath;
        }()).finally(function () {
            weatherSceneGenerationPromises.delete(entry.sceneKey);
        }));
    }

    return weatherSceneGenerationPromises.get(entry.sceneKey);
}

function buildWeatherResponsePayload(snapshot, entry) {
    const dayNotesByDate = new Map((Array.isArray(entry?.dayNotes) ? entry.dayNotes : []).map(function (note) {
        return [note.dateKey, note];
    }));
    const forecastDays = snapshot.daily.slice(0, WEATHER_FORECAST_DAYS).map(function (day, index) {
        const note = dayNotesByDate.get(day.dateKey) || buildWeatherFallbackDayNote(day, index);

        return {
            ...day,
            label: formatWeatherDayLabel(index),
            noteTitle: note.title,
            noteSummary: note.summary
        };
    });
    const todayForecast = forecastDays[0] || null;
    const tomorrowForecast = forecastDays[1] || forecastDays[0] || null;

    return {
        date: snapshot.dateKey,
        location: snapshot.location,
        summaryLine: entry?.summaryLine || buildWeatherFallbackNarrative(snapshot).summaryLine,
        current: snapshot.current,
        today: {
            ...(todayForecast || {}),
            title: entry?.todayTitle || "",
            summary: entry?.todaySummary || "",
            details: entry?.todayDetails || ""
        },
        tomorrow: {
            ...(tomorrowForecast || {}),
            title: entry?.tomorrowTitle || "",
            summary: entry?.tomorrowSummary || "",
            details: entry?.tomorrowDetails || ""
        },
        forecast: forecastDays,
        timelines: snapshot.timelines,
        planningTips: Array.isArray(entry?.planningTips) ? entry.planningTips : buildWeatherFallbackPlanningTips(snapshot),
        backgroundImageUrl: normalizeField(entry?.coverMediaUrl, "", 500) || (entry?.sceneKey ? `/api/weather-scene/${entry.sceneKey}.jpg` : ""),
        publishedAt: entry?.publishedAt || new Date().toISOString(),
        attribution: {
            forecast: "Open-Meteo",
            editorial: client ? "OpenAI" : "Sisseehitatud varutekst"
        }
    };
}

function isPlaceholderWeatherLocationLabel(label) {
    const normalizedLabel = normalizeField(label, "", 64).toLocaleLowerCase("et-EE");
    return !normalizedLabel || WEATHER_LOCATION_PLACEHOLDERS.has(normalizedLabel);
}

function getWeatherLocationLabelCacheKey(latitude, longitude) {
    return `${roundWeatherCoordinate(latitude, WEATHER_DEFAULT_LOCATION.latitude).toFixed(3)}:${roundWeatherCoordinate(longitude, WEATHER_DEFAULT_LOCATION.longitude).toFixed(3)}`;
}

function pickWeatherLocationLabelFromReverseGeocode(payload, fallbackLabel) {
    const address = payload?.address && typeof payload.address === "object" ? payload.address : {};
    const candidate = [
        address.city,
        address.town,
        address.village,
        address.municipality,
        address.city_district,
        address.suburb,
        payload?.name,
        address.county
    ].find(function (value) {
        return normalizeField(value, "", 64);
    });

    return normalizeField(candidate, fallbackLabel, 48);
}

async function resolveWeatherLocationLabel(requestedLocation) {
    const fallbackLabel = normalizeField(requestedLocation?.label, WEATHER_DEFAULT_LOCATION.label, 48);

    if (!isPlaceholderWeatherLocationLabel(fallbackLabel)) {
        return fallbackLabel;
    }

    const latitude = roundWeatherCoordinate(requestedLocation?.latitude, WEATHER_DEFAULT_LOCATION.latitude);
    const longitude = roundWeatherCoordinate(requestedLocation?.longitude, WEATHER_DEFAULT_LOCATION.longitude);
    const cacheKey = getWeatherLocationLabelCacheKey(latitude, longitude);

    if (weatherLocationLabelCache.has(cacheKey)) {
        return weatherLocationLabelCache.get(cacheKey);
    }

    try {
        const requestUrl = new URL(WEATHER_REVERSE_GEOCODE_URL);

        requestUrl.searchParams.set("format", "jsonv2");
        requestUrl.searchParams.set("lat", String(latitude));
        requestUrl.searchParams.set("lon", String(longitude));
        requestUrl.searchParams.set("accept-language", "et");
        requestUrl.searchParams.set("zoom", "10");

        const response = await fetch(requestUrl, {
            headers: {
                Accept: "application/json",
                "User-Agent": "probleemilahendaja-weather/1.0"
            }
        });

        if (!response.ok) {
            throw new Error(`Reverse geocode request failed with ${response.status}.`);
        }

        const payload = await response.json();
        const resolvedLabel = pickWeatherLocationLabelFromReverseGeocode(payload, fallbackLabel);

        weatherLocationLabelCache.set(cacheKey, resolvedLabel);
        return resolvedLabel;
    } catch (error) {
        console.error("Failed to resolve weather location label.", error);
        return fallbackLabel;
    }
}

function parseWeatherLocationQuery(query) {
    const latitude = roundWeatherCoordinate(query?.lat, WEATHER_DEFAULT_LOCATION.latitude);
    const longitude = roundWeatherCoordinate(query?.lon, WEATHER_DEFAULT_LOCATION.longitude);
    const label = normalizeField(query?.label, WEATHER_DEFAULT_LOCATION.label, 48);

    return {
        latitude,
        longitude,
        label
    };
}

function buildFallbackDailyArticle(dateKey) {
    const theme = getThemeForDate(dateKey);
    const fallbackArticle = theme.fallback;

    return {
        id: dateKey,
        dateKey,
        styleVersion: DAILY_ARTICLE_STYLE_VERSION,
        publishedAt: new Date().toISOString(),
        theme: theme.label,
        title: fallbackArticle.title,
        lead: fallbackArticle.lead,
        highlight: fallbackArticle.highlight,
        bannerNote: fallbackArticle.bannerNote,
        paragraphs: fallbackArticle.paragraphs,
        takeaways: fallbackArticle.takeaways,
        lenses: theme.lenses,
        readingTime: fallbackArticle.readingTime
    };
}

function buildFallbackDailyCoverStory(dateKey) {
    return {
        id: dateKey,
        dateKey,
        styleVersion: DAILY_COVER_STORY_STYLE_VERSION,
        publishedAt: new Date().toISOString(),
        subjectName: "",
        title: "",
        summary: "",
        transcriptSummary: "",
        lead: "",
        paragraphs: [],
        pullQuote: "",
        photoBrief: "",
        imageUrl: "",
        imageAlt: ""
    };
}

function normalizeCoverStoryGalleryImages(value) {
    const images = Array.isArray(value) ? value : [];

    return images
        .slice(0, 4)
        .map(function (image, index) {
            if (!image || typeof image !== "object") {
                return null;
            }

            const url = normalizeField(image.url || image.src, "", 500);

            if (!url) {
                return null;
            }

            return {
                slot: Math.max(1, Math.min(4, Number(image.slot) || index + 1)),
                url,
                alt: normalizeField(image.alt, "", 180),
                caption: normalizeField(image.caption, "", 180)
            };
        })
        .filter(Boolean);
}

function normalizeDailyCoverStoryPayload(dateKey, payload, publishedAt = new Date().toISOString()) {
    const fallbackStory = buildFallbackDailyCoverStory(dateKey);

    return {
        id: dateKey,
        dateKey,
        styleVersion: DAILY_COVER_STORY_STYLE_VERSION,
        publishedAt,
        subjectName: normalizeField(payload.subjectName, fallbackStory.subjectName, 64),
        title: normalizeField(payload.title, fallbackStory.title, 96),
        summary: normalizeField(payload.summary, fallbackStory.summary, 220),
        transcriptSummary: normalizeField(payload.transcriptSummary || payload.transcript_summary, fallbackStory.transcriptSummary, 320),
        lead: normalizeField(payload.lead, fallbackStory.lead, 220),
        paragraphs: normalizeTextList(payload.paragraphs, fallbackStory.paragraphs, 4, 360),
        pullQuote: normalizeField(payload.pullQuote || payload.pull_quote, fallbackStory.pullQuote, 220),
        photoBrief: normalizeField(payload.photoBrief, fallbackStory.photoBrief, 420),
        imageUrl: normalizeField(payload.imageUrl || payload.image_url, fallbackStory.imageUrl, 500),
        imageAlt: normalizeField(payload.imageAlt || payload.image_alt, fallbackStory.imageAlt, 180),
        galleryImages: normalizeCoverStoryGalleryImages(payload.galleryImages || payload.gallery_images)
    };
}

function normalizeStoredDailyCoverStory(record) {
    if (!record || typeof record !== "object") {
        return null;
    }

    if ((record.styleVersion ?? 0) !== DAILY_COVER_STORY_STYLE_VERSION) {
        return null;
    }

    const publishedAt = new Date(parseTimestamp(record.publishedAt || record.published_at) || Date.now()).toISOString();

    const normalizedStory = normalizeDailyCoverStoryPayload(normalizeField(record.dateKey || record.date_key || record.id, getLocalDateKey(), 20), {
        subjectName: record.subjectName || record.subject_name,
        title: record.title,
        summary: record.summary,
        transcriptSummary: record.transcriptSummary || record.transcript_summary,
        lead: record.lead,
        paragraphs: record.paragraphs,
        pullQuote: record.pullQuote || record.pull_quote,
        photoBrief: record.photoBrief || record.photo_brief,
        imageUrl: record.imageUrl || record.image_url,
        imageAlt: record.imageAlt || record.image_alt,
        galleryImages: record.galleryImages || record.gallery_images
    }, publishedAt);

    return {
        ...normalizedStory,
        slug: normalizeField(record.slug, "", 120),
        generationSignature: normalizeField(record.generationSignature || record.generation_signature, "", 200),
        variant: normalizeField(record.variant, "", 32)
    };
}

async function loadDailyCoverStories() {
    if (dailyCoverStoriesLoaded) {
        return dailyCoverStories;
    }

    if (!isSupabaseAdminConfigured()) {
        dailyCoverStories = [];
        dailyCoverStoriesLoaded = true;
        return dailyCoverStories;
    }

    try {
        const rows = await fetchPublishedEditorialRows("daily_article", Math.max(DAILY_COVER_STORY_ARCHIVE_LIMIT * 6, 24));
        const coverStories = await Promise.all(
            rows
                .filter(isInterviewCoverStoryRow)
                .map(enrichCoverStoryRecordFromEditorialRow)
        );

        dailyCoverStories = coverStories
            .map(normalizeStoredDailyCoverStory)
            .filter(function (story) {
                return Boolean(story?.subjectName || story?.imageUrl);
            })
            .sort(function (firstStory, secondStory) {
                return getArchiveSortTimestamp(secondStory) - getArchiveSortTimestamp(firstStory);
            })
            .slice(0, DAILY_COVER_STORY_ARCHIVE_LIMIT);
    } catch (error) {
        console.error("Failed to load interview-based cover story archive from Supabase.", error);
        dailyCoverStories = [];
    }

    dailyCoverStoriesLoaded = true;
    return dailyCoverStories;
}

function upsertDailyCoverStoryInMemory(story) {
    if (!story) {
        return;
    }

    dailyCoverStories = [
        story,
        ...dailyCoverStories.filter(function (existingStory) {
            return existingStory.dateKey !== story.dateKey;
        })
    ]
        .sort(function (firstStory, secondStory) {
            return getArchiveSortTimestamp(secondStory) - getArchiveSortTimestamp(firstStory);
        })
        .slice(0, DAILY_COVER_STORY_ARCHIVE_LIMIT);

    dailyCoverStoriesLoaded = true;
}

function removeDailyCoverStoryFromMemory(dateKey) {
    if (!dateKey) {
        return;
    }

    dailyCoverStories = dailyCoverStories.filter(function (existingStory) {
        return existingStory.dateKey !== dateKey && existingStory.id !== dateKey;
    });
    dailyCoverStoriesLoaded = true;
}

async function getDailyCoverStoryForToday() {
    await loadDailyCoverStories();
    const currentStory = dailyCoverStories[0] || null;

    if (!currentStory || hasDailyCoverStoryDetailContent(currentStory)) {
        return currentStory;
    }

    try {
        const enrichedStory = await enrichDailyCoverStoryFromInterview(currentStory);

        if (enrichedStory) {
            upsertDailyCoverStoryInMemory(enrichedStory);
            return enrichedStory;
        }
    } catch (error) {
        console.error("Failed to enrich daily cover story feature.", error);
    }

    return currentStory;
}

function isDailyArticleTooSoft(article) {
    const compactText = [article.title, article.lead, article.highlight, article.bannerNote].join(" ");
    const fullText = [compactText, ...article.paragraphs].join(" ");
    const brandMentions = fullText.match(/\bLorien Velmore\b/giu) || [];

    if (DAILY_ARTICLE_SOFT_LANGUAGE_REGEX.test(compactText)) {
        return true;
    }

    if (article.highlight.includes(":")) {
        return true;
    }

    if (article.title.split(/\s+/).filter(Boolean).length > 10) {
        return true;
    }

    if (article.lead.split(/\s+/).filter(Boolean).length > 24) {
        return true;
    }

    if (brandMentions.length > 2) {
        return true;
    }

    return false;
}

function normalizeDailyArticlePayload(dateKey, payload, publishedAt = new Date().toISOString()) {
    const fallbackArticle = buildFallbackDailyArticle(dateKey);
    const fallbackTakeaways = fallbackArticle.takeaways;
    const fallbackLenses = fallbackArticle.lenses;

    const normalizedArticle = {
        id: dateKey,
        dateKey,
        styleVersion: DAILY_ARTICLE_STYLE_VERSION,
        publishedAt,
        theme: normalizeLorienField(payload.theme, fallbackArticle.theme, 42),
        title: normalizeLorienField(payload.title, fallbackArticle.title, 98),
        lead: normalizeLorienField(payload.lead, fallbackArticle.lead, 180),
        highlight: normalizeLorienField(payload.highlight, fallbackArticle.highlight, 210),
        bannerNote: normalizeLorienField(payload.bannerNote, fallbackArticle.bannerNote, 190),
        paragraphs: normalizeLorienTextList(payload.paragraphs, fallbackArticle.paragraphs, 4, 360),
        takeaways: normalizeTextList(payload.takeaways, fallbackTakeaways, 3, 52).map(function (value, index) {
            return compactLabel(sanitizeLorienBrandText(value), sanitizeLorienBrandText(fallbackTakeaways[index]), 34);
        }),
        lenses: normalizeTextList(payload.lenses, fallbackLenses, 3, 28).map(function (value, index) {
            return compactLabel(sanitizeLorienBrandText(value), sanitizeLorienBrandText(fallbackLenses[index]), 18);
        }),
        readingTime: normalizeReadingTime(payload.readingTime, fallbackArticle.readingTime),
        imageUrl: normalizeField(payload.imageUrl || payload.image_url, "", 500),
        imageAlt: normalizeField(payload.imageAlt || payload.image_alt, "", 180),
        imageObjectPosition: normalizeField(payload.imageObjectPosition || payload.image_object_position, "", 32)
    };

    if (isDailyArticleTooSoft(normalizedArticle)) {
        return {
            ...fallbackArticle,
            publishedAt,
            imageUrl: normalizedArticle.imageUrl,
            imageAlt: normalizedArticle.imageAlt,
            imageObjectPosition: normalizedArticle.imageObjectPosition
        };
    }

    return normalizedArticle;
}

function normalizeStoredDailyArticle(record) {
    if (!record || typeof record !== "object") {
        return null;
    }

    if ((record.styleVersion ?? 0) !== DAILY_ARTICLE_STYLE_VERSION) {
        return null;
    }

    const publishedAt = new Date(parseTimestamp(record.publishedAt || record.published_at) || Date.now()).toISOString();

    return normalizeDailyArticlePayload(normalizeField(record.dateKey || record.id, getLocalDateKey(), 20), {
            theme: record.theme,
            title: record.title,
            lead: record.lead,
            highlight: record.highlight,
            bannerNote: record.bannerNote || record.banner_note,
            paragraphs: record.paragraphs,
            takeaways: record.takeaways,
            lenses: record.lenses,
            readingTime: record.readingTime,
            imageUrl: record.imageUrl || record.image_url,
            imageAlt: record.imageAlt || record.image_alt,
            imageObjectPosition: record.imageObjectPosition || record.image_object_position
        }, publishedAt);
}

async function loadDailyArticles() {
    if (dailyArticlesLoaded) {
        return dailyArticles;
    }

    if (isSupabaseAdminConfigured()) {
        try {
            const rows = await fetchPublishedEditorialRows("daily_article", DAILY_ARTICLE_ARCHIVE_LIMIT, {
                slugPrefix: "daily-article-"
            });
            dailyArticles = rows.map(buildArticleRecordFromEditorialRow).map(normalizeStoredDailyArticle).filter(Boolean);
        } catch (error) {
            console.error("Failed to load daily article archive from Supabase.", error);
            dailyArticles = [];
        }
    }

    if (dailyArticles.length === 0) {
        try {
            const raw = await readFile(dailyArticleCachePath, "utf8");
            const payload = JSON.parse(raw);

            dailyArticles = Array.isArray(payload?.articles)
                ? payload.articles.map(normalizeStoredDailyArticle).filter(Boolean)
                : [];
        } catch (error) {
            if (error?.code !== "ENOENT") {
                console.error("Failed to load daily article archive.", error);
            }

            dailyArticles = [];
        }
    }

    dailyArticles.sort(function (firstArticle, secondArticle) {
        return getArchiveSortTimestamp(secondArticle) - getArchiveSortTimestamp(firstArticle);
    });
    dailyArticles = dailyArticles.slice(0, DAILY_ARTICLE_ARCHIVE_LIMIT);
    dailyArticlesLoaded = true;

    return dailyArticles;
}

async function persistDailyArticle(article) {
    const slug = buildDailyArticleSlug(article.dateKey);
    const normalizedArticle = normalizeDailyArticlePayload(article.dateKey, article, article.publishedAt);

    if (!isSupabaseAdminConfigured()) {
        return normalizedArticle;
    }

    await upsertEditorialItemRecord({
        slug,
        content_type: "daily_article",
        date_key: normalizedArticle.dateKey,
        location_key: null,
        generation_signature: null,
        status: EDITORIAL_STATUS_PUBLISHED,
        title: normalizedArticle.title,
        summary: normalizedArticle.lead,
        payload: {
            id: normalizedArticle.id,
            theme: normalizedArticle.theme,
            highlight: normalizedArticle.highlight,
            bannerNote: normalizedArticle.bannerNote,
            paragraphs: normalizedArticle.paragraphs,
            takeaways: normalizedArticle.takeaways,
            lenses: normalizedArticle.lenses,
            readingTime: normalizedArticle.readingTime
        },
        cover_media_url: normalizeField(normalizedArticle.imageUrl, "", 500) || undefined,
        source_model: client ? articleModel : "fallback",
        prompt_version: EDITORIAL_PROMPT_VERSIONS.daily_article,
        style_version: DAILY_ARTICLE_STYLE_VERSION,
        published_at: normalizedArticle.publishedAt
    });

    return normalizedArticle;
}

async function saveDailyArticles() {
    await mkdir(path.dirname(dailyArticleCachePath), { recursive: true });
    await writeFile(
        dailyArticleCachePath,
        JSON.stringify({ articles: dailyArticles.slice(0, DAILY_ARTICLE_ARCHIVE_LIMIT) }, null, 2),
        "utf8"
    );
}

function normalizeStoredNewsletterSignup(record) {
    if (!record || typeof record !== "object") {
        return null;
    }

    const email = normalizeEmailAddress(record.email);

    if (!isValidNewsletterEmail(email)) {
        return null;
    }

    return {
        email,
        createdAt: new Date(parseTimestamp(record.createdAt || record.created_at) || Date.now()).toISOString()
    };
}

async function loadNewsletterSignups() {
    if (newsletterSignupsLoaded) {
        return newsletterSignups;
    }

    if (isSupabaseAdminConfigured()) {
        try {
            const { data, error } = await supabaseAdmin
                .from("newsletter_signups")
                .select("email, created_at")
                .order("created_at", { ascending: false })
                .limit(500);

            if (error) {
                throw error;
            }

            newsletterSignups = Array.isArray(data)
                ? data.map(function (row) {
                    return normalizeStoredNewsletterSignup({
                        email: row.email,
                        createdAt: row.created_at
                    });
                }).filter(Boolean)
                : [];
        } catch (error) {
            console.error("Failed to load newsletter signups from Supabase.", error);
            newsletterSignups = [];
        }
    }

    if (newsletterSignups.length === 0) {
        try {
            const raw = await readFile(newsletterSignupsCachePath, "utf8");
            const payload = JSON.parse(raw);

            newsletterSignups = Array.isArray(payload?.signups)
                ? payload.signups.map(normalizeStoredNewsletterSignup).filter(Boolean)
                : [];
        } catch (error) {
            if (error?.code !== "ENOENT") {
                console.error("Failed to load newsletter signups.", error);
            }

            newsletterSignups = [];
        }
    }

    newsletterSignupsLoaded = true;
    return newsletterSignups;
}

async function saveNewsletterSignups() {
    await mkdir(path.dirname(newsletterSignupsCachePath), { recursive: true });
    await writeFile(
        newsletterSignupsCachePath,
        JSON.stringify({ signups: newsletterSignups }, null, 2),
        "utf8"
    );
}

async function addNewsletterSignup(email) {
    const normalizedEmail = normalizeEmailAddress(email);

    if (!isValidNewsletterEmail(normalizedEmail)) {
        return {
            status: "invalid"
        };
    }

    if (isSupabaseAdminConfigured()) {
        const { data: existingSignup, error: existingSignupError } = await supabaseAdmin
            .from("newsletter_signups")
            .select("email, created_at")
            .eq("email_normalized", normalizedEmail)
            .maybeSingle();

        if (existingSignupError) {
            throw existingSignupError;
        }

        if (existingSignup) {
            return {
                status: "existing",
                signup: normalizeStoredNewsletterSignup({
                    email: existingSignup.email,
                    createdAt: existingSignup.created_at
                })
            };
        }

        const { data: insertedSignup, error: insertError } = await supabaseAdmin
            .from("newsletter_signups")
            .insert({
                email: normalizedEmail,
                email_normalized: normalizedEmail,
                source: "homepage-form"
            })
            .select("email, created_at")
            .single();

        if (insertError) {
            throw insertError;
        }

        return {
            status: "created",
            signup: normalizeStoredNewsletterSignup({
                email: insertedSignup.email,
                createdAt: insertedSignup.created_at
            })
        };
    }

    await loadNewsletterSignups();

    const existingSignup = newsletterSignups.find(function (signup) {
        return signup.email === normalizedEmail;
    });

    if (existingSignup) {
        return {
            status: "existing",
            signup: existingSignup
        };
    }

    const signup = {
        email: normalizedEmail,
        createdAt: new Date().toISOString()
    };

    newsletterSignups.unshift(signup);
    newsletterSignupsWritePromise = newsletterSignupsWritePromise.then(saveNewsletterSignups);
    await newsletterSignupsWritePromise;

    return {
        status: "created",
        signup
    };
}

registerInterviewWorkflow({
    app,
    supabaseAdmin,
    openAiClient: client,
    resendClient: resend,
    config: {
        appBaseUrl,
        adminAccessCode,
        interviewUploadBucketName,
        resendFromEmail,
        interviewerModel,
        interviewStoryModel,
        promptVersions: {
            interview_opening: EDITORIAL_PROMPT_VERSIONS.interview_opening,
            interview_turn: EDITORIAL_PROMPT_VERSIONS.interview_turn,
            interview_story: EDITORIAL_PROMPT_VERSIONS.interview_story
        },
        isProduction
    },
    helpers: {
        isSupabaseAdminConfigured,
        normalizeField,
        sanitizeProblemText,
        normalizeDailyCoverStoryPayload,
        normalizeStoredDailyCoverStory,
        normalizeDailyPersonaPayload,
        normalizeStoredDailyPersona,
        buildDailyCoverStorySlug,
        buildCoverStoryRecordFromEditorialRow,
        buildPersonaRecordFromEditorialRow,
        runWithAiGenerationLog,
        upsertEditorialItemRecord,
        updateEditorialItemMediaFields,
        uploadEditorialImageAsset,
        retryAsyncOperation,
        getLocalDateKey,
        editorialStatusPublished: EDITORIAL_STATUS_PUBLISHED,
        dailyCoverStoryStyleVersion: DAILY_COVER_STORY_STYLE_VERSION,
        dailyPersonaStyleVersion: DAILY_PERSONA_STYLE_VERSION,
        upsertDailyCoverStoryInMemory,
        removeDailyCoverStoryFromMemory,
        upsertDailyPersonaInMemory,
        removeDailyPersonaFromMemory
    }
});

async function requestDailyArticleFromModel(model, dateKey, theme) {
    const articleTextVerbosity = /^gpt-4\.1/i.test(model) ? "medium" : "low";
    const aiResponse = await client.responses.create({
        model,
        max_output_tokens: 1200,
        instructions: [
            "Sa kirjutad eestikeelse päevase digi-ajakirja artikli Lorien Velmore'i brändist.",
            "Lorien Velmore mõjub selle rakenduse visuaali põhjal elegantse, moodsa ja galeriiliku seinakunsti brändina.",
            "Kirjuta nagu tugev Eesti interjööri- või elustiiliajakirja toimetaja, mitte nagu reklaamtekstide generaator.",
            "Iga artikkel peab lähtuma ühest väikesest, aga päriselt äratuntavast probleemist: tühi sein, iseloomuta tuba, kinkimise ummik, ajutine kodu, rahutu töönurk või muu sarnane kodu- ja ruumiprobleem.",
            "Näita, kuidas hästi valitud teos aitab seda probleemi lahendada praktiliselt ja esteetiliselt.",
            "Püsi ainult antud päevateemas. Ära ava loos teisi probleemitüüpe ega kõrvalteemasid.",
            "Lase Lorien Velmore'il loos loomulikult esineda 1 kuni 2 korda, mitte igas lõigus.",
            "Ära tee kõva müügijuttu. Ära kasuta kampaania-, hinnapakkumise-, allahindluse- ega üleskutselist reklaamikeelt.",
            "Ära mõtle välja brändi ajalugu, asutajat, tootmisviisi, materjale, kollektsioone ega muid fakte, mida sisendis pole.",
            "Ära maini AI-d, mudelit, prompti, sisu genereerimist ega ühtegi muud meta- või töövoo elementi.",
            "Ära kirjuta terapeutiliselt, spirituaalselt ega liiga pehme elustiiliblogi toonis.",
            "Väldi sõnastusi nagu 'teekond', 'maagia', 'inspireeriv', 'sisemine', 'täiuslik', 'unistuste' või muu udune müügikeel.",
            "Ära kasuta väljamõeldud uuringuid, protsente või eksperte.",
            "Kirjuta loomulikult, vaoshoitult, täpselt ja loetavalt. Lauseehitus peab vahelduma ja iga lõik peab lisama ühe uue tähelepaneku.",
            "Ära kirjuta pikki sissejuhatavaid üldsõnalisi lauseid. Mine teemasse kiiresti.",
            "title peab olema konkreetne, ajakirjalik ja kuni umbes 9 sõna.",
            "lead peab olema lühike, selge ja kuni umbes 24 sõna.",
            "highlight peab olema üks tugev, meeldejääv lause ilma koolonita.",
            "bannerNote peab olema üks lühike lause, mis seob Lorien Velmore'i teose artikli probleemiga loomulikul viisil.",
            "paragraphs peab sisaldama täpselt 4 lõiku, igaüks lühike kuni keskmine, hästi loetav ja sisukas.",
            "takeaways peab sisaldama täpselt 3 lühikest meeldejäävat rida, igaüks maksimaalselt umbes 4 sõna.",
            "lenses peab sisaldama täpselt 3 lühikest märksõna või vaatenurka, igaüks maksimaalselt umbes 2 sõna.",
            "theme peab olema väga lühike, umbes 2 kuni 4 sõna.",
            "readingTime peab olema lühike eestikeelne lugemisaja märge kujul '4 min lugemine'.",
            "Tagasta ainult puhas JSON."
        ].join(" "),
        input: [
            `Kuupäev: ${dateKey}`,
            `Tänane vaatenurk: ${theme.prompt}`,
            `Lensi märksõnad: ${theme.lenses.join(", ")}`,
            "Keskendu ainult sellele ühele tänasele olukorrale ja ära vii lugu teiste koduprobleemide juurde.",
            "Kirjuta lugu nii, et lugeja tunneks pärast lugemist väga selgelt, miks üks Lorien Velmore'i teos võiks tema koju või kingituseks päriselt sobida.",
            "Lugu peab tunduma toimetatud, rahulik ja inimlik, mitte automaatselt kokku pandud."
        ].join("\n"),
        text: {
            verbosity: articleTextVerbosity,
            format: {
                type: "json_schema",
                name: "daily_science_article",
                strict: true,
                schema: DAILY_ARTICLE_JSON_SCHEMA
            }
        }
    });

    if (aiResponse.status && aiResponse.status !== "completed") {
        const reason = aiResponse.incomplete_details?.reason || aiResponse.status;
        throw new Error(`Daily article response incomplete: ${reason}`);
    }

    const payload = extractJsonObject(aiResponse.output_text);
    return normalizeDailyArticlePayload(dateKey, payload);
}

async function generateDailyArticle(dateKey) {
    const fallbackArticle = buildFallbackDailyArticle(dateKey);
    const theme = getThemeForDate(dateKey);

    if (!client) {
        return fallbackArticle;
    }

    const candidateModels = [...new Set([articleModel, "gpt-4.1"])];
    let lastError = null;

    for (const model of candidateModels) {
        try {
            return await runWithAiGenerationLog({
                contentType: "daily_article",
                itemSlug: buildDailyArticleSlug(dateKey),
                model,
                promptVersion: EDITORIAL_PROMPT_VERSIONS.daily_article,
                inputPayload: {
                    dateKey,
                    theme: theme.label,
                    prompt: theme.prompt
                }
            }, async function () {
                return await requestDailyArticleFromModel(model, dateKey, theme);
            });
        } catch (error) {
            lastError = error;
            console.error(`Failed to generate daily article with model ${model}.`, error);
        }
    }

    console.error("Failed to generate daily article.", lastError);
    return fallbackArticle;
}

async function ensureDailyArticleForToday() {
    const todayKey = getLocalDateKey();
    await loadDailyArticles();

    const existingArticle = dailyArticles.find(function (article) {
        return article.dateKey === todayKey || article.id === todayKey;
    });

    if (existingArticle) {
        if (isSupabaseAdminConfigured()) {
            try {
                const remoteRow = await fetchPublishedEditorialRowBySlug(buildDailyArticleSlug(todayKey));

                if (!remoteRow) {
                    const persistedArticle = await persistDailyArticle(existingArticle);

                    dailyArticles = [
                        persistedArticle,
                        ...dailyArticles.filter(function (article) {
                            return article.id !== persistedArticle.id && article.dateKey !== persistedArticle.dateKey;
                        })
                    ].slice(0, DAILY_ARTICLE_ARCHIVE_LIMIT);

                    return persistedArticle;
                }
            } catch (error) {
                console.error("Failed to sync cached daily article to Supabase.", error);
            }
        }

        return existingArticle;
    }

    if (!dailyArticleGenerationPromise) {
        dailyArticleGenerationPromise = (async function () {
            const article = await persistDailyArticle(await generateDailyArticle(todayKey));

            dailyArticles = [
                article,
                ...dailyArticles.filter(function (existing) {
                    return existing.id !== article.id && existing.dateKey !== article.dateKey;
                })
            ].slice(0, DAILY_ARTICLE_ARCHIVE_LIMIT);

            if (!isSupabaseAdminConfigured()) {
                await saveDailyArticles();
            }

            return article;
        }()).finally(function () {
            dailyArticleGenerationPromise = null;
        });
    }

    return dailyArticleGenerationPromise;
}

async function getDailyArticleArchive() {
    await ensureDailyArticleForToday();

    return dailyArticles
        .slice()
        .sort(function (firstArticle, secondArticle) {
            return getArchiveSortTimestamp(secondArticle) - getArchiveSortTimestamp(firstArticle);
        })
        .slice(0, DAILY_ARTICLE_PUBLIC_LIMIT);
}

async function backfillDailyArticles(count = DAILY_ARTICLE_PUBLIC_LIMIT) {
    await loadDailyArticles();
    const remoteArticleDateKeys = new Set();

    if (isSupabaseAdminConfigured()) {
        try {
            const remoteRows = await fetchPublishedEditorialRows("daily_article", DAILY_ARTICLE_ARCHIVE_LIMIT, {
                slugPrefix: "daily-article-"
            });

            remoteRows.forEach(function (row) {
                remoteArticleDateKeys.add(getEditorialDateKey(row));
            });
        } catch (error) {
            console.error("Failed to inspect remote daily article archive.", error);
        }
    }

    const targetDateKeys = getRecentDateKeys(count);

    for (const dateKey of targetDateKeys) {
        const existingArticle = dailyArticles.find(function (article) {
            return article.dateKey === dateKey || article.id === dateKey;
        });

        if (existingArticle && isSupabaseAdminConfigured() && !remoteArticleDateKeys.has(dateKey)) {
            const persistedArticle = await persistDailyArticle(existingArticle);

            dailyArticles = [
                persistedArticle,
                ...dailyArticles.filter(function (article) {
                    return article.id !== persistedArticle.id && article.dateKey !== persistedArticle.dateKey;
                })
            ];
            remoteArticleDateKeys.add(dateKey);
        } else if (!existingArticle) {
            const article = await persistDailyArticle(await generateDailyArticle(dateKey));
            dailyArticles = [
                article,
                ...dailyArticles.filter(function (existing) {
                    return existing.id !== article.id && existing.dateKey !== article.dateKey;
                })
            ];

            if (isSupabaseAdminConfigured()) {
                remoteArticleDateKeys.add(dateKey);
            }
        }
    }

    dailyArticles = dailyArticles
        .slice()
        .sort(function (firstArticle, secondArticle) {
            return getArchiveSortTimestamp(secondArticle) - getArchiveSortTimestamp(firstArticle);
        })
        .slice(0, DAILY_ARTICLE_ARCHIVE_LIMIT);

    if (!isSupabaseAdminConfigured()) {
        await saveDailyArticles();
    }

    return dailyArticles.slice(0, Math.max(1, Number(count) || DAILY_ARTICLE_PUBLIC_LIMIT));
}

function normalizePersonaGalleryImages(value) {
    const images = Array.isArray(value) ? value : [];

    return images
        .slice(0, 4)
        .map(function (image, index) {
            if (!image || typeof image !== "object") {
                return null;
            }

            const url = normalizeField(image.url || image.src, "", 500);

            if (!url) {
                return null;
            }

            return {
                slot: Math.max(1, Math.min(4, Number(image.slot) || index + 1)),
                url,
                alt: normalizeField(image.alt, "", 180),
                caption: normalizeField(image.caption, "", 180)
            };
        })
        .filter(Boolean);
}

function normalizeDailyPersonaPayload(dateKey, payload, publishedAt = new Date().toISOString(), options = {}) {
    const normalizedIdFallback = normalizeField(options.id, dateKey, 96);
    const themeLabelMaxLength = Number.isFinite(options.themeLabelMaxLength)
        ? Math.max(18, Math.floor(options.themeLabelMaxLength))
        : 42;
    const galleryImages = normalizePersonaGalleryImages(payload.galleryImages || payload.gallery_images);
    const emptyParagraphs = ["", "", "", ""];
    const emptyTakeaways = ["", "", ""];

    return {
        id: normalizeField(payload.id, normalizedIdFallback, 96),
        dateKey,
        styleVersion: DAILY_PERSONA_STYLE_VERSION,
        publishedAt,
        theme: compactLabel(
            normalizeField(sanitizeAdministrativeLanguage(payload.theme), "Persoonilugu", 42),
            "Persoonilugu",
            themeLabelMaxLength
        ),
        characterName: normalizeField(payload.characterName, "", 48),
        characterMeta: normalizeField(payload.characterMeta, "", 72),
        title: normalizeField(sanitizeAdministrativeLanguage(payload.title), "", 110),
        lead: normalizeField(sanitizeAdministrativeLanguage(payload.lead), "", 190),
        highlight: normalizeField(sanitizeAdministrativeLanguage(payload.highlight), "", 190),
        resultNote: normalizeField(sanitizeAdministrativeLanguage(payload.resultNote), "", 210),
        photoBrief: normalizeField(payload.photoBrief, "", 320),
        paragraphs: normalizeTextList(
            Array.isArray(payload.paragraphs) ? payload.paragraphs.map(sanitizeAdministrativeLanguage) : payload.paragraphs,
            emptyParagraphs,
            4,
            360
        ),
        takeaways: normalizeTextList(payload.takeaways, emptyTakeaways, 3, 54).map(function (value) {
            return compactLabel(sanitizeAdministrativeLanguage(value), "", 34);
        }),
        readingTime: normalizeReadingTime(payload.readingTime, "4 min lugemine"),
        imageUrl: normalizeField(payload.imageUrl || payload.image_url, "", 500),
        imageAlt: normalizeField(payload.imageAlt || payload.image_alt, "", 180),
        imageObjectPosition: normalizeField(payload.imageObjectPosition || payload.image_object_position, "", 32),
        galleryImages
    };
}

function normalizeStoredDailyPersona(record) {
    if (!record || typeof record !== "object") {
        return null;
    }

    if ((record.styleVersion ?? 0) !== DAILY_PERSONA_STYLE_VERSION) {
        return null;
    }

    const publishedAt = new Date(parseTimestamp(record.publishedAt || record.published_at) || Date.now()).toISOString();
    const normalizedId = normalizeField(record.id || record.slug, getLocalDateKey(), 96);
    return normalizeDailyPersonaPayload(normalizeField(record.dateKey || record.id, getLocalDateKey(), 20), {
        id: normalizedId,
        theme: record.theme,
        characterName: record.characterName || record.character_name,
        characterMeta: record.characterMeta || record.character_meta,
        title: record.title,
        lead: record.lead,
        highlight: record.highlight,
        resultNote: record.resultNote || record.result_note,
        photoBrief: record.photoBrief || record.photo_brief,
        paragraphs: record.paragraphs,
        takeaways: record.takeaways,
        readingTime: record.readingTime,
        imageUrl: record.imageUrl || record.image_url,
        imageAlt: record.imageAlt || record.image_alt,
        imageObjectPosition: record.imageObjectPosition || record.image_object_position,
        galleryImages: record.galleryImages || record.gallery_images
    }, publishedAt, {
        id: normalizedId,
        themeLabelMaxLength: 42
    });
}

async function loadDailyPersonas() {
    if (dailyPersonasLoaded) {
        return dailyPersonas;
    }

    if (!isSupabaseAdminConfigured()) {
        dailyPersonas = [];
        dailyPersonasLoaded = true;
        return dailyPersonas;
    }

    try {
        const rows = await fetchPublishedEditorialRows("daily_persona", DAILY_PERSONA_ARCHIVE_LIMIT, {
            slugPrefix: "interview-persona-"
        });

        dailyPersonas = rows
            .filter(function (row) {
                return !isLegacyBrokenInterviewPersonaRow(row);
            })
            .map(buildPersonaRecordFromEditorialRow)
            .map(normalizeStoredDailyPersona)
            .filter(function (story) {
                return Boolean(story?.title);
            });
    } catch (error) {
        console.error("Failed to load interview-based persona archive from Supabase.", error);
        dailyPersonas = [];
    }

    dailyPersonas.sort(function (firstStory, secondStory) {
        return getArchiveSortTimestamp(secondStory) - getArchiveSortTimestamp(firstStory);
    });
    dailyPersonas = dailyPersonas.slice(0, DAILY_PERSONA_ARCHIVE_LIMIT);
    dailyPersonasLoaded = true;

    return dailyPersonas;
}
function upsertDailyPersonaInMemory(story) {
    if (!story) {
        return;
    }

    // If the archive has not been hydrated from Supabase yet, avoid turning a
    // single freshly published story into the whole in-memory archive.
    if (!dailyPersonasLoaded) {
        return;
    }

    dailyPersonas = [
        story,
        ...dailyPersonas.filter(function (existingStory) {
            return existingStory.id !== story.id;
        })
    ]
        .sort(function (firstStory, secondStory) {
            return getArchiveSortTimestamp(secondStory) - getArchiveSortTimestamp(firstStory);
        })
        .slice(0, DAILY_PERSONA_ARCHIVE_LIMIT);

    dailyPersonasLoaded = true;
}

function removeDailyPersonaFromMemory(storyId) {
    if (!storyId) {
        return;
    }

    if (!dailyPersonasLoaded) {
        return;
    }

    dailyPersonas = dailyPersonas.filter(function (existingStory) {
        return existingStory.id !== storyId;
    });
    dailyPersonasLoaded = true;
}

async function getDailyPersonaArchive() {
    await loadDailyPersonas();

    return dailyPersonas
        .slice()
        .sort(function (firstStory, secondStory) {
            return getArchiveSortTimestamp(secondStory) - getArchiveSortTimestamp(firstStory);
        })
        .slice(0, DAILY_PERSONA_PUBLIC_LIMIT);
}

function buildFallbackDailyHoroscope(dateKey) {
    return {
        dateKey,
        styleVersion: DAILY_HOROSCOPE_STYLE_VERSION,
        publishedAt: new Date().toISOString(),
        signs: HOROSCOPE_SIGNS.map(function (signMeta) {
            const fallbackIndicators = HOROSCOPE_INDICATOR_DEFAULTS[signMeta.id] || {
                money: 3,
                relationships: 3,
                family: 3
            };

            return {
                sign: signMeta.id,
                label: signMeta.label,
                title: signMeta.fallback.title,
                paragraphs: buildFallbackHoroscopeParagraphs(signMeta.fallback),
                indicators: fallbackIndicators
            };
        })
    };
}

function normalizeDailyHoroscopeSignPayload(signMeta, payload) {
    const fallbackSign = signMeta.fallback;
    const fallbackIndicators = HOROSCOPE_INDICATOR_DEFAULTS[signMeta.id] || {
        money: 3,
        relationships: 3,
        family: 3
    };
    const fallbackParagraphs = buildFallbackHoroscopeParagraphs(fallbackSign);

    return {
        sign: signMeta.id,
        label: signMeta.label,
        title: normalizeField(payload?.title, fallbackSign.title, 48),
        paragraphs: normalizeTextList(payload?.paragraphs, fallbackParagraphs, 3, 220),
        indicators: {
            money: normalizeScaleValue(payload?.indicators?.money, fallbackIndicators.money),
            relationships: normalizeScaleValue(payload?.indicators?.relationships, fallbackIndicators.relationships),
            family: normalizeScaleValue(payload?.indicators?.family, fallbackIndicators.family)
        }
    };
}

function normalizeDailyHoroscopePayload(dateKey, payload, publishedAt = new Date().toISOString()) {
    const payloadSigns = Array.isArray(payload?.signs) ? payload.signs : [];

    return {
        dateKey,
        styleVersion: DAILY_HOROSCOPE_STYLE_VERSION,
        publishedAt,
        signs: HOROSCOPE_SIGNS.map(function (signMeta) {
            const matchingPayload = payloadSigns.find(function (entry) {
                return entry?.sign === signMeta.id;
            });

            return normalizeDailyHoroscopeSignPayload(signMeta, matchingPayload);
        })
    };
}

function normalizeStoredDailyHoroscope(record) {
    if (!record || typeof record !== "object") {
        return null;
    }

    if ((record.styleVersion ?? 0) !== DAILY_HOROSCOPE_STYLE_VERSION) {
        return null;
    }

    const dateKey = normalizeField(record.dateKey || record.date_key, getLocalDateKey(), 20);
    const publishedAt = new Date(parseTimestamp(record.publishedAt || record.published_at) || Date.now()).toISOString();

    return normalizeDailyHoroscopePayload(dateKey, {
        signs: record.signs
    }, publishedAt);
}

async function loadDailyHoroscope() {
    if (dailyHoroscopeLoaded) {
        return dailyHoroscope;
    }

    if (isSupabaseAdminConfigured()) {
        try {
            const row = await fetchPublishedEditorialRowBySlug(buildDailyHoroscopeSlug(getLocalDateKey()));
            dailyHoroscope = row ? buildHoroscopeRecordFromEditorialRow(row) : null;
        } catch (error) {
            console.error("Failed to load daily horoscope from Supabase.", error);
            dailyHoroscope = null;
        }
    }

    if (!dailyHoroscope) {
        try {
            const raw = await readFile(dailyHoroscopeCachePath, "utf8");
            const payload = JSON.parse(raw);
            dailyHoroscope = normalizeStoredDailyHoroscope(payload);
        } catch (error) {
            if (error?.code !== "ENOENT") {
                console.error("Failed to load daily horoscope.", error);
            }

            dailyHoroscope = null;
        }
    }

    dailyHoroscopeLoaded = true;
    return dailyHoroscope;
}

async function persistDailyHoroscope(horoscope) {
    if (!horoscope) {
        return horoscope;
    }

    const normalizedHoroscope = normalizeDailyHoroscopePayload(
        horoscope.dateKey,
        horoscope,
        horoscope.publishedAt
    );

    if (!isSupabaseAdminConfigured()) {
        return normalizedHoroscope;
    }

    await upsertEditorialItemRecord({
        slug: buildDailyHoroscopeSlug(normalizedHoroscope.dateKey),
        content_type: "daily_horoscope",
        date_key: normalizedHoroscope.dateKey,
        location_key: null,
        generation_signature: null,
        status: EDITORIAL_STATUS_PUBLISHED,
        title: `Horoskoop ${normalizedHoroscope.dateKey}`,
        summary: "Päeva horoskoop 12 tähemärgile.",
        payload: {
            signs: normalizedHoroscope.signs
        },
        source_model: client ? horoscopeModel : "fallback",
        prompt_version: EDITORIAL_PROMPT_VERSIONS.daily_horoscope,
        style_version: DAILY_HOROSCOPE_STYLE_VERSION,
        published_at: normalizedHoroscope.publishedAt
    });

    return normalizedHoroscope;
}

async function saveDailyHoroscope() {
    await mkdir(path.dirname(dailyHoroscopeCachePath), { recursive: true });
    await writeFile(
        dailyHoroscopeCachePath,
        JSON.stringify(dailyHoroscope, null, 2),
        "utf8"
    );
}

async function generateDailyHoroscope(dateKey) {
    const fallbackHoroscope = buildFallbackDailyHoroscope(dateKey);

    if (!client) {
        return fallbackHoroscope;
    }

    try {
        const aiResponse = await runWithAiGenerationLog({
            contentType: "daily_horoscope",
            itemSlug: buildDailyHoroscopeSlug(dateKey),
            model: horoscopeModel,
            promptVersion: EDITORIAL_PROMPT_VERSIONS.daily_horoscope,
            inputPayload: {
                dateKey
            }
        }, async function () {
            return await client.responses.create({
                model: horoscopeModel,
                max_output_tokens: 2000,
                reasoning: {
                    effort: "low"
                },
                instructions: [
                    "Sa kirjutad eestikeelse päevase horoskoobi 12 tähemärgile.",
                    "Iga tähemärgi tekst peab olema seotud probleemide, hõõrdumise, otsuste, lahtiste otsade või nende lahendamisega.",
                    "Toon peab olema jutustav, voolav ja horoskoobile omane, aga samal ajal maitsekas ja usutav.",
                    "See peab lugedes mõjuma nagu päris horoskoobirubriik, mitte nagu juhend, checklist või lahenduste nimekiri.",
                    "Lauseehitus võib olla horoskoobile omane, näiteks 'täna oled...' või 'päeva peale võib selguda...'.",
                    "Ära alusta kõiki tähemärke sama mustriga ja väldi korduvat mehhaanilist rütmi.",
                    "Ära kasuta sõnu või ideid nagu universum, kosmiline energia, retrograad, vibratsioon, hinge teekond, tervenemine, manifestatsioon.",
                    "Ära maini AI-d, mudelit ega sisu loomise protsessi.",
                    "Iga märgi title peab olema lühike, kuni umbes 4 sõna.",
                    "paragraphs peab sisaldama täpselt 3 lühikest lõiku, mis loevad kokku ühe voolava horoskoobina.",
                    "Esimene lõik peab seadma päeva tooni ja näitama, kuidas lahtised teemad või probleemid sind täna mõjutavad.",
                    "Teine lõik peab kirjeldama, kus kohas pinge, hõõrdumine või mõni lahendamata küsimus end näitab.",
                    "Kolmas lõik peab andma elegantse horoskoobilaadse suuna selle kohta, mis juhtub siis, kui teema käsile võtad või õigel hetkel lõpetad.",
                    "Kirjuta konkreetselt, aga ära muutu käskivaks ega tehniliseks.",
                    "indicators peab andma kolm päeva näidikut skaalal 1 kuni 5: money, relationships, family.",
                    "Näidikud peavad sobima sama päeva tooniga, mitte olema juhuslikud.",
                    "Tagasta ainult puhas JSON."
                ].join(" "),
                input: [
                    `Kuupäev: ${dateKey}`,
                    "Tähemärgid ja toonid:",
                    HOROSCOPE_SIGNS.map(function (signMeta) {
                        return `- ${signMeta.label} (${signMeta.id}): ${signMeta.prompt}`;
                    }).join("\n")
                ].join("\n"),
                text: {
                    verbosity: "low",
                    format: {
                        type: "json_schema",
                        name: "daily_horoscope",
                        strict: true,
                        schema: DAILY_HOROSCOPE_JSON_SCHEMA
                    }
                }
            });
        });

        const payload = extractJsonObject(aiResponse.output_text);
        return normalizeDailyHoroscopePayload(dateKey, payload);
    } catch (error) {
        console.error("Failed to generate daily horoscope.", error);
        return fallbackHoroscope;
    }
}

async function ensureDailyHoroscopeForToday() {
    const todayKey = getLocalDateKey();
    await loadDailyHoroscope();

    if (dailyHoroscope?.dateKey === todayKey) {
        if (isSupabaseAdminConfigured()) {
            try {
                const remoteRow = await fetchPublishedEditorialRowBySlug(buildDailyHoroscopeSlug(todayKey));

                if (!remoteRow) {
                    dailyHoroscope = await persistDailyHoroscope(dailyHoroscope);
                }
            } catch (error) {
                console.error("Failed to sync cached daily horoscope to Supabase.", error);
            }
        }

        return dailyHoroscope;
    }

    if (!dailyHoroscopeGenerationPromise) {
        dailyHoroscopeGenerationPromise = (async function () {
            dailyHoroscope = await persistDailyHoroscope(await generateDailyHoroscope(todayKey));

            if (!isSupabaseAdminConfigured()) {
                await saveDailyHoroscope();
            }

            return dailyHoroscope;
        }()).finally(function () {
            dailyHoroscopeGenerationPromise = null;
        });
    }

    return dailyHoroscopeGenerationPromise;
}

async function getDailyHoroscopeForToday() {
    return ensureDailyHoroscopeForToday();
}

function buildModerationSummary(moderationResult) {
    if (!moderationResult || typeof moderationResult !== "object") {
        return "Moderation result unavailable.";
    }

    const flaggedCategories = Object.entries(moderationResult.categories || {})
        .filter(function ([, isFlagged]) {
            return Boolean(isFlagged);
        })
        .map(function ([category]) {
            return category;
        });

    return JSON.stringify({
        flagged: Boolean(moderationResult.flagged),
        flaggedCategories,
        categoryScores: moderationResult.category_scores || {}
    });
}

function buildProblemRunSlug(prefix, problemText) {
    return `${prefix}:${hashText(String(problemText || "").replace(/\s+/g, " ").trim()).slice(0, 16)}`;
}

async function createPublicFeedProblemText(problemText) {
    const fallbackPublicText = normalizePublicFeedProblemText(problemText);

    if (!client) {
        return fallbackPublicText;
    }

    try {
        const moderationResponse = await client.moderations.create({
            model: "omni-moderation-latest",
            input: problemText
        });

        const moderationResult = moderationResponse.results?.[0] ?? null;
        const moderationSummary = buildModerationSummary(moderationResult);
        const aiResponse = await runWithAiGenerationLog({
            contentType: "problem_public_feed",
            itemSlug: buildProblemRunSlug("public-feed", problemText),
            model: publicFeedModel,
            promptVersion: EDITORIAL_PROMPT_VERSIONS.problem_public_feed,
            inputPayload: {
                problemLength: problemText.length
            }
        }, async function () {
            return await client.responses.create({
                model: publicFeedModel,
                max_output_tokens: 220,
                reasoning: {
                    effort: "low"
                },
                instructions: [
                    "Sa otsustad, milline lühike tekst sobib avalikku 'viimati lahendatud probleemid' loendisse.",
                    "Eesmärk on näidata probleemi sisu lühidalt, aga turvaliselt ja viisakalt.",
                    "Kui originaalis on roppused, solvangud, labasused, ähvardused, seksuaalne otsekõne või muu avalikku loendisse sobimatu sõnastus, kirjuta see ümber pehmemaks või üldisemaks.",
                    "Ära kasuta vastuses roppusi ega solvangulist sõnastust isegi siis, kui need olid sisendis olemas.",
                    "Kui sisu saab turvaliselt lühidalt ümber sõnastada, kasuta visibility='sanitized'.",
                    "Kui tekst on juba avalikuks näitamiseks sobiv, kasuta visibility='original'.",
                    "Kui sisend on nii räige või sobimatu, et seda ei ole mõistlik isegi ümber sõnastada, kasuta visibility='hidden' ja anna neutraalne üldistus.",
                    "publicText peab olema eestikeelne, maksimaalselt umbes 18 sõna ja ühe lühikese lausena või fraasina.",
                    "Tagasta ainult puhas JSON."
                ].join(" "),
                input: [
                    "Originaalne probleem:",
                    problemText,
                    "",
                    "Moderatsiooni kokkuvõte:",
                    moderationSummary
                ].join("\n"),
                text: {
                    verbosity: "low",
                    format: {
                        type: "json_schema",
                        name: "public_feed_problem",
                        strict: true,
                        schema: PUBLIC_FEED_JSON_SCHEMA
                    }
                }
            });
        });

        const payload = extractJsonObject(aiResponse.output_text);

        if (payload.visibility === "hidden") {
            return PUBLIC_FEED_FALLBACK_TEXT;
        }

        return normalizePublicFeedProblemText(payload.publicText);
    } catch (error) {
        console.error("Failed to create public feed problem text.", error);
        return fallbackPublicText;
    }
}

async function createPublicProblemDetailText(problemText) {
    const normalizedOriginalText = normalizePublicProblemDetailText(problemText);
    const fallbackPayload = normalizedOriginalText
        ? containsProfanity(normalizedOriginalText)
            ? {
                publicText: normalizePublicProblemDetailText(maskProfanity(normalizedOriginalText))
                    || PUBLIC_PROBLEM_DETAIL_FALLBACK_TEXT,
                visibility: "sanitized"
            }
            : {
                publicText: normalizedOriginalText,
                visibility: "original"
            }
        : {
            publicText: PUBLIC_PROBLEM_DETAIL_FALLBACK_TEXT,
            visibility: "hidden"
        };

    if (!client || !normalizedOriginalText) {
        return fallbackPayload;
    }

    try {
        const moderationResponse = await client.moderations.create({
            model: "omni-moderation-latest",
            input: normalizedOriginalText
        });

        const moderationResult = moderationResponse.results?.[0] ?? null;
        const moderationSummary = buildModerationSummary(moderationResult);
        const aiResponse = await runWithAiGenerationLog({
            contentType: "problem_public_detail",
            itemSlug: buildProblemRunSlug("public-detail", normalizedOriginalText),
            model: publicFeedModel,
            promptVersion: EDITORIAL_PROMPT_VERSIONS.problem_public_detail,
            inputPayload: {
                problemLength: normalizedOriginalText.length
            }
        }, async function () {
            return await client.responses.create({
                model: publicFeedModel,
                max_output_tokens: 1200,
                reasoning: {
                    effort: "low"
                },
                instructions: [
                    "Sa otsustad, milline täispikk probleemikirjeldus sobib avalikku detailvaatesse.",
                    "Kui tekst on juba viisakas ja avalikuks näitamiseks sobiv, jäta selle sisu, järjestus, toon ja detailsus sisuliselt muutmata.",
                    "Kui tekstis on roppused, solvangud, ähvardused, alandamine, seksuaalne labasus või muu avalikku vaatesse sobimatu sõnastus, kirjuta ümber ainult need kohad.",
                    "Hoia alles kõik olulised faktid, olukorra kirjeldus, esimese isiku vaade ja konkreetne probleem.",
                    "Ära lisa uusi fakte, hinnanguid, lahendusi ega kokkuvõtteid.",
                    "Ära lühenda teksti rohkem kui hädavajalik. Eesmärk ei ole kokkuvõte, vaid avalikult sobiv täispikk kirjeldus.",
                    "Kui sisu on nii räige, et seda ei saa mõistlikult avalikult näidata isegi pärast ümber sõnastamist, kasuta visibility='hidden' ja anna neutraalne lühike üldistus.",
                    "Tagasta ainult puhas JSON."
                ].join(" "),
                input: [
                    "Originaalne probleemikirjeldus:",
                    normalizedOriginalText,
                    "",
                    "Moderatsiooni kokkuvõte:",
                    moderationSummary
                ].join("\n"),
                text: {
                    verbosity: "medium",
                    format: {
                        type: "json_schema",
                        name: "public_problem_detail",
                        strict: true,
                        schema: PUBLIC_FEED_JSON_SCHEMA
                    }
                }
            });
        });

        const payload = extractJsonObject(aiResponse.output_text);
        const publicText = normalizePublicProblemDetailText(payload.publicText);
        const safePublicText = containsProfanity(publicText)
            ? normalizePublicProblemDetailText(maskProfanity(publicText))
            : publicText;

        if (!safePublicText) {
            return fallbackPayload;
        }

        if (payload.visibility === "hidden") {
            return {
                publicText: safePublicText,
                visibility: "hidden"
            };
        }

        return {
            publicText: safePublicText,
            visibility: payload.visibility === "original" && safePublicText === publicText ? "original" : "sanitized"
        };
    } catch (error) {
        console.error("Failed to create public problem detail text.", error);
        return fallbackPayload;
    }
}

function buildFallbackRecentProblemResolutionText(record) {
    const summary = normalizeRecentProblemResolutionText(record?.summary || "");
    const resolution = normalizeRecentProblemResolutionText(record?.resolution || "");
    const analysis = normalizeRecentProblemResolutionText(record?.analysis || "");

    return summary
        || resolution
        || analysis
        || PUBLIC_PROBLEM_RESOLUTION_FALLBACK_TEXT;
}

async function createRecentProblemResolutionText(record, publicDetail) {
    const fallbackText = buildFallbackRecentProblemResolutionText(record);
    const publicProblemText = normalizePublicFeedProblemText(record?.public_problem_text || record?.problem_text || "");
    const publicDetailText = normalizePublicProblemDetailText(publicDetail?.publicText || record?.public_problem_text || record?.problem_text || "");
    const reportSummary = normalizeRecentProblemResolutionText(record?.summary || "");
    const reportAnalysis = normalizeRecentProblemResolutionText(record?.analysis || "");
    const reportResolution = normalizeRecentProblemResolutionText(record?.resolution || "");

    if (!client) {
        return fallbackText;
    }

    try {
        const aiResponse = await runWithAiGenerationLog({
            contentType: "problem_resolution_public",
            itemSlug: buildProblemRunSlug("public-resolution", publicProblemText || publicDetailText),
            model: publicFeedModel,
            promptVersion: EDITORIAL_PROMPT_VERSIONS.problem_resolution_public,
            inputPayload: {
                reportId: sanitizeProblemText(record?.id || "")
            }
        }, async function () {
            return await client.responses.create({
                model: publicFeedModel,
                max_output_tokens: 420,
                reasoning: {
                    effort: "low"
                },
                instructions: [
                    "Sa kirjutad avalikku lahendusteksti rubriiki 'Viimati lahendatud probleemid'.",
                    "See tekst läheb UI-s otse sildi 'Lahendus:' järele.",
                    "Eesmärk on anda tõestus, et konkreetne mure on nüüd maas ja ei vajuta enam peale.",
                    "Kirjuta ainult lõppseisust: mis enam ei sega, mis on nüüd korras ja milline tunne asemele tuli.",
                    "Kasuta konkreetselt selle probleemi enda detaile, et tõestus mõjuks päriselt veenvalt.",
                    "Kui probleemis mainiti näiteks segadust, valu, hirmu, pingeid, katkestusi, häbi või muud kindlat asja, näita just selle asja kadumist või rahunemist.",
                    "Lugejale peab jääma tunne, et ta näeb selle sama konkreetse mure lõppu, mitte üldist motivatsiooniteksti.",
                    "Ära kirjelda samme, protsessi, tööriistu, soovitusi ega seda, kuidas lahendus leiti.",
                    "Ära kasuta igal juhul samu stamp-alguseid nagu 'Probleem sai lahendatud', 'Enam ei ole', 'Nüüd on kõik hästi'.",
                    "Kasuta loomulikku eestikeelset sõnastust ja varieeri avangut.",
                    "Kirjuta pigem 2 kuni 4 lauset või kaks lühikest lõiku, umbes 45 kuni 90 sõna.",
                    "Toon peab olema helge, kindel, mõnus lugeda ja jätma päriselt kergendatud mulje.",
                    "Ära loba, ära korda probleemi ümber sõna-sõnalt, ära kasuta hüüumärke ega korporatiivseid klišeesid.",
                    "Tagasta ainult puhas JSON."
                ].join(" "),
                input: [
                    "Avalik probleemilühend:",
                    publicProblemText,
                    "",
                    "Avalik täispikk kirjeldus:",
                    publicDetailText,
                    "",
                    "Raporti kokkuvõte:",
                    reportSummary || "-",
                    "",
                    "Raporti analüüs:",
                    reportAnalysis || "-",
                    "",
                    "Raporti lõppseis:",
                    reportResolution || "-"
                ].join("\n"),
                text: {
                    verbosity: "low",
                    format: {
                        type: "json_schema",
                        name: "recent_problem_resolution",
                        strict: true,
                        schema: RECENT_PROBLEM_RESOLUTION_JSON_SCHEMA
                    }
                }
            });
        });

        const payload = extractJsonObject(aiResponse.output_text);
        return normalizeRecentProblemResolutionText(payload.resolutionText) || fallbackText;
    } catch (error) {
        console.error("Failed to create recent problem resolution text.", error);
        return fallbackText;
    }
}

async function buildRecentProblemDetail(record) {
    const reportId = sanitizeProblemText(record?.id || "");
    const problemText = String(record?.problem_text || "");
    const cacheKey = `${reportId}:${hashText([
        `resolution-style:${RECENT_PROBLEM_RESOLUTION_STYLE_VERSION}`,
        problemText,
        String(record?.summary || ""),
        String(record?.analysis || ""),
        String(record?.resolution || "")
    ].join("|"))}`;

    if (recentProblemDetailCache.has(cacheKey)) {
        return recentProblemDetailCache.get(cacheKey);
    }

    const publicDetail = await createPublicProblemDetailText(problemText);
    const resolutionText = await createRecentProblemResolutionText(record, publicDetail);
    const payload = {
        reportId,
        publicProblemText: normalizePublicFeedProblemText(record?.public_problem_text || problemText),
        detailText: publicDetail.publicText || PUBLIC_PROBLEM_DETAIL_FALLBACK_TEXT,
        resolutionText,
        problemType: truncate(sanitizeProblemText(record?.problem_type || GENERAL_PROBLEM_CATEGORY.label), 40),
        status: truncate(sanitizeProblemText(record?.status || "Lahendatud"), 24),
        createdAt: new Date(record?.created_at || Date.now()).toISOString(),
        visibility: publicDetail.visibility || "original"
    };

    recentProblemDetailCache.set(cacheKey, payload);

    if (recentProblemDetailCache.size > 60) {
        const oldestKey = recentProblemDetailCache.keys().next().value;

        if (oldestKey) {
            recentProblemDetailCache.delete(oldestKey);
        }
    }

    return payload;
}

function normalizeReport(problemText, payload) {
    const safeProblem = truncate(problemText, 220);
    const category = resolveProblemCategory(payload.typeValue, problemText);

    return {
        title: normalizeField(payload.title, "Olukord on lahendatud", 56),
        lead: normalizeField(
            payload.lead,
            "Lühike ülevaade sellest, mis on nüüd korras ja mis enam ei rõhu.",
            96
        ),
        statusValue: normalizeField(payload.statusValue, "Lahendatud", 30),
        statusMeta: normalizeField(
            payload.statusMeta,
            "Teema on lõpetatud ja varasem pinge ei juhi enam olukorda.",
            64
        ),
        typeValue: normalizeField(category.label, GENERAL_PROBLEM_CATEGORY.label, 34),
        typeMeta: normalizeField(
            payload.typeMeta,
            category.meta,
            72
        ),
        clarityValue: normalizeField(payload.clarityValue, "Rahulik", 24),
        clarityMeta: normalizeField(
            payload.clarityMeta,
            "Praegune seis jätab selge mulje, et probleem on läbi.",
            64
        ),
        originalProblem: normalizeField(payload.originalProblem, safeProblem, 140),
        analysis: normalizeField(
            payload.analysis,
            category.resolved,
            132
        ),
        resolution: normalizeField(
            payload.resolution,
            category.state,
            76
        ),
        summary: normalizeField(
            payload.summary,
            category.summary,
            124
        )
    };
}

function pushRecentProblemReport(publicProblemText, report) {
    recentProblemReports.unshift({
        problemText: normalizePublicFeedProblemText(publicProblemText),
        problemType: truncate(sanitizeProblemText(report?.typeValue || GENERAL_PROBLEM_CATEGORY.label), 40),
        status: truncate(sanitizeProblemText(report?.statusValue || "Lahendatud"), 24),
        createdAt: new Date().toISOString()
    });

    recentProblemReports.splice(RECENT_PROBLEMS_LIMIT);
}

app.get("/api/health", function (_request, response) {
    response.json({
        ok: true,
        openAiConfigured: Boolean(client),
        supabaseEditorialConfigured: isSupabaseAdminConfigured(),
        model: openAiModel
    });
});

app.get("/api/recent-problems", function (_request, response) {
    response.json({
        problems: recentProblemReports
    });
});

app.get("/api/recent-problems/:reportId", async function (request, response) {
    const reportId = sanitizeProblemText(request.params.reportId).toLocaleLowerCase("en-US");

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(reportId)) {
        response.status(400).json({
            error: "Probleemi identifikaator on vigane."
        });
        return;
    }

    if (!isSupabaseAdminConfigured()) {
        response.status(503).json({
            error: "Probleemi detailvaade ei ole praegu saadaval."
        });
        return;
    }

    try {
        const { data, error } = await supabaseAdmin
            .from("reports")
            .select("id, problem_text, public_problem_text, problem_type, status, summary, analysis, resolution, created_at")
            .eq("id", reportId)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) {
            response.status(404).json({
                error: "Seda probleemi ei leitud."
            });
            return;
        }

        response.json({
            problem: await buildRecentProblemDetail(data)
        });
    } catch (error) {
        console.error("Failed to load recent problem detail.", error);
        response.status(500).json({
            error: "Probleemi detaili laadimine ebaõnnestus."
        });
    }
});

app.get("/api/daily-cover-story", async function (_request, response) {
    try {
        const story = await getDailyCoverStoryForToday();

        response.json({
            date: story?.dateKey || null,
            story: story || null
        });
    } catch (error) {
        console.error("Failed to prepare daily cover story.", error);
        response.status(500).json({
            error: "Päeva kaaneloo laadimine ebaõnnestus."
        });
    }
});

app.post("/api/newsletter-signups", async function (request, response) {
    const email = normalizeEmailAddress(request.body?.email);

    if (!isValidNewsletterEmail(email)) {
        response.status(400).json({
            error: "Sisesta korrektne e-post."
        });
        return;
    }

    try {
        const result = await addNewsletterSignup(email);

        response.status(result.status === "created" ? 201 : 200).json({
            status: result.status
        });
    } catch (error) {
        console.error("Failed to save newsletter signup.", error);
        response.status(500).json({
            error: "Liitumine ebaõnnestus."
        });
    }
});

app.get("/api/daily-articles", async function (_request, response) {
    try {
        const articles = await getDailyArticleArchive();

        response.json({
            date: getLocalDateKey(),
            articles
        });
    } catch (error) {
        console.error("Failed to prepare daily articles.", error);
        response.status(500).json({
            error: "Päeva artikli laadimine ebaõnnestus."
        });
    }
});

app.get("/api/daily-personas", async function (_request, response) {
    try {
        const stories = await getDailyPersonaArchive();

        response.json({
            date: getLocalDateKey(),
            stories
        });
    } catch (error) {
        console.error("Failed to prepare daily persona stories.", error);
        response.status(500).json({
            error: "Päeva persooniloo laadimine ebaõnnestus."
        });
    }
});

app.get("/api/daily-horoscope", async function (_request, response) {
    try {
        const horoscope = await getDailyHoroscopeForToday();

        response.json({
            date: horoscope?.dateKey || getLocalDateKey(),
            publishedAt: horoscope?.publishedAt || new Date().toISOString(),
            signs: Array.isArray(horoscope?.signs) ? horoscope.signs : []
        });
    } catch (error) {
        console.error("Failed to prepare daily horoscope.", error);
        response.status(500).json({
            error: "Päeva horoskoobi laadimine ebaõnnestus."
        });
    }
});

app.get("/api/weather", async function (request, response) {
    const requestedLocation = parseWeatherLocationQuery(request.query);

    try {
        const location = {
            ...requestedLocation,
            label: await resolveWeatherLocationLabel(requestedLocation)
        };
        const forecastSnapshot = await fetchWeatherForecastSnapshot(location);
        const weatherEntry = await ensureDailyWeatherEntry(forecastSnapshot);
        const cachedSceneAsset = weatherEntry.coverMediaUrl
            || weatherScenePublicUrlCache.get(weatherEntry.sceneKey)
            || "";

        if (typeof cachedSceneAsset === "string" && /^https?:\/\//iu.test(cachedSceneAsset)) {
            weatherEntry.coverMediaUrl = cachedSceneAsset;
        }

        void ensureWeatherSceneForEntry(weatherEntry).then(function (weatherSceneAsset) {
            if (typeof weatherSceneAsset === "string" && /^https?:\/\//iu.test(weatherSceneAsset)) {
                weatherEntry.coverMediaUrl = weatherSceneAsset;
            }
        }).catch(function (error) {
            console.error("Failed to pre-generate weather scene.", error);
        });

        response.json(buildWeatherResponsePayload(forecastSnapshot, weatherEntry));
    } catch (error) {
        console.error("Failed to prepare daily weather.", error);
        response.status(500).json({
            error: "Ilma laadimine ebaõnnestus."
        });
    }
});

app.get("/api/weather-scene/:sceneFile", async function (request, response) {
    const sceneFile = sanitizeProblemText(request.params.sceneFile).replace(/[^a-z0-9_.-]/giu, "");
    const sceneKey = sceneFile.replace(/\.(?:jpe?g|png|webp)$/iu, "");

    if (!sceneKey) {
        response.status(400).json({
            error: "Ilmapildi võti puudub."
        });
        return;
    }

    try {
        await loadDailyWeatherEntries();

        const matchingEntry = dailyWeatherEntries.find(function (entry) {
            return entry.sceneKey === sceneKey;
        });

        if (!matchingEntry) {
            response.status(404).json({
                error: "Ilmapilti ei leitud."
            });
            return;
        }

        const sceneAsset = await ensureWeatherSceneForEntry(matchingEntry);

        if (typeof sceneAsset === "string" && /^https?:\/\//iu.test(sceneAsset)) {
            response.redirect(302, sceneAsset);
            return;
        }

        const filePath = sceneAsset;

        if (!filePath) {
            response.setHeader("Cache-Control", "public, max-age=3600");
            response.type("image/svg+xml").send(buildWeatherSceneFallbackSvg(matchingEntry));
            return;
        }

        if (!(await doesFileExist(filePath))) {
            response.setHeader("Cache-Control", "public, max-age=3600");
            response.type("image/svg+xml").send(buildWeatherSceneFallbackSvg(matchingEntry));
            return;
        }

        const fileBuffer = await readFile(filePath);

        response.setHeader("Cache-Control", "public, max-age=86400");
        response.type("image/jpeg").send(fileBuffer);
    } catch (error) {
        console.error("Failed to serve weather scene.", error);
        const cachedEntry = dailyWeatherEntries.find(function (entry) {
            return entry.sceneKey === sceneKey;
        });

        if (cachedEntry) {
            response.setHeader("Cache-Control", "public, max-age=3600");
            response.type("image/svg+xml").send(buildWeatherSceneFallbackSvg(cachedEntry));
            return;
        }

        response.status(500).json({
            error: "Ilmapildi laadimine ebaõnnestus."
        });
    }
});

app.post("/api/report", async function (request, response) {
    const problemText = sanitizeProblemText(request.body?.problemText);

    if (!problemText) {
        response.status(400).json({
            error: "Probleemi tekst on puudu."
        });
        return;
    }

    if (!client) {
        response.status(503).json({
            error: "OPENAI_API_KEY puudub serveri keskkonnamuutujatest."
        });
        return;
    }

    try {
        const [openAiResponse, publicProblemText] = await Promise.all([
            runWithAiGenerationLog({
                contentType: "problem_report",
                itemSlug: buildProblemRunSlug("report", problemText),
                model: openAiModel,
                promptVersion: EDITORIAL_PROMPT_VERSIONS.problem_report,
                inputPayload: {
                    problemLength: problemText.length
                }
            }, async function () {
                return await client.responses.create({
                    model: openAiModel,
                    max_output_tokens: 1400,
                    reasoning: {
                        effort: "low"
                    },
                    instructions: REPORT_SYSTEM_PROMPT,
                    input: [
                        "Koosta selle sisendi põhjal üks professionaalne ja positiivne raport.",
                        "Oluline:",
                        "- title peab olema lühike, lööv ja 2 kuni 5 sõna pikk",
                        "- lead peab olema üks lühike lause, umbes kuni 12 sõna",
                        "- statusValue peab olema täpselt 'Lahendatud'",
                        `- typeValue peab olema täpselt üks neist kategooriatest: ${PROBLEM_CATEGORY_LABELS.join(", ")}`,
                        "- statusMeta, typeMeta ja clarityMeta peavad olema lühikesed kõrvalread, mitte pikad selgitused",
                        "- clarityValue peab olema väga lühike, eelistatult 1 kuni 2 sõna",
                        "- resolution peab kirjeldama ainult praegust lõppseisu, olema väga kompaktne ja umbes 6 kuni 10 sõna piires",
                        "- analysis peab ütlema ühes lühikeses lauses, mis täpselt sai lahendatud",
                        "- summary peab olema üks lühike lause, mis jätab mulje, et see teema enam ei ole päriselt probleem",
                        "- originalProblem peab olema kasutaja sisendi lühike või täpne eestikeelne kuju",
                        "- kõik väljad peavad olema eestikeelsed",
                        "- ära kirjelda protsessi, lahenduskäiku, tegevusplaani ega seda, mida täpselt tehti",
                        "- toon peab jääma professionaalseks, rahulikuks ja kindlaks",
                        "",
                        "Kasutaja probleem:",
                        problemText
                    ].join("\n"),
                    text: {
                        verbosity: "low",
                        format: {
                            type: "json_schema",
                            name: "problem_report",
                            strict: true,
                            schema: REPORT_JSON_SCHEMA
                        }
                    }
                });
            }),
            createPublicFeedProblemText(problemText)
        ]);

        const payload = extractJsonObject(openAiResponse.output_text);
        const report = normalizeReport(problemText, payload);
        pushRecentProblemReport(publicProblemText, report);

        response.json({
            report,
            publicProblemText,
            model: openAiModel
        });
    } catch (error) {
        console.error("Failed to generate OpenAI report.", error);
        response.status(502).json({
            error: "OpenAI raporti loomine ebaõnnestus."
        });
    }
});

function getCliNumericFlag(flagName, fallbackValue) {
    const directFlag = process.argv.find(function (value) {
        return value.startsWith(`${flagName}=`);
    });

    if (directFlag) {
        const directValue = Number(directFlag.split("=")[1]);
        return Number.isFinite(directValue) && directValue > 0 ? directValue : fallbackValue;
    }

    const flagIndex = process.argv.indexOf(flagName);

    if (flagIndex === -1) {
        return fallbackValue;
    }

    const nextValue = Number(process.argv[flagIndex + 1]);
    return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : fallbackValue;
}

async function warmupEditorialBundleForDate(dateKey) {
    const [coverStory, article, horoscope, weather] = await Promise.all([
        getDailyCoverStoryForToday(),
        ensureDailyArticleForToday(),
        ensureDailyHoroscopeForToday(),
        prepareDefaultDailyWeatherForToday()
    ]);

    if (weather) {
        try {
            await ensureWeatherSceneForEntry(weather);
        } catch (error) {
            console.error("Failed to warm up daily weather scene.", error);
        }
    }

    lastEditorialWarmupDateKey = dateKey;

    return {
        coverStory,
        article,
        persona: null,
        horoscope,
        weather
    };
}

function scheduleEditorialWarmup() {
    const runWarmup = async function () {
        const todayKey = getLocalDateKey();

        if (lastEditorialWarmupDateKey === todayKey) {
            return null;
        }

        if (!editorialWarmupPromise) {
            editorialWarmupPromise = (async function () {
                try {
                    return await warmupEditorialBundleForDate(todayKey);
                } catch (error) {
                    console.error("Failed to warm up daily editorial bundle.", error);
                    return null;
                } finally {
                    editorialWarmupPromise = null;
                }
            }());
        }

        return editorialWarmupPromise;
    };

    void runWarmup();
    return setInterval(function () {
        void runWarmup();
    }, EDITORIAL_WARMUP_INTERVAL_MS);
}

async function maybeRunBackfillCli() {
    if (!process.argv.some(function (value) {
        return value === "--backfill-content" || value.startsWith("--backfill-content=");
    })) {
        return false;
    }

    const requestedCount = getCliNumericFlag("--backfill-content", DAILY_ARTICLE_PUBLIC_LIMIT);
    const articleCount = Math.max(1, Math.min(DAILY_ARTICLE_ARCHIVE_LIMIT, requestedCount));

    console.log(`Backfilling ${articleCount} Lorien articles, today's horoscope and default weather...`);

    try {
        const [articles, horoscope, weather] = await Promise.all([
            backfillDailyArticles(articleCount),
            ensureDailyHoroscopeForToday(),
            prepareDefaultDailyWeatherForToday()
        ]);

        console.log("Backfill complete.");
        console.log(`Lorien archive: ${articles.length} entries`);
        console.log(`Horoscope date: ${horoscope?.dateKey || getLocalDateKey()}`);
        console.log(`Default weather date: ${weather?.dateKey || getLocalDateKey()}`);
        return true;
    } catch (error) {
        console.error("Backfill failed.", error);
        process.exitCode = 1;
        return true;
    }
}

if (isProduction) {
    const distPath = path.join(__dirname, "dist");

    app.use(express.static(distPath));
    app.get(/.*/, function (_request, response) {
        response.sendFile(path.join(distPath, "index.html"));
    });
}

const ranBackfillCli = await maybeRunBackfillCli();

if (!ranBackfillCli) {
    scheduleEditorialWarmup();
    app.listen(port, "0.0.0.0", function () {
        console.log(
            isProduction
                ? `Probleemilahendaja server listening on http://0.0.0.0:${port}`
                : `Probleemilahendaja API listening on http://0.0.0.0:${port}`
        );
    });
}

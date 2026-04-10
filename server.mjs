import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const isProduction = process.argv.includes("--production");
const port = Number(process.env.PORT || 8787);
const openAiModel = process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";
const publicFeedModel = process.env.OPENAI_PUBLIC_FEED_MODEL?.trim() || openAiModel;
const articleModel = process.env.OPENAI_ARTICLE_MODEL?.trim() || openAiModel;
const horoscopeModel = process.env.OPENAI_HOROSCOPE_MODEL?.trim() || openAiModel;
const appTimeZone = process.env.APP_TIMEZONE?.trim() || "Europe/Tallinn";
const openAiApiKey = process.env.OPENAI_API_KEY?.trim() || "";
const client = openAiApiKey ? new OpenAI({ apiKey: openAiApiKey }) : null;
const recentProblemReports = [];
const dailyArticleCachePath = path.join(__dirname, ".cache", "daily-articles.json");
const dailyHoroscopeCachePath = path.join(__dirname, ".cache", "daily-horoscope.json");
const newsletterSignupsCachePath = path.join(__dirname, ".cache", "newsletter-signups.json");
const RECENT_PROBLEMS_LIMIT = 6;
const DAILY_ARTICLE_ARCHIVE_LIMIT = 10;
const DAILY_ARTICLE_PUBLIC_LIMIT = 4;
const DAILY_ARTICLE_STYLE_VERSION = 3;
const DAILY_HOROSCOPE_STYLE_VERSION = 4;
const NEWSLETTER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const PUBLIC_FEED_TEXT_LIMIT = 180;
const PUBLIC_FEED_FALLBACK_TEXT = "Üks terava sõnastusega probleem sai lahendatud.";
const PUBLIC_FEED_PROFANITY_REGEX = /\b(?:pers(?:e|se|es|et|ed|ega|ele|el|esse|est|i)?|t(?:ü|y)r(?:a|ad|aga|ale|al|ast|i)?|munn(?:i|e|id|idega|ile|il|ist)?|vitt(?:u|i|e|ud|idega|ile|is|a)?|niku(?:da|n|d|b|s|tud|ga|le)?|pask(?:a|e|i|aks|aga|ale|as|ast|u)?|sit(?:t|a|ad|ane|ase|aks|aga|ale|as|ast)?|hui(?:a|i|d|ga|le|s)?|fuck(?:ing|ed|er|s)?|shit(?:ty|ted|ting|s)?)\b/giu;
const DAILY_ARTICLE_SOFT_LANGUAGE_REGEX = /\b(?:teekond|hingetõmme|kergus|maagia|pehme|õrn|soe|inspireer|lohut|sisemine|eneseusk|päriselt|päris|hing|süda|hell)\b/iu;
let dailyArticles = [];
let dailyArticlesLoaded = false;
let dailyArticleGenerationPromise = null;
let dailyHoroscope = null;
let dailyHoroscopeLoaded = false;
let dailyHoroscopeGenerationPromise = null;
let newsletterSignups = [];
let newsletterSignupsLoaded = false;
let newsletterSignupsWritePromise = Promise.resolve();

const DAILY_ARTICLE_THEMES = [
    {
        label: "Kognitiivne koormus",
        prompt: "miks lahendamata probleemid hoiavad tähelepanu kinni ja võtavad vaimset tööruumi",
        lenses: ["Tähelepanu", "Mälukoormus", "Selgus"]
    },
    {
        label: "Kontrollitunne",
        prompt: "miks probleemiga tegelemine taastab mõju, suutlikkuse ja sisemise kontrollitunde",
        lenses: ["Mõju", "Enesetõhusus", "Hoog"]
    },
    {
        label: "Stressi vähenemine",
        prompt: "miks lõpetatud probleem langetab pingefooni ja aitab kehal ning mõtetel rahuneda",
        lenses: ["Stress", "Taastumine", "Kergus"]
    },
    {
        label: "Otsustusjõud",
        prompt: "miks lahendatud takistus vabastab otsustusruumi järgmiste sammude jaoks",
        lenses: ["Valikud", "Suund", "Fookus"]
    },
    {
        label: "Suhted ja usaldus",
        prompt: "miks probleemide lahendamine hoiab usaldust, koostööd ja suhteid tervemana",
        lenses: ["Usaldus", "Koostöö", "Turvatunne"]
    },
    {
        label: "Harjumused ja hoog",
        prompt: "miks isegi väikesed lahendused kasvatavad tegutsemisharjumust ja eneseusku",
        lenses: ["Harjumus", "Tegutsemine", "Eneseusk"]
    }
];

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
        typeValue: { type: "string" },
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

const DAILY_ARTICLE_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["theme", "title", "lead", "highlight", "paragraphs", "takeaways", "lenses", "readingTime"],
    properties: {
        theme: { type: "string" },
        title: { type: "string" },
        lead: { type: "string" },
        highlight: { type: "string" },
        paragraphs: {
            type: "array",
            minItems: 3,
            maxItems: 3,
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

function getThemeForDate(dateKey) {
    const numericKey = Number(String(dateKey).replaceAll("-", "")) || 0;
    return DAILY_ARTICLE_THEMES[numericKey % DAILY_ARTICLE_THEMES.length];
}

function parseTimestamp(value) {
    const timestamp = new Date(value || "").getTime();

    return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildFallbackDailyArticle(dateKey) {
    const theme = getThemeForDate(dateKey);

    return {
        id: dateKey,
        dateKey,
        styleVersion: DAILY_ARTICLE_STYLE_VERSION,
        publishedAt: new Date().toISOString(),
        theme: theme.label,
        title: "Miks lõpetatud probleem vähendab vaimset koormust",
        lead: "Lahendamata küsimus jääb tähelepanu külge. Kui teema saab lõpetatud, väheneb hajus koormus ja järgmised otsused muutuvad lihtsamaks.",
        highlight: "Lõpetatud teema võtab vähem tähelepanu.",
        paragraphs: [
            "Lõpetamata probleemid jäävad töömälu ja tähelepanu külge ka siis, kui inimene tegeleb juba millegi muuga. See tähendab, et osa vaimsest ressursist on kogu aeg broneeritud lahtise teema jaoks.",
            "Kui küsimus saab otsuse või lahenduse, langeb vajadus seda peas uuesti läbi mängida. Tulemuseks ei ole tingimata hea tuju, vaid pigem väiksem taustakoormus ja selgem järgmine samm.",
            "Sellepärast on probleemide lahendamine praktiline viis vähendada vaimset müra. Vähem lahtisi otsi tähendab vähem hajumist, vähem pingeid ja täpsemat keskendumist."
        ],
        takeaways: [
            "Vähem taustamüra",
            "Rohkem otsustusruumi",
            "Selgem järgmine samm"
        ],
        lenses: theme.lenses,
        readingTime: "3 min lugemine"
    };
}

function isDailyArticleTooSoft(article) {
    const compactText = [article.title, article.lead, article.highlight].join(" ");

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
        theme: normalizeField(payload.theme, fallbackArticle.theme, 42),
        title: normalizeField(payload.title, fallbackArticle.title, 98),
        lead: normalizeField(payload.lead, fallbackArticle.lead, 180),
        highlight: normalizeField(payload.highlight, fallbackArticle.highlight, 210),
        paragraphs: normalizeTextList(payload.paragraphs, fallbackArticle.paragraphs, 3, 360),
        takeaways: normalizeTextList(payload.takeaways, fallbackTakeaways, 3, 52).map(function (value, index) {
            return compactLabel(value, fallbackTakeaways[index], 34);
        }),
        lenses: normalizeTextList(payload.lenses, fallbackLenses, 3, 28).map(function (value, index) {
            return compactLabel(value, fallbackLenses[index], 18);
        }),
        readingTime: normalizeField(payload.readingTime, fallbackArticle.readingTime, 24)
    };

    if (isDailyArticleTooSoft(normalizedArticle)) {
        return {
            ...fallbackArticle,
            publishedAt
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
            paragraphs: record.paragraphs,
            takeaways: record.takeaways,
            lenses: record.lenses,
            readingTime: record.readingTime
        }, publishedAt);
}

async function loadDailyArticles() {
    if (dailyArticlesLoaded) {
        return dailyArticles;
    }

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

    dailyArticles.sort(function (firstArticle, secondArticle) {
        return parseTimestamp(secondArticle.publishedAt || secondArticle.dateKey)
            - parseTimestamp(firstArticle.publishedAt || firstArticle.dateKey);
    });
    dailyArticles = dailyArticles.slice(0, DAILY_ARTICLE_ARCHIVE_LIMIT);
    dailyArticlesLoaded = true;

    return dailyArticles;
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
    await loadNewsletterSignups();

    const normalizedEmail = normalizeEmailAddress(email);

    if (!isValidNewsletterEmail(normalizedEmail)) {
        return {
            status: "invalid"
        };
    }

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

async function generateDailyArticle(dateKey) {
    const fallbackArticle = buildFallbackDailyArticle(dateKey);
    const theme = getThemeForDate(dateKey);

    if (!client) {
        return fallbackArticle;
    }

    try {
        const aiResponse = await client.responses.create({
            model: articleModel,
            max_output_tokens: 1100,
            reasoning: {
                effort: "low"
            },
            instructions: [
                "Sa kirjutad eestikeelse päevase miniartikli probleemide lahendamise väärtusest.",
                "Artikkel peab tunduma tark, täpne, rahulik ja usutav.",
                "Toetu üldisele teadmisele käitumisteadusest, stressipsühholoogiast, tähelepanu uurimisest, otsustuspsühholoogiast või sotsiaalpsühholoogiast.",
                "Ära mõtle välja konkreetseid uuringuid, teadlasi, ülikoole, aastaarve ega täpseid protsente.",
                "Kui põhjendad midagi teaduspõhiselt, tee seda kontseptsioonide tasemel, mitte väljamõeldud viidetega.",
                "Ära kirjuta tervisealaseid lubadusi, diagnoose ega teraapiasoovitusi.",
                "Kirjuta nagu hea ajakirjanduslik lühitekst: selge, otse, ilma loosungite ja ilustamiseta.",
                "Ära ole poeetiline, inspireeriv, terapeutiline, lohutav ega sentimentaalne.",
                "Ära kasuta metafoore, kujundeid, loosungeid ega sõnamänge.",
                "Väldi sõnastusi nagu 'päriselt', 'teekond', 'sisemine kindlus', 'kergus', 'hoog', 'hingetõmme' või muud pehmet müügikeelt.",
                "Eelista põhjus-tagajärg lauseid ja konkreetset keelt.",
                "title peab olema lühike ja konkreetne, kuni umbes 8 sõna.",
                "lead peab olema kuni umbes 22 sõna.",
                "highlight peab olema üks lühike, kuiv lause ilma koolonita.",
                "paragraphs peab sisaldama täpselt 3 lühikest, sisukat lõiku.",
                "takeaways peab sisaldama täpselt 3 lühikest meeldejäävat rida, igaüks maksimaalselt umbes 4 sõna.",
                "lenses peab sisaldama täpselt 3 lühikest märksõna või vaatenurka, igaüks maksimaalselt umbes 2 sõna.",
                "theme peab olema väga lühike, umbes 2 kuni 4 sõna.",
                "readingTime peab olema lühike eestikeelne lugemisaja märge kujul '3 min lugemine'.",
                "Tagasta ainult puhas JSON."
            ].join(" "),
            input: [
                `Kuupäev: ${dateKey}`,
                `Tänane vaatenurk: ${theme.prompt}`,
                "Selgita, miks probleemi lahendamine vähendab vaimset koormust, muudab otsustamise lihtsamaks ja jätab vähem lahtisi otsi."
            ].join("\n"),
            text: {
                verbosity: "low",
                format: {
                    type: "json_schema",
                    name: "daily_science_article",
                    strict: true,
                    schema: DAILY_ARTICLE_JSON_SCHEMA
                }
            }
        });

        const payload = extractJsonObject(aiResponse.output_text);
        return normalizeDailyArticlePayload(dateKey, payload);
    } catch (error) {
        console.error("Failed to generate daily article.", error);
        return fallbackArticle;
    }
}

async function ensureDailyArticleForToday() {
    const todayKey = getLocalDateKey();
    await loadDailyArticles();

    const existingArticle = dailyArticles.find(function (article) {
        return article.dateKey === todayKey || article.id === todayKey;
    });

    if (existingArticle) {
        return existingArticle;
    }

    if (!dailyArticleGenerationPromise) {
        dailyArticleGenerationPromise = (async function () {
            const article = await generateDailyArticle(todayKey);

            dailyArticles = [
                article,
                ...dailyArticles.filter(function (existing) {
                    return existing.id !== article.id && existing.dateKey !== article.dateKey;
                })
            ].slice(0, DAILY_ARTICLE_ARCHIVE_LIMIT);

            await saveDailyArticles();
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
            return parseTimestamp(secondArticle.publishedAt || secondArticle.dateKey)
                - parseTimestamp(firstArticle.publishedAt || firstArticle.dateKey);
        })
        .slice(0, DAILY_ARTICLE_PUBLIC_LIMIT);
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

    dailyHoroscopeLoaded = true;
    return dailyHoroscope;
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
        const aiResponse = await client.responses.create({
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
        return dailyHoroscope;
    }

    if (!dailyHoroscopeGenerationPromise) {
        dailyHoroscopeGenerationPromise = (async function () {
            dailyHoroscope = await generateDailyHoroscope(todayKey);
            await saveDailyHoroscope();
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
        const aiResponse = await client.responses.create({
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

function normalizeReport(problemText, payload) {
    const safeProblem = truncate(problemText, 220);

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
        typeValue: normalizeField(payload.typeValue, "Üldine olukord", 34),
        typeMeta: normalizeField(
            payload.typeMeta,
            "See teema on nüüd rahunenud ja lõpptulemus mõjub kindlalt.",
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
            "Lahenes see osa olukorrast, mis tekitas pinge, segaduse või pideva ebamugavuse.",
            132
        ),
        resolution: normalizeField(
            payload.resolution,
            "Praegune seis on rahulik ja lõpetatud ning varasem probleem ei määra enam tervikut.",
            76
        ),
        summary: normalizeField(
            payload.summary,
            "See teema on nüüd lõpetatud ning asemele on tulnud selgem ja kergem tunne.",
            124
        )
    };
}

function pushRecentProblemReport(publicProblemText, report) {
    recentProblemReports.unshift({
        problemText: normalizePublicFeedProblemText(publicProblemText),
        problemType: truncate(sanitizeProblemText(report?.typeValue || "Üldine olukord"), 40),
        status: truncate(sanitizeProblemText(report?.statusValue || "Lahendatud"), 24),
        createdAt: new Date().toISOString()
    });

    recentProblemReports.splice(RECENT_PROBLEMS_LIMIT);
}

app.get("/api/health", function (_request, response) {
    response.json({
        ok: true,
        openAiConfigured: Boolean(client),
        model: openAiModel
    });
});

app.get("/api/recent-problems", function (_request, response) {
    response.json({
        problems: recentProblemReports
    });
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
            client.responses.create({
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
                    "- typeValue peab olema lühike, selge ja mitte liiga tehniline",
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

if (isProduction) {
    const distPath = path.join(__dirname, "dist");

    app.use(express.static(distPath));
    app.get(/.*/, function (_request, response) {
        response.sendFile(path.join(distPath, "index.html"));
    });
}

app.listen(port, "0.0.0.0", function () {
    console.log(
        isProduction
            ? `Probleemilahendaja server listening on http://0.0.0.0:${port}`
            : `Probleemilahendaja API listening on http://0.0.0.0:${port}`
    );
});

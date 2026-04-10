import {
    createProblemReport,
    fetchRecentProblemReports,
    fetchSolvedReportsTotal,
    getOrCreateSessionId,
    isSupabaseConfigured,
    subscribeToReportInserts,
    submitProblemRating
} from "./supabase.js";

const body = document.body;
const container = document.querySelector(".container");
const loadingDiv = document.getElementById("loading");
const solutionDiv = document.getElementById("solution");
const reportDiv = document.getElementById("report");
const problemInput = document.getElementById("problemInput");
const problemFeedback = document.getElementById("problemFeedback");
const solveButton = document.getElementById("solveButton");
const loadingProgressBar = document.getElementById("loadingProgressBar");
const loadingProgressValue = document.getElementById("loadingProgressValue");
const reportButton = document.getElementById("reportButton");
const resetButton = document.getElementById("resetButton");
const reportBackButton = document.getElementById("reportBackButton");
const reportResetButton = document.getElementById("reportResetButton");
const solvedCount = document.getElementById("solvedCount");
const newsletterSection = document.getElementById("newsletter");
const newsletterForm = document.getElementById("newsletterForm");
const newsletterEmail = document.getElementById("newsletterEmail");
const newsletterSubmitButton = document.getElementById("newsletterSubmitButton");
const newsletterFeedback = document.getElementById("newsletterFeedback");
const recentProblemsList = document.getElementById("recentProblemsList");
const scienceArticleFeatured = document.getElementById("scienceArticleFeatured");
const scienceArticleList = document.getElementById("scienceArticleList");
const horoscopeFeatured = document.getElementById("horoscopeFeatured");
const horoscopeSignGrid = document.getElementById("horoscopeSignGrid");
const reportTitle = document.getElementById("reportTitle");
const reportLead = document.getElementById("reportLead");
const reportStatusValue = document.getElementById("reportStatusValue");
const reportStatusMeta = document.getElementById("reportStatusMeta");
const reportTypeValue = document.getElementById("reportTypeValue");
const reportTypeMeta = document.getElementById("reportTypeMeta");
const reportClarityValue = document.getElementById("reportClarityValue");
const reportClarityMeta = document.getElementById("reportClarityMeta");
const reportOriginalProblem = document.getElementById("reportOriginalProblem");
const reportProblemAnalysis = document.getElementById("reportProblemAnalysis");
const reportResolution = document.getElementById("reportResolution");
const reportSummary = document.getElementById("reportSummary");
const ratingButtons = Array.from(document.querySelectorAll(".rating-panel__button"));
const ratingFeedback = document.getElementById("ratingFeedback");
const ratingPanel = document.querySelector(".rating-panel");
const intakeStage = document.querySelector(".intake-stage");

let solvedCountSyncTimer;
let solvedCountRealtimeCleanup = null;
let loadingProgressFrame;
let currentSolvedCount = 0;
let currentProblemText = "";
let currentPublicProblemText = "";
let currentReportId = null;
let pendingReportSave = null;
let recentProblems = [];
let recentProblemsSyncTimer;
let dailyArticles = [];
let dailyArticlesSyncTimer;
let selectedDailyArticleId = "";
let dailyHoroscopeSigns = [];
let dailyHoroscopeSyncTimer;
let selectedHoroscopeSignId = "";
let dailyHoroscopePublishedAt = "";
let isSubmittingNewsletter = false;
let selectedRating = 0;
let remoteSolvedCount = null;
let isGeneratingReport = false;

const MIN_SOLVE_DURATION = 3200;
const LOADING_PROGRESS_CAP = 0.92;
const REMOTE_METRICS_REFRESH_INTERVAL = 15000;
const REPORT_REQUEST_TIMEOUT = 18000;
const RECENT_PROBLEMS_LIMIT = 6;
const RECENT_PROBLEMS_STORAGE_KEY = "probleemilahendaja_recent_problems";
const RECENT_PROBLEM_EQUIVALENT_WINDOW_MS = 15000;
const RECENT_PROBLEMS_REFRESH_INTERVAL = 10000;
const DAILY_ARTICLES_LIMIT = 4;
const DAILY_ARTICLES_REFRESH_INTERVAL = 60 * 60 * 1000;
const DAILY_HOROSCOPE_REFRESH_INTERVAL = 60 * 60 * 1000;
const NEWSLETTER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const PUBLIC_FEED_PROFANITY_REGEX = /\b(?:pers(?:e|se|es|et|ed|ega|ele|el|esse|est|i)?|t(?:ü|y)r(?:a|ad|aga|ale|al|ast|i)?|munn(?:i|e|id|idega|ile|il|ist)?|vitt(?:u|i|e|ud|idega|ile|is|a)?|niku(?:da|n|d|b|s|tud|ga|le)?|pask(?:a|e|i|aks|aga|ale|as|ast|u)?|sit(?:t|a|ad|ane|ase|aks|aga|ale|as|ast)?|hui(?:a|i|d|ga|le|s)?|fuck(?:ing|ed|er|s)?|shit(?:ty|ted|ting|s)?)\b/giu;
const numberFormatter = new Intl.NumberFormat("et-EE");
const relativeTimeFormatter = new Intl.RelativeTimeFormat("et-EE", {
    numeric: "auto"
});
const articleDateFormatter = new Intl.DateTimeFormat("et-EE", {
    day: "numeric",
    month: "long",
    year: "numeric"
});

const HOROSCOPE_SIGNS = [
    { id: "aries", label: "Jäär", symbol: "\u2648", accent: "#ff8c73", accentSoft: "rgba(255, 140, 115, 0.22)" },
    { id: "taurus", label: "Sõnn", symbol: "\u2649", accent: "#d0ab65", accentSoft: "rgba(208, 171, 101, 0.22)" },
    { id: "gemini", label: "Kaksikud", symbol: "\u264A", accent: "#7ab1ff", accentSoft: "rgba(122, 177, 255, 0.22)" },
    { id: "cancer", label: "Vähk", symbol: "\u264B", accent: "#8fd0cb", accentSoft: "rgba(143, 208, 203, 0.24)" },
    { id: "leo", label: "Lõvi", symbol: "\u264C", accent: "#f19a4e", accentSoft: "rgba(241, 154, 78, 0.24)" },
    { id: "virgo", label: "Neitsi", symbol: "\u264D", accent: "#8ec7a5", accentSoft: "rgba(142, 199, 165, 0.24)" },
    { id: "libra", label: "Kaalud", symbol: "\u264E", accent: "#f0bf88", accentSoft: "rgba(240, 191, 136, 0.24)" },
    { id: "scorpio", label: "Skorpion", symbol: "\u264F", accent: "#8378ff", accentSoft: "rgba(131, 120, 255, 0.22)" },
    { id: "sagittarius", label: "Ambur", symbol: "\u2650", accent: "#4ec9d5", accentSoft: "rgba(78, 201, 213, 0.22)" },
    { id: "capricorn", label: "Kaljukits", symbol: "\u2651", accent: "#b8c0d1", accentSoft: "rgba(184, 192, 209, 0.22)" },
    { id: "aquarius", label: "Veevalaja", symbol: "\u2652", accent: "#72b5ff", accentSoft: "rgba(114, 181, 255, 0.22)" },
    { id: "pisces", label: "Kalad", symbol: "\u2653", accent: "#b898ff", accentSoft: "rgba(184, 152, 255, 0.22)" }
];
const sections = [container, loadingDiv, solutionDiv, reportDiv];

const CATEGORY_RULES = [
    {
        label: "Töö ja vastutus",
        meta: "Tööga seotud pinge on vaibunud ja koormus on taas paigas.",
        keywords: ["töö", "projekt", "tähtaeg", "klient", "boss", "juht", "koosolek", "kolleeg", "karjäär"],
        resolved: "Lahenes tööga seotud surve, mis venitas tähelepanu ja sisemist rahu.",
        state: "Töö on taas kontrolli all ja päev tundub selgem.",
        summary: "Tööteema ei paina enam ja fookus on tagasi."
    },
    {
        label: "Raha ja kohustused",
        meta: "Rahaline olukord on stabiilsem ja igapäevane pinge on taandunud.",
        keywords: ["raha", "palk", "eelarve", "võlg", "laen", "arve", "kulud", "sissetulek", "makse"],
        resolved: "Lahenes rahaline pinge, mis tekitas nappuse või kohustuste survet.",
        state: "Rahaline seis on rahulikum, kindlam ja tasakaalus.",
        summary: "Raha ei mõju enam pideva probleemina."
    },
    {
        label: "Suhted ja suhtlus",
        meta: "Suhtlus on pehmem, lähedus on taastunud ja pinge on taandunud.",
        keywords: ["suhe", "partner", "sõber", "pere", "ema", "isa", "abikaasa", "tüli", "konflikt", "suhtlus"],
        resolved: "Lahenes suhte või suhtluse ümber olnud pinge.",
        state: "Suhe on soojem, vastastikune ja tasakaalus.",
        summary: "See suheteema ei hoia enam midagi kinni."
    },
    {
        label: "Tervis ja koormus",
        meta: "Koormus on leevenenud ja sisemine rahu on tagasi.",
        keywords: ["stress", "ärevus", "väsimus", "tervis", "uni", "läbipõlemine", "kurnatus", "pinge", "depressioon"],
        resolved: "Lahenes pinge või ülekoormuse osa, mis kurnas kõige rohkem.",
        state: "Enesetunne on ühtlasem ja olukord ei rõhu enam.",
        summary: "See teema ei koorma enam samal viisil."
    },
    {
        label: "Otsus ja suunavalik",
        meta: "Suund on selge ja sisemine kõhklus on taandunud.",
        keywords: ["otsus", "valik", "valima", "kas", "kolida", "lahkuda", "jääda", "suund", "variant"],
        resolved: "Lahenes valiku ümber olnud ebaselgus.",
        state: "Otsus on paigas ja edasi liikumine on lihtsam.",
        summary: "See küsimus ei ripu enam õhus."
    }
];

const RATING_MESSAGES = {
    1: "Tagasiside salvestatud. Tulemus ei olnud seekord sinu jaoks piisav.",
    2: "Tagasiside salvestatud. Tulemus jäi pigem nõrgaks.",
    3: "Tagasiside salvestatud. Tulemus oli täiesti okei.",
    4: "Tagasiside salvestatud. Tulemus jättis tugeva mulje.",
    5: "Tagasiside salvestatud. Tulemus tabas väga hästi märki."
};

const REPORT_FIELD_LIMITS = {
    title: 56,
    lead: 96,
    statusValue: 28,
    statusMeta: 64,
    typeValue: 34,
    typeMeta: 72,
    clarityValue: 24,
    clarityMeta: 64,
    originalProblem: 140,
    analysis: 132,
    resolution: 76,
    summary: 124
};

function sanitizeProblemText(text) {
    return text.replace(/\s+/g, " ").trim();
}

function truncate(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }

    return text.slice(0, maxLength - 1).trimEnd() + "…";
}

function clampReportFields(report) {
    const limitedReport = { ...report };

    Object.entries(REPORT_FIELD_LIMITS).forEach(function ([key, maxLength]) {
        if (typeof limitedReport[key] === "string") {
            limitedReport[key] = truncate(sanitizeProblemText(limitedReport[key]), maxLength);
        }
    });

    return limitedReport;
}

function capitalizeFirst(text) {
    if (!text) {
        return text;
    }

    return text.charAt(0).toLocaleUpperCase("et-EE") + text.slice(1);
}

function isGenericMeta(value, genericValues) {
    const normalizedValue = sanitizeProblemText(value || "").toLocaleLowerCase("et-EE");

    return genericValues.includes(normalizedValue);
}

function animateValue(element, start, end, duration) {
    const safeStart = Number.isFinite(start) ? start : 0;
    const safeEnd = Number.isFinite(end) ? end : 0;

    if (element._counterFrame) {
        window.cancelAnimationFrame(element._counterFrame);
    }

    if (safeStart === safeEnd) {
        element.textContent = numberFormatter.format(safeEnd);
        return;
    }

    const animationStart = performance.now();

    function frame(now) {
        const progress = Math.min(1, (now - animationStart) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(safeStart + ((safeEnd - safeStart) * eased));

        element.textContent = numberFormatter.format(value);

        if (progress < 1) {
            element._counterFrame = window.requestAnimationFrame(frame);
        }
    }

    element._counterFrame = window.requestAnimationFrame(frame);
}

function renderSolvedCount() {
    const total = typeof remoteSolvedCount === "number" ? remoteSolvedCount : 0;

    animateValue(solvedCount, currentSolvedCount, total, 420);
    currentSolvedCount = total;
}

function normalizeEmailAddress(value) {
    return sanitizeProblemText(String(value || "")).toLocaleLowerCase("en-US");
}

function isValidNewsletterEmail(value) {
    return NEWSLETTER_EMAIL_REGEX.test(value) && value.length <= 254;
}

function setNewsletterFeedback(message, state = "") {
    if (!newsletterFeedback) {
        return;
    }

    newsletterFeedback.hidden = !message;
    newsletterFeedback.textContent = message || "";

    if (state) {
        newsletterFeedback.dataset.state = state;
        newsletterSection?.setAttribute("data-newsletter-state", state);
    } else {
        delete newsletterFeedback.dataset.state;
        newsletterSection?.removeAttribute("data-newsletter-state");
    }
}

function setNewsletterSubmitting(isSubmitting) {
    isSubmittingNewsletter = isSubmitting;

    if (newsletterSubmitButton) {
        newsletterSubmitButton.disabled = isSubmitting;
        newsletterSubmitButton.textContent = isSubmitting ? "Liitun..." : "Liitun loosiga";
    }

    newsletterForm?.classList.toggle("is-submitting", isSubmitting);
}

function setRemoteSolvedCount(total) {
    if (typeof total === "number" && Number.isFinite(total)) {
        remoteSolvedCount = total;
        renderSolvedCount();
    }
}

function setProblemFeedback(message, state = "") {
    if (!problemFeedback) {
        return;
    }

    problemFeedback.hidden = !message;
    problemFeedback.textContent = message || "";

    if (state) {
        problemFeedback.dataset.state = state;
        intakeStage?.setAttribute("data-state", state);
    } else {
        delete problemFeedback.dataset.state;
        intakeStage?.removeAttribute("data-state");
    }

    if (problemInput) {
        if (state === "error") {
            problemInput.setAttribute("aria-invalid", "true");
        } else {
            problemInput.removeAttribute("aria-invalid");
        }
    }
}

async function refreshSolvedCountFromSupabase() {
    if (!isSupabaseConfigured) {
        setRemoteSolvedCount(0);
        return;
    }

    try {
        const total = await fetchSolvedReportsTotal();
        setRemoteSolvedCount(total);
    } catch (error) {
        console.error("Failed to sync solved count from Supabase.", error);
    }
}

function startSolvedCountSync() {
    renderSolvedCount();

    if (isSupabaseConfigured) {
        if (solvedCountSyncTimer) {
            window.clearInterval(solvedCountSyncTimer);
        }

        if (typeof solvedCountRealtimeCleanup === "function") {
            solvedCountRealtimeCleanup();
        }

        void refreshSolvedCountFromSupabase();
        solvedCountSyncTimer = window.setInterval(
            refreshSolvedCountFromSupabase,
            REMOTE_METRICS_REFRESH_INTERVAL
        );
        solvedCountRealtimeCleanup = subscribeToReportInserts(function () {
            void refreshSolvedCountFromSupabase();
        });
    }
}

function setLoadingProgress(progress) {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const percentage = Math.round(clampedProgress * 100);

    loadingProgressBar.style.width = percentage + "%";
    loadingProgressValue.textContent = percentage + "%";
}

function stopLoadingProgress() {
    if (loadingProgressFrame) {
        window.cancelAnimationFrame(loadingProgressFrame);
        loadingProgressFrame = null;
    }
}

function startLoadingProgress() {
    const startTime = performance.now();

    stopLoadingProgress();
    setLoadingProgress(0);

    function frame(now) {
        const elapsed = now - startTime;
        const progress = Math.min(LOADING_PROGRESS_CAP, (elapsed / MIN_SOLVE_DURATION) * LOADING_PROGRESS_CAP);

        setLoadingProgress(progress);

        if (progress < LOADING_PROGRESS_CAP) {
            loadingProgressFrame = window.requestAnimationFrame(frame);
        }
    }

    loadingProgressFrame = window.requestAnimationFrame(frame);
}

function showPanel(panel, state) {
    sections.forEach(function (element) {
        element.style.display = "none";
    });

    panel.style.display = "block";
    body.dataset.state = state;
}

function detectCategory(problemText) {
    const lowerText = problemText.toLowerCase();

    return CATEGORY_RULES.find(function (category) {
        return category.keywords.some(function (keyword) {
            return lowerText.includes(keyword);
        });
    }) || {
        label: "Üldine olukord",
        meta: "Varasem ebaselgus on taandunud ja olukord mõjub kindlamalt.",
        resolved: "Lahenes pinge või ebaselguse osa, mis hoidis teemat lahtisena.",
        state: "Olukord on nüüd selgem, rahulikum ja lõpetatud.",
        summary: "Algne segadus on läbi ja tunne on kindlam."
    };
}

function getClarity(problemText) {
    const wordCount = problemText.split(/\s+/).filter(Boolean).length;

    if (wordCount >= 22) {
        return {
            value: "Lõppenud",
            meta: "Küsimus on läbi ja pinge on kadunud."
        };
    }

    if (wordCount >= 10) {
        return {
            value: "Selge",
            meta: "Lõpptulemus mõjub kindla ja lõpetatuna."
        };
    }

    return {
        value: "Rahulik",
        meta: "Teema ei häiri enam."
    };
}

function buildFallbackReport(problemText) {
    const cleanProblem = sanitizeProblemText(problemText);
    const category = detectCategory(cleanProblem);
    const clarity = getClarity(cleanProblem);
    const shortProblem = truncate(cleanProblem, 220);

    return clampReportFields({
        title: category.label + " on lõpetatud",
        lead: "Lühike ülevaade sellest, mis on nüüd korras ja mis enam ei rõhu.",
        statusValue: "Lahendatud",
        statusMeta: "Teema on lõpetatud ja varasem pinge ei juhi enam olukorda.",
        typeValue: category.label,
        typeMeta: category.meta,
        clarityValue: clarity.value,
        clarityMeta: clarity.meta,
        originalProblem: shortProblem,
        analysis: category.resolved,
        resolution: category.state,
        summary: category.summary
    });
}

function normalizeGeneratedReport(problemText, report) {
    const fallbackReport = buildFallbackReport(problemText);

    if (!report || typeof report !== "object") {
        return fallbackReport;
    }

    const normalizedReport = { ...fallbackReport };

    Object.keys(fallbackReport).forEach(function (key) {
        if (typeof report[key] === "string") {
            const cleanValue = sanitizeProblemText(report[key]);

            if (cleanValue !== "") {
                normalizedReport[key] = cleanValue;
            }
        }
    });

    normalizedReport.originalProblem = normalizedReport.originalProblem || fallbackReport.originalProblem;
    normalizedReport.statusValue = "Lahendatud";
    normalizedReport.typeValue = capitalizeFirst(normalizedReport.typeValue);
    normalizedReport.clarityValue = capitalizeFirst(normalizedReport.clarityValue);

    if (isGenericMeta(normalizedReport.statusMeta, ["staatus", "status", "olek", "olek paigas"])) {
        normalizedReport.statusMeta = fallbackReport.statusMeta;
    }

    if (isGenericMeta(normalizedReport.typeMeta, ["tüüp", "teema", "kategooria"])) {
        normalizedReport.typeMeta = fallbackReport.typeMeta;
    }

    if (isGenericMeta(normalizedReport.clarityMeta, ["täpsus", "selgus", "seis", "selge seis"])) {
        normalizedReport.clarityMeta = fallbackReport.clarityMeta;
    }

    return clampReportFields(normalizedReport);
}

function parseDateToTimestamp(value) {
    const timestamp = new Date(value || "").getTime();

    return Number.isFinite(timestamp) ? timestamp : Date.now();
}

function normalizeTextArray(values, fallbackValues, maxItems, maxLength) {
    const normalizedValues = (Array.isArray(values) ? values : [])
        .map(function (value) {
            return truncate(sanitizeProblemText(value || ""), maxLength);
        })
        .filter(Boolean)
        .slice(0, maxItems);

    if (normalizedValues.length > 0) {
        return normalizedValues;
    }

    return fallbackValues
        .map(function (value) {
            return truncate(sanitizeProblemText(value || ""), maxLength);
        })
        .filter(Boolean)
        .slice(0, maxItems);
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

function normalizeDailyArticle(record, index) {
    if (!record || typeof record !== "object") {
        return null;
    }

    const title = truncate(sanitizeProblemText(record.title || ""), 98);

    if (!title) {
        return null;
    }

    const publishedAt = new Date(parseDateToTimestamp(record.publishedAt || record.published_at)).toISOString();
    const fallbackLead = "Lahendatud probleemid vabastavad tähelepanu, vähendavad pinget ja aitavad elu uuesti liikuma.";

    return {
        id: sanitizeProblemText(record.id || record.dateKey || record.date_key || String(index + 1)),
        theme: capitalizeFirst(truncate(sanitizeProblemText(record.theme || "Päeva vaade"), 42)),
        title,
        lead: truncate(sanitizeProblemText(record.lead || fallbackLead), 180),
        highlight: truncate(
            sanitizeProblemText(
                record.highlight
                || "Lahendamine ei vähenda ainult segadust, vaid annab tagasi vaimse ruumi järgmisteks asjadeks."
            ),
            210
        ),
        paragraphs: normalizeTextArray(
            record.paragraphs,
            [
                fallbackLead,
                "Kui probleem jääb õhku, jääb õhku ka osa tähelepanust ja sisemisest energiast.",
                "Kui see saab lõpetatud, vabaneb ruumi keskendumiseks, taastumiseks ja järgmisteks otsusteks."
            ],
            3,
            340
        ),
        takeaways: normalizeTextArray(
            record.takeaways,
            ["Vähem kognitiivset müra", "Rohkem kontrollitunnet", "Kergem edasi liikuda"],
            3,
            44
        ).map(function (value, index) {
            return compactLabel(
                value,
                ["Vähem kognitiivset müra", "Rohkem kontrollitunnet", "Kergem edasi liikuda"][index],
                34
            );
        }),
        lenses: normalizeTextArray(
            record.lenses,
            ["Tähelepanu", "Stress", "Kontrollitunne"],
            3,
            24
        ).map(function (value, index) {
            return capitalizeFirst(compactLabel(value, ["Tähelepanu", "Stress", "Kontrollitunne"][index], 18));
        }),
        readingTime: truncate(sanitizeProblemText(record.readingTime || record.reading_time || "3 min lugemine"), 24),
        publishedAt
    };
}

function getHoroscopeMeta(signId) {
    return HOROSCOPE_SIGNS.find(function (sign) {
        return sign.id === signId;
    }) || HOROSCOPE_SIGNS[0];
}

function normalizeHoroscopeEntry(record, publishedAt) {
    if (!record || typeof record !== "object") {
        return null;
    }

    const signId = sanitizeProblemText(record.sign || "").toLocaleLowerCase("en-US");
    const signMeta = getHoroscopeMeta(signId);
    const title = truncate(sanitizeProblemText(record.title || ""), 48);
    const paragraphs = normalizeTextArray(
        record.paragraphs,
        [
            "Täna jäävad lahtised teemad veidi kiiremini külge kui tavaliselt.",
            "Päeva sisse jääb üks probleem, mis tahab rohkem tähelepanu kui esmapilgul paistab.",
            "Kui selle õigel hetkel ära lõpetad, liigub ülejäänud päev palju puhtamalt edasi."
        ],
        3,
        220
    );

    if (!signId || signMeta.id !== signId || !title || paragraphs.length === 0) {
        return null;
    }

    const rawIndicators = record.indicators && typeof record.indicators === "object" ? record.indicators : {};
    const indicators = {
        money: Math.max(1, Math.min(5, Math.round(Number(rawIndicators.money) || 3))),
        relationships: Math.max(1, Math.min(5, Math.round(Number(rawIndicators.relationships) || 3))),
        family: Math.max(1, Math.min(5, Math.round(Number(rawIndicators.family) || 3)))
    };

    return {
        id: signMeta.id,
        label: signMeta.label,
        symbol: signMeta.symbol,
        accent: signMeta.accent,
        accentSoft: signMeta.accentSoft,
        title,
        paragraphs,
        indicators,
        publishedAt
    };
}

function getSelectedHoroscopeSign() {
    if (dailyHoroscopeSigns.length === 0) {
        return null;
    }

    return dailyHoroscopeSigns.find(function (sign) {
        return sign.id === selectedHoroscopeSignId;
    }) || dailyHoroscopeSigns[0];
}

function createHoroscopePlaceholder() {
    const fragment = document.createDocumentFragment();
    const title = document.createElement("h3");

    title.className = "horoscope-card__title";
    title.textContent = "Laadimine";
    fragment.append(title);

    return fragment;
}

function renderFeaturedHoroscope(sign) {
    if (!horoscopeFeatured) {
        return;
    }

    if (!sign) {
        horoscopeFeatured.classList.add("horoscope-card--empty");
        horoscopeFeatured.replaceChildren(createHoroscopePlaceholder());
        return;
    }

    horoscopeFeatured.classList.remove("horoscope-card--empty");
    horoscopeFeatured.style.setProperty("--horoscope-accent", sign.accent);
    horoscopeFeatured.style.setProperty("--horoscope-glow", sign.accentSoft);

    const fragment = document.createDocumentFragment();
    const top = document.createElement("div");
    const emblem = document.createElement("div");
    const meta = document.createElement("div");
    const signLabel = document.createElement("span");
    const date = document.createElement("span");
    const title = document.createElement("h3");
    const body = document.createElement("div");
    const indicators = document.createElement("div");

    top.className = "horoscope-card__top";
    emblem.className = "horoscope-card__emblem";
    meta.className = "horoscope-card__meta";
    signLabel.className = "horoscope-card__sign";
    date.className = "horoscope-card__date";
    title.className = "horoscope-card__title";
    body.className = "horoscope-card__body";
    indicators.className = "horoscope-card__indicators";

    emblem.textContent = sign.symbol;
    signLabel.textContent = sign.label;
    date.textContent = articleDateFormatter.format(new Date(sign.publishedAt || dailyHoroscopePublishedAt || Date.now()));
    title.textContent = sign.title;

    meta.append(signLabel, date);
    top.append(emblem, meta);
    fragment.append(top, title);

    sign.paragraphs.forEach(function (paragraphText, index) {
        const paragraph = document.createElement("p");

        paragraph.className = index === 0 ? "horoscope-card__lead" : "horoscope-card__paragraph";
        paragraph.textContent = paragraphText;
        body.append(paragraph);
    });

    [
        { key: "money", label: "Raha" },
        { key: "relationships", label: "Suhted" },
        { key: "family", label: "Perekond" }
    ].forEach(function (item) {
        const block = document.createElement("div");
        const label = document.createElement("span");
        const meter = document.createElement("span");
        const value = sign.indicators?.[item.key] ?? 3;

        block.className = "horoscope-indicator";
        label.className = "horoscope-indicator__label";
        meter.className = "horoscope-indicator__meter";

        label.textContent = item.label;

        for (let index = 0; index < 5; index += 1) {
            const segment = document.createElement("span");
            segment.className = "horoscope-indicator__segment";
            segment.classList.toggle("is-active", index < value);
            meter.append(segment);
        }

        block.append(label, meter);
        indicators.append(block);
    });

    fragment.append(body, indicators);
    horoscopeFeatured.replaceChildren(fragment);
}

function createHoroscopeSignButton(sign) {
    const button = document.createElement("button");
    const glyph = document.createElement("span");
    const name = document.createElement("strong");
    const isSelected = sign.id === getSelectedHoroscopeSign()?.id;

    button.type = "button";
    button.className = "horoscope-sign";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(isSelected));
    button.classList.toggle("is-selected", isSelected);
    button.style.setProperty("--sign-accent", sign.accent);
    button.style.setProperty("--sign-glow", sign.accentSoft);

    glyph.className = "horoscope-sign__glyph";
    name.className = "horoscope-sign__name";

    glyph.textContent = sign.symbol;
    name.textContent = sign.label;
    button.append(glyph, name);

    button.addEventListener("click", function () {
        selectedHoroscopeSignId = sign.id;
        renderDailyHoroscope();
    });

    return button;
}

function renderDailyHoroscope() {
    if (!horoscopeFeatured || !horoscopeSignGrid) {
        return;
    }

    const selectedSign = getSelectedHoroscopeSign();
    const fragment = document.createDocumentFragment();

    renderFeaturedHoroscope(selectedSign);

    if (dailyHoroscopeSigns.length === 0) {
        const emptyItem = document.createElement("div");
        emptyItem.className = "horoscope-sign horoscope-sign--empty";
        emptyItem.textContent = "Laadimine";
        horoscopeSignGrid.replaceChildren(emptyItem);
        return;
    }

    dailyHoroscopeSigns.forEach(function (sign) {
        fragment.append(createHoroscopeSignButton(sign));
    });

    horoscopeSignGrid.replaceChildren(fragment);
}

function setDailyHoroscope(payload) {
    const publishedAt = new Date(parseDateToTimestamp(payload?.publishedAt || payload?.published_at)).toISOString();

    dailyHoroscopePublishedAt = publishedAt;
    dailyHoroscopeSigns = HOROSCOPE_SIGNS.map(function (meta) {
        const entry = Array.isArray(payload?.signs)
            ? payload.signs.find(function (item) {
                return item?.sign === meta.id;
            })
            : null;

        return normalizeHoroscopeEntry(entry, publishedAt);
    }).filter(Boolean);

    if (!dailyHoroscopeSigns.some(function (sign) {
        return sign.id === selectedHoroscopeSignId;
    })) {
        selectedHoroscopeSignId = dailyHoroscopeSigns[0]?.id || "";
    }

    renderDailyHoroscope();
}

function normalizeRecentProblem(record) {
    if (!record || typeof record !== "object") {
        return null;
    }

    const problemText = sanitizeProblemText(record.problemText || record.problem_text || "");

    if (!problemText) {
        return null;
    }

    const problemType = sanitizeProblemText(record.problemType || record.problem_type || "Üldine olukord")
        || "Üldine olukord";
    const status = sanitizeProblemText(record.status || "Lahendatud") || "Lahendatud";
    const createdAt = new Date(parseDateToTimestamp(record.createdAt || record.created_at)).toISOString();

    return {
        reportId: record.reportId || record.report_id || null,
        problemText: truncate(problemText, 180),
        problemType: truncate(problemType, 40),
        status: truncate(status, 24),
        createdAt
    };
}

function areRecentProblemsEquivalent(firstProblem, secondProblem) {
    if (!firstProblem || !secondProblem) {
        return false;
    }

    if (
        firstProblem.reportId
        && secondProblem.reportId
        && firstProblem.reportId === secondProblem.reportId
    ) {
        return true;
    }

    const firstText = sanitizeProblemText(firstProblem.problemText).toLocaleLowerCase("et-EE");
    const secondText = sanitizeProblemText(secondProblem.problemText).toLocaleLowerCase("et-EE");

    if (firstText === "" || firstText !== secondText) {
        return false;
    }

    return Math.abs(parseDateToTimestamp(firstProblem.createdAt) - parseDateToTimestamp(secondProblem.createdAt))
        <= RECENT_PROBLEM_EQUIVALENT_WINDOW_MS;
}

function mergeRecentProblems() {
    const merged = [];
    const collections = Array.from(arguments);

    collections
        .flat()
        .map(normalizeRecentProblem)
        .filter(Boolean)
        .sort(function (firstProblem, secondProblem) {
            return parseDateToTimestamp(secondProblem.createdAt) - parseDateToTimestamp(firstProblem.createdAt);
        })
        .forEach(function (problem) {
            const existingIndex = merged.findIndex(function (existingProblem) {
                return areRecentProblemsEquivalent(existingProblem, problem);
            });

            if (existingIndex === -1) {
                merged.push(problem);
                return;
            }

            if (!merged[existingIndex].reportId && problem.reportId) {
                merged[existingIndex] = problem;
            }
        });

    return merged.slice(0, RECENT_PROBLEMS_LIMIT);
}

function persistRecentProblems() {
    try {
        window.localStorage.setItem(RECENT_PROBLEMS_STORAGE_KEY, JSON.stringify(recentProblems));
    } catch (_error) {
        // Ignore storage failures and keep the in-memory list.
    }
}

function loadRecentProblems() {
    try {
        const raw = window.localStorage.getItem(RECENT_PROBLEMS_STORAGE_KEY);

        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);

        return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
        return [];
    }
}

function formatRecentProblemTime(createdAt) {
    const timestamp = parseDateToTimestamp(createdAt);
    const diffInMinutes = Math.round((timestamp - Date.now()) / 60000);
    const absoluteMinutes = Math.abs(diffInMinutes);

    if (absoluteMinutes < 1) {
        return "äsja";
    }

    if (absoluteMinutes < 60) {
        return relativeTimeFormatter.format(diffInMinutes, "minute");
    }

    const diffInHours = Math.round(diffInMinutes / 60);

    if (Math.abs(diffInHours) < 24) {
        return relativeTimeFormatter.format(diffInHours, "hour");
    }

    const diffInDays = Math.round(diffInHours / 24);
    return relativeTimeFormatter.format(diffInDays, "day");
}

function maskProfanity(word) {
    return "•".repeat(Math.max(4, Math.min(word.length, 10)));
}

function appendPublicProblemText(container, text) {
    const safeText = truncate(text, 112);
    const regex = new RegExp(PUBLIC_FEED_PROFANITY_REGEX.source, PUBLIC_FEED_PROFANITY_REGEX.flags);
    let lastIndex = 0;
    let hasMatch = false;

    container.replaceChildren();

    for (const match of safeText.matchAll(regex)) {
        const matchedText = match[0];
        const matchIndex = match.index ?? 0;

        if (matchIndex > lastIndex) {
            container.append(document.createTextNode(safeText.slice(lastIndex, matchIndex)));
        }

        const censoredWord = document.createElement("span");
        censoredWord.className = "recent-problem__censored";
        censoredWord.textContent = maskProfanity(matchedText);
        censoredWord.setAttribute("aria-label", "Peidetud sõna");
        censoredWord.title = "Peidetud sõna";
        container.append(censoredWord);

        lastIndex = matchIndex + matchedText.length;
        hasMatch = true;
    }

    if (lastIndex < safeText.length) {
        container.append(document.createTextNode(safeText.slice(lastIndex)));
    }

    if (!hasMatch) {
        container.textContent = safeText;
    }
}

function createRecentProblemCard(problem) {
    const article = document.createElement("article");
    article.className = "recent-problem";

    const meta = document.createElement("div");
    meta.className = "recent-problem__meta";

    const status = document.createElement("span");
    status.className = "recent-problem__status";
    status.textContent = problem.status || "Lahendatud";

    const time = document.createElement("span");
    time.className = "recent-problem__time";
    time.textContent = formatRecentProblemTime(problem.createdAt);

    const text = document.createElement("p");
    text.className = "recent-problem__text";
    appendPublicProblemText(text, problem.problemText);

    const footer = document.createElement("div");
    footer.className = "recent-problem__footer";

    const type = document.createElement("span");
    type.className = "recent-problem__type";
    type.textContent = problem.problemType || "Üldine olukord";

    const state = document.createElement("span");
    state.className = "recent-problem__state";
    state.textContent = "Nüüd korras";

    meta.append(status, time);
    footer.append(type, state);
    article.append(meta, text, footer);

    return article;
}

function renderRecentProblems() {
    if (!recentProblemsList) {
        return;
    }

    const fragment = document.createDocumentFragment();

    if (recentProblems.length === 0) {
        const emptyCard = document.createElement("article");
        const emptyTitle = document.createElement("p");
        const emptyNote = document.createElement("p");

        emptyCard.className = "recent-problem recent-problem--empty";
        emptyTitle.className = "recent-problem__text";
        emptyNote.className = "recent-problem__note";
        emptyTitle.textContent = "Järgmine lahendatud probleem võib olla juba sinu oma.";
        emptyNote.textContent = "Kui esimene teema saab lahendatud, ilmub see siia kohe lühikese, lõpetatud kaardina.";

        emptyCard.append(emptyTitle, emptyNote);
        fragment.append(emptyCard);
    } else {
        recentProblems.forEach(function (problem) {
            fragment.append(createRecentProblemCard(problem));
        });
    }

    recentProblemsList.replaceChildren(fragment);
}

function getSelectedDailyArticle() {
    if (dailyArticles.length === 0) {
        return null;
    }

    return dailyArticles.find(function (article) {
        return article.id === selectedDailyArticleId;
    }) || dailyArticles[0];
}

function createSciencePlaceholder() {
    const fragment = document.createDocumentFragment();
    const title = document.createElement("h3");

    title.className = "science-article__title";
    title.textContent = "Laadimine";
    fragment.append(title);

    return fragment;
}

function renderFeaturedDailyArticle(article) {
    if (!scienceArticleFeatured) {
        return;
    }

    if (!article) {
        scienceArticleFeatured.classList.add("science-article--empty");
        scienceArticleFeatured.replaceChildren(createSciencePlaceholder());
        return;
    }

    scienceArticleFeatured.classList.remove("science-article--empty");

    const fragment = document.createDocumentFragment();
    const title = document.createElement("h3");
    const lead = document.createElement("p");
    const highlight = document.createElement("blockquote");
    const body = document.createElement("div");
    const tags = document.createElement("div");
    const takeaways = document.createElement("div");

    title.className = "science-article__title";
    lead.className = "science-article__lead";
    highlight.className = "science-article__highlight";
    body.className = "science-article__body";
    tags.className = "science-article__lenses";
    takeaways.className = "science-article__takeaways";

    title.textContent = article.title;
    lead.textContent = article.lead;
    highlight.textContent = article.highlight;

    article.lenses.forEach(function (label) {
        const pill = document.createElement("span");
        pill.className = "science-article__lens";
        pill.textContent = label;
        tags.append(pill);
    });

    article.paragraphs.forEach(function (paragraphText) {
        const paragraph = document.createElement("p");
        paragraph.textContent = paragraphText;
        body.append(paragraph);
    });

    article.takeaways.forEach(function (takeawayText) {
        const pill = document.createElement("span");
        pill.className = "science-article__takeaway";
        pill.textContent = takeawayText;
        takeaways.append(pill);
    });

    fragment.append(title, lead, highlight, tags, body, takeaways);
    scienceArticleFeatured.replaceChildren(fragment);
}

function createDailyArticleListItem(article) {
    const button = document.createElement("button");
    const meta = document.createElement("div");
    const date = document.createElement("span");
    const theme = document.createElement("span");
    const title = document.createElement("strong");
    const lead = document.createElement("span");
    const isSelected = article.id === getSelectedDailyArticle()?.id;

    button.type = "button";
    button.className = "science-feed__list-item";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(isSelected));
    button.classList.toggle("is-selected", isSelected);

    meta.className = "science-feed__list-meta";
    date.className = "science-feed__list-date";
    theme.className = "science-feed__list-theme";
    title.className = "science-feed__list-title";
    lead.className = "science-feed__list-lead";

    date.textContent = articleDateFormatter.format(new Date(article.publishedAt));
    theme.textContent = article.theme;
    title.textContent = article.title;
    lead.textContent = article.lead;

    meta.append(date, theme);
    button.append(meta, title, lead);
    button.addEventListener("click", function () {
        selectedDailyArticleId = article.id;
        renderDailyArticles();
    });

    return button;
}

function renderDailyArticles() {
    if (!scienceArticleFeatured || !scienceArticleList) {
        return;
    }

    const selectedArticle = getSelectedDailyArticle();
    const listFragment = document.createDocumentFragment();

    renderFeaturedDailyArticle(selectedArticle);

    if (dailyArticles.length === 0) {
        const emptyItem = document.createElement("div");
        emptyItem.className = "science-feed__list-empty";
        emptyItem.textContent = "Laadimine";
        scienceArticleList.replaceChildren(emptyItem);
        return;
    }

    dailyArticles.forEach(function (article) {
        listFragment.append(createDailyArticleListItem(article));
    });

    scienceArticleList.replaceChildren(listFragment);
}

function setDailyArticles(nextArticles) {
    dailyArticles = nextArticles
        .map(normalizeDailyArticle)
        .filter(Boolean)
        .sort(function (firstArticle, secondArticle) {
            return parseDateToTimestamp(secondArticle.publishedAt) - parseDateToTimestamp(firstArticle.publishedAt);
        })
        .slice(0, DAILY_ARTICLES_LIMIT);

    if (!dailyArticles.some(function (article) {
        return article.id === selectedDailyArticleId;
    })) {
        selectedDailyArticleId = dailyArticles[0]?.id || "";
    }

    renderDailyArticles();
}

function setRecentProblems(nextProblems) {
    recentProblems = mergeRecentProblems(nextProblems);
    persistRecentProblems();
    renderRecentProblems();
}

function pushRecentProblem(problem) {
    recentProblems = mergeRecentProblems([problem], recentProblems);
    persistRecentProblems();
    renderRecentProblems();
}

async function fetchGeneratedReport(problemText) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(function () {
        controller.abort();
    }, REPORT_REQUEST_TIMEOUT);

    try {
        const response = await fetch("/api/report", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            signal: controller.signal,
            body: JSON.stringify({
                problemText
            })
        });

        if (!response.ok) {
            let errorMessage = "OpenAI raporti päring ebaõnnestus.";

            try {
                const payload = await response.json();
                errorMessage = payload.error || errorMessage;
            } catch (_error) {
                // Ignore JSON parsing failure and keep the generic error.
            }

            throw new Error(errorMessage);
        }

        const payload = await response.json();

        return {
            report: normalizeGeneratedReport(problemText, payload.report),
            publicProblemText: sanitizeProblemText(payload.publicProblemText || problemText) || problemText
        };
    } catch (error) {
        console.error("Failed to generate report via API.", error);
        return {
            report: buildFallbackReport(problemText),
            publicProblemText: problemText
        };
    } finally {
        window.clearTimeout(timeoutId);
    }
}

function populateReport(report) {
    reportTitle.textContent = report.title;
    reportLead.textContent = report.lead;
    reportStatusValue.textContent = report.statusValue;
    reportStatusMeta.textContent = report.statusMeta;
    reportTypeValue.textContent = report.typeValue;
    reportTypeMeta.textContent = report.typeMeta;
    reportClarityValue.textContent = report.clarityValue;
    reportClarityMeta.textContent = report.clarityMeta;
    reportOriginalProblem.textContent = report.originalProblem;
    reportProblemAnalysis.textContent = report.analysis;
    reportResolution.textContent = report.resolution;
    reportSummary.textContent = report.summary;
}

function resetRating() {
    selectedRating = 0;
    ratingPanel?.removeAttribute("data-selected-rating");

    ratingButtons.forEach(function (button) {
        button.classList.remove("is-selected");
        button.setAttribute("aria-pressed", "false");
    });

    ratingFeedback.hidden = true;
    ratingFeedback.textContent = "";
}

function setRating(rating) {
    selectedRating = rating;
    ratingPanel?.setAttribute("data-selected-rating", String(rating));

    ratingButtons.forEach(function (button) {
        const buttonRating = Number(button.dataset.rating);
        const isSelected = buttonRating === rating;

        button.classList.toggle("is-selected", isSelected);
        button.setAttribute("aria-pressed", String(isSelected));
    });

    ratingFeedback.hidden = false;
    ratingFeedback.textContent = RATING_MESSAGES[rating];
}

function applyPersistedReport(persistedReport) {
    if (!persistedReport) {
        return;
    }

    if (persistedReport.reportId) {
        currentReportId = persistedReport.reportId;
    }

    if (typeof persistedReport.solvedReportsTotal === "number") {
        setRemoteSolvedCount(persistedReport.solvedReportsTotal);
    }

    if (persistedReport.recentProblem) {
        pushRecentProblem(persistedReport.recentProblem);
    } else {
        void refreshRecentProblems().catch(function (error) {
            console.error("Failed to refresh recent problems.", error);
        });
    }
}

function queueReportPersistence(report) {
    currentReportId = null;
    pendingReportSave = null;

    if (!isSupabaseConfigured) {
        return;
    }

    const sessionId = getOrCreateSessionId();

    pendingReportSave = createProblemReport({
        sessionId,
        problemText: currentProblemText,
        publicProblemText: currentPublicProblemText || currentProblemText,
        problemType: report.typeValue,
        status: report.statusValue,
        clarityLevel: report.clarityValue,
        summary: report.summary,
        analysis: report.analysis,
        resolution: report.resolution
    })
        .then(function (result) {
            applyPersistedReport(result);
            return result;
        })
        .catch(function (error) {
            console.error("Failed to save report to Supabase.", error);
            return null;
        });
}

function queueReportPersistenceInBackground(report) {
    try {
        queueReportPersistence(report);
    } catch (error) {
        console.error("Failed to start report persistence.", error);
        pendingReportSave = null;
    }

    void settleReportSaveAfterLoading().catch(function (error) {
        console.error("Failed to settle report persistence.", error);
    });
}

async function settleReportSaveAfterLoading() {
    if (!pendingReportSave) {
        return;
    }

    const result = await Promise.race([
        pendingReportSave,
        new Promise(function (resolve) {
            window.setTimeout(function () {
                resolve(null);
            }, 700);
        })
    ]);

    void result;
}

async function refreshRecentProblemsFromSupabase() {
    if (!isSupabaseConfigured) {
        return [];
    }

    try {
        return await fetchRecentProblemReports(RECENT_PROBLEMS_LIMIT);
    } catch (error) {
        console.error("Failed to sync recent problems from Supabase.", error);
        return [];
    }
}

async function fetchRecentProblemsFromServer() {
    try {
        const response = await fetch("/api/recent-problems", {
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("Recent problems request failed.");
        }

        const payload = await response.json();

        return Array.isArray(payload?.problems) ? payload.problems : [];
    } catch (error) {
        console.error("Failed to fetch recent problems from local server.", error);
        return [];
    }
}

async function fetchDailyArticlesFromServer() {
    try {
        const response = await fetch("/api/daily-articles", {
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("Daily articles request failed.");
        }

        const payload = await response.json();

        return Array.isArray(payload?.articles) ? payload.articles : [];
    } catch (error) {
        console.error("Failed to fetch daily articles from local server.", error);
        return [];
    }
}

async function fetchDailyHoroscopeFromServer() {
    try {
        const response = await fetch("/api/daily-horoscope", {
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("Daily horoscope request failed.");
        }

        return await response.json();
    } catch (error) {
        console.error("Failed to fetch daily horoscope from local server.", error);
        return null;
    }
}

async function submitNewsletterSignup(email) {
    const response = await fetch("/api/newsletter-signups", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email
        })
    });

    let payload = null;

    try {
        payload = await response.json();
    } catch (_error) {
        payload = null;
    }

    if (!response.ok) {
        throw new Error(payload?.error || "Liitumine ebaõnnestus.");
    }

    return payload;
}

async function refreshRecentProblems() {
    const [serverProblems, remoteProblems] = await Promise.all([
        fetchRecentProblemsFromServer(),
        refreshRecentProblemsFromSupabase()
    ]);

    setRecentProblems(mergeRecentProblems(serverProblems, remoteProblems, recentProblems));
}

async function refreshDailyArticles() {
    const articles = await fetchDailyArticlesFromServer();

    if (articles.length > 0) {
        setDailyArticles(articles);
    } else if (dailyArticles.length === 0) {
        renderDailyArticles();
    }
}

async function refreshDailyHoroscope() {
    const payload = await fetchDailyHoroscopeFromServer();

    if (payload?.signs?.length > 0) {
        setDailyHoroscope(payload);
    } else if (dailyHoroscopeSigns.length === 0) {
        renderDailyHoroscope();
    }
}

async function persistRatingSelection(rating) {
    if (!isSupabaseConfigured) {
        return;
    }

    try {
        let reportId = currentReportId;

        if (!reportId && pendingReportSave) {
            const persistedReport = await pendingReportSave;
            reportId = persistedReport?.reportId ?? null;
        }

        if (!reportId) {
            return;
        }

        await submitProblemRating({
            reportId,
            sessionId: getOrCreateSessionId(),
            rating
        });
    } catch (error) {
        console.error("Failed to save rating to Supabase.", error);
    }
}

function resetApp() {
    stopLoadingProgress();
    setLoadingProgress(0);
    isGeneratingReport = false;
    currentProblemText = "";
    currentPublicProblemText = "";
    currentReportId = null;
    pendingReportSave = null;
    problemInput.value = "";
    resetRating();
    showPanel(container, "idle");
    problemInput.focus();
}

function initializeRecentProblems() {
    recentProblems = mergeRecentProblems(loadRecentProblems());
    renderRecentProblems();

    if (recentProblemsSyncTimer) {
        window.clearInterval(recentProblemsSyncTimer);
    }

    void refreshRecentProblems();
    recentProblemsSyncTimer = window.setInterval(function () {
        void refreshRecentProblems();
    }, RECENT_PROBLEMS_REFRESH_INTERVAL);
}

function initializeDailyArticles() {
    renderDailyArticles();

    if (dailyArticlesSyncTimer) {
        window.clearInterval(dailyArticlesSyncTimer);
    }

    void refreshDailyArticles();
    dailyArticlesSyncTimer = window.setInterval(function () {
        void refreshDailyArticles();
    }, DAILY_ARTICLES_REFRESH_INTERVAL);
}

function initializeDailyHoroscope() {
    renderDailyHoroscope();

    if (dailyHoroscopeSyncTimer) {
        window.clearInterval(dailyHoroscopeSyncTimer);
    }

    void refreshDailyHoroscope();
    dailyHoroscopeSyncTimer = window.setInterval(function () {
        void refreshDailyHoroscope();
    }, DAILY_HOROSCOPE_REFRESH_INTERVAL);
}

function initializeNewsletterForm() {
    if (!newsletterForm || !newsletterEmail) {
        return;
    }

    newsletterForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (isSubmittingNewsletter) {
            return;
        }

        const email = normalizeEmailAddress(newsletterEmail.value);

        if (!isValidNewsletterEmail(email)) {
            setNewsletterFeedback("Sisesta korrektne e-post.", "error");
            newsletterEmail.focus();
            return;
        }

        setNewsletterFeedback("", "");
        setNewsletterSubmitting(true);

        try {
            const payload = await submitNewsletterSignup(email);

            newsletterEmail.value = "";
            setNewsletterFeedback(
                payload?.status === "existing" ? "See e-post on juba kirjas." : "Oled loosis kirjas.",
                "success"
            );
        } catch (error) {
            setNewsletterFeedback(error.message || "Liitumine ebaõnnestus.", "error");
        } finally {
            setNewsletterSubmitting(false);
        }
    });

    newsletterEmail.addEventListener("input", function () {
        if (newsletterFeedback?.dataset.state === "error") {
            setNewsletterFeedback("", "");
        }
    });
}

solveButton.addEventListener("click", async function () {
    if (isGeneratingReport) {
        return;
    }

    const problemText = sanitizeProblemText(problemInput.value);

    if (problemText === "") {
        setProblemFeedback("Sisesta enne probleem, mida lahendada.", "error");
        problemInput.focus();
        return;
    }

    setProblemFeedback("", "");
    isGeneratingReport = true;
    currentProblemText = problemText;
    resetRating();
    showPanel(loadingDiv, "loading");
    startLoadingProgress();

    try {
        const [{ report, publicProblemText }] = await Promise.all([
            fetchGeneratedReport(problemText),
            new Promise(function (resolve) {
                window.setTimeout(resolve, MIN_SOLVE_DURATION);
            })
        ]);

        stopLoadingProgress();
        setLoadingProgress(1);
        currentPublicProblemText = publicProblemText;
        populateReport(report);
        pushRecentProblem({
            problemText: publicProblemText,
            problemType: report.typeValue,
            status: report.statusValue,
            createdAt: new Date().toISOString()
        });
        showPanel(solutionDiv, "done");
        queueReportPersistenceInBackground(report);
    } finally {
        isGeneratingReport = false;
    }
});

problemInput.addEventListener("input", function () {
    if (problemFeedback?.dataset.state === "error") {
        setProblemFeedback("", "");
    }
});

reportButton.addEventListener("click", function () {
    showPanel(reportDiv, "report");
});

reportBackButton.addEventListener("click", function () {
    showPanel(solutionDiv, "done");
});

[resetButton, reportResetButton].forEach(function (button) {
    button.addEventListener("click", resetApp);
});

ratingButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        const rating = Number(button.dataset.rating);

        setRating(rating);
        persistRatingSelection(rating);
    });
});

setLoadingProgress(0);
resetRating();
initializeRecentProblems();
initializeDailyArticles();
initializeDailyHoroscope();
initializeNewsletterForm();
startSolvedCountSync();

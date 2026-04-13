import {
    createProblemReport,
    fetchProblemCategoryStats,
    fetchProblemCategoryTrends,
    fetchProblemTimeSegments,
    fetchRecentProblemReports,
    fetchSolvedReportsTotal,
    getOrCreateSessionId,
    isSupabaseConfigured,
    subscribeToReportInserts,
    submitProblemRating
} from "./supabase.js";
import {
    GENERAL_PROBLEM_CATEGORY,
    PROBLEM_CATEGORY_DEFINITIONS,
    detectProblemCategory,
    getProblemCategoryDefinition
} from "./problem-categories.mjs";
import urgitsFirePrimary from "./assets/Urgits-branch-1.png";
import urgitsFireSecondary from "./assets/Urgits-branch-2.png";

const lorienMockupModules = import.meta.glob("./assets/Lorien mockups/*.{png,jpg,jpeg,webp,avif}", {
    eager: true,
    import: "default"
});
const LORIEN_MOCKUP_IMAGES = Object.entries(lorienMockupModules)
    .sort(function ([firstPath], [secondPath]) {
        const firstName = firstPath.split("/").pop() || "";
        const secondName = secondPath.split("/").pop() || "";
        const firstNumber = Number(firstName.match(/\d+/)?.[0] || Number.POSITIVE_INFINITY);
        const secondNumber = Number(secondName.match(/\d+/)?.[0] || Number.POSITIVE_INFINITY);

        if (firstNumber !== secondNumber) {
            return firstNumber - secondNumber;
        }

        return firstName.localeCompare(secondName, "et");
    })
    .map(function ([filePath, src]) {
        return {
            src,
            name: filePath.split("/").pop() || "mockup"
        };
    });

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
const coverStoryHero = document.getElementById("coverStoryHero");
const coverStoryHeroToggle = document.getElementById("coverStoryHeroToggle");
const coverIssueDate = document.getElementById("coverIssueDate");
const coverIssueNumber = document.getElementById("coverIssueNumber");
const coverStoryName = document.getElementById("coverStoryName");
const coverStoryTitle = document.getElementById("coverStoryTitle");
const coverStoryToggleHint = document.getElementById("coverStoryToggleHint");
const coverStoryFeature = document.getElementById("coverStoryFeature");
const coverStoryFeatureDate = document.getElementById("coverStoryFeatureDate");
const coverStoryFeatureTitle = document.getElementById("coverStoryFeatureTitle");
const coverStoryFeatureSummary = document.getElementById("coverStoryFeatureSummary");
const coverStoryFeatureLead = document.getElementById("coverStoryFeatureLead");
const coverStoryFeatureQuote = document.getElementById("coverStoryFeatureQuote");
const coverStoryFeatureBody = document.getElementById("coverStoryFeatureBody");
const coverStoryFeatureSubject = document.getElementById("coverStoryFeatureSubject");
const newsletterSection = document.getElementById("newsletter");
const newsletterForm = document.getElementById("newsletterForm");
const newsletterEmail = document.getElementById("newsletterEmail");
const newsletterSubmitButton = document.getElementById("newsletterSubmitButton");
const newsletterFeedback = document.getElementById("newsletterFeedback");
const recentProblemsSection = document.getElementById("recentProblems");
const recentProblemsList = document.getElementById("recentProblemsList");
const recentProblemsMoreButton = document.getElementById("recentProblemsMoreButton");
const problemStatsLead = document.getElementById("problemStatsLead");
const problemStatsChart = document.getElementById("problemStatsChart");
const scienceArticleFeatured = document.getElementById("scienceArticleFeatured");
const scienceArticleList = document.getElementById("scienceArticleList");
const scienceArticleMoreButton = document.getElementById("scienceArticleMoreButton");
const personaStoryFeatured = document.getElementById("personaStoryFeatured");
const personaStoryList = document.getElementById("personaStoryList");
const personaStoryMoreButton = document.getElementById("personaStoryMoreButton");
const dailyHoroscopeSection = document.getElementById("dailyHoroscope");
const horoscopeFeatured = document.getElementById("horoscopeFeatured");
const horoscopeSignGrid = document.getElementById("horoscopeSignGrid");
const problemQuizSection = document.getElementById("problemQuiz");
const problemQuizCard = document.getElementById("problemQuizCard");
const problemQuizSnapshot = document.getElementById("problemQuizSnapshot");
const problemQuizStepLabel = document.getElementById("problemQuizStepLabel");
const problemQuizProgressBar = document.getElementById("problemQuizProgressBar");
const problemQuizStepDots = document.getElementById("problemQuizStepDots");
const problemQuizRestartButton = document.getElementById("problemQuizRestartButton");
const problemQuizStartButton = document.getElementById("problemQuizStartButton");
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
const solutionLead = document.getElementById("solutionLead");
const intakeStage = document.querySelector(".intake-stage");
const intakeStageFrame = intakeStage?.querySelector(".intake-stage__frame");
const solverSkinDots = document.getElementById("solverSkinDots");
const urgitsBannerFrame = document.querySelector(".urgits-banner__frame");
const urgitsBannerImageLayers = Array.from(document.querySelectorAll(".urgits-banner__image-layer"));
const weatherStrip = document.getElementById("weatherStrip");
const weatherStripIcon = document.getElementById("weatherStripIcon");
const weatherStripLocation = document.getElementById("weatherStripLocation");
const weatherStripSummary = document.getElementById("weatherStripSummary");
const weatherStripTemp = document.getElementById("weatherStripTemp");
const weatherStripCondition = document.getElementById("weatherStripCondition");
const weatherStripRange = document.getElementById("weatherStripRange");
const weatherStripMeta = document.getElementById("weatherStripMeta");
const weatherStripPeek = document.getElementById("weatherStripPeek");
const weatherModal = document.getElementById("weatherModal");
const weatherModalDialog = weatherModal?.querySelector(".weather-modal__dialog");
const weatherModalBackdrop = document.getElementById("weatherModalBackdrop");
const weatherModalClose = document.getElementById("weatherModalClose");
const weatherModalScene = document.getElementById("weatherModalScene");
const weatherModalLead = document.getElementById("weatherModalLead");
const weatherModalCurrentIcon = document.getElementById("weatherModalCurrentIcon");
const weatherModalCurrentTemp = document.getElementById("weatherModalCurrentTemp");
const weatherModalCurrentCondition = document.getElementById("weatherModalCurrentCondition");
const weatherModalLocation = document.getElementById("weatherModalLocation");
const weatherModalMeta = document.getElementById("weatherModalMeta");
const weatherTodayCard = document.getElementById("weatherTodayCard");
const weatherTomorrowCard = document.getElementById("weatherTomorrowCard");
const weatherForecastList = document.getElementById("weatherForecastList");
const weatherTodayTimeline = document.getElementById("weatherTodayTimeline");
const weatherTomorrowTimeline = document.getElementById("weatherTomorrowTimeline");
const weatherPlanningTips = document.getElementById("weatherPlanningTips");

let solvedCountSyncTimer;
let solvedCountRealtimeCleanup = null;
let loadingProgressFrame;
let currentSolvedCount = 0;
let currentProblemText = "";
let currentPublicProblemText = "";
let currentReportId = null;
let pendingReportSave = null;
let currentSolveStartedAt = 0;
let recentProblemsUnlocked = false;
let recentProblems = [];
let recentProblemsSyncTimer;
let visibleRecentProblemsCount = 0;
let problemCategoryStats = [];
let problemCategoryTrends = [];
let problemTimeSegments = [];
let problemCategoryStatsSyncTimer;
let problemCategoryStatsRealtimeCleanup = null;
let problemStatsStoryCleanup = null;
let selectedRecentProblemReportId = "";
let selectedRecentProblemPreview = null;
let selectedRecentProblemDetail = null;
let isRecentProblemOriginalVisible = false;
let recentProblemDetailError = "";
let isRecentProblemDetailLoading = false;
let likedRecentProblemIds = new Set();
let dailyCoverStory = null;
let dailyCoverStorySyncTimer;
let isDailyCoverStoryOpen = false;
let dailyArticles = [];
let dailyArticlesSyncTimer;
let selectedDailyArticleId = "";
let expandedDailyArticleId = "";
let visibleDailyArticleCount = 0;
let dailyPersonaStories = [];
let dailyPersonaStoriesSyncTimer;
let selectedDailyPersonaStoryId = "";
let expandedDailyPersonaStoryId = "";
let visiblePersonaStoryCount = 0;
let dailyHoroscopeSigns = [];
let dailyHoroscopeSyncTimer;
let selectedHoroscopeSignId = "";
let dailyHoroscopePublishedAt = "";
let isSubmittingNewsletter = false;
let selectedRating = 0;
let remoteSolvedCount = null;
let isGeneratingReport = false;
let problemQuizAnswers = [];
let currentProblemQuizStep = 0;
let problemQuizAdvanceTimer = null;
let isProblemQuizStarted = false;
let currentSolverSkinId = "gold";
let solverSkinMotionTimer = 0;
let solverSkinTouchStartX = 0;
let solverSkinTouchStartY = 0;
let solverSkinTouchActive = false;
let dailyWeather = null;
let dailyWeatherSyncTimer;
let activeWeatherLocation = null;
let weatherSceneLoadToken = 0;
let coverStoryImageLoadToken = 0;
let urgitsBannerImageTimer = 0;
let urgitsBannerActiveLayerIndex = 0;
let urgitsBannerActiveImageIndex = 0;

const MIN_SOLVE_DURATION = 3200;
const LOADING_PROGRESS_CAP = 0.92;
const REMOTE_METRICS_REFRESH_INTERVAL = 15000;
const REPORT_REQUEST_TIMEOUT = 18000;
const RECENT_PROBLEMS_LIMIT = 6;
const RECENT_PROBLEMS_MOBILE_INITIAL_COUNT = 1;
const RECENT_PROBLEMS_DESKTOP_INITIAL_COUNT = 3;
const RECENT_PROBLEMS_LOAD_STEP = 3;
const RECENT_PROBLEMS_STORAGE_KEY = "probleemilahendaja_recent_problems";
const RECENT_PROBLEMS_UNLOCKED_KEY = "probleemilahendaja_recent_problems_unlocked";
const RECENT_PROBLEM_EQUIVALENT_WINDOW_MS = 15000;
const RECENT_PROBLEMS_REFRESH_INTERVAL = 10000;
const RECENT_PROBLEM_DETAIL_REQUEST_TIMEOUT = 12000;
const RECENT_PROBLEM_LIKES_STORAGE_KEY = "probleemilahendaja_recent_problem_likes";
const URGITS_BANNER_IMAGE_ROTATION_MS = 5200;
const URGITS_BANNER_IMAGES = [urgitsFirePrimary, urgitsFireSecondary];
const PROBLEM_CATEGORY_STATS_DAYS = 30;
const PROBLEM_CATEGORY_STATS_REFRESH_INTERVAL = 60 * 1000;
const DAILY_COVER_STORY_REFRESH_INTERVAL = 60 * 60 * 1000;
const DAILY_ARTICLES_LIMIT = 8;
const DAILY_ARTICLES_MOBILE_INITIAL_COUNT = 1;
const DAILY_ARTICLES_LOAD_STEP = 1;
const DAILY_ARTICLES_REFRESH_INTERVAL = 60 * 60 * 1000;
const DAILY_ARTICLE_PREVIEW_PARAGRAPHS = 2;
const DAILY_PERSONA_STORIES_LIMIT = 8;
const DAILY_PERSONA_STORIES_MOBILE_INITIAL_COUNT = 1;
const DAILY_PERSONA_STORIES_LOAD_STEP = 1;
const DAILY_PERSONA_STORIES_REFRESH_INTERVAL = 60 * 60 * 1000;
const DAILY_PERSONA_REFRESH_SIGNAL_KEY = "probleemilahendaja:daily-persona-refresh";
const DAILY_HOROSCOPE_REFRESH_INTERVAL = 60 * 60 * 1000;
const DAILY_WEATHER_REFRESH_INTERVAL = 20 * 60 * 1000;
const WEATHER_LOCATION_TIMEOUT = 6500;
const SOLVER_SKIN_STORAGE_KEY = "probleemilahendaja_solver_skin";
const SOLVER_SKIN_SWIPE_THRESHOLD = 54;
const SOLVER_SKIN_MOTION_DURATION = 360;
const SOLVER_SKINS = [
    { id: "gold" },
    { id: "rose" },
    { id: "platinum" },
    { id: "ocean" },
    { id: "mint" },
    { id: "lavender" },
    { id: "citrus" },
    { id: "cherry" },
    { id: "forest" },
    { id: "graphite" }
];
const DEFAULT_WEATHER_LOCATION = {
    label: "Tallinn",
    latitude: 59.437,
    longitude: 24.7536,
    source: "fallback"
};
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
const weatherWeekdayFormatter = new Intl.DateTimeFormat("et-EE", {
    weekday: "short"
});
const weatherFullDateFormatter = new Intl.DateTimeFormat("et-EE", {
    weekday: "long",
    day: "numeric",
    month: "long"
});
const recentProblemsViewportQuery = window.matchMedia("(max-width: 640px)");
let lastRecentProblemsInitialCount = recentProblemsViewportQuery.matches
    ? RECENT_PROBLEMS_MOBILE_INITIAL_COUNT
    : RECENT_PROBLEMS_DESKTOP_INITIAL_COUNT;
let lastDailyArticlesMobileView = recentProblemsViewportQuery.matches;
let lastPersonaStoriesMobileView = recentProblemsViewportQuery.matches;
const recentProblemDetailCache = new Map();
const prefersReducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const weatherTimeFormatter = new Intl.DateTimeFormat("et-EE", {
    hour: "2-digit",
    minute: "2-digit"
});

function getISOWeekNumber(date) {
    const normalizedDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const weekday = normalizedDate.getUTCDay() || 7;

    normalizedDate.setUTCDate(normalizedDate.getUTCDate() + 4 - weekday);

    const yearStart = new Date(Date.UTC(normalizedDate.getUTCFullYear(), 0, 1));
    return Math.ceil((((normalizedDate - yearStart) / 86400000) + 1) / 7);
}

function initializeCoverIssueMeta() {
    const today = new Date();

    if (coverIssueDate) {
        coverIssueDate.textContent = articleDateFormatter.format(today);
    }

    if (coverIssueNumber) {
        coverIssueNumber.textContent = "Nr " + numberFormatter.format(getISOWeekNumber(today));
    }
}

function loadCoverStoryHeroImage() {
    if (!coverStoryHero) {
        return;
    }

    const nextUrl = dailyCoverStory?.imageUrl || "";

    if (!nextUrl) {
        coverStoryHero.style.removeProperty("--intake-hero-image");
        coverStoryHero.dataset.imageState = "fallback";
        coverStoryHero.dataset.imageUrl = "";
        return;
    }

    if (coverStoryHero.dataset.imageUrl === nextUrl && coverStoryHero.dataset.imageState === "ready") {
        return;
    }

    const currentToken = ++coverStoryImageLoadToken;
    const image = new Image();

    coverStoryHero.dataset.imageState = "loading";
    coverStoryHero.dataset.imageUrl = nextUrl;

    image.onload = function () {
        if (currentToken !== coverStoryImageLoadToken) {
            return;
        }

        coverStoryHero.style.setProperty("--intake-hero-image", `url("${nextUrl}")`);
        coverStoryHero.dataset.imageState = "ready";
    };

    image.onerror = function () {
        if (currentToken !== coverStoryImageLoadToken) {
            return;
        }

        coverStoryHero.style.removeProperty("--intake-hero-image");
        coverStoryHero.dataset.imageState = "error";
    };

    image.src = nextUrl;
}

function renderDailyCoverStory() {
    if (coverStoryName) {
        coverStoryName.hidden = !dailyCoverStory?.subjectName;
        coverStoryName.textContent = dailyCoverStory?.subjectName || "";
    }

    loadCoverStoryHeroImage();
    renderDailyCoverStoryFeature();
}

function hasDailyCoverStoryFeature(story = dailyCoverStory) {
    return Boolean(
        story
        && (
            story.title
            || story.summary
            || story.lead
            || story.pullQuote
            || story.subjectName
            || (Array.isArray(story.paragraphs) && story.paragraphs.length > 0)
        )
    );
}

function getDailyCoverStoryFeatureTitle(story = dailyCoverStory) {
    return story?.title || story?.subjectName || "Kaane lugu";
}

function setDailyCoverStoryExpanded(nextOpen, options = {}) {
    if (!coverStoryHero || !coverStoryHeroToggle || !coverStoryFeature || !hasDailyCoverStoryFeature()) {
        isDailyCoverStoryOpen = false;
        coverStoryHero?.classList.remove("intake-hero--expanded");
        coverStoryHeroToggle?.setAttribute("aria-expanded", "false");
        coverStoryHeroToggle?.setAttribute("aria-label", "Ava kaanelugu");
        coverStoryFeature?.classList.remove("is-open");
        coverStoryFeature?.setAttribute("aria-hidden", "true");

        return;
    }

    isDailyCoverStoryOpen = Boolean(nextOpen);
    coverStoryHero.classList.toggle("intake-hero--expanded", isDailyCoverStoryOpen);
    coverStoryHeroToggle.setAttribute("aria-expanded", String(isDailyCoverStoryOpen));
    coverStoryHeroToggle.setAttribute("aria-label", isDailyCoverStoryOpen ? "Sulge kaanelugu" : "Ava kaanelugu");
    coverStoryFeature.classList.toggle("is-open", isDailyCoverStoryOpen);
    coverStoryFeature.setAttribute("aria-hidden", String(!isDailyCoverStoryOpen));
}

function renderDailyCoverStoryFeature() {
    if (!coverStoryHero || !coverStoryHeroToggle || !coverStoryFeature) {
        return;
    }

    const hasFeature = hasDailyCoverStoryFeature();

    coverStoryHero.classList.toggle("intake-hero--clickable", hasFeature);
    coverStoryHeroToggle.classList.toggle("intake-hero__cover--interactive", hasFeature);
    coverStoryHeroToggle.setAttribute("aria-disabled", String(!hasFeature));
    coverStoryHeroToggle.tabIndex = hasFeature ? 0 : -1;
    coverStoryFeature.hidden = !hasFeature;

    if (coverStoryToggleHint) {
        coverStoryToggleHint.hidden = !hasFeature;
    }

    if (!hasFeature) {
        setDailyCoverStoryExpanded(false);
        return;
    }

    if (coverStoryFeatureDate) {
        coverStoryFeatureDate.textContent = formatEditorialDate(dailyCoverStory);
    }

    if (coverStoryFeatureTitle) {
        coverStoryFeatureTitle.textContent = getDailyCoverStoryFeatureTitle(dailyCoverStory);
    }

    if (coverStoryFeatureSummary) {
        coverStoryFeatureSummary.hidden = !dailyCoverStory?.summary;
        coverStoryFeatureSummary.textContent = dailyCoverStory?.summary || "";
    }

    const summaryText = dailyCoverStory?.summary || "";
    const transcriptSummaryText = dailyCoverStory?.transcriptSummary || "";
    const leadText = dailyCoverStory?.lead || (transcriptSummaryText !== summaryText ? transcriptSummaryText : "");
    const quoteText = dailyCoverStory?.pullQuote || "";
    const bodyParagraphs = (dailyCoverStory?.paragraphs || [])
        .filter(Boolean)
        .filter(function (paragraphText, index, paragraphs) {
            return paragraphs.indexOf(paragraphText) === index
                && paragraphText !== summaryText
                && paragraphText !== leadText;
        });

    if (coverStoryFeatureLead) {
        coverStoryFeatureLead.hidden = !leadText || leadText === summaryText;
        coverStoryFeatureLead.textContent = leadText || "";
    }

    if (coverStoryFeatureQuote) {
        coverStoryFeatureQuote.hidden = !quoteText || quoteText === summaryText || quoteText === leadText;
        coverStoryFeatureQuote.textContent = quoteText || "";
    }

    if (coverStoryFeatureBody) {
        coverStoryFeatureBody.hidden = bodyParagraphs.length === 0;

        if (bodyParagraphs.length === 0) {
            coverStoryFeatureBody.replaceChildren();
        } else {
            const bodyFragment = document.createDocumentFragment();

            bodyParagraphs.forEach(function (paragraphText) {
                const paragraph = document.createElement("p");
                paragraph.textContent = paragraphText;
                bodyFragment.append(paragraph);
            });

            coverStoryFeatureBody.replaceChildren(bodyFragment);
        }
    }

    if (coverStoryFeatureSubject) {
        coverStoryFeatureSubject.hidden = !dailyCoverStory?.subjectName;
        coverStoryFeatureSubject.textContent = dailyCoverStory?.subjectName || "";
    }

    coverStoryFeature.setAttribute("aria-hidden", String(!isDailyCoverStoryOpen));
    coverStoryFeature.classList.toggle("is-open", isDailyCoverStoryOpen);
    coverStoryHero.classList.toggle("intake-hero--expanded", isDailyCoverStoryOpen);
    coverStoryHeroToggle.setAttribute("aria-expanded", String(isDailyCoverStoryOpen));
    coverStoryHeroToggle.setAttribute("aria-label", isDailyCoverStoryOpen ? "Sulge kaanelugu" : "Ava kaanelugu");
}

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
const PROBLEM_QUIZ_AREAS = {
    tempo: {
        label: "Töö ja tempo",
        recommendation: "Just siin annab üks lõpetatud ots sulle kõige kiirema hingamisruumi tagasi.",
        prompt: "Mul koguneb praegu liiga palju töö ja tempo teemasid. Kõige rohkem vajab lahendamist see, et "
    },
    money: {
        label: "Raha ja asjaajamine",
        recommendation: "Kui see valdkond korraks sirgu tõmmata, kaob taustal suur osa pidevast hõõrdumisest.",
        prompt: "Mul on praegu lahti raha või asjaajamisega seotud teema. Kõige rohkem häirib mind see, et "
    },
    people: {
        label: "Inimesed ja suhted",
        recommendation: "Üks aus lahendus või vestlus annaks siin rohkem kergendust kui uus ring mõtlemist.",
        prompt: "Mul on praegu lahendamata suhtlus või suhtega seotud teema. Kõige rohkem kriibib see, et "
    },
    home: {
        label: "Kodused asjad",
        recommendation: "See on tüüpiline valdkond, mis näib väike, aga sööb iga päev üllatavalt palju tähelepanu.",
        prompt: "Mul on praegu pooleli kodune või igapäevane asi, mis venib. Kõige rohkem segab mind see, et "
    },
    self: {
        label: "Pea ja energia",
        recommendation: "Selle valdkonna puhul on kasu sellest, kui sõnastad ühe teema lõpuks väga konkreetselt välja.",
        prompt: "Mul on peas teema, mis sööb liiga palju energiat. Kõige rohkem koormab mind see, et "
    }
};
const PROBLEM_QUIZ_METRICS = [
    { key: "pressure", label: "Pinge" },
    { key: "backlog", label: "Kuhjumine" },
    { key: "avoidance", label: "Vältimine" }
];
const PROBLEM_QUIZ_LEVELS = [
    {
        max: 24,
        label: "Pigem sile meri",
        estimate: "0-1 teemat",
        description: "Praegu ei paista, et probleemid sul päeva juhiksid. Mõni lahtine ots võib olla, aga süsteem on veel sinu käes.",
        nudge: "Ühest väikesest lõpetamisest piisab, et pilt täiesti puhas püsiks.",
        accent: "#86d0b0",
        glow: "rgba(134, 208, 176, 0.22)"
    },
    {
        max: 49,
        label: "Vaikne kuhjumine",
        estimate: "2-3 teemat",
        description: "Mitu asja kogub vaikselt hoogu. Midagi pole veel punases, aga see on täpselt see koht, kus üks lahendus annab suure kergenduse.",
        nudge: "Ära oota motivatsiooni. Vali üks konkreetne teema ja tõmba see sirgeks.",
        accent: "#efbc6a",
        glow: "rgba(239, 188, 106, 0.22)"
    },
    {
        max: 74,
        label: "Probleemisaba on päris olemas",
        estimate: "4-6 teemat",
        description: "Sul on juba mitu teemat, mis võtavad ruumi ka siis, kui sa nendega aktiivselt ei tegele. Pidev taustakoormus on tuntav.",
        nudge: "Suurim võit tuleb praegu sellest, kui lahendad ühe konkreetse asja lõpuni, mitte poole peale.",
        accent: "#f08a63",
        glow: "rgba(240, 138, 99, 0.24)"
    },
    {
        max: 100,
        label: "Punane tsoon",
        estimate: "6+ teemat",
        description: "Praegu ei ole küsimus enam motivatsioonis, vaid selles, et liiga palju asju tahab korraga tähelepanu. Üks korralik selgusehetk kulub ära.",
        nudge: "Sul ei ole vaja kõike korraga korda teha. Sul on vaja valida see üks asi, mis praegu kõige rohkem õhku kinni hoiab.",
        accent: "#ad8cff",
        glow: "rgba(173, 140, 255, 0.24)"
    }
];
const PROBLEM_QUIZ_QUESTIONS = [
    {
        id: "open_tabs",
        prompt: "Kui palju lahtisi otsi sul peas korraga ringi jookseb?",
        note: "Kõige ausam esimene tunne loeb.",
        answers: [
            {
                label: "Pea on üsna tühi",
                meta: "Midagi ei karju tähelepanu järele.",
                score: 0,
                metrics: { backlog: 0, pressure: 0 }
            },
            {
                label: "Mõni asi tiksutab",
                meta: "Neid on, aga need ei määra päeva.",
                score: 1,
                metrics: { backlog: 1, pressure: 1 }
            },
            {
                label: "Päris mitu",
                meta: "Peas on juba väike järjekord.",
                score: 2,
                metrics: { backlog: 2, pressure: 1 }
            },
            {
                label: "Terve tagatuba on täis",
                meta: "Üks asi meenutab teist.",
                score: 3,
                metrics: { backlog: 3, pressure: 2 }
            }
        ]
    },
    {
        id: "thought_return",
        prompt: "Kui tihti tabad end mõttelt: ma peaksin sellega tegelema?",
        note: "See näitab, kui palju ruumi probleemid päriselt võtavad.",
        answers: [
            {
                label: "Harva või peaaegu mitte",
                meta: "Päev püsib oma kursil.",
                score: 0,
                metrics: { pressure: 0 }
            },
            {
                label: "Korralikult korra päevas",
                meta: "Mõni asi tuletab end meelde.",
                score: 1,
                metrics: { pressure: 1 }
            },
            {
                label: "Mitu korda päevas",
                meta: "Teemad hüppavad ise pähe.",
                score: 2,
                metrics: { pressure: 2 }
            },
            {
                label: "See jookseb kogu aeg taustal",
                meta: "Tähelepanu lekib sinna tagasi.",
                score: 3,
                metrics: { pressure: 3 }
            }
        ]
    },
    {
        id: "focus_area",
        prompt: "Milline valdkond kisub sind praegu kõige rohkem varrukast?",
        note: "Vali see, mis esimese hooga pähe tuleb.",
        answers: [
            {
                label: "Töö ja tempo",
                meta: "Tähtaeg, koormus või venivad tegemised.",
                score: 1,
                area: "tempo"
            },
            {
                label: "Raha ja asjaajamine",
                meta: "Arved, kohustused või segane korraldus.",
                score: 1,
                area: "money"
            },
            {
                label: "Inimesed ja suhted",
                meta: "Midagi on ütlemata või kripeldab.",
                score: 1,
                area: "people"
            },
            {
                label: "Kodused asjad",
                meta: "Poolikud majapidamise või elu korraldamise teemad.",
                score: 1,
                area: "home"
            },
            {
                label: "Mu enda pea ja energia",
                meta: "Peamine pinge tuleb seestpoolt.",
                score: 1,
                area: "self"
            }
        ]
    },
    {
        id: "reaction_pattern",
        prompt: "Kui mõni probleem korraks meelde tuleb, mida sa enamasti teed?",
        note: "Aus vastus on kasulikum kui ilus vastus.",
        answers: [
            {
                label: "Võtan kohe käsile",
                meta: "Vähemalt esimese sammu teen ära.",
                score: 0,
                metrics: { avoidance: 0, backlog: 0 }
            },
            {
                label: "Panen vaimselt järjekorda",
                meta: "See saab koha, aga mitte kohe aega.",
                score: 1,
                metrics: { avoidance: 1, backlog: 1 }
            },
            {
                label: "Lükkan homsesse",
                meta: "Täna ei taha sellega jamada.",
                score: 2,
                metrics: { avoidance: 2, backlog: 1 }
            },
            {
                label: "Teen nägu, et seda pole olemas",
                meta: "Kuni ta päriselt karjuma hakkab.",
                score: 3,
                metrics: { avoidance: 3, pressure: 1 }
            }
        ]
    },
    {
        id: "energy_drain",
        prompt: "Kui palju need teemad su tuju või energiat söövad?",
        note: "Mõtle viimaste päevade, mitte ideaalnädala peale.",
        answers: [
            {
                label: "Peaaegu üldse mitte",
                meta: "Vaba ruumi on veel palju.",
                score: 0,
                metrics: { pressure: 0 }
            },
            {
                label: "Natuke võtavad ära",
                meta: "Vahel tunned, et midagi hõõrub.",
                score: 1,
                metrics: { pressure: 1 }
            },
            {
                label: "Päris tuntavalt",
                meta: "Mitu asja imeb energiat korraga.",
                score: 2,
                metrics: { pressure: 2, backlog: 1 }
            },
            {
                label: "Liiga palju",
                meta: "See on juba päevade kvaliteedi teema.",
                score: 3,
                metrics: { pressure: 3, backlog: 2 }
            }
        ]
    },
    {
        id: "finish_today",
        prompt: "Kui lihtne oleks sul täna üks päris tüütu asi lõpuni ära lahendada?",
        note: "Mitte ideaalselt. Lihtsalt lõpuni.",
        answers: [
            {
                label: "Täiesti tehtav",
                meta: "Kui vaja, teen ära.",
                score: 0,
                metrics: { avoidance: 0 }
            },
            {
                label: "Tuleks pingutada",
                meta: "Saaks, aga tahaks edasi lükata.",
                score: 1,
                metrics: { avoidance: 1, pressure: 1 }
            },
            {
                label: "Vajaks tõsist sundi",
                meta: "Mul ei ole selleks väga ruumi.",
                score: 2,
                metrics: { avoidance: 2, pressure: 1 }
            },
            {
                label: "Praegu ei kujuta ette",
                meta: "Jõud käib lihtsalt üle serva.",
                score: 3,
                metrics: { avoidance: 3, pressure: 2 }
            }
        ]
    },
    {
        id: "list_feeling",
        prompt: "Mis tunne tekiks, kui peaksid kõik praegused mured ühele lehele kirja panema?",
        note: "See on hea lakmuspaber sellele, kui palju on õhus.",
        answers: [
            {
                label: "Pigem kergendus",
                meta: "Siis oleks vähemalt pilt ees.",
                score: 0,
                metrics: { backlog: 0, pressure: 0 }
            },
            {
                label: "Natuke ebamugav",
                meta: "Aga midagi hullu selles poleks.",
                score: 1,
                metrics: { backlog: 1, pressure: 1 }
            },
            {
                label: "See oleks väsitav vaatepilt",
                meta: "Juba nimekiri ise võtaks energiat.",
                score: 2,
                metrics: { backlog: 2, pressure: 2 }
            },
            {
                label: "Ausalt, ma ei tahaks seda näha",
                meta: "See teeks pildi liiga päriseks.",
                score: 3,
                metrics: { backlog: 3, pressure: 3 }
            }
        ]
    },
    {
        id: "truth_line",
        prompt: "Milline lause on praegu kõige rohkem tõsi?",
        note: "Lõpus arvutame selle põhjal sinu probleemirõhu välja.",
        answers: [
            {
                label: "Asjad on enam-vähem joones",
                meta: "Pigem väikesed korrastused kui päris probleemid.",
                score: 0,
                metrics: { backlog: 0, pressure: 0 }
            },
            {
                label: "Mõni teema oleks vaja ära sulgeda",
                meta: "See ei sega kõike, aga võiks juba tehtud olla.",
                score: 1,
                metrics: { backlog: 1, pressure: 1 }
            },
            {
                label: "Mitmed asjad seisavad lihtsalt ees",
                meta: "Nad võtavad rohkem ruumi, kui peaks.",
                score: 2,
                metrics: { backlog: 2, pressure: 2, avoidance: 1 }
            },
            {
                label: "Mul oleks hädasti üht suurt puhastust vaja",
                meta: "Praegu on ruum liiga täis.",
                score: 3,
                metrics: { backlog: 3, pressure: 3, avoidance: 2 }
            }
        ]
    }
];
const PROBLEM_QUIZ_INPUT_INTROS = {
    tempo: [
        "Praegu kisub kõige rohkem töö ja tempo.",
        "Töö ja tempo on mul praegu kõige suurem probleemikoht.",
        "Kõige rohkem survet tekitab praegu töötempo."
    ],
    money: [
        "Praegu survestavad mind kõige rohkem rahaasjad ja asjaajamine.",
        "Raha või asjaajamisega seotud asi on mul praegu kõige suurem pingeallikas.",
        "Kõige rohkem vajab mul praegu lahendamist raha või asjaajamine."
    ],
    people: [
        "Praegu närib mind kõige rohkem üks suhtluse või suhte teema.",
        "Kõige rohkem segab mind praegu suhte või suhtluse pinge.",
        "Praegu on kõige pakilisem probleem seotud inimeste ja suhtlusega."
    ],
    home: [
        "Praegu kisuvad kõige rohkem kodused asjad.",
        "Kõige rohkem ripub mul praegu kaelas üks kodune teema.",
        "Praegu tahavad kõige rohkem lahendamist kodused asjad."
    ],
    self: [
        "Praegu sööb kõige rohkem energiat üks peas tiksuv teema.",
        "Kõige rohkem koormab mind praegu üks sisemine pinge.",
        "Praegu vajab kõige rohkem lahti harutamist see, mis mul peas kogu aeg tiksub."
    ]
};
const PROBLEM_QUIZ_INPUT_FRAGMENTS = {
    open_tabs: [
        "Lahtisi otsi on vähe, aga üks neist tiksub siiski taustal.",
        "Mõni lahtine ots käib mul päeva jooksul ikka kuklast läbi.",
        "Mul on peas juba mitu lahtist otsa korraga.",
        "Lahtisi otsi on korraga liiga palju ja need kuhjuvad üksteise otsa."
    ],
    thought_return: [
        "Teema ei ole pidevalt ees, kuid päriselt maas see ka pole.",
        "Vähemalt kord päevas tuleb see teema mulle meelde.",
        "See teema hüppab mul mitu korda päevas ise pähe.",
        "See jookseb mul peaaegu kogu aeg taustal."
    ],
    reaction_pattern: [
        "Ma küll tegelen sellega, aga lahendus pole veel koos.",
        "Panen selle pigem järjekorda kui päriselt käsile.",
        "Lükkan seda liiga tihti homsesse.",
        "Väldin seda seni, kuni see muutub liiga teravaks."
    ],
    energy_drain: [
        "See võtab veidi energiat, kuigi mitte kogu päeva.",
        "See jätab päeva sisse pideva väikese hõõrdumise.",
        "See mõjutab mu energiat juba päris tuntavalt.",
        "See sööb praegu liiga palju energiat."
    ],
    finish_today: [
        "Kui pilt oleks selge, suudaksin ma selle täna ära lahendada.",
        "Selle lõpuni tegemine oleks tehtav, aga nõuaks pingutust.",
        "Selle lõpuni tegemiseks peaksin end päris kõvasti sundima.",
        "Praegu tundub selle lõpuni tegemine juba liiga raske."
    ],
    truth_line: [
        "See ei ole suur kaos, aga tahab ikkagi ärategemist.",
        "Mul on paar teemat, mis tuleks lihtsalt ära sulgeda.",
        "Mul on mitu asja ees, mis võtavad rohkem ruumi kui peaks.",
        "Mul oleks praegu hädasti vaja korralikku puhastust."
    ]
};
const sections = [container, loadingDiv, solutionDiv, reportDiv];

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

function normalizeProblemInputText(text) {
    return String(text || "")
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map(function (line) {
            return line.replace(/[^\S\n]+/g, " ").trim();
        })
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function normalizeProblemDetailText(text) {
    return String(text || "")
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map(function (line) {
            return line.replace(/[^\S\n]+/g, " ").trim();
        })
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
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
    if (!element) {
        return;
    }

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

function normalizeSolverSkin(value) {
    return SOLVER_SKINS.some(function (skin) {
        return skin.id === value;
    })
        ? value
        : SOLVER_SKINS[0].id;
}

function getSolverSkinIndex(value = currentSolverSkinId) {
    const normalizedValue = normalizeSolverSkin(value);
    const index = SOLVER_SKINS.findIndex(function (skin) {
        return skin.id === normalizedValue;
    });

    return index >= 0 ? index : 0;
}

function renderSolverSkinDots() {
    if (!solverSkinDots) {
        return;
    }

    const fragment = document.createDocumentFragment();
    const activeIndex = getSolverSkinIndex();

    SOLVER_SKINS.forEach(function (_skin, index) {
        const dot = document.createElement("span");
        dot.className = "intake-stage__skin-dot";
        dot.classList.toggle("is-active", index === activeIndex);
        fragment.append(dot);
    });

    solverSkinDots.replaceChildren(fragment);
}

function applySolverSkin(value, options = {}) {
    const nextSkin = normalizeSolverSkin(value);
    const motion = options.motion === "prev" || options.motion === "next"
        ? options.motion
        : "";

    currentSolverSkinId = nextSkin;

    if (document.body) {
        document.body.dataset.solverSkin = nextSkin;
    }

    if (intakeStage) {
        intakeStage.dataset.solverSkin = nextSkin;
    }

    if (motion) {
        if (intakeStage) {
            intakeStage.dataset.solverSkinMotion = motion;
        }

        if (document.body) {
            document.body.dataset.solverSkinMotion = motion;
        }

        window.clearTimeout(solverSkinMotionTimer);
        solverSkinMotionTimer = window.setTimeout(function () {
            if (intakeStage && intakeStage.dataset.solverSkinMotion === motion) {
                delete intakeStage.dataset.solverSkinMotion;
            }

            if (document.body && document.body.dataset.solverSkinMotion === motion) {
                delete document.body.dataset.solverSkinMotion;
            }
        }, SOLVER_SKIN_MOTION_DURATION);
    }

    renderSolverSkinDots();
}

function loadSolverSkinPreference() {
    try {
        return normalizeSolverSkin(window.localStorage.getItem(SOLVER_SKIN_STORAGE_KEY) || "");
    } catch (_error) {
        return SOLVER_SKINS[0].id;
    }
}

function persistSolverSkinPreference(value) {
    try {
        window.localStorage.setItem(SOLVER_SKIN_STORAGE_KEY, normalizeSolverSkin(value));
    } catch (_error) {
        // Ignore storage failures and keep the in-memory preference.
    }
}

function cycleSolverSkin(step, motion) {
    const currentIndex = getSolverSkinIndex();
    const nextIndex = (currentIndex + step + SOLVER_SKINS.length) % SOLVER_SKINS.length;
    const nextSkinId = SOLVER_SKINS[nextIndex].id;

    applySolverSkin(nextSkinId, {
        motion: prefersReducedMotionQuery.matches ? "" : motion
    });
    persistSolverSkinPreference(nextSkinId);
}

function initializeSolverSkinSwipe() {
    applySolverSkin(loadSolverSkinPreference());

    if (!intakeStageFrame || intakeStageFrame.dataset.solverSkinSwipeBound === "true") {
        return;
    }

    intakeStageFrame.addEventListener("touchstart", function (event) {
        if (event.touches.length !== 1) {
            solverSkinTouchActive = false;
            return;
        }

        const touch = event.touches[0];
        solverSkinTouchStartX = touch.clientX;
        solverSkinTouchStartY = touch.clientY;
        solverSkinTouchActive = true;
    }, { passive: true });

    intakeStageFrame.addEventListener("touchend", function (event) {
        if (!solverSkinTouchActive || event.changedTouches.length !== 1) {
            solverSkinTouchActive = false;
            return;
        }

        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - solverSkinTouchStartX;
        const deltaY = touch.clientY - solverSkinTouchStartY;

        solverSkinTouchActive = false;

        if (Math.abs(deltaX) < SOLVER_SKIN_SWIPE_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) {
            return;
        }

        cycleSolverSkin(deltaX < 0 ? 1 : -1, deltaX < 0 ? "next" : "prev");
    }, { passive: true });

    intakeStageFrame.addEventListener("touchcancel", function () {
        solverSkinTouchActive = false;
    }, { passive: true });

    intakeStageFrame.dataset.solverSkinSwipeBound = "true";
}

function setUrgitsBannerLayerImage(layer, imageSrc) {
    if (!layer) {
        return;
    }

    layer.style.backgroundImage = imageSrc ? 'url("' + imageSrc + '")' : "";
}

function advanceUrgitsBannerImage() {
    if (!urgitsBannerFrame || urgitsBannerImageLayers.length < 2 || URGITS_BANNER_IMAGES.length < 2) {
        return;
    }

    const nextImageIndex = (urgitsBannerActiveImageIndex + 1) % URGITS_BANNER_IMAGES.length;
    const nextLayerIndex = (urgitsBannerActiveLayerIndex + 1) % urgitsBannerImageLayers.length;
    const currentLayer = urgitsBannerImageLayers[urgitsBannerActiveLayerIndex];
    const nextLayer = urgitsBannerImageLayers[nextLayerIndex];

    setUrgitsBannerLayerImage(nextLayer, URGITS_BANNER_IMAGES[nextImageIndex]);
    nextLayer.classList.add("is-active");
    currentLayer?.classList.remove("is-active");

    urgitsBannerActiveImageIndex = nextImageIndex;
    urgitsBannerActiveLayerIndex = nextLayerIndex;
}

function initializeUrgitsBannerRotation() {
    if (!urgitsBannerFrame || urgitsBannerImageLayers.length === 0 || URGITS_BANNER_IMAGES.length === 0) {
        return;
    }

    setUrgitsBannerLayerImage(urgitsBannerImageLayers[0], URGITS_BANNER_IMAGES[0]);

    if (urgitsBannerImageLayers[1]) {
        setUrgitsBannerLayerImage(urgitsBannerImageLayers[1], URGITS_BANNER_IMAGES[1] || URGITS_BANNER_IMAGES[0]);
        urgitsBannerImageLayers[1].classList.remove("is-active");
    }

    urgitsBannerActiveLayerIndex = 0;
    urgitsBannerActiveImageIndex = 0;

    if (urgitsBannerImageTimer) {
        window.clearInterval(urgitsBannerImageTimer);
    }

    if (prefersReducedMotionQuery.matches || URGITS_BANNER_IMAGES.length < 2) {
        return;
    }

    urgitsBannerImageTimer = window.setInterval(function () {
        if (document.hidden) {
            return;
        }

        advanceUrgitsBannerImage();
    }, URGITS_BANNER_IMAGE_ROTATION_MS);
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

    window.requestAnimationFrame(function () {
        const scrollTarget = panel.querySelector(".panel__frame") || panel;
        const bodyPaddingTop = parseFloat(window.getComputedStyle(body).paddingTop) || 0;
        const targetTop = Math.max(0, window.scrollY + scrollTarget.getBoundingClientRect().top - bodyPaddingTop);

        window.scrollTo({
            top: targetTop,
            behavior: prefersReducedMotionQuery.matches ? "auto" : "smooth"
        });
    });
}

function formatSolveDurationLabel(durationMs) {
    const totalSeconds = Math.max(1, Math.round(durationMs / 1000));

    if (totalSeconds < 60) {
        return "Valmis " + totalSeconds + " sekundiga.";
    }

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (seconds === 0) {
        return "Valmis " + minutes + " minutiga.";
    }

    return "Valmis " + minutes + " min " + seconds + " s.";
}

function detectCategory(problemText) {
    return detectProblemCategory(problemText) || GENERAL_PROBLEM_CATEGORY;
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

function getRecordDateValue(record) {
    const dateKey = sanitizeProblemText(record?.dateKey || record?.date_key || "");

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return new Date(`${dateKey}T12:00:00`);
    }

    return new Date(parseDateToTimestamp(record?.publishedAt || record?.published_at));
}

function getRecordDateTimestamp(record) {
    return getRecordDateValue(record).getTime();
}

function formatEditorialDate(record) {
    return articleDateFormatter.format(getRecordDateValue(record));
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

function sanitizeAdministrativeUiText(value) {
    return String(value || "")
        .replace(/\badmin-asju\b/giu, "asjaajamisi")
        .replace(/\badminiga\b/giu, "asjaajamisega")
        .replace(/\badminni\b/giu, "asjaajamist")
        .replace(/\badmin\b/giu, "asjaajamine")
        .replace(/\s+/g, " ")
        .trim();
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

function normalizeDailyCoverStory(record) {
    if (!record || typeof record !== "object") {
        return null;
    }

    const subjectName = truncate(sanitizeProblemText(record.subjectName || record.subject_name || ""), 64);
    const imageUrl = sanitizeProblemText(record.imageUrl || record.image_url || "");
    const title = truncate(sanitizeProblemText(record.title || ""), 96);

    if (!subjectName && !imageUrl && !title) {
        return null;
    }

    return {
        dateKey: sanitizeProblemText(record.dateKey || record.date_key || ""),
        subjectName,
        title,
        summary: truncate(sanitizeProblemText(record.summary || ""), 220),
        transcriptSummary: truncate(sanitizeProblemText(record.transcriptSummary || record.transcript_summary || ""), 320),
        lead: truncate(sanitizeProblemText(record.lead || ""), 220),
        paragraphs: normalizeTextArray(record.paragraphs, [], 4, 360),
        pullQuote: truncate(sanitizeProblemText(record.pullQuote || record.pull_quote || ""), 220),
        imageUrl,
        imageAlt: truncate(sanitizeProblemText(record.imageAlt || record.image_alt || ""), 180),
        publishedAt: new Date(parseDateToTimestamp(record.publishedAt || record.published_at)).toISOString()
    };
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
    const fallbackLead = "Üks hästi valitud teos võib lahendada väikese, aga tüütu koduse probleemi palju täpsemini kui järjekordne uus ese.";

    return {
        id: sanitizeProblemText(record.id || record.dateKey || record.date_key || String(index + 1)),
        dateKey: sanitizeProblemText(record.dateKey || record.date_key || ""),
        theme: capitalizeFirst(truncate(sanitizeProblemText(record.theme || "Kunst"), 42)),
        title,
        lead: truncate(sanitizeProblemText(record.lead || fallbackLead), 180),
        highlight: truncate(
            sanitizeProblemText(
                record.highlight
                || "Hea teos ei täida ainult seina, vaid lõpetab ühe lahtiseks jäänud ruumiprobleemi."
            ),
            210
        ),
        bannerNote: truncate(
            sanitizeProblemText(
                record.bannerNote
                || record.banner_note
                || "Lorien Velmore sobib just sellesse kohta, kus ruum vajab üht selget, läbimõeldud otsust."
            ),
            190
        ),
        paragraphs: normalizeTextArray(
            record.paragraphs,
            [
                fallbackLead,
                "Sageli ei lahenda seda probleemset tunnet uus riiul või uus lamp, vaid hoopis üks tugev visuaalne raskuskese.",
                "Kui ruumis on lõpuks midagi, mis seob ülejäänu kokku, muutub kogu taju kohe täpsemaks.",
                "Just selles kohas töötab Lorien Velmore kõige paremini: mitte lisandina, vaid viimase vajaliku otsusena."
            ],
            4,
            340
        ),
        takeaways: normalizeTextArray(
            record.takeaways,
            ["Ruum saab põhjuse", "Valik tundub täpne", "Kodu jääb meelde"],
            3,
            44
        ).map(function (value, index) {
            return compactLabel(
                value,
                ["Ruum saab põhjuse", "Valik tundub täpne", "Kodu jääb meelde"][index],
                34
            );
        }),
        lenses: normalizeTextArray(
            record.lenses,
            ["Ruum", "Valik", "Mõju"],
            3,
            24
        ).map(function (value, index) {
            return capitalizeFirst(compactLabel(value, ["Ruum", "Valik", "Mõju"][index], 18));
        }),
        readingTime: truncate(sanitizeProblemText(record.readingTime || record.reading_time || "4 min lugemine"), 24),
        imageUrl: sanitizeProblemText(record.imageUrl || record.image_url || ""),
        imageAlt: truncate(sanitizeProblemText(record.imageAlt || record.image_alt || ""), 180),
        imageObjectPosition: sanitizeProblemText(record.imageObjectPosition || record.image_object_position || ""),
        publishedAt
    };
}

function normalizeDailyPersonaStory(record, index) {
    if (!record || typeof record !== "object") {
        return null;
    }

    const title = truncate(sanitizeProblemText(record.title || ""), 110);

    if (!title) {
        return null;
    }

    const publishedAt = new Date(parseDateToTimestamp(record.publishedAt || record.published_at)).toISOString();
    const galleryImages = (Array.isArray(record.galleryImages) ? record.galleryImages : [])
        .slice(0, 4)
        .map(function (image, imageIndex) {
            if (!image || typeof image !== "object") {
                return null;
            }

            const url = sanitizeProblemText(image.url || image.src || "");

            if (!url) {
                return null;
            }

            return {
                id: sanitizeProblemText(image.id || `${record.id || record.dateKey || "persona"}-gallery-${imageIndex + 1}`),
                slot: Math.max(1, Math.min(4, Number(image.slot) || imageIndex + 1)),
                url,
                alt: truncate(sanitizeProblemText(image.alt || ""), 180),
                caption: truncate(sanitizeAdministrativeUiText(sanitizeProblemText(image.caption || "")), 180)
            };
        })
        .filter(Boolean);

    return {
        id: sanitizeProblemText(record.id || record.dateKey || record.date_key || String(index + 1)),
        dateKey: sanitizeProblemText(record.dateKey || record.date_key || ""),
        theme: capitalizeFirst(truncate(sanitizeAdministrativeUiText(sanitizeProblemText(record.theme || "Persoonilugu")), 42)),
        characterName: truncate(sanitizeProblemText(record.characterName || record.character_name || ""), 48),
        characterMeta: truncate(sanitizeProblemText(record.characterMeta || record.character_meta || ""), 72),
        title: truncate(sanitizeAdministrativeUiText(title), 110),
        lead: truncate(sanitizeAdministrativeUiText(sanitizeProblemText(record.lead || "")), 190),
        highlight: truncate(sanitizeAdministrativeUiText(sanitizeProblemText(record.highlight || "")), 190),
        resultNote: truncate(sanitizeAdministrativeUiText(sanitizeProblemText(record.resultNote || record.result_note || "")), 210),
        paragraphs: normalizeTextArray(
            Array.isArray(record.paragraphs) ? record.paragraphs.map(sanitizeAdministrativeUiText) : record.paragraphs,
            [],
            4,
            360
        ).filter(Boolean),
        takeaways: normalizeTextArray(
            Array.isArray(record.takeaways) ? record.takeaways.map(sanitizeAdministrativeUiText) : record.takeaways,
            [],
            3,
            48
        )
            .map(function (value) {
                return compactLabel(value, "", 34);
            })
            .filter(Boolean),
        readingTime: truncate(sanitizeProblemText(record.readingTime || record.reading_time || ""), 24),
        imageUrl: sanitizeProblemText(record.imageUrl || record.image_url || ""),
        imageAlt: truncate(sanitizeProblemText(record.imageAlt || record.image_alt || ""), 180),
        imageObjectPosition: sanitizeProblemText(record.imageObjectPosition || record.image_object_position || ""),
        galleryImages,
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
    if (dailyHoroscopeSection) {
        dailyHoroscopeSection.style.setProperty("--horoscope-section-accent", sign.accent);
        dailyHoroscopeSection.style.setProperty("--horoscope-section-glow", sign.accentSoft);
    }

    const fragment = document.createDocumentFragment();
    const hero = document.createElement("div");
    const meta = document.createElement("div");
    const visual = document.createElement("div");
    const visualSymbol = document.createElement("span");
    const signLabel = document.createElement("span");
    const title = document.createElement("p");
    const date = document.createElement("span");
    const body = document.createElement("div");
    const indicators = document.createElement("div");

    hero.className = "horoscope-card__hero";
    meta.className = "horoscope-card__meta";
    visual.className = "horoscope-card__visual";
    visualSymbol.className = "horoscope-card__visual-symbol";
    signLabel.className = "horoscope-card__sign";
    title.className = "horoscope-card__title";
    date.className = "horoscope-card__date";
    body.className = "horoscope-card__body";
    indicators.className = "horoscope-card__indicators";

    visualSymbol.textContent = sign.symbol;
    signLabel.textContent = sign.label;
    title.textContent = sign.title;
    date.textContent = articleDateFormatter.format(new Date(sign.publishedAt || dailyHoroscopePublishedAt || Date.now()));

    meta.append(signLabel, title, date);
    visual.append(visualSymbol);
    hero.append(meta, visual);
    fragment.append(hero);

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
        const tone = value <= 2 ? "low" : value === 3 ? "mid" : "high";

        block.className = "horoscope-indicator";
        block.classList.add("is-" + tone);
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

    const activeButton = horoscopeSignGrid.querySelector(".horoscope-sign.is-selected");
    if (activeButton && window.matchMedia("(max-width: 767px)").matches) {
        activeButton.scrollIntoView({
            block: "nearest",
            inline: "center",
            behavior: "smooth"
        });
    }
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

const WEATHER_VISUALS = {
    clear: {
        accent: "#ffcc70",
        glow: "rgba(255, 204, 112, 0.28)",
        secondary: "#ffe4ad"
    },
    "partly-cloudy": {
        accent: "#f0bd73",
        glow: "rgba(240, 189, 115, 0.26)",
        secondary: "#bdd4ff"
    },
    cloudy: {
        accent: "#aebed4",
        glow: "rgba(174, 190, 212, 0.24)",
        secondary: "#dce6f3"
    },
    fog: {
        accent: "#b9c2ce",
        glow: "rgba(185, 194, 206, 0.26)",
        secondary: "#dfe6ef"
    },
    drizzle: {
        accent: "#76bbd6",
        glow: "rgba(118, 187, 214, 0.24)",
        secondary: "#d7eef6"
    },
    rain: {
        accent: "#5ea0d0",
        glow: "rgba(94, 160, 208, 0.24)",
        secondary: "#d2e7f5"
    },
    snow: {
        accent: "#dbe7f6",
        glow: "rgba(219, 231, 246, 0.24)",
        secondary: "#ffffff"
    },
    storm: {
        accent: "#a58dff",
        glow: "rgba(165, 141, 255, 0.26)",
        secondary: "#ffd38a"
    },
    mixed: {
        accent: "#8fc0b5",
        glow: "rgba(143, 192, 181, 0.24)",
        secondary: "#def3ec"
    }
};

function normalizeWeatherText(value, fallback, maxLength = 180) {
    const cleaned = truncate(sanitizeProblemText(value || ""), maxLength);
    return cleaned || fallback;
}

function normalizeWeatherNumber(value, fallbackValue = 0) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallbackValue;
}

function getWeatherVisual(conditionKey) {
    return WEATHER_VISUALS[conditionKey] || WEATHER_VISUALS.mixed;
}

function formatWeatherTemperature(value) {
    return `${Math.round(normalizeWeatherNumber(value))}°`;
}

function formatWeatherProbability(value) {
    return `${Math.round(Math.max(0, normalizeWeatherNumber(value)))}%`;
}

function getWeatherDateValue(value) {
    const dateKey = sanitizeProblemText(value || "");

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return new Date(`${dateKey}T12:00:00`);
    }

    return new Date(parseDateToTimestamp(value));
}

function formatWeatherWeekday(value) {
    return capitalizeFirst(weatherWeekdayFormatter.format(getWeatherDateValue(value)).replace(".", ""));
}

function formatWeatherFullDate(value) {
    return capitalizeFirst(weatherFullDateFormatter.format(getWeatherDateValue(value)));
}

function formatWeatherTime(value) {
    return weatherTimeFormatter.format(new Date(parseDateToTimestamp(value)));
}

function getWeatherConditionMeta(conditionKey, conditionLabel, isDay = true) {
    const fallbackLabel = normalizeWeatherText(conditionLabel, "Muutlik");

    if (conditionKey === "clear") {
        return {
            label: fallbackLabel,
            iconKey: isDay ? "sun" : "moon"
        };
    }

    if (conditionKey === "partly-cloudy") {
        return {
            label: fallbackLabel,
            iconKey: isDay ? "cloud-sun" : "cloud-moon"
        };
    }

    if (conditionKey === "cloudy") {
        return {
            label: fallbackLabel,
            iconKey: "cloud"
        };
    }

    if (conditionKey === "fog") {
        return {
            label: fallbackLabel,
            iconKey: "fog"
        };
    }

    if (conditionKey === "drizzle") {
        return {
            label: fallbackLabel,
            iconKey: "drizzle"
        };
    }

    if (conditionKey === "rain") {
        return {
            label: fallbackLabel,
            iconKey: "rain"
        };
    }

    if (conditionKey === "snow") {
        return {
            label: fallbackLabel,
            iconKey: "snow"
        };
    }

    if (conditionKey === "storm") {
        return {
            label: fallbackLabel,
            iconKey: "storm"
        };
    }

    return {
        label: fallbackLabel,
        iconKey: "mixed"
    };
}

function getWeatherIconMarkup(conditionKey, options = {}) {
    const meta = getWeatherConditionMeta(conditionKey, "", options.isDay !== false);
    const size = options.size || 32;
    const stroke = options.strokeWidth || 1.85;
    const secondaryClass = options.secondaryClass || "weather-icon__secondary";
    const primaryClass = options.primaryClass || "weather-icon__primary";

    const iconBodyByKey = {
        sun: `
            <circle class="${primaryClass}" cx="12" cy="12" r="4"></circle>
            <path class="${secondaryClass}" d="M12 2.5V5"></path>
            <path class="${secondaryClass}" d="M12 19V21.5"></path>
            <path class="${secondaryClass}" d="M2.5 12H5"></path>
            <path class="${secondaryClass}" d="M19 12H21.5"></path>
            <path class="${secondaryClass}" d="M5.6 5.6L7.4 7.4"></path>
            <path class="${secondaryClass}" d="M16.6 16.6L18.4 18.4"></path>
            <path class="${secondaryClass}" d="M16.6 7.4L18.4 5.6"></path>
            <path class="${secondaryClass}" d="M5.6 18.4L7.4 16.6"></path>
        `,
        moon: `
            <path class="${primaryClass}" d="M15.9 3.5C13.1 4 11 6.4 11 9.4C11 12.8 13.8 15.6 17.2 15.6C18.2 15.6 19.1 15.4 20 15C19 18.1 16.2 20.3 12.9 20.3C8.8 20.3 5.5 17 5.5 12.9C5.5 9.5 7.7 6.7 10.8 5.8C12.1 5.4 13.6 5.2 15.9 3.5Z"></path>
        `,
        "cloud-sun": `
            <circle class="${secondaryClass}" cx="8" cy="8" r="3.2"></circle>
            <path class="${secondaryClass}" d="M8 2.2V4"></path>
            <path class="${secondaryClass}" d="M8 12V13.8"></path>
            <path class="${secondaryClass}" d="M2.2 8H4"></path>
            <path class="${secondaryClass}" d="M12 8H13.8"></path>
            <path class="${primaryClass}" d="M6.5 17.5H17.2C19.3 17.5 21 15.8 21 13.7C21 11.7 19.5 10.1 17.6 9.9C17 7.7 15 6.2 12.7 6.2C9.9 6.2 7.6 8.2 7.2 10.8C5.3 11.2 4 12.8 4 14.7C4 16.2 5.1 17.5 6.5 17.5Z"></path>
        `,
        "cloud-moon": `
            <path class="${secondaryClass}" d="M10.8 4C9 4.4 7.7 6 7.7 7.9C7.7 10.1 9.5 11.9 11.7 11.9C12.4 11.9 13 11.8 13.6 11.5C12.9 13.7 10.9 15.2 8.6 15.2C5.8 15.2 3.6 13 3.6 10.2C3.6 7.9 5.1 5.9 7.3 5.2"></path>
            <path class="${primaryClass}" d="M7.2 18H17.2C19.3 18 21 16.3 21 14.2C21 12.3 19.6 10.7 17.7 10.4C17.1 8.4 15.2 7 13.1 7C10.3 7 8 8.9 7.6 11.5C5.7 11.9 4.4 13.5 4.4 15.3C4.4 16.9 5.7 18 7.2 18Z"></path>
        `,
        cloud: `
            <path class="${primaryClass}" d="M6.2 18H17.8C20.1 18 22 16.1 22 13.8C22 11.7 20.5 9.9 18.4 9.6C17.8 7 15.5 5.2 12.8 5.2C9.7 5.2 7.1 7.5 6.6 10.5C4.7 10.9 3.4 12.4 3.4 14.3C3.4 16.4 5.1 18 6.2 18Z"></path>
        `,
        fog: `
            <path class="${primaryClass}" d="M6.2 12.8H17.8C20.1 12.8 22 11 22 8.7C22 6.6 20.5 4.8 18.4 4.5C17.8 1.9 15.5 0.1 12.8 0.1C9.7 0.1 7.1 2.4 6.6 5.4C4.7 5.8 3.4 7.3 3.4 9.2C3.4 11.3 5.1 12.8 6.2 12.8Z" transform="translate(0 4.6) scale(0.9)"></path>
            <path class="${secondaryClass}" d="M4 17H20"></path>
            <path class="${secondaryClass}" d="M2.5 20H18.5"></path>
        `,
        drizzle: `
            <path class="${primaryClass}" d="M6.2 13H17.8C20.1 13 22 11.2 22 8.9C22 6.8 20.5 5 18.4 4.7C17.8 2.1 15.5 0.3 12.8 0.3C9.7 0.3 7.1 2.6 6.6 5.6C4.7 6 3.4 7.5 3.4 9.4C3.4 11.5 5.1 13 6.2 13Z" transform="translate(0 3.8) scale(0.92)"></path>
            <path class="${secondaryClass}" d="M8 18.2L7.2 20"></path>
            <path class="${secondaryClass}" d="M12 18.8L11.2 20.6"></path>
            <path class="${secondaryClass}" d="M16 18.2L15.2 20"></path>
        `,
        rain: `
            <path class="${primaryClass}" d="M6.2 13H17.8C20.1 13 22 11.2 22 8.9C22 6.8 20.5 5 18.4 4.7C17.8 2.1 15.5 0.3 12.8 0.3C9.7 0.3 7.1 2.6 6.6 5.6C4.7 6 3.4 7.5 3.4 9.4C3.4 11.5 5.1 13 6.2 13Z" transform="translate(0 3.8) scale(0.92)"></path>
            <path class="${secondaryClass}" d="M7.5 17.5L6.2 20.5"></path>
            <path class="${secondaryClass}" d="M12 18.4L10.7 21.4"></path>
            <path class="${secondaryClass}" d="M16.5 17.5L15.2 20.5"></path>
        `,
        snow: `
            <path class="${primaryClass}" d="M6.2 13H17.8C20.1 13 22 11.2 22 8.9C22 6.8 20.5 5 18.4 4.7C17.8 2.1 15.5 0.3 12.8 0.3C9.7 0.3 7.1 2.6 6.6 5.6C4.7 6 3.4 7.5 3.4 9.4C3.4 11.5 5.1 13 6.2 13Z" transform="translate(0 3.8) scale(0.92)"></path>
            <path class="${secondaryClass}" d="M8.2 18.2H10.8"></path>
            <path class="${secondaryClass}" d="M9.5 16.9V19.5"></path>
            <path class="${secondaryClass}" d="M7.9 17.2L11.1 19.4"></path>
            <path class="${secondaryClass}" d="M11.1 17.2L7.9 19.4"></path>
            <path class="${secondaryClass}" d="M14.6 18.2H17.2"></path>
            <path class="${secondaryClass}" d="M15.9 16.9V19.5"></path>
            <path class="${secondaryClass}" d="M14.3 17.2L17.5 19.4"></path>
            <path class="${secondaryClass}" d="M17.5 17.2L14.3 19.4"></path>
        `,
        storm: `
            <path class="${primaryClass}" d="M6.2 13H17.8C20.1 13 22 11.2 22 8.9C22 6.8 20.5 5 18.4 4.7C17.8 2.1 15.5 0.3 12.8 0.3C9.7 0.3 7.1 2.6 6.6 5.6C4.7 6 3.4 7.5 3.4 9.4C3.4 11.5 5.1 13 6.2 13Z" transform="translate(0 3.8) scale(0.92)"></path>
            <path class="${secondaryClass}" d="M12.4 14.8L9.8 19.1H13.1L11.3 23.2L16.2 17.4H13.2L15.1 14.8Z"></path>
        `,
        mixed: `
            <path class="${primaryClass}" d="M6.2 13H17.8C20.1 13 22 11.2 22 8.9C22 6.8 20.5 5 18.4 4.7C17.8 2.1 15.5 0.3 12.8 0.3C9.7 0.3 7.1 2.6 6.6 5.6C4.7 6 3.4 7.5 3.4 9.4C3.4 11.5 5.1 13 6.2 13Z" transform="translate(0 3.8) scale(0.92)"></path>
            <path class="${secondaryClass}" d="M9.2 18.4L8.1 20.7"></path>
            <path class="${secondaryClass}" d="M14.7 16.9L17.2 18.4"></path>
            <path class="${secondaryClass}" d="M16 13.6L16 15.4"></path>
        `
    };

    return `
        <svg class="weather-icon weather-icon--${conditionKey}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            ${iconBodyByKey[meta.iconKey] || iconBodyByKey.mixed}
        </svg>
    `;
}

function applyWeatherTheme(element, conditionKey) {
    if (!element) {
        return;
    }

    const visual = getWeatherVisual(conditionKey);
    element.style.setProperty("--weather-accent", visual.accent);
    element.style.setProperty("--weather-glow", visual.glow);
    element.style.setProperty("--weather-secondary", visual.secondary);
}

function normalizeWeatherTimelineEntry(entry) {
    if (!entry || typeof entry !== "object") {
        return null;
    }

    return {
        time: normalizeWeatherText(entry.time, ""),
        conditionKey: normalizeWeatherText(entry.conditionKey, "mixed", 32),
        conditionLabel: normalizeWeatherText(entry.conditionLabel, "Muutlik"),
        temperature: normalizeWeatherNumber(entry.temperature, 0),
        apparentTemperature: normalizeWeatherNumber(entry.apparentTemperature, 0),
        precipitationProbability: normalizeWeatherNumber(entry.precipitationProbability, 0),
        precipitation: normalizeWeatherNumber(entry.precipitation, 0),
        windSpeed: normalizeWeatherNumber(entry.windSpeed, 0),
        isDay: entry.isDay !== false
    };
}

function normalizeWeatherForecastDay(entry, index) {
    if (!entry || typeof entry !== "object") {
        return null;
    }

    return {
        dateKey: normalizeWeatherText(entry.dateKey, String(index + 1), 20),
        label: normalizeWeatherText(entry.label, index === 0 ? "Täna" : index === 1 ? "Homme" : formatWeatherWeekday(entry.dateKey), 24),
        conditionKey: normalizeWeatherText(entry.conditionKey, "mixed", 32),
        conditionLabel: normalizeWeatherText(entry.conditionLabel, "Muutlik"),
        temperatureMax: normalizeWeatherNumber(entry.temperatureMax, 0),
        temperatureMin: normalizeWeatherNumber(entry.temperatureMin, 0),
        apparentTemperatureMax: normalizeWeatherNumber(entry.apparentTemperatureMax, 0),
        apparentTemperatureMin: normalizeWeatherNumber(entry.apparentTemperatureMin, 0),
        precipitationProbabilityMax: normalizeWeatherNumber(entry.precipitationProbabilityMax, 0),
        precipitationSum: normalizeWeatherNumber(entry.precipitationSum, 0),
        windSpeedMax: normalizeWeatherNumber(entry.windSpeedMax, 0),
        windGustsMax: normalizeWeatherNumber(entry.windGustsMax, 0),
        sunrise: normalizeWeatherText(entry.sunrise, ""),
        sunset: normalizeWeatherText(entry.sunset, ""),
        noteTitle: normalizeWeatherText(entry.noteTitle, "Päeva toon", 72),
        noteSummary: normalizeWeatherText(entry.noteSummary, "Päev liigub rahulikult edasi.", 180)
    };
}

function normalizeDailyWeatherPayload(payload, location) {
    if (!payload || typeof payload !== "object") {
        return null;
    }

    const forecast = (Array.isArray(payload.forecast) ? payload.forecast : [])
        .map(normalizeWeatherForecastDay)
        .filter(Boolean)
        .slice(0, 5);

    if (forecast.length === 0) {
        return null;
    }

    const current = {
        time: normalizeWeatherText(payload.current?.time, new Date().toISOString()),
        conditionKey: normalizeWeatherText(payload.current?.conditionKey, forecast[0]?.conditionKey || "mixed", 32),
        conditionLabel: normalizeWeatherText(payload.current?.conditionLabel, payload.current?.condition || "Muutlik"),
        temperature: normalizeWeatherNumber(payload.current?.temperature, forecast[0]?.temperatureMax || 0),
        apparentTemperature: normalizeWeatherNumber(payload.current?.apparentTemperature, payload.current?.temperature || 0),
        relativeHumidity: normalizeWeatherNumber(payload.current?.relativeHumidity, 0),
        precipitation: normalizeWeatherNumber(payload.current?.precipitation, 0),
        windSpeed: normalizeWeatherNumber(payload.current?.windSpeed, 0),
        windGusts: normalizeWeatherNumber(payload.current?.windGusts, 0),
        cloudCover: normalizeWeatherNumber(payload.current?.cloudCover, 0),
        isDay: payload.current?.isDay !== false
    };

    return {
        date: normalizeWeatherText(payload.date, forecast[0]?.dateKey || ""),
        location: {
            label: normalizeWeatherText(payload.location?.label, location?.label || "Tallinn", 48),
            latitude: normalizeWeatherNumber(payload.location?.latitude, location?.latitude || DEFAULT_WEATHER_LOCATION.latitude),
            longitude: normalizeWeatherNumber(payload.location?.longitude, location?.longitude || DEFAULT_WEATHER_LOCATION.longitude),
            source: location?.source || DEFAULT_WEATHER_LOCATION.source
        },
        summaryLine: normalizeWeatherText(payload.summaryLine, "Värske ilmavaade valmistub.", 160),
        current,
        today: {
            ...normalizeWeatherForecastDay(payload.today || forecast[0], 0),
            title: normalizeWeatherText(payload.today?.title, forecast[0]?.noteTitle || "Täna", 72),
            summary: normalizeWeatherText(payload.today?.summary, forecast[0]?.noteSummary || "Tänane ilmaülevaade valmistub.", 220),
            details: normalizeWeatherText(payload.today?.details, "Hoia päeva plaanis veidi paindlikkust.", 220)
        },
        tomorrow: {
            ...normalizeWeatherForecastDay(payload.tomorrow || forecast[1] || forecast[0], 1),
            title: normalizeWeatherText(payload.tomorrow?.title, forecast[1]?.noteTitle || "Homme", 72),
            summary: normalizeWeatherText(payload.tomorrow?.summary, forecast[1]?.noteSummary || "Homne ilmaülevaade valmistub.", 220),
            details: normalizeWeatherText(payload.tomorrow?.details, "Homme jätkub sama üldtoon.", 220)
        },
        forecast,
        timelines: {
            today: (Array.isArray(payload.timelines?.today) ? payload.timelines.today : [])
                .map(normalizeWeatherTimelineEntry)
                .filter(Boolean),
            tomorrow: (Array.isArray(payload.timelines?.tomorrow) ? payload.timelines.tomorrow : [])
                .map(normalizeWeatherTimelineEntry)
                .filter(Boolean)
        },
        planningTips: (Array.isArray(payload.planningTips) ? payload.planningTips : [])
            .map(function (tip) {
                return normalizeWeatherText(tip, "", 88);
            })
            .filter(Boolean)
            .slice(0, 3),
        backgroundImageUrl: normalizeWeatherText(payload.backgroundImageUrl, "", 220),
        publishedAt: new Date(parseDateToTimestamp(payload.publishedAt || payload.published_at)).toISOString(),
        attribution: payload.attribution && typeof payload.attribution === "object" ? payload.attribution : {}
    };
}

function renderWeatherPeekDays(forecastDays) {
    if (!weatherStripPeek) {
        return;
    }

    const fragment = document.createDocumentFragment();

    forecastDays.slice(0, 3).forEach(function (day, index) {
        const item = document.createElement("span");
        const label = document.createElement("span");
        const range = document.createElement("strong");

        item.className = "weather-strip__peek-item";
        label.className = "weather-strip__peek-label";
        range.className = "weather-strip__peek-range";

        label.textContent = index === 0 ? "Täna" : index === 1 ? "Homme" : formatWeatherWeekday(day.dateKey);
        range.textContent = `${formatWeatherTemperature(day.temperatureMax)} · ${formatWeatherTemperature(day.temperatureMin)}`;

        item.append(label, range);
        fragment.append(item);
    });

    weatherStripPeek.replaceChildren(fragment);
}

function renderWeatherStrip() {
    if (!weatherStrip) {
        return;
    }

    if (!dailyWeather) {
        weatherStrip.disabled = true;
        weatherStrip.setAttribute("aria-busy", "true");
        weatherStripIcon.innerHTML = getWeatherIconMarkup("cloudy", { size: 34 });
        weatherStripLocation.textContent = "Ilm valmistub";
        weatherStripSummary.textContent = "Laen värske ilmaülevaate ja 5 päeva vaate.";
        weatherStripTemp.textContent = "--°";
        weatherStripCondition.textContent = "Laadimine";
        weatherStripRange.textContent = "--° / --°";
        weatherStripMeta.textContent = "";
        weatherStripPeek.replaceChildren();
        applyWeatherTheme(weatherStrip, "cloudy");
        weatherStrip.style.removeProperty("--weather-strip-photo");
        weatherStrip.dataset.sceneState = "idle";
        weatherStrip.dataset.sceneUrl = "";
        return;
    }

    const currentMeta = getWeatherConditionMeta(
        dailyWeather.current.conditionKey,
        dailyWeather.current.conditionLabel,
        dailyWeather.current.isDay
    );

    weatherStrip.disabled = false;
    weatherStrip.removeAttribute("aria-busy");
    weatherStripIcon.innerHTML = getWeatherIconMarkup(dailyWeather.current.conditionKey, {
        size: 34,
        isDay: dailyWeather.current.isDay
    });
    weatherStripLocation.textContent = dailyWeather.location.label;
    weatherStripSummary.textContent = dailyWeather.summaryLine;
    weatherStripTemp.textContent = formatWeatherTemperature(dailyWeather.current.temperature);
    weatherStripCondition.textContent = currentMeta.label;
    weatherStripRange.textContent = `${formatWeatherTemperature(dailyWeather.today.temperatureMax)} / ${formatWeatherTemperature(dailyWeather.today.temperatureMin)}`;
    weatherStripMeta.textContent = "";
    renderWeatherPeekDays(dailyWeather.forecast);
    applyWeatherTheme(weatherStrip, dailyWeather.current.conditionKey);
    loadWeatherSceneImage();
}

function createWeatherMetric(labelText, valueText) {
    const item = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");

    item.className = "weather-story__metric";
    label.className = "weather-story__metric-label";
    value.className = "weather-story__metric-value";

    label.textContent = labelText;
    value.textContent = valueText;
    item.append(label, value);

    return item;
}

function renderWeatherStoryCard(target, day, headingText) {
    if (!target || !day) {
        return;
    }

    const fragment = document.createDocumentFragment();
    const top = document.createElement("div");
    const label = document.createElement("span");
    const date = document.createElement("span");
    const title = document.createElement("h3");
    const summary = document.createElement("p");
    const details = document.createElement("p");
    const metrics = document.createElement("div");

    top.className = "weather-story__top";
    label.className = "weather-story__eyebrow";
    date.className = "weather-story__date";
    title.className = "weather-story__title";
    summary.className = "weather-story__summary";
    details.className = "weather-story__details";
    metrics.className = "weather-story__metrics";

    label.textContent = headingText;
    date.textContent = formatWeatherFullDate(day.dateKey);
    title.textContent = day.title;
    summary.textContent = day.summary;
    details.textContent = day.details;

    top.append(label, date);
    metrics.append(
        createWeatherMetric("Temperatuur", `${formatWeatherTemperature(day.temperatureMin)} kuni ${formatWeatherTemperature(day.temperatureMax)}`),
        createWeatherMetric("Saju võimalus", formatWeatherProbability(day.precipitationProbabilityMax)),
        createWeatherMetric("Tuul", `${Math.round(day.windSpeedMax)} km/h`)
    );

    fragment.append(top, title, summary, details, metrics);
    target.replaceChildren(fragment);
    applyWeatherTheme(target, day.conditionKey);
}

function renderWeatherForecast() {
    if (!weatherForecastList) {
        return;
    }

    const fragment = document.createDocumentFragment();

    dailyWeather.forecast.forEach(function (day, index) {
        const card = document.createElement("article");
        const top = document.createElement("div");
        const dayLabel = document.createElement("div");
        const icon = document.createElement("div");
        const title = document.createElement("h4");
        const summary = document.createElement("p");
        const metrics = document.createElement("div");

        card.className = "weather-day-card";
        top.className = "weather-day-card__top";
        dayLabel.className = "weather-day-card__label";
        icon.className = "weather-day-card__icon";
        title.className = "weather-day-card__title";
        summary.className = "weather-day-card__summary";
        metrics.className = "weather-day-card__metrics";

        dayLabel.innerHTML = `<strong>${day.label}</strong><span>${formatWeatherWeekday(day.dateKey)}</span>`;
        icon.innerHTML = getWeatherIconMarkup(day.conditionKey, { size: 28 });
        title.textContent = day.noteTitle;
        summary.textContent = day.noteSummary;
        metrics.append(
            createWeatherMetric("Max", formatWeatherTemperature(day.temperatureMax)),
            createWeatherMetric("Min", formatWeatherTemperature(day.temperatureMin)),
            createWeatherMetric("Sadu", formatWeatherProbability(day.precipitationProbabilityMax))
        );

        top.append(dayLabel, icon);
        card.append(top, title, summary, metrics);
        applyWeatherTheme(card, day.conditionKey);
        fragment.append(card);
    });

    weatherForecastList.replaceChildren(fragment);
}

function renderWeatherTimeline(target, entries) {
    if (!target) {
        return;
    }

    const fragment = document.createDocumentFragment();

    if (!entries || entries.length === 0) {
        const empty = document.createElement("div");
        empty.className = "weather-timeline__empty";
        empty.textContent = "Täpsem tunnivaade valmistub.";
        target.replaceChildren(empty);
        return;
    }

    entries.forEach(function (entry) {
        const item = document.createElement("div");
        const time = document.createElement("span");
        const icon = document.createElement("div");
        const temp = document.createElement("strong");
        const meta = document.createElement("span");

        item.className = "weather-timeline__item";
        time.className = "weather-timeline__time";
        icon.className = "weather-timeline__icon";
        temp.className = "weather-timeline__temp";
        meta.className = "weather-timeline__meta";

        time.textContent = formatWeatherTime(entry.time);
        icon.innerHTML = getWeatherIconMarkup(entry.conditionKey, {
            size: 24,
            isDay: entry.isDay
        });
        temp.textContent = formatWeatherTemperature(entry.temperature);
        meta.textContent = `${formatWeatherProbability(entry.precipitationProbability)} · ${Math.round(entry.windSpeed)} km/h`;

        item.append(time, icon, temp, meta);
        applyWeatherTheme(item, entry.conditionKey);
        fragment.append(item);
    });

    target.replaceChildren(fragment);
}

function renderWeatherPlanningTips() {
    if (!weatherPlanningTips) {
        return;
    }

    const fragment = document.createDocumentFragment();

    (dailyWeather.planningTips.length > 0 ? dailyWeather.planningTips : ["Hoia päeva plaan paindlik."]).forEach(function (tipText) {
        const item = document.createElement("div");
        item.className = "weather-tip";
        item.textContent = tipText;
        fragment.append(item);
    });

    weatherPlanningTips.replaceChildren(fragment);
}

function loadWeatherSceneImage() {
    if (!weatherModalScene && !weatherStrip) {
        return;
    }

    const nextUrl = dailyWeather?.backgroundImageUrl || "";

    if (!nextUrl) {
        if (weatherModalScene) {
            weatherModalScene.style.backgroundImage = "";
            weatherModalScene.dataset.state = "idle";
            weatherModalScene.dataset.url = "";
        }

        if (weatherStrip) {
            weatherStrip.style.removeProperty("--weather-strip-photo");
            weatherStrip.dataset.sceneState = "idle";
            weatherStrip.dataset.sceneUrl = "";
        }
        return;
    }

    if (
        weatherModalScene?.dataset.url === nextUrl
        && weatherModalScene?.dataset.state === "ready"
        && weatherStrip?.dataset.sceneUrl === nextUrl
        && weatherStrip?.dataset.sceneState === "ready"
    ) {
        return;
    }

    const currentToken = ++weatherSceneLoadToken;
    const image = new Image();

    if (weatherModalScene) {
        weatherModalScene.dataset.state = "loading";
        weatherModalScene.dataset.url = nextUrl;
    }

    if (weatherStrip) {
        weatherStrip.dataset.sceneState = "loading";
        weatherStrip.dataset.sceneUrl = nextUrl;
    }

    image.onload = function () {
        if (currentToken !== weatherSceneLoadToken) {
            return;
        }

        if (weatherModalScene) {
            weatherModalScene.style.backgroundImage = `url("${nextUrl}")`;
            weatherModalScene.dataset.state = "ready";
        }

        if (weatherStrip) {
            weatherStrip.style.setProperty("--weather-strip-photo", `url("${nextUrl}")`);
            weatherStrip.dataset.sceneState = "ready";
        }
    };

    image.onerror = function () {
        if (currentToken !== weatherSceneLoadToken) {
            return;
        }

        if (weatherModalScene) {
            weatherModalScene.style.backgroundImage = "";
            weatherModalScene.dataset.state = "error";
        }

        if (weatherStrip) {
            weatherStrip.style.removeProperty("--weather-strip-photo");
            weatherStrip.dataset.sceneState = "error";
        }
    };

    image.src = nextUrl;
}

function renderWeatherModal() {
    if (!dailyWeather || !weatherModal) {
        return;
    }

    const currentMeta = getWeatherConditionMeta(
        dailyWeather.current.conditionKey,
        dailyWeather.current.conditionLabel,
        dailyWeather.current.isDay
    );

    weatherModalLead.textContent = dailyWeather.summaryLine;
    weatherModalCurrentIcon.innerHTML = getWeatherIconMarkup(dailyWeather.current.conditionKey, {
        size: 42,
        isDay: dailyWeather.current.isDay
    });
    weatherModalCurrentTemp.textContent = formatWeatherTemperature(dailyWeather.current.temperature);
    weatherModalCurrentCondition.textContent = currentMeta.label;
    weatherModalLocation.textContent = dailyWeather.location.label;
    weatherModalMeta.textContent = `${formatWeatherFullDate(dailyWeather.date)} · uuendatud ${formatWeatherTime(dailyWeather.publishedAt)}`;
    renderWeatherStoryCard(weatherTodayCard, dailyWeather.today, "Täna");
    renderWeatherStoryCard(weatherTomorrowCard, dailyWeather.tomorrow, "Homme");
    renderWeatherForecast();
    renderWeatherTimeline(weatherTodayTimeline, dailyWeather.timelines.today);
    renderWeatherTimeline(weatherTomorrowTimeline, dailyWeather.timelines.tomorrow);
    renderWeatherPlanningTips();
    applyWeatherTheme(weatherModalDialog, dailyWeather.current.conditionKey);
    loadWeatherSceneImage();
}

function openWeatherModal() {
    if (!weatherModal || !dailyWeather) {
        return;
    }

    renderWeatherModal();
    weatherModal.hidden = false;
    document.body.classList.add("weather-modal-open");

    window.requestAnimationFrame(function () {
        weatherModal.classList.add("is-open");
    });
}

function closeWeatherModal() {
    if (!weatherModal || weatherModal.hidden) {
        return;
    }

    weatherModal.classList.remove("is-open");
    document.body.classList.remove("weather-modal-open");

    window.setTimeout(function () {
        if (!weatherModal.classList.contains("is-open")) {
            weatherModal.hidden = true;
        }
    }, 180);
}

function renderWeatherUnavailable(location = DEFAULT_WEATHER_LOCATION) {
    dailyWeather = null;
    activeWeatherLocation = location;
    renderWeatherStrip();
}

function setDailyWeather(payload, location) {
    const normalizedWeather = normalizeDailyWeatherPayload(payload, location);

    if (!normalizedWeather) {
        renderWeatherUnavailable(location);
        return;
    }

    dailyWeather = normalizedWeather;
    activeWeatherLocation = {
        ...location,
        label: normalizedWeather.location.label
    };
    renderWeatherStrip();

    if (!weatherModal?.hidden) {
        renderWeatherModal();
    }
}

function resolveBrowserWeatherLocation() {
    return new Promise(function (resolve) {
        if (!("geolocation" in navigator)) {
            resolve(DEFAULT_WEATHER_LOCATION);
            return;
        }

        navigator.geolocation.getCurrentPosition(function (position) {
            resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                label: "Sinu asukoht",
                source: "device"
            });
        }, function () {
            resolve(DEFAULT_WEATHER_LOCATION);
        }, {
            enableHighAccuracy: true,
            timeout: WEATHER_LOCATION_TIMEOUT,
            maximumAge: 15 * 60 * 1000
        });
    });
}

async function fetchDailyWeatherFromServer(location) {
    try {
        const requestUrl = new URL("/api/weather", window.location.origin);

        requestUrl.searchParams.set("lat", String(location.latitude));
        requestUrl.searchParams.set("lon", String(location.longitude));
        requestUrl.searchParams.set("label", location.label);

        const response = await fetch(requestUrl, {
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("Daily weather request failed.");
        }

        return await response.json();
    } catch (error) {
        console.error("Failed to fetch daily weather from local server.", error);
        return null;
    }
}

async function refreshDailyWeather(options = {}) {
    const location = options.refreshLocation || !activeWeatherLocation
        ? await resolveBrowserWeatherLocation()
        : activeWeatherLocation;
    const payload = await fetchDailyWeatherFromServer(location);

    if (payload) {
        setDailyWeather(payload, location);
    } else if (!dailyWeather) {
        renderWeatherUnavailable(location);
    }
}

function initializeDailyWeather() {
    if (!weatherStrip) {
        return;
    }

    renderWeatherStrip();

    weatherStrip.addEventListener("click", function () {
        if (dailyWeather) {
            openWeatherModal();
        }
    });

    weatherModalClose?.addEventListener("click", closeWeatherModal);
    weatherModalBackdrop?.addEventListener("click", closeWeatherModal);

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeWeatherModal();
        }
    });

    if (dailyWeatherSyncTimer) {
        window.clearInterval(dailyWeatherSyncTimer);
    }

    void refreshDailyWeather({ refreshLocation: true });
    dailyWeatherSyncTimer = window.setInterval(function () {
        void refreshDailyWeather();
    }, DAILY_WEATHER_REFRESH_INTERVAL);
}

function clearProblemQuizAdvanceTimer() {
    if (problemQuizAdvanceTimer) {
        window.clearTimeout(problemQuizAdvanceTimer);
        problemQuizAdvanceTimer = null;
    }
}

function getProblemQuizAnswer(questionIndex) {
    const answerIndex = problemQuizAnswers[questionIndex];

    if (!Number.isInteger(answerIndex)) {
        return null;
    }

    return PROBLEM_QUIZ_QUESTIONS[questionIndex]?.answers?.[answerIndex] || null;
}

function getProblemQuizAnswerIndexById(questionId) {
    const questionIndex = PROBLEM_QUIZ_QUESTIONS.findIndex(function (question) {
        return question.id === questionId;
    });

    if (questionIndex < 0) {
        return -1;
    }

    return Number.isInteger(problemQuizAnswers[questionIndex]) ? problemQuizAnswers[questionIndex] : -1;
}

function getProblemQuizAnswerById(questionId) {
    const questionIndex = PROBLEM_QUIZ_QUESTIONS.findIndex(function (question) {
        return question.id === questionId;
    });

    if (questionIndex < 0) {
        return null;
    }

    return getProblemQuizAnswer(questionIndex);
}

function getProblemQuizSeed() {
    return problemQuizAnswers.reduce(function (total, answerIndex, questionIndex) {
        const safeValue = Number.isInteger(answerIndex) ? answerIndex + 1 : 0;
        return total + (safeValue * (questionIndex + 3));
    }, 0);
}

function pickProblemQuizVariant(options, seed) {
    if (!Array.isArray(options) || options.length === 0) {
        return "";
    }

    const normalizedSeed = Math.abs(Number(seed) || 0);
    return options[normalizedSeed % options.length];
}

function getProblemQuizAnswerScore(questionId) {
    return getProblemQuizAnswerById(questionId)?.score || 0;
}

function getStrongestProblemQuizSignal(questionIds) {
    return questionIds.reduce(function (bestId, questionId) {
        return getProblemQuizAnswerScore(questionId) > getProblemQuizAnswerScore(bestId) ? questionId : bestId;
    }, questionIds[0]);
}

function getProblemQuizAnsweredCount() {
    return problemQuizAnswers.filter(Number.isInteger).length;
}

function getProblemQuizFocusArea() {
    const areaTotals = Object.keys(PROBLEM_QUIZ_AREAS).reduce(function (result, key) {
        result[key] = 0;
        return result;
    }, {});

    problemQuizAnswers.forEach(function (_answerIndex, questionIndex) {
        const answer = getProblemQuizAnswer(questionIndex);

        if (!answer?.area || !Object.prototype.hasOwnProperty.call(areaTotals, answer.area)) {
            return;
        }

        areaTotals[answer.area] += 1;
    });

    const [focusAreaKey, focusAreaScore] = Object.entries(areaTotals).sort(function (left, right) {
        return right[1] - left[1];
    })[0] || [];

    return focusAreaKey && focusAreaScore > 0 ? { key: focusAreaKey, ...PROBLEM_QUIZ_AREAS[focusAreaKey] } : null;
}

function getProblemQuizMetricTone(value) {
    if (value >= 67) {
        return "kõrge";
    }

    if (value >= 34) {
        return "tõusmas";
    }

    return "madal";
}

function setProblemQuizState(state) {
    if (!problemQuizSection) {
        return;
    }

    problemQuizSection.dataset.quizState = state;
}

function focusProblemQuizPrimaryAction() {
    const focusTarget = problemQuizCard?.querySelector(".problem-quiz__answer, .problem-quiz__action--primary, .problem-quiz__action--secondary");

    if (!focusTarget) {
        return;
    }

    window.setTimeout(function () {
        focusTarget.focus();
    }, 80);
}

function getProblemQuizSnapshotState() {
    const totals = {
        pressure: 0,
        backlog: 0,
        avoidance: 0
    };
    const maxTotals = {
        pressure: 0,
        backlog: 0,
        avoidance: 0
    };

    problemQuizAnswers.forEach(function (_answerIndex, questionIndex) {
        const answer = getProblemQuizAnswer(questionIndex);

        if (!answer?.metrics) {
            return;
        }

        Object.entries(answer.metrics).forEach(function ([metricKey, value]) {
            if (!Object.prototype.hasOwnProperty.call(totals, metricKey)) {
                return;
            }

            totals[metricKey] += Number(value) || 0;
            maxTotals[metricKey] += 3;
        });
    });

    return PROBLEM_QUIZ_METRICS.map(function (metric) {
        const value = maxTotals[metric.key] > 0
            ? Math.round((totals[metric.key] / maxTotals[metric.key]) * 100)
            : 0;

        return {
            ...metric,
            value,
            tone: getProblemQuizMetricTone(value)
        };
    });
}

function getProblemQuizResult() {
    const score = problemQuizAnswers.reduce(function (total, answerIndex, questionIndex) {
        const answer = Number.isInteger(answerIndex)
            ? PROBLEM_QUIZ_QUESTIONS[questionIndex]?.answers?.[answerIndex]
            : null;

        return total + (answer?.score || 0);
    }, 0);
    const maxScore = PROBLEM_QUIZ_QUESTIONS.reduce(function (total, question) {
        return total + Math.max(...question.answers.map(function (answer) {
            return answer.score;
        }));
    }, 0);
    const scorePercent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    const level = PROBLEM_QUIZ_LEVELS.find(function (entry) {
        return scorePercent <= entry.max;
    }) || PROBLEM_QUIZ_LEVELS[PROBLEM_QUIZ_LEVELS.length - 1];
    const focusArea = getProblemQuizFocusArea() || { key: "self", ...PROBLEM_QUIZ_AREAS.self };

    return {
        scorePercent,
        level,
        focusArea,
        snapshot: getProblemQuizSnapshotState(),
        summary: level.description + " Kõige rohkem kisub praegu " + focusArea.label.toLocaleLowerCase("et-EE") + ".",
        estimateMeta: "Testi järgi tundub, et praegu küsib päriselt tähelepanu umbes " + level.estimate + ".",
        prefill: focusArea.prompt,
        generatedProblemText: buildProblemQuizGeneratedProblem({ scorePercent, level, focusArea })
    };
}

function buildProblemQuizGeneratedProblem(result) {
    const seed = getProblemQuizSeed();
    const scorePercent = Number.isFinite(result?.scorePercent) ? result.scorePercent : 0;
    const focusIntro = pickProblemQuizVariant(
        PROBLEM_QUIZ_INPUT_INTROS[result?.focusArea?.key] || ["Praegu on mul üks probleem, mis vajab lahendamist."],
        seed
    );
    const pressureSignalId = getStrongestProblemQuizSignal(["open_tabs", "thought_return", "reaction_pattern"]);
    const impactSignalId = getStrongestProblemQuizSignal(["energy_drain", "finish_today", "truth_line"]);
    const pressureSentence = PROBLEM_QUIZ_INPUT_FRAGMENTS[pressureSignalId]?.[getProblemQuizAnswerIndexById(pressureSignalId)] || "";
    const impactSentence = PROBLEM_QUIZ_INPUT_FRAGMENTS[impactSignalId]?.[getProblemQuizAnswerIndexById(impactSignalId)] || "";
    const closingSentence = pickProblemQuizVariant(
        scorePercent >= 60
            ? [
                "Palun võta see kõige pakilisem teema kiiresti lahti ja aita see ära lahendada.",
                "Aita mul see põhiprobleem kiiresti konkreetseks teha ja ära lahendada.",
                "Palun tee see teema mulle selgeks ja lahendatavaks."
            ]
            : [
                "Aita mul see teema selgelt sõnastada ja ära lahendada.",
                "Palun võta see teema konkreetselt lahti ja aita see ära lahendada.",
                "Aita mul sellest teha üks selge probleem, mille saab ära lahendada."
            ],
        seed + scorePercent + 5
    );

    return sanitizeProblemText([
        focusIntro,
        pressureSentence,
        impactSentence,
        closingSentence
    ].join(" "));
}

function renderProblemQuizSnapshot() {
    if (!problemQuizSnapshot) {
        return;
    }

    const fragment = document.createDocumentFragment();
    const metrics = getProblemQuizSnapshotState();
    const focusArea = getProblemQuizFocusArea();

    metrics.forEach(function (metric) {
        const item = document.createElement("div");
        const top = document.createElement("div");
        const label = document.createElement("strong");
        const value = document.createElement("span");
        const tone = document.createElement("p");
        const meter = document.createElement("div");
        const fill = document.createElement("span");

        item.className = "problem-quiz__snapshot-item";
        item.dataset.metric = metric.key;
        top.className = "problem-quiz__snapshot-top";
        label.className = "problem-quiz__snapshot-label";
        value.className = "problem-quiz__snapshot-value";
        tone.className = "problem-quiz__snapshot-tone";
        meter.className = "problem-quiz__snapshot-meter";
        fill.className = "problem-quiz__snapshot-fill";

        label.textContent = metric.label;
        value.textContent = metric.value + "%";
        tone.textContent = metric.tone;
        fill.style.width = metric.value + "%";

        top.append(label, value);
        meter.append(fill);
        item.append(top, meter, tone);
        fragment.append(item);
    });

    const focus = document.createElement("div");
    const focusLabel = document.createElement("span");
    const focusValue = document.createElement("strong");

    focus.className = "problem-quiz__snapshot-focus";
    focusLabel.textContent = focusArea ? "Praegu kisub enim" : "Fookus selgub varsti";
    focusValue.textContent = focusArea ? focusArea.label : "Vasta paarile küsimusele";
    focus.append(focusLabel, focusValue);
    fragment.append(focus);

    problemQuizSnapshot.replaceChildren(fragment);
}

function renderProblemQuizProgress() {
    if (!problemQuizStepLabel || !problemQuizProgressBar || !problemQuizStepDots || !problemQuizRestartButton) {
        return;
    }

    const isComplete = currentProblemQuizStep >= PROBLEM_QUIZ_QUESTIONS.length;
    const answeredCount = getProblemQuizAnsweredCount();
    const progressValue = isComplete
        ? 100
        : Math.round((answeredCount / PROBLEM_QUIZ_QUESTIONS.length) * 100);
    const fragment = document.createDocumentFragment();

    problemQuizStepLabel.textContent = isComplete
        ? "Tulemus valmis"
        : "Küsimus " + (currentProblemQuizStep + 1) + " / " + PROBLEM_QUIZ_QUESTIONS.length;
    problemQuizProgressBar.style.width = progressValue + "%";
    problemQuizRestartButton.hidden = answeredCount === 0;

    PROBLEM_QUIZ_QUESTIONS.forEach(function (_question, index) {
        const dot = document.createElement("span");
        const isAnswered = Number.isInteger(problemQuizAnswers[index]);

        dot.className = "problem-quiz__step";
        dot.classList.toggle("is-complete", isAnswered);
        dot.classList.toggle("is-current", !isComplete && index === currentProblemQuizStep);
        fragment.append(dot);
    });

    problemQuizStepDots.replaceChildren(fragment);
}

function moveProblemQuizBack() {
    clearProblemQuizAdvanceTimer();
    currentProblemQuizStep = Math.max(0, currentProblemQuizStep - 1);
    renderProblemQuiz();
}

function focusProblemInputFromQuiz(prefill) {
    showPanel(container, "idle");

    problemInput.value = sanitizeProblemText(prefill);
    problemInput.dispatchEvent(new Event("input"));
    setProblemFeedback("Sõnastasin testi põhjal su probleemi valmis. Kui sobib, vajuta Lahenda probleem!", "success");
    container.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    window.setTimeout(function () {
        solveButton.focus();
    }, 320);
}

function selectProblemQuizAnswer(questionIndex, answerIndex, button) {
    clearProblemQuizAdvanceTimer();
    problemQuizAnswers[questionIndex] = answerIndex;

    Array.from(problemQuizCard?.querySelectorAll(".problem-quiz__answer") || []).forEach(function (element) {
        element.disabled = true;
        element.classList.toggle("is-selected", element === button);
    });

    button.classList.add("is-picked");

    renderProblemQuizProgress();
    renderProblemQuizSnapshot();

    problemQuizAdvanceTimer = window.setTimeout(function () {
        problemQuizAdvanceTimer = null;
        currentProblemQuizStep = Math.min(questionIndex + 1, PROBLEM_QUIZ_QUESTIONS.length);
        renderProblemQuiz();
    }, 170);
}

function renderProblemQuizQuestion() {
    const question = PROBLEM_QUIZ_QUESTIONS[currentProblemQuizStep];

    if (!problemQuizCard || !question) {
        return;
    }

    const fragment = document.createDocumentFragment();
    const tag = document.createElement("span");
    const title = document.createElement("h3");
    const note = document.createElement("p");
    const answers = document.createElement("div");
    const footer = document.createElement("div");
    const footerNote = document.createElement("span");
    const backButton = document.createElement("button");
    const selectedAnswerIndex = problemQuizAnswers[currentProblemQuizStep];

    problemQuizCard.classList.remove("is-result");
    problemQuizCard.style.removeProperty("--problem-quiz-accent");
    problemQuizCard.style.removeProperty("--problem-quiz-glow");
    problemQuizCard.style.removeProperty("--problem-quiz-score-angle");

    tag.className = "problem-quiz__question-tag";
    title.className = "problem-quiz__question";
    note.className = "problem-quiz__question-note";
    answers.className = "problem-quiz__answers";
    answers.dataset.count = String(question.answers.length);
    footer.className = "problem-quiz__footer";
    footerNote.className = "problem-quiz__footer-note";
    backButton.className = "problem-quiz__back-button";
    backButton.type = "button";
    backButton.textContent = "Tagasi";
    backButton.hidden = currentProblemQuizStep === 0;

    tag.textContent = "Kiire küsimus";
    title.textContent = question.prompt;
    note.textContent = question.note;
    footerNote.textContent = "Vali üks. Esimene impulss on tavaliselt kõige täpsem.";

    backButton.addEventListener("click", moveProblemQuizBack);

    question.answers.forEach(function (answer, answerIndex) {
        const button = document.createElement("button");
        const index = document.createElement("span");
        const body = document.createElement("span");
        const label = document.createElement("strong");
        const meta = document.createElement("span");
        const isSelected = selectedAnswerIndex === answerIndex;

        button.type = "button";
        button.className = "problem-quiz__answer";
        button.classList.toggle("is-selected", isSelected);

        index.className = "problem-quiz__answer-index";
        body.className = "problem-quiz__answer-body";
        label.className = "problem-quiz__answer-label";
        meta.className = "problem-quiz__answer-meta";

        index.textContent = String(answerIndex + 1).padStart(2, "0");
        label.textContent = answer.label;
        meta.textContent = answer.meta;

        body.append(label, meta);
        button.append(index, body);
        button.addEventListener("click", function () {
            selectProblemQuizAnswer(currentProblemQuizStep, answerIndex, button);
        });

        answers.append(button);
    });

    footer.append(backButton, footerNote);
    fragment.append(tag, title, note, answers, footer);
    problemQuizCard.replaceChildren(fragment);
}

function renderProblemQuizResult() {
    if (!problemQuizCard) {
        return;
    }

    const result = getProblemQuizResult();
    const fragment = document.createDocumentFragment();
    const top = document.createElement("div");
    const score = document.createElement("div");
    const scoreLabel = document.createElement("span");
    const scoreValue = document.createElement("strong");
    const scoreUnit = document.createElement("span");
    const main = document.createElement("div");
    const tag = document.createElement("span");
    const title = document.createElement("h3");
    const summary = document.createElement("p");
    const stats = document.createElement("div");
    const estimate = document.createElement("div");
    const focus = document.createElement("div");
    const estimateLabel = document.createElement("span");
    const estimateValue = document.createElement("strong");
    const estimateMeta = document.createElement("p");
    const focusLabel = document.createElement("span");
    const focusValue = document.createElement("strong");
    const focusMeta = document.createElement("p");
    const nudge = document.createElement("p");
    const actions = document.createElement("div");
    const primary = document.createElement("button");
    const secondary = document.createElement("button");

    problemQuizCard.classList.add("is-result");
    problemQuizCard.style.setProperty("--problem-quiz-accent", result.level.accent);
    problemQuizCard.style.setProperty("--problem-quiz-glow", result.level.glow);
    problemQuizCard.style.setProperty("--problem-quiz-score-angle", (result.scorePercent * 3.6) + "deg");

    top.className = "problem-quiz__result-top";
    score.className = "problem-quiz__result-score";
    scoreLabel.className = "problem-quiz__result-score-label";
    scoreValue.className = "problem-quiz__result-score-value";
    scoreUnit.className = "problem-quiz__result-score-unit";
    main.className = "problem-quiz__result-main";
    tag.className = "problem-quiz__question-tag";
    title.className = "problem-quiz__result-title";
    summary.className = "problem-quiz__result-summary";
    stats.className = "problem-quiz__result-stats";
    estimate.className = "problem-quiz__result-stat";
    focus.className = "problem-quiz__result-stat";
    estimateLabel.className = "problem-quiz__result-stat-label";
    focusLabel.className = "problem-quiz__result-stat-label";
    nudge.className = "problem-quiz__result-nudge";
    actions.className = "problem-quiz__actions";
    primary.className = "problem-quiz__action problem-quiz__action--primary";
    secondary.className = "problem-quiz__action problem-quiz__action--secondary";

    scoreLabel.textContent = "Probleemirõhk";
    scoreValue.textContent = String(result.scorePercent);
    scoreUnit.textContent = "/100";
    tag.textContent = "Tulemus";
    title.textContent = result.level.label;
    summary.textContent = result.summary;
    estimateLabel.textContent = "Hinnanguliselt lahendamist ootab";
    estimateValue.textContent = result.level.estimate;
    estimateMeta.textContent = result.estimateMeta;
    focusLabel.textContent = "Alusta siit";
    focusValue.textContent = result.focusArea.label;
    focusMeta.textContent = result.focusArea.recommendation;
    nudge.textContent = result.level.nudge;
    primary.type = "button";
    primary.textContent = "Lahenda probleemilahendajaga";
    secondary.type = "button";
    secondary.textContent = "Tee test uuesti";

    primary.addEventListener("click", function () {
        focusProblemInputFromQuiz(result.generatedProblemText);
    });

    secondary.addEventListener("click", function () {
        resetProblemQuiz({ keepStarted: true });
        focusProblemQuizPrimaryAction();
    });

    score.append(scoreLabel, scoreValue, scoreUnit);
    main.append(tag, title, summary);
    top.append(score, main);
    estimate.append(estimateLabel, estimateValue, estimateMeta);
    focus.append(focusLabel, focusValue, focusMeta);
    stats.append(estimate, focus);
    actions.append(primary, secondary);
    fragment.append(top, stats, nudge, actions);

    problemQuizCard.replaceChildren(fragment);
}

function renderProblemQuiz() {
    if (!problemQuizCard) {
        return;
    }

    if (!isProblemQuizStarted) {
        setProblemQuizState("intro");
        return;
    }

    renderProblemQuizProgress();
    renderProblemQuizSnapshot();

    if (currentProblemQuizStep >= PROBLEM_QUIZ_QUESTIONS.length) {
        setProblemQuizState("result");
        renderProblemQuizResult();
        return;
    }

    setProblemQuizState("active");
    renderProblemQuizQuestion();
}

function resetProblemQuiz(options = {}) {
    const keepStarted = options.keepStarted === true;

    clearProblemQuizAdvanceTimer();
    problemQuizAnswers = PROBLEM_QUIZ_QUESTIONS.map(function () {
        return null;
    });
    currentProblemQuizStep = 0;
    isProblemQuizStarted = keepStarted;
    renderProblemQuiz();
}

function startProblemQuiz() {
    isProblemQuizStarted = true;

    if (currentProblemQuizStep >= PROBLEM_QUIZ_QUESTIONS.length) {
        currentProblemQuizStep = 0;
    }

    renderProblemQuiz();
    problemQuizSection?.scrollIntoView({
        behavior: prefersReducedMotionQuery.matches ? "auto" : "smooth",
        block: "start"
    });
    focusProblemQuizPrimaryAction();
}

function initializeProblemQuiz() {
    if (!problemQuizSection || !problemQuizCard) {
        return;
    }

    problemQuizStartButton?.addEventListener("click", startProblemQuiz);
    problemQuizRestartButton?.addEventListener("click", function () {
        resetProblemQuiz({ keepStarted: true });
    });
    resetProblemQuiz();
}

function normalizeRecentProblem(record) {
    if (!record || typeof record !== "object") {
        return null;
    }

    const problemText = sanitizeProblemText(record.problemText || record.problem_text || "");

    if (!problemText) {
        return null;
    }

    const problemType = sanitizeProblemText(record.problemType || record.problem_type || GENERAL_PROBLEM_CATEGORY.label)
        || GENERAL_PROBLEM_CATEGORY.label;
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

function normalizeRecentProblemDetail(record) {
    if (!record || typeof record !== "object") {
        return null;
    }

    const reportId = sanitizeProblemText(record.reportId || record.report_id || "");
    const detailText = normalizeProblemDetailText(record.detailText || record.detail_text || record.problemText || "");
    const resolutionText = normalizeProblemDetailText(
        record.resolutionText
        || record.resolution_text
        || record.summary
        || ""
    );

    if (!reportId || !detailText) {
        return null;
    }

    return {
        reportId,
        publicProblemText: sanitizeProblemText(
            record.publicProblemText || record.public_problem_text || record.problemType || "Probleemi kirjeldus"
        ) || "Probleemi kirjeldus",
        detailText,
        resolutionText,
        problemType: sanitizeProblemText(record.problemType || record.problem_type || GENERAL_PROBLEM_CATEGORY.label)
            || GENERAL_PROBLEM_CATEGORY.label,
        status: sanitizeProblemText(record.status || "Lahendatud") || "Lahendatud",
        createdAt: new Date(parseDateToTimestamp(record.createdAt || record.created_at)).toISOString(),
        visibility: sanitizeProblemText(record.visibility || "original") || "original"
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

function areRecentProblemListsEqual(firstCollection, secondCollection) {
    if (firstCollection === secondCollection) {
        return true;
    }

    if (!Array.isArray(firstCollection) || !Array.isArray(secondCollection)) {
        return false;
    }

    if (firstCollection.length !== secondCollection.length) {
        return false;
    }

    return firstCollection.every(function (firstProblem, index) {
        const secondProblem = secondCollection[index];

        return Boolean(secondProblem)
            && firstProblem.reportId === secondProblem.reportId
            && firstProblem.problemText === secondProblem.problemText
            && firstProblem.problemType === secondProblem.problemType
            && firstProblem.status === secondProblem.status
            && firstProblem.createdAt === secondProblem.createdAt;
    });
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

function loadRecentProblemsUnlocked() {
    try {
        const unlockedValue = window.localStorage.getItem(RECENT_PROBLEMS_UNLOCKED_KEY);

        if (unlockedValue === "true") {
            return true;
        }

        if (unlockedValue === "false") {
            return false;
        }

        return loadRecentProblems().length > 0;
    } catch (_error) {
        return false;
    }
}

function persistRecentProblemsUnlocked(value) {
    try {
        window.localStorage.setItem(RECENT_PROBLEMS_UNLOCKED_KEY, value ? "true" : "false");
    } catch (_error) {
        // Ignore storage failures and keep the in-memory state.
    }
}

function setRecentProblemsUnlocked(value) {
    recentProblemsUnlocked = Boolean(value);

    if (recentProblemsSection) {
        recentProblemsSection.hidden = !recentProblemsUnlocked;
    }

    persistRecentProblemsUnlocked(recentProblemsUnlocked);
}

function loadLikedRecentProblemIds() {
    try {
        const raw = window.localStorage.getItem(RECENT_PROBLEM_LIKES_STORAGE_KEY);

        if (!raw) {
            return new Set();
        }

        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return new Set();
        }

        return new Set(parsed.map(function (value) {
            return sanitizeProblemText(value);
        }).filter(Boolean));
    } catch (_error) {
        return new Set();
    }
}

function persistLikedRecentProblemIds() {
    try {
        window.localStorage.setItem(
            RECENT_PROBLEM_LIKES_STORAGE_KEY,
            JSON.stringify(Array.from(likedRecentProblemIds))
        );
    } catch (_error) {
        // Ignore storage failures and keep the in-memory state.
    }
}

function isRecentProblemLiked(reportId) {
    return Boolean(reportId) && likedRecentProblemIds.has(reportId);
}

function toggleRecentProblemLike(reportId) {
    if (!reportId) {
        return;
    }

    if (likedRecentProblemIds.has(reportId)) {
        likedRecentProblemIds.delete(reportId);
    } else {
        likedRecentProblemIds.add(reportId);
    }

    persistLikedRecentProblemIds();
    renderRecentProblems();
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

function formatRecentProblemDetailMeta(problem) {
    if (!problem) {
        return "";
    }

    const pieces = [];

    if (problem.problemType) {
        pieces.push(problem.problemType);
    }

    pieces.push(articleDateFormatter.format(new Date(parseDateToTimestamp(problem.createdAt))));

    return pieces.join(" · ");
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

function appendRecentProblemDetailParagraphs(container, text) {
    const paragraphs = normalizeProblemDetailText(text)
        .split(/\n{2,}/)
        .map(function (paragraph) {
            return paragraph.trim();
        })
        .filter(Boolean);

    container.replaceChildren();

    if (paragraphs.length === 0) {
        const paragraph = document.createElement("p");
        paragraph.textContent = "Täispikk kirjeldus ei ole hetkel saadaval.";
        container.append(paragraph);
        return;
    }

    paragraphs.forEach(function (paragraphText) {
        const paragraph = document.createElement("p");
        paragraph.textContent = paragraphText;
        container.append(paragraph);
    });
}

function getRecentProblemSolutionIconMarkup(iconKey) {
    const iconBodyByKey = {
        spark: `
            <path d="M12 2.8L13.9 8.1L19.2 10L13.9 11.9L12 17.2L10.1 11.9L4.8 10L10.1 8.1L12 2.8Z"></path>
            <path d="M18.6 3.8L19.2 5.5L20.9 6.1L19.2 6.7L18.6 8.4L18 6.7L16.3 6.1L18 5.5L18.6 3.8Z"></path>
        `,
        check: `
            <circle cx="12" cy="12" r="8.2"></circle>
            <path d="M8.7 12.1L11 14.4L15.5 9.9"></path>
        `,
        bloom: `
            <path d="M12 4.1C13.4 6.1 13.6 8.4 12 10C10.4 8.4 10.6 6.1 12 4.1Z"></path>
            <path d="M17.9 9C16 10.4 13.7 10.6 12 9C13.7 7.4 16 7.6 17.9 9Z"></path>
            <path d="M12 13.9C13.6 15.5 13.4 17.8 12 19.9C10.6 17.8 10.4 15.5 12 13.9Z"></path>
            <path d="M6.1 9C8 7.6 10.3 7.4 12 9C10.3 10.6 8 10.4 6.1 9Z"></path>
            <circle cx="12" cy="9.1" r="1.2"></circle>
        `
    };

    return `
        <svg class="recent-problem__solution-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            ${iconBodyByKey[iconKey] || iconBodyByKey.check}
        </svg>
    `;
}

function buildRecentProblemSolutionModel(text) {
    const paragraphs = normalizeProblemDetailText(text)
        .split(/\n{2,}/)
        .map(function (paragraph) {
            return paragraph.trim();
        })
        .filter(Boolean);

    const sentencePattern = /(?<=[.!?])\s+/;
    const sentences = paragraphs.flatMap(function (paragraph) {
        return paragraph
            .split(sentencePattern)
            .map(function (sentence) {
                return sentence.trim();
            })
            .filter(Boolean);
    });

    if (sentences.length === 0) {
        return {
            lead: "Selle teema ümber on nüüd palju rohkem selgust ja kergust.",
            points: []
        };
    }

    return {
        lead: sentences[0],
        points: sentences.slice(1, 4)
    };
}

function appendRecentProblemSolutionParagraphs(container, text) {
    const model = buildRecentProblemSolutionModel(text);
    const shell = document.createElement("div");
    const hero = document.createElement("div");
    const mark = document.createElement("span");
    const lead = document.createElement("p");
    const points = document.createElement("div");
    const iconKeys = ["spark", "check", "bloom"];

    container.replaceChildren();

    shell.className = "recent-problem__solution-shell";
    hero.className = "recent-problem__solution-hero";
    mark.className = "recent-problem__solution-mark";
    lead.className = "recent-problem__solution-lead";
    points.className = "recent-problem__solution-points";

    mark.innerHTML = getRecentProblemSolutionIconMarkup("spark");
    lead.textContent = model.lead;
    hero.append(mark, lead);
    shell.append(hero);

    model.points.forEach(function (pointText, index) {
        const item = document.createElement("div");
        const icon = document.createElement("span");
        const paragraph = document.createElement("p");
        item.className = "recent-problem__solution-point";
        icon.className = "recent-problem__solution-point-icon";
        paragraph.className = "recent-problem__solution-point-text";
        icon.innerHTML = getRecentProblemSolutionIconMarkup(iconKeys[index % iconKeys.length]);
        paragraph.textContent = pointText;
        item.append(icon, paragraph);
        points.append(item);
    });

    if (points.childElementCount > 0) {
        shell.append(points);
    }

    container.append(shell);
}

function createRecentProblemDetailContent(problem) {
    const detail = document.createElement("div");
    const problemSection = document.createElement("section");
    const problemLabel = document.createElement("span");
    const problemBody = document.createElement("div");
    const solutionSection = document.createElement("section");
    const solutionLabel = document.createElement("span");
    const solutionBody = document.createElement("div");
    const revealWrap = document.createElement("div");
    const revealButton = document.createElement("button");
    const footer = document.createElement("div");
    const likeButton = document.createElement("button");
    const note = document.createElement("p");

    detail.className = "recent-problem__detail";
    problemSection.className = "recent-problem__detail-section recent-problem__detail-section--problem";
    problemLabel.className = "recent-problem__detail-label";
    problemBody.className = "recent-problem__detail-body";
    solutionSection.className = "recent-problem__detail-section recent-problem__detail-section--solution";
    solutionLabel.className = "recent-problem__detail-label recent-problem__detail-label--solution";
    solutionBody.className = "recent-problem__solution";
    revealWrap.className = "recent-problem__reveal-wrap";
    revealButton.className = "recent-problem__reveal";
    footer.className = "recent-problem__detail-footer";
    likeButton.className = "recent-problem__like";
    note.className = "recent-problem__detail-note";

    problemLabel.textContent = "Probleem";
    solutionLabel.textContent = "Lahendus";

    detail.addEventListener("click", function (event) {
        event.stopPropagation();
    });

    if (isRecentProblemDetailLoading) {
        detail.dataset.state = "loading";
        appendRecentProblemSolutionParagraphs(solutionBody, "Koostan veel korraks selle pikema kinnituse, et see teema on nüüd päriselt maas.");
        solutionSection.append(solutionLabel, solutionBody);
        detail.append(solutionSection);
        return detail;
    }

    if (recentProblemDetailError) {
        detail.dataset.state = "error";
        appendRecentProblemSolutionParagraphs(solutionBody, "Selle lahenduse helgem lõppseis ei jõudnud praegu kohale.");
        solutionSection.append(solutionLabel, solutionBody);
        detail.append(solutionSection);
        return detail;
    }

    detail.dataset.state = "ready";
    appendRecentProblemSolutionParagraphs(
        solutionBody,
        problem?.resolutionText || "See teema ei suru enam peale ja asemele on tulnud palju kergem tunne."
    );
    solutionSection.append(solutionLabel, solutionBody);
    detail.append(solutionSection);

    if (problem?.detailText) {
        const problemSectionId = `recent-problem-original-${String(problem.reportId || "preview").replace(/[^a-z0-9_-]+/gi, "-")}`;

        revealButton.type = "button";
        revealButton.textContent = isRecentProblemOriginalVisible ? "Peida probleem" : "Vaata milles oli probleem";
        revealButton.setAttribute("aria-expanded", String(isRecentProblemOriginalVisible));
        revealButton.setAttribute("aria-controls", problemSectionId);
        revealButton.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            isRecentProblemOriginalVisible = !isRecentProblemOriginalVisible;
            renderRecentProblems();
        });
        revealButton.addEventListener("keydown", function (event) {
            event.stopPropagation();
        });
        revealWrap.append(revealButton);
        detail.append(revealWrap);

        if (isRecentProblemOriginalVisible) {
            problemSection.id = problemSectionId;
            appendRecentProblemDetailParagraphs(problemBody, problem.detailText);
            problemSection.append(problemLabel, problemBody);
            detail.append(problemSection);
        }
    }

    if (problem?.reportId) {
        const liked = isRecentProblemLiked(problem.reportId);

        likeButton.type = "button";
        likeButton.classList.toggle("is-liked", liked);
        likeButton.setAttribute("aria-pressed", String(liked));
        likeButton.setAttribute("aria-label", liked ? "Eemalda meeldimine" : "Märgi see lahendus meeldivaks");
        likeButton.textContent = liked ? "Meeldib" : "Märgi meeldivaks";
        likeButton.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            toggleRecentProblemLike(problem.reportId);
        });
        likeButton.addEventListener("keydown", function (event) {
            event.stopPropagation();
        });
        footer.append(likeButton);
    }

    if (problem?.visibility === "sanitized") {
        note.textContent = "Avaliku vaate jaoks on roppused või solvangud pehmemaks toimetatud.";
    } else if (problem?.visibility === "hidden") {
        note.textContent = "Avaliku vaate jaoks tuli kirjeldust tugevamalt toimetada.";
    }

    if (note.textContent) {
        footer.append(note);
    }

    if (footer.childElementCount > 0) {
        detail.append(footer);
    }

    return detail;
}

function closeRecentProblemDetail() {
    selectedRecentProblemReportId = "";
    selectedRecentProblemPreview = null;
    selectedRecentProblemDetail = null;
    isRecentProblemOriginalVisible = false;
    recentProblemDetailError = "";
    isRecentProblemDetailLoading = false;
    renderRecentProblems();
}

async function fetchRecentProblemDetail(reportId) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(function () {
        controller.abort();
    }, RECENT_PROBLEM_DETAIL_REQUEST_TIMEOUT);

    try {
        const response = await fetch(`/api/recent-problems/${encodeURIComponent(reportId)}`, {
            headers: {
                Accept: "application/json"
            },
            signal: controller.signal
        });

        let payload = null;

        try {
            payload = await response.json();
        } catch (_error) {
            payload = null;
        }

        if (!response.ok) {
            throw new Error(payload?.error || "Täispika kirjelduse laadimine ebaõnnestus.");
        }

        const detail = normalizeRecentProblemDetail(payload?.problem);

        if (!detail) {
            throw new Error("Täispika kirjelduse laadimine ebaõnnestus.");
        }

        recentProblemDetailCache.set(reportId, detail);
        return detail;
    } finally {
        window.clearTimeout(timeoutId);
    }
}

async function toggleRecentProblemDetail(problem) {
    if (!problem?.reportId) {
        return;
    }

    if (selectedRecentProblemReportId === problem.reportId) {
        closeRecentProblemDetail();
        return;
    }

    selectedRecentProblemReportId = problem.reportId;
    selectedRecentProblemPreview = problem;
    selectedRecentProblemDetail = recentProblemDetailCache.get(problem.reportId) || null;
    isRecentProblemOriginalVisible = false;
    recentProblemDetailError = "";
    isRecentProblemDetailLoading = !selectedRecentProblemDetail;

    renderRecentProblems();

    if (selectedRecentProblemDetail) {
        document.querySelector(".recent-problem.is-active")?.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
        return;
    }

    try {
        const detail = await fetchRecentProblemDetail(problem.reportId);

        if (selectedRecentProblemReportId !== problem.reportId) {
            return;
        }

        selectedRecentProblemDetail = detail;
        isRecentProblemDetailLoading = false;
        renderRecentProblems();
        document.querySelector(".recent-problem.is-active")?.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    } catch (error) {
        if (selectedRecentProblemReportId !== problem.reportId) {
            return;
        }

        selectedRecentProblemDetail = null;
        recentProblemDetailError = error.message || "Täispika kirjelduse laadimine ebaõnnestus.";
        isRecentProblemDetailLoading = false;
        renderRecentProblems();
    }
}

function createRecentProblemCard(problem, index) {
    const article = document.createElement("article");
    const meta = document.createElement("div");
    const category = document.createElement("span");
    const time = document.createElement("span");
    article.className = "recent-problem";

    const issueNumber = document.createElement("span");
    issueNumber.className = "recent-problem__index";
    issueNumber.textContent = String(index + 1).padStart(2, "0");

    meta.className = "recent-problem__meta";
    category.className = "recent-problem__category";
    time.className = "recent-problem__time";
    category.textContent = problem.problemType || GENERAL_PROBLEM_CATEGORY.label;
    time.textContent = formatRecentProblemTime(problem.createdAt);
    meta.append(category, time);

    const text = document.createElement("p");
    text.className = "recent-problem__text";
    appendPublicProblemText(text, problem.problemText);

    const verdict = document.createElement("div");
    verdict.className = "recent-problem__verdict";
    verdict.dataset.stamp = "LAHENDATUD";

    const verdictWord = document.createElement("span");
    verdictWord.className = "recent-problem__verdict-word";
    verdictWord.textContent = problem.status || "Lahendatud";

    verdict.append(verdictWord);
    article.append(issueNumber, meta, text, verdict);

    return article;
}

function getInitialRecentProblemsCount() {
    return recentProblemsViewportQuery.matches
        ? RECENT_PROBLEMS_MOBILE_INITIAL_COUNT
        : RECENT_PROBLEMS_DESKTOP_INITIAL_COUNT;
}

function syncRecentProblemsVisibleCount() {
    const initialCount = getInitialRecentProblemsCount();

    if (visibleRecentProblemsCount === 0 || visibleRecentProblemsCount <= lastRecentProblemsInitialCount) {
        visibleRecentProblemsCount = initialCount;
    }

    lastRecentProblemsInitialCount = initialCount;

    if (recentProblems.length > 0) {
        visibleRecentProblemsCount = Math.min(
            Math.max(initialCount, visibleRecentProblemsCount),
            recentProblems.length
        );
    }
}

function updateRecentProblemsMoreButton() {
    if (!recentProblemsMoreButton) {
        return;
    }

    const initialCount = getInitialRecentProblemsCount();
    const hasProblems = recentProblems.length > 0;
    const canExpand = hasProblems && visibleRecentProblemsCount < recentProblems.length;
    const canCollapse = recentProblems.length > initialCount && visibleRecentProblemsCount > initialCount;

    recentProblemsMoreButton.hidden = !canExpand && !canCollapse;
    recentProblemsMoreButton.textContent = canExpand ? "Vaata veel" : "Näita vähem";
}

function renderRecentProblems() {
    if (!recentProblemsList) {
        return;
    }

    if (recentProblemsSection) {
        recentProblemsSection.hidden = !recentProblemsUnlocked;
    }

    if (!recentProblemsUnlocked) {
        recentProblemsMoreButton.hidden = true;
        return;
    }

    syncRecentProblemsVisibleCount();

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
        const visibleProblems = recentProblems.slice(0, visibleRecentProblemsCount);
        const grid = document.createElement("div");

        grid.className = "recent-feed__folio-grid";

        visibleProblems.forEach(function (problem, index) {
            grid.append(createRecentProblemCard(problem, index));
        });

        fragment.append(grid);
    }

    recentProblemsList.replaceChildren(fragment);
    updateRecentProblemsMoreButton();
}

function normalizeProblemCategoryStatsRows(rows) {
    const rawRows = Array.isArray(rows) ? rows : [];
    const totalReportsFromRows = rawRows.reduce(function (largestTotal, row) {
        return Math.max(largestTotal, Number(row?.totalReports || 0));
    }, 0);
    const totalReports = totalReportsFromRows || rawRows.reduce(function (sum, row) {
        return sum + Number(row?.problemCount || 0);
    }, 0);
    const rowByLabel = new Map();

    rawRows.forEach(function (row) {
        const category = getProblemCategoryDefinition(row?.problemType || row?.problem_type || "");
        const problemCount = Number(row?.problemCount || row?.problem_count || 0);
        const sharePercent = Number(row?.sharePercent || row?.share_percent || 0);

        rowByLabel.set(category.label, {
            category,
            problemType: category.label,
            problemCount: Number.isFinite(problemCount) ? problemCount : 0,
            sharePercent: Number.isFinite(sharePercent) ? sharePercent : 0,
            totalReports
        });
    });

    return PROBLEM_CATEGORY_DEFINITIONS
        .concat(GENERAL_PROBLEM_CATEGORY)
        .map(function (category) {
            return rowByLabel.get(category.label) || {
                category,
                problemType: category.label,
                problemCount: 0,
                sharePercent: 0,
                totalReports
            };
        })
        .filter(function (entry) {
            return entry.problemCount > 0;
        })
        .sort(function (firstEntry, secondEntry) {
            if (secondEntry.problemCount !== firstEntry.problemCount) {
                return secondEntry.problemCount - firstEntry.problemCount;
            }

            return firstEntry.problemType.localeCompare(secondEntry.problemType, "et");
        });
}

function normalizeProblemCategoryTrendRows(rows) {
    const rawRows = Array.isArray(rows) ? rows : [];
    const rowByLabel = new Map();

    rawRows.forEach(function (row) {
        const category = getProblemCategoryDefinition(row?.problemType || row?.problem_type || "");
        const currentCount = Number(row?.currentCount || row?.current_count || 0);
        const previousCount = Number(row?.previousCount || row?.previous_count || 0);
        const currentSharePercent = Number(row?.currentSharePercent || row?.current_share_percent || 0);
        const previousSharePercent = Number(row?.previousSharePercent || row?.previous_share_percent || 0);
        const deltaSharePoints = Number(row?.deltaSharePoints || row?.delta_share_points || 0);
        const deltaCount = Number(row?.deltaCount || row?.delta_count || 0);

        rowByLabel.set(category.label, {
            category,
            problemType: category.label,
            currentCount: Number.isFinite(currentCount) ? currentCount : 0,
            previousCount: Number.isFinite(previousCount) ? previousCount : 0,
            currentSharePercent: Number.isFinite(currentSharePercent) ? currentSharePercent : 0,
            previousSharePercent: Number.isFinite(previousSharePercent) ? previousSharePercent : 0,
            deltaSharePoints: Number.isFinite(deltaSharePoints) ? deltaSharePoints : 0,
            deltaCount: Number.isFinite(deltaCount) ? deltaCount : 0
        });
    });

    return PROBLEM_CATEGORY_DEFINITIONS
        .concat(GENERAL_PROBLEM_CATEGORY)
        .map(function (category) {
            return rowByLabel.get(category.label) || {
                category,
                problemType: category.label,
                currentCount: 0,
                previousCount: 0,
                currentSharePercent: 0,
                previousSharePercent: 0,
                deltaSharePoints: 0,
                deltaCount: 0
            };
        })
        .filter(function (entry) {
            return entry.currentCount > 0 || entry.previousCount > 0;
        })
        .sort(function (firstEntry, secondEntry) {
            if (secondEntry.deltaSharePoints !== firstEntry.deltaSharePoints) {
                return secondEntry.deltaSharePoints - firstEntry.deltaSharePoints;
            }

            if (secondEntry.currentCount !== firstEntry.currentCount) {
                return secondEntry.currentCount - firstEntry.currentCount;
            }

            return firstEntry.problemType.localeCompare(secondEntry.problemType, "et");
        });
}

function normalizeProblemTimeSegmentRows(rows) {
    const rawRows = Array.isArray(rows) ? rows : [];
    const rowByIndex = new Map();

    rawRows.forEach(function (row) {
        const segmentIndex = Number(row?.segmentIndex ?? row?.segment_index ?? -1);
        const problemCount = Number(row?.problemCount ?? row?.problem_count ?? 0);
        const sharePercent = Number(row?.sharePercent ?? row?.share_percent ?? 0);
        const startHour = Number(row?.startHour ?? row?.start_hour ?? segmentIndex * 2);
        const endHour = Number(row?.endHour ?? row?.end_hour ?? ((segmentIndex * 2) + 2) % 24);

        if (!Number.isFinite(segmentIndex) || segmentIndex < 0 || segmentIndex > 11) {
            return;
        }

        rowByIndex.set(segmentIndex, {
            segmentIndex,
            segmentLabel: row?.segmentLabel || row?.segment_label || `${String(startHour).padStart(2, "0")}–${String(endHour).padStart(2, "0")}`,
            startHour: Number.isFinite(startHour) ? startHour : segmentIndex * 2,
            endHour: Number.isFinite(endHour) ? endHour : ((segmentIndex * 2) + 2) % 24,
            problemCount: Number.isFinite(problemCount) ? problemCount : 0,
            sharePercent: Number.isFinite(sharePercent) ? sharePercent : 0
        });
    });

    return Array.from({ length: 12 }, function (_item, segmentIndex) {
        const startHour = segmentIndex * 2;
        const endHour = (startHour + 2) % 24;

        return rowByIndex.get(segmentIndex) || {
            segmentIndex,
            segmentLabel: `${String(startHour).padStart(2, "0")}–${String(endHour).padStart(2, "0")}`,
            startHour,
            endHour,
            problemCount: 0,
            sharePercent: 0
        };
    });
}

function setProblemStatsStoryData(nextData) {
    problemCategoryStats = normalizeProblemCategoryStatsRows(nextData?.stats);
    problemCategoryTrends = normalizeProblemCategoryTrendRows(nextData?.trends);
    problemTimeSegments = normalizeProblemTimeSegmentRows(nextData?.timeSegments);
    renderProblemCategoryStats();
}

function getProblemCategoryIconMarkup(categoryKey) {
    const iconBodyByKey = {
        work: `
            <path d="M8 7.5V6.8C8 5.8 8.8 5 9.8 5H14.2C15.2 5 16 5.8 16 6.8V7.5"></path>
            <path d="M5.5 8.5H18.5V17.2C18.5 18.2 17.7 19 16.7 19H7.3C6.3 19 5.5 18.2 5.5 17.2V8.5Z"></path>
            <path d="M10.2 11.5H13.8"></path>
        `,
        money: `
            <circle cx="12" cy="12" r="6.8"></circle>
            <path d="M12 8.3V15.7"></path>
            <path d="M14.4 10.1C14.4 9.2 13.3 8.5 12 8.5C10.7 8.5 9.6 9.1 9.6 10.1C9.6 11.1 10.6 11.5 12 11.8C13.4 12.1 14.4 12.5 14.4 13.5C14.4 14.5 13.3 15.2 12 15.2C10.7 15.2 9.6 14.5 9.6 13.5"></path>
        `,
        relationships: `
            <path d="M12 18.2L6.4 12.8C4.9 11.4 4.9 9.1 6.4 7.7C7.9 6.3 10.2 6.4 11.6 7.9L12 8.3L12.4 7.9C13.8 6.4 16.1 6.3 17.6 7.7C19.1 9.1 19.1 11.4 17.6 12.8L12 18.2Z"></path>
        `,
        home: `
            <path d="M6.2 10.4L12 5.7L17.8 10.4"></path>
            <path d="M7.4 9.8V18.3H16.6V9.8"></path>
            <path d="M10.5 18.3V13.6H13.5V18.3"></path>
        `,
        health: `
            <path d="M5 12H8.1L9.8 8.7L12.3 15.2L14.1 11.5H19"></path>
            <path d="M12 19C8.1 19 5 15.9 5 12C5 8.1 8.1 5 12 5C15.9 5 19 8.1 19 12C19 15.9 15.9 19 12 19Z"></path>
        `,
        decision: `
            <circle cx="12" cy="12" r="7"></circle>
            <path d="M12 12L15.8 8.2"></path>
            <path d="M12 7V9"></path>
            <path d="M17 12H15"></path>
            <path d="M12 17V15"></path>
            <path d="M7 12H9"></path>
        `,
        general: `
            <path d="M12 4.8L13.9 9L18.5 9.5L15 12.6L16 17.2L12 14.9L8 17.2L9 12.6L5.5 9.5L10.1 9L12 4.8Z"></path>
        `
    };

    return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            ${iconBodyByKey[categoryKey] || iconBodyByKey.general}
        </svg>
    `;
}

const PROBLEM_STATS_EDITORIAL_PALETTE = [
    { color: "#de6f56", glow: "rgba(222, 111, 86, 0.24)" },
    { color: "#d9a24a", glow: "rgba(217, 162, 74, 0.24)" },
    { color: "#78afa4", glow: "rgba(120, 175, 164, 0.22)" },
    { color: "#6675d1", glow: "rgba(102, 117, 209, 0.22)" },
    { color: "#b87eb5", glow: "rgba(184, 126, 181, 0.22)" },
    { color: "#8ea3b5", glow: "rgba(142, 163, 181, 0.22)" }
];

const PROBLEM_STATS_OTHER_CATEGORY = {
    key: "other",
    label: "Muud teemad",
    shortLabel: "Muud"
};

function getProblemCategoryDisplayStats(stats) {
    if (!stats.length) {
        return PROBLEM_CATEGORY_DEFINITIONS.slice(0, 5).map(function (category, index) {
            const placeholderShares = [34, 23, 18, 14, 11];
            return {
                category,
                problemType: category.label,
                problemCount: placeholderShares[index],
                sharePercent: placeholderShares[index],
                totalReports: placeholderShares.reduce(function (sum, value) {
                    return sum + value;
                }, 0)
            };
        });
    }

    if (stats.length <= 5) {
        return stats.slice();
    }

    const visibleStats = stats.slice(0, 4);
    const remainingStats = stats.slice(4);
    const totalReports = stats[0]?.totalReports || remainingStats.reduce(function (sum, entry) {
        return sum + entry.problemCount;
    }, 0);
    const remainingCount = remainingStats.reduce(function (sum, entry) {
        return sum + entry.problemCount;
    }, 0);

    visibleStats.push({
        category: PROBLEM_STATS_OTHER_CATEGORY,
        problemType: PROBLEM_STATS_OTHER_CATEGORY.label,
        problemCount: remainingCount,
        sharePercent: totalReports > 0 ? (remainingCount / totalReports) * 100 : 0,
        totalReports
    });

    return visibleStats;
}

function buildProblemCategoryGaugeGradient(stats) {
    const gaugeSweep = 250;
    let currentAngle = 0;
    const segments = stats.map(function (stat, index) {
        const palette = PROBLEM_STATS_EDITORIAL_PALETTE[index % PROBLEM_STATS_EDITORIAL_PALETTE.length];
        const segmentSweep = gaugeSweep * (Math.max(0, stat.sharePercent) / 100);
        const nextAngle = Math.min(gaugeSweep, currentAngle + segmentSweep);
        const segment = `${palette.color} ${currentAngle.toFixed(2)}deg ${nextAngle.toFixed(2)}deg`;
        currentAngle = nextAngle;
        return segment;
    });

    if (currentAngle < gaugeSweep) {
        segments.push(`rgba(20, 32, 48, 0.12) ${currentAngle.toFixed(2)}deg ${gaugeSweep.toFixed(2)}deg`);
    }

    segments.push(`rgba(255, 255, 255, 0) ${gaugeSweep.toFixed(2)}deg 360deg`);

    return `conic-gradient(from 145deg, ${segments.join(", ")})`;
}

function createProblemCategoryScaleMarker(value) {
    const marker = document.createElement("span");
    const angle = 145 + ((250 * value) / 100);

    marker.className = "problem-barometer__scale-mark";
    marker.style.setProperty("--problem-scale-angle", `${angle}deg`);
    marker.textContent = String(value);

    return marker;
}

function createProblemCategoryPressureItem(stat, index, leaderShare) {
    const palette = PROBLEM_STATS_EDITORIAL_PALETTE[index % PROBLEM_STATS_EDITORIAL_PALETTE.length];
    const item = document.createElement("article");
    const top = document.createElement("div");
    const rank = document.createElement("span");
    const name = document.createElement("strong");
    const value = document.createElement("span");
    const track = document.createElement("div");
    const fill = document.createElement("span");
    const meta = document.createElement("span");
    const fillRatio = leaderShare > 0 ? (stat.sharePercent / leaderShare) * 100 : 0;

    item.className = "problem-barometer__item";
    item.style.setProperty("--problem-barometer-item-color", palette.color);
    item.style.setProperty("--problem-barometer-item-glow", palette.glow);
    item.style.setProperty("--problem-barometer-item-index", String(index));
    item.style.setProperty("--problem-barometer-fill", `${Math.max(10, Math.min(100, fillRatio)).toFixed(2)}%`);
    item.setAttribute("role", "listitem");

    top.className = "problem-barometer__item-top";
    rank.className = "problem-barometer__item-rank";
    name.className = "problem-barometer__item-name";
    value.className = "problem-barometer__item-value";
    track.className = "problem-barometer__item-track";
    fill.className = "problem-barometer__item-fill";
    meta.className = "problem-barometer__item-meta";

    rank.textContent = String(index + 1).padStart(2, "0");
    name.textContent = stat.category.label;
    value.textContent = `${Math.max(1, Math.round(stat.sharePercent))}%`;
    meta.textContent = `${numberFormatter.format(stat.problemCount)} lahendust`;

    track.append(fill);
    top.append(rank, name, value);
    item.append(top, track, meta);

    return item;
}

function createProblemCategoryShowcase(stats) {
    const visibleStats = getProblemCategoryDisplayStats(stats);
    const totalReports = visibleStats[0]?.totalReports || 0;
    const leader = visibleStats[0];
    const leaderPalette = PROBLEM_STATS_EDITORIAL_PALETTE[0];
    const barometer = document.createElement("div");
    const board = document.createElement("div");
    const dialCard = document.createElement("article");
    const dialHeader = document.createElement("div");
    const eyebrow = document.createElement("span");
    const headline = document.createElement("strong");
    const context = document.createElement("span");
    const stage = document.createElement("div");
    const glow = document.createElement("div");
    const dial = document.createElement("div");
    const arc = document.createElement("div");
    const ticks = document.createElement("div");
    const scale = document.createElement("div");
    const needle = document.createElement("div");
    const pivot = document.createElement("div");
    const queue = document.createElement("div");
    const queueList = document.createElement("div");
    const footer = document.createElement("p");

    barometer.className = "problem-barometer";
    board.className = "problem-barometer__board";
    dialCard.className = "problem-barometer__dial-card";
    dialHeader.className = "problem-barometer__dial-header";
    eyebrow.className = "problem-barometer__eyebrow";
    headline.className = "problem-barometer__headline";
    context.className = "problem-barometer__context";
    stage.className = "problem-barometer__stage";
    glow.className = "problem-barometer__glow";
    dial.className = "problem-barometer__dial";
    arc.className = "problem-barometer__arc";
    ticks.className = "problem-barometer__ticks";
    scale.className = "problem-barometer__scale";
    needle.className = "problem-barometer__needle";
    pivot.className = "problem-barometer__pivot";
    queue.className = "problem-barometer__queue";
    queueList.className = "problem-barometer__queue-list";
    queueList.setAttribute("role", "list");
    footer.className = "problem-barometer__footer";

    const gaugeAngle = 145 + ((250 * Math.max(0, Math.min(100, leader.sharePercent))) / 100);

    barometer.style.setProperty("--problem-barometer-accent", leaderPalette.color);
    barometer.style.setProperty("--problem-barometer-accent-soft", leaderPalette.glow);
    barometer.style.setProperty("--problem-barometer-gauge", buildProblemCategoryGaugeGradient(visibleStats));
    barometer.style.setProperty("--problem-barometer-angle", `${gaugeAngle - 90}deg`);

    eyebrow.textContent = "Praegu kõige kõrgem surve";
    headline.textContent = leader.category.label;
    context.textContent = `${Math.max(1, Math.round(leader.sharePercent))}% kõigist viimase ${PROBLEM_CATEGORY_STATS_DAYS} päeva lahendustest`;

    [0, 25, 50, 75, 100].forEach(function (value) {
        scale.append(createProblemCategoryScaleMarker(value));
    });

    visibleStats.forEach(function (stat, index) {
        queueList.append(createProblemCategoryPressureItem(stat, index, leader.sharePercent));
    });

    footer.textContent = `${numberFormatter.format(totalReports)} lahendust viimase ${PROBLEM_CATEGORY_STATS_DAYS} päeva jooksul`;

    dial.append(arc, ticks, scale, needle, pivot);
    stage.append(glow, dial);
    dialHeader.append(eyebrow, headline, context);
    dialCard.append(dialHeader, stage);
    queue.append(queueList);
    board.append(dialCard, queue);
    barometer.append(board, footer);

    return barometer;
}

function getProblemCategoryTrendDisplayRows(trends, stats) {
    if (Array.isArray(trends) && trends.length) {
        return trends.slice();
    }

    const visibleStats = getProblemCategoryDisplayStats(stats).slice(0, 5);
    const placeholderDeltas = [7.2, 3.6, 1.1, -2.8, -5.3];

    return visibleStats.map(function (stat, index) {
        const deltaSharePoints = placeholderDeltas[index] || 0;
        const deltaCount = Math.round((deltaSharePoints / 100) * Math.max(stat.totalReports || 0, stat.problemCount || 0));

        return {
            category: stat.category,
            problemType: stat.problemType,
            currentCount: stat.problemCount,
            previousCount: Math.max(0, stat.problemCount - deltaCount),
            currentSharePercent: stat.sharePercent,
            previousSharePercent: Math.max(0, stat.sharePercent - deltaSharePoints),
            deltaSharePoints,
            deltaCount
        };
    }).sort(function (firstEntry, secondEntry) {
        return secondEntry.deltaSharePoints - firstEntry.deltaSharePoints;
    });
}

function getProblemTimeSegmentDisplayRows(segments) {
    if (Array.isArray(segments) && segments.some(function (segment) {
        return segment.problemCount > 0;
    })) {
        return segments.slice();
    }

    const placeholderCounts = [1, 1, 1, 2, 2, 3, 4, 5, 6, 9, 11, 7];
    const total = placeholderCounts.reduce(function (sum, value) {
        return sum + value;
    }, 0);

    return placeholderCounts.map(function (problemCount, segmentIndex) {
        const startHour = segmentIndex * 2;
        const endHour = (startHour + 2) % 24;

        return {
            segmentIndex,
            segmentLabel: `${String(startHour).padStart(2, "0")}–${String(endHour).padStart(2, "0")}`,
            startHour,
            endHour,
            problemCount,
            sharePercent: total > 0 ? (problemCount / total) * 100 : 0
        };
    });
}

function formatProblemTrendDelta(value) {
    const normalizedValue = Number.isFinite(value) ? value : 0;
    const roundedValue = Math.round(normalizedValue * 10) / 10;
    const valueText = Number.isInteger(roundedValue)
        ? String(roundedValue)
        : roundedValue.toFixed(1).replace(".", ",");

    return `${roundedValue > 0 ? "+" : ""}${valueText}p`;
}

function createProblemTrendItem(entry, direction, index, maxDelta) {
    const item = document.createElement("article");
    const head = document.createElement("div");
    const name = document.createElement("strong");
    const delta = document.createElement("span");
    const rail = document.createElement("div");
    const fill = document.createElement("span");
    const meta = document.createElement("span");
    const palette = PROBLEM_STATS_EDITORIAL_PALETTE[index % PROBLEM_STATS_EDITORIAL_PALETTE.length];
    const ratio = maxDelta > 0 ? Math.abs(entry.deltaSharePoints) / maxDelta : 0;

    item.className = `problem-trend__item problem-trend__item--${direction}`;
    item.style.setProperty("--problem-trend-color", palette.color);
    item.style.setProperty("--problem-trend-glow", palette.glow);
    item.style.setProperty("--problem-trend-width", `${(Math.max(0.18, Math.min(1, ratio)) * 100).toFixed(2)}%`);

    head.className = "problem-trend__item-head";
    name.className = "problem-trend__item-name";
    delta.className = "problem-trend__item-delta";
    rail.className = "problem-trend__item-rail";
    fill.className = "problem-trend__item-fill";
    meta.className = "problem-trend__item-meta";

    name.textContent = entry.category.label;
    delta.textContent = formatProblemTrendDelta(entry.deltaSharePoints);
    meta.textContent = `${numberFormatter.format(entry.currentCount)} nüüd · ${numberFormatter.format(entry.previousCount)} enne`;

    rail.append(fill);
    head.append(name, delta);
    item.append(head, rail, meta);

    return item;
}

function createProblemTrendShowcase(stats, trends) {
    const rows = getProblemCategoryTrendDisplayRows(trends, stats);
    const sortedDescending = rows.slice().sort(function (firstEntry, secondEntry) {
        return secondEntry.deltaSharePoints - firstEntry.deltaSharePoints;
    });
    const sortedAscending = rows.slice().sort(function (firstEntry, secondEntry) {
        return firstEntry.deltaSharePoints - secondEntry.deltaSharePoints;
    });
    const rising = sortedDescending.filter(function (entry) {
        return entry.deltaSharePoints > 0;
    }).slice(0, 3);
    const falling = sortedAscending.filter(function (entry) {
        return entry.deltaSharePoints < 0;
    }).slice(0, 3);
    const fallbackRising = rising.length ? rising : sortedDescending.slice(0, 3);
    const usedLabels = new Set(fallbackRising.map(function (entry) {
        return entry.category.label;
    }));
    const fallbackFalling = falling.length
        ? falling
        : sortedAscending.filter(function (entry) {
            return !usedLabels.has(entry.category.label);
        }).slice(0, 3);
    const strongestDelta = rows.reduce(function (largestValue, entry) {
        return Math.max(largestValue, Math.abs(entry.deltaSharePoints));
    }, 0);
    const strongestRise = fallbackRising[0];
    const strongestFall = fallbackFalling[0];
    const showcase = document.createElement("div");
    const header = document.createElement("div");
    const eyebrow = document.createElement("span");
    const title = document.createElement("strong");
    const context = document.createElement("span");
    const lanes = document.createElement("div");
    const risingLane = document.createElement("section");
    const fallingLane = document.createElement("section");
    const risingLabel = document.createElement("span");
    const fallingLabel = document.createElement("span");

    showcase.className = "problem-trend";
    header.className = "problem-trend__header";
    eyebrow.className = "problem-trend__eyebrow";
    title.className = "problem-trend__title";
    context.className = "problem-trend__context";
    lanes.className = "problem-trend__lanes";
    risingLane.className = "problem-trend__lane problem-trend__lane--rising";
    fallingLane.className = "problem-trend__lane problem-trend__lane--falling";
    risingLabel.className = "problem-trend__lane-label";
    fallingLabel.className = "problem-trend__lane-label";

    eyebrow.textContent = "Võrreldes eelmise 30 päevaga";
    title.textContent = "Tõusjad ja langejad";
    context.textContent = strongestRise && strongestFall
        ? `${strongestRise.category.label} kerkib, ${strongestFall.category.label} vajub taha.`
        : "Teemad liiguvad eri suundades.";
    risingLabel.textContent = "Tõusvad teemad";
    fallingLabel.textContent = "Rahunevad teemad";

    fallbackRising.forEach(function (entry, index) {
        risingLane.append(createProblemTrendItem(entry, "rising", index, strongestDelta));
    });

    fallbackFalling.forEach(function (entry, index) {
        fallingLane.append(createProblemTrendItem(entry, "falling", index + fallbackRising.length, strongestDelta));
    });

    risingLane.prepend(risingLabel);
    fallingLane.prepend(fallingLabel);
    lanes.append(risingLane, fallingLane);
    header.append(eyebrow, title, context);
    showcase.append(header, lanes);

    return showcase;
}

function getProblemTimeSegmentColor(segment, intensity) {
    if (segment.startHour < 6) {
        return `rgba(107, 119, 232, ${0.2 + (intensity * 0.78)})`;
    }

    if (segment.startHour < 12) {
        return `rgba(98, 190, 219, ${0.2 + (intensity * 0.78)})`;
    }

    if (segment.startHour < 18) {
        return `rgba(240, 189, 93, ${0.22 + (intensity * 0.76)})`;
    }

    return `rgba(229, 121, 87, ${0.22 + (intensity * 0.76)})`;
}

function buildProblemTimeClockGradient(segments) {
    const largestCount = segments.reduce(function (largestValue, segment) {
        return Math.max(largestValue, segment.problemCount);
    }, 0);
    const gradientSegments = [];

    segments.forEach(function (segment, index) {
        const startAngle = index * 30;
        const endAngle = startAngle + 30;
        const fillStart = startAngle + 1.8;
        const fillEnd = endAngle - 2.8;
        const intensity = largestCount > 0 ? segment.problemCount / largestCount : 0;

        gradientSegments.push(`rgba(255, 255, 255, 0) ${startAngle.toFixed(2)}deg ${fillStart.toFixed(2)}deg`);
        gradientSegments.push(`${getProblemTimeSegmentColor(segment, intensity)} ${fillStart.toFixed(2)}deg ${fillEnd.toFixed(2)}deg`);
        gradientSegments.push(`rgba(255, 255, 255, 0) ${fillEnd.toFixed(2)}deg ${endAngle.toFixed(2)}deg`);
    });

    return `conic-gradient(from -90deg, ${gradientSegments.join(", ")})`;
}

function describeProblemTimeMoment(startHour) {
    if (startHour < 6) {
        return "öö";
    }

    if (startHour < 10) {
        return "hommik";
    }

    if (startHour < 14) {
        return "päev";
    }

    if (startHour < 18) {
        return "pärastlõuna";
    }

    if (startHour < 22) {
        return "õhtu";
    }

    return "hilisõhtu";
}

function createProblemTimeSpark(segment, largestCount) {
    const spark = document.createElement("span");
    const intensity = largestCount > 0 ? segment.problemCount / largestCount : 0;
    const angle = -90 + (segment.segmentIndex * 30) + 15;

    spark.className = "problem-clock__spark";
    spark.style.setProperty("--problem-clock-angle", `${angle}deg`);
    spark.style.setProperty("--problem-clock-color", getProblemTimeSegmentColor(segment, intensity));
    spark.style.setProperty("--problem-clock-scale", `${(0.52 + (intensity * 0.84)).toFixed(3)}`);

    return spark;
}

function createProblemTimeShowcase(segments) {
    const rows = getProblemTimeSegmentDisplayRows(segments);
    const largestCount = rows.reduce(function (largestValue, row) {
        return Math.max(largestValue, row.problemCount);
    }, 0);
    const peakSegment = rows.reduce(function (strongestSegment, row) {
        if (!strongestSegment || row.problemCount > strongestSegment.problemCount) {
            return row;
        }

        return strongestSegment;
    }, null);
    const showcase = document.createElement("div");
    const header = document.createElement("div");
    const eyebrow = document.createElement("span");
    const title = document.createElement("strong");
    const context = document.createElement("span");
    const stage = document.createElement("div");
    const halo = document.createElement("div");
    const dial = document.createElement("div");
    const ring = document.createElement("div");
    const sparks = document.createElement("div");
    const core = document.createElement("div");
    const coreEyebrow = document.createElement("span");
    const coreValue = document.createElement("strong");
    const coreMeta = document.createElement("span");
    const footer = document.createElement("p");

    showcase.className = "problem-clock";
    header.className = "problem-clock__header";
    eyebrow.className = "problem-clock__eyebrow";
    title.className = "problem-clock__title";
    context.className = "problem-clock__context";
    stage.className = "problem-clock__stage";
    halo.className = "problem-clock__halo";
    dial.className = "problem-clock__dial";
    ring.className = "problem-clock__ring";
    sparks.className = "problem-clock__sparks";
    core.className = "problem-clock__core";
    coreEyebrow.className = "problem-clock__core-eyebrow";
    coreValue.className = "problem-clock__core-value";
    coreMeta.className = "problem-clock__core-meta";
    footer.className = "problem-clock__footer";

    eyebrow.textContent = "Millal abi enim otsitakse";
    title.textContent = "Murekell";
    context.textContent = peakSegment
        ? `${describeProblemTimeMoment(peakSegment.startHour)} hoiab praegu kõige tugevamat rütmi.`
        : "Päeva jooksul tekib oma selge mureteekond.";

    ring.style.setProperty("--problem-clock-gradient", buildProblemTimeClockGradient(rows));

    rows.forEach(function (row) {
        sparks.append(createProblemTimeSpark(row, largestCount));
    });

    coreEyebrow.textContent = "Kõige tihedam hetk";
    coreValue.textContent = peakSegment?.segmentLabel || "20–22";
    coreMeta.textContent = peakSegment
        ? `${Math.max(1, Math.round(peakSegment.sharePercent))}% kõigist pöördumistest`
        : "Õhtune tippaeg";
    footer.textContent = "00 · 06 · 12 · 18 · 24";

    core.append(coreEyebrow, coreValue, coreMeta);
    dial.append(ring, sparks, core);
    stage.append(halo, dial);
    header.append(eyebrow, title, context);
    showcase.append(header, stage, footer);

    return showcase;
}

function getProblemStatsStoryPanels(stats, trends, timeSegments) {
    const displayStats = getProblemCategoryDisplayStats(stats);
    const leader = displayStats[0];
    const trendRows = getProblemCategoryTrendDisplayRows(trends, stats);
    const strongestRise = trendRows[0];
    const strongestFall = trendRows.slice().sort(function (firstEntry, secondEntry) {
        return firstEntry.deltaSharePoints - secondEntry.deltaSharePoints;
    })[0];
    const timeRows = getProblemTimeSegmentDisplayRows(timeSegments);
    const peakSegment = timeRows.reduce(function (strongestSegment, row) {
        if (!strongestSegment || row.problemCount > strongestSegment.problemCount) {
            return row;
        }

        return strongestSegment;
    }, null);

    return [
        {
            label: "Murebaromeeter",
            summary: leader
                ? `Murebaromeeter näitab, et ${leader.category.label} hoiab suurimat osa, ${Math.max(1, Math.round(leader.sharePercent))} protsenti.`
                : "Murebaromeeter valmistub värskeid andmeid kuvama.",
            content: createProblemCategoryShowcase(stats)
        },
        {
            label: "Tõusjad ja langejad",
            summary: strongestRise && strongestFall
                ? `${strongestRise.category.label} on tõusul ja ${strongestFall.category.label} liigub rahulikumas suunas.`
                : "Teemade liikumine täitub automaatselt värskete andmetega.",
            content: createProblemTrendShowcase(stats, trends)
        },
        {
            label: "Murekell",
            summary: peakSegment
                ? `${peakSegment.segmentLabel} on kõige aktiivsem aeg probleemide jagamiseks.`
                : "Murekell kogub päeva rütmi.",
            content: createProblemTimeShowcase(timeSegments)
        }
    ];
}

function createProblemStatsStory(stats, trends, timeSegments) {
    const story = document.createElement("div");
    const viewport = document.createElement("div");
    const track = document.createElement("div");
    const pager = document.createElement("div");
    const panels = getProblemStatsStoryPanels(stats, trends, timeSegments);

    story.className = "problem-story";
    viewport.className = "problem-story__viewport";
    track.className = "problem-story__track";
    pager.className = "problem-story__pager";

    panels.forEach(function (panel, index) {
        const slide = document.createElement("article");
        const frame = document.createElement("div");
        const dot = document.createElement("button");

        slide.className = "problem-story__panel";
        slide.dataset.panelIndex = String(index);
        slide.setAttribute("aria-label", panel.label);

        frame.className = "problem-story__panel-frame";
        frame.append(panel.content);
        slide.append(frame);
        track.append(slide);

        dot.className = "problem-story__pager-dot";
        dot.type = "button";
        dot.dataset.panelIndex = String(index);
        dot.setAttribute("aria-label", `Ava ${panel.label}`);
        pager.append(dot);
    });

    viewport.append(track);
    story.append(viewport, pager);

    return {
        element: story,
        summaries: panels.map(function (panel) {
            return panel.summary;
        })
    };
}

function enhanceProblemStatsStory(storyElement, summaries) {
    const viewport = storyElement.querySelector(".problem-story__viewport");
    const panels = Array.from(storyElement.querySelectorAll(".problem-story__panel"));
    const dots = Array.from(storyElement.querySelectorAll(".problem-story__pager-dot"));
    let frameId = 0;

    if (!viewport || panels.length === 0) {
        return function () {
            // No-op cleanup when no story viewport is present.
        };
    }

    function setActivePanel(nextIndex) {
        storyElement.dataset.activeIndex = String(nextIndex);

        dots.forEach(function (dot, index) {
            const isActive = index === nextIndex;
            dot.classList.toggle("is-active", isActive);
            dot.setAttribute("aria-pressed", String(isActive));
        });

        if (problemStatsLead) {
            problemStatsLead.textContent = summaries[nextIndex] || summaries[0] || "Murebaromeeter.";
        }
    }

    function syncPanelProgress() {
        if (viewport.scrollWidth <= viewport.clientWidth + 8) {
            panels.forEach(function (panel) {
                panel.style.setProperty("--problem-story-shift", "0");
                panel.style.setProperty("--problem-story-focus", "1");
            });

            setActivePanel(0);
            frameId = 0;
            return;
        }

        const viewportRect = viewport.getBoundingClientRect();
        const viewportCenter = viewportRect.left + (viewportRect.width / 2);
        let activeIndex = 0;
        let shortestDistance = Number.POSITIVE_INFINITY;

        panels.forEach(function (panel, index) {
            const panelRect = panel.getBoundingClientRect();
            const panelCenter = panelRect.left + (panelRect.width / 2);
            const shift = (panelCenter - viewportCenter) / Math.max(viewportRect.width, 1);
            const clampedShift = Math.max(-1.2, Math.min(1.2, shift));
            const focus = Math.max(0, 1 - (Math.abs(clampedShift) * 1.25));

            panel.style.setProperty("--problem-story-shift", clampedShift.toFixed(3));
            panel.style.setProperty("--problem-story-focus", focus.toFixed(3));

            if (Math.abs(clampedShift) < shortestDistance) {
                shortestDistance = Math.abs(clampedShift);
                activeIndex = index;
            }
        });

        setActivePanel(activeIndex);
        frameId = 0;
    }

    function requestSync() {
        if (frameId) {
            return;
        }

        frameId = window.requestAnimationFrame(syncPanelProgress);
    }

    function scrollToPanel(index) {
        const panel = panels[index];

        if (!panel) {
            return;
        }

        const targetLeft = panel.offsetLeft - ((viewport.clientWidth - panel.clientWidth) / 2);
        viewport.scrollTo({
            left: Math.max(0, targetLeft),
            behavior: prefersReducedMotionQuery.matches ? "auto" : "smooth"
        });
    }

    const dotHandlers = dots.map(function (dot, index) {
        const handler = function () {
            scrollToPanel(index);
        };

        dot.addEventListener("click", handler);
        return handler;
    });

    viewport.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync);
    requestSync();

    return function cleanupProblemStatsStory() {
        if (frameId) {
            window.cancelAnimationFrame(frameId);
            frameId = 0;
        }

        viewport.removeEventListener("scroll", requestSync);
        window.removeEventListener("resize", requestSync);
        dots.forEach(function (dot, index) {
            dot.removeEventListener("click", dotHandlers[index]);
        });
    };
}

function renderProblemCategoryStats() {
    if (!problemStatsChart || !problemStatsLead) {
        return;
    }

    if (typeof problemStatsStoryCleanup === "function") {
        problemStatsStoryCleanup();
        problemStatsStoryCleanup = null;
    }

    const hasStats = problemCategoryStats.length > 0;
    const statsForDisplay = hasStats ? problemCategoryStats : [];
    const leader = getProblemCategoryDisplayStats(statsForDisplay)[0];

    problemStatsLead.textContent = hasStats
        ? (leader.category.key === PROBLEM_STATS_OTHER_CATEGORY.key
            ? `Murebaromeeter näitab, et väiksemad teemad kokku moodustavad suurima osa, ${Math.max(1, Math.round(leader.sharePercent))} protsenti.`
            : `Murebaromeeter näitab, et ${leader.category.label} on suurim mureallikas osakaaluga ${Math.max(1, Math.round(leader.sharePercent))} protsenti.`)
        : (isSupabaseConfigured
            ? "Murebaromeeter täitub automaatselt, kui lahendusi koguneb."
            : "Murebaromeetri jaoks peab salvestus olema Supabase'iga ühendatud.");
    const story = createProblemStatsStory(statsForDisplay, problemCategoryTrends, problemTimeSegments);

    problemStatsChart.replaceChildren(story.element);
    problemStatsStoryCleanup = enhanceProblemStatsStory(story.element, story.summaries);
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
    const lead = document.createElement("p");

    title.className = "science-article__title";
    lead.className = "science-article__lead";
    title.textContent = "Kunstilugu valmistub";
    lead.textContent = "Lorien Velmore'i järgmine lugu laeb ennast sisse.";
    fragment.append(title, lead);

    return fragment;
}

function pickLorienMockupImage(article) {
    if (!LORIEN_MOCKUP_IMAGES.length) {
        return null;
    }

    const seed = String(article?.id || article?.dateKey || article?.title || "lorien-mockup");
    let hash = 0;

    for (const character of seed) {
        hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
    }

    return LORIEN_MOCKUP_IMAGES[hash % LORIEN_MOCKUP_IMAGES.length];
}

function createLorienStoryInsert(article, options = {}) {
    const mockup = article?.imageUrl
        ? {
            src: article.imageUrl,
            objectPosition: article.imageObjectPosition || "center center",
            alt: article.imageAlt || `Lorien Velmore'i teose illustratsioon teemal "${article.theme}"`
        }
        : pickLorienMockupImage(article);

    if (!mockup) {
        return null;
    }

    const figure = document.createElement("figure");
    const image = document.createElement("img");
    const caption = document.createElement("figcaption");
    const note = document.createElement("p");
    const isCompact = options.compact === true;

    figure.className = "science-article__mockup";
    figure.classList.toggle("science-article__mockup--compact", isCompact);
    image.className = "science-article__mockup-image";
    caption.className = "science-article__mockup-caption";
    note.className = "science-article__mockup-note";

    image.src = mockup.src;
    image.alt = mockup.alt || `Lorien Velmore'i teose mockup teemal "${article.theme}"`;
    image.loading = "lazy";
    image.decoding = "async";
    image.style.objectPosition = mockup.objectPosition || "center center";

    caption.textContent = "Lorien Velmore";
    note.textContent = article.bannerNote;

    figure.append(image, caption);

    if (!isCompact) {
        figure.append(note);
    }

    return figure;
}

function createStoryPreviewToggle(options) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "button--ghost story-preview__toggle";
    button.textContent = options.expanded ? "Näita vähem" : "Ava täislugu";
    button.setAttribute("aria-expanded", String(Boolean(options.expanded)));
    button.addEventListener("click", options.onClick);

    return button;
}

function renderFeaturedDailyArticle(article) {
    if (!scienceArticleFeatured) {
        return;
    }

    if (!article) {
        scienceArticleFeatured.classList.add("science-article--empty");
        scienceArticleFeatured.classList.remove("is-preview", "is-expanded");
        scienceArticleFeatured.replaceChildren(createSciencePlaceholder());
        return;
    }

    scienceArticleFeatured.classList.remove("science-article--empty");

    const fragment = document.createDocumentFragment();
    const isExpanded = article.id === expandedDailyArticleId;
    const date = document.createElement("span");
    const title = document.createElement("h3");
    const lead = document.createElement("p");
    const highlight = document.createElement("blockquote");
    const body = document.createElement("div");
    const takeaways = document.createElement("div");
    const takeawaysLabel = document.createElement("span");
    const previewParagraphs = article.paragraphs.slice(0, DAILY_ARTICLE_PREVIEW_PARAGRAPHS);
    const visibleParagraphs = isExpanded ? article.paragraphs : previewParagraphs;
    const storyInsert = createLorienStoryInsert(article, { compact: !isExpanded });
    const hasMockup = Boolean(storyInsert);
    const hasTakeaways = article.takeaways.length > 0;
    const hasMoreContent = article.paragraphs.length > previewParagraphs.length || hasMockup || hasTakeaways;

    date.className = "science-article__date";
    title.className = "science-article__title";
    lead.className = "science-article__lead";
    highlight.className = "science-article__highlight";
    body.className = "science-article__body";
    takeaways.className = "science-article__takeaways";
    takeawaysLabel.className = "science-article__section-label";

    date.textContent = formatEditorialDate(article);
    title.textContent = article.title;
    lead.textContent = article.lead;
    highlight.textContent = article.highlight;
    takeawaysLabel.textContent = "Miks see töötab";
    scienceArticleFeatured.classList.toggle("is-preview", hasMoreContent && !isExpanded);
    scienceArticleFeatured.classList.toggle("is-expanded", hasMoreContent && isExpanded);

    visibleParagraphs.forEach(function (paragraphText, index) {
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

    fragment.append(date, title, lead, highlight);

    if (storyInsert) {
        fragment.append(storyInsert);
    }

    fragment.append(body);

    if (isExpanded && hasTakeaways) {
        fragment.append(takeawaysLabel, takeaways);
    }

    if (hasMoreContent) {
        fragment.append(createStoryPreviewToggle({
            expanded: isExpanded,
            onClick: function () {
                expandedDailyArticleId = isExpanded ? "" : article.id;
                renderDailyArticles();
            }
        }));
    }

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

    date.textContent = formatEditorialDate(article);
    theme.textContent = article.theme;
    title.textContent = article.title;
    lead.textContent = article.lead;

    meta.append(date, theme);
    button.append(meta, title, lead);
    button.addEventListener("click", function () {
        selectedDailyArticleId = article.id;
        expandedDailyArticleId = "";
        renderDailyArticles();
    });

    return button;
}

function renderDailyArticles() {
    if (!scienceArticleFeatured || !scienceArticleList) {
        return;
    }

    const selectedArticle = getSelectedDailyArticle();
    const otherArticles = dailyArticles.filter(function (article) {
        return article.id !== selectedArticle?.id;
    });
    const visibleCount = getVisibleDailyArticles(otherArticles);
    const listFragment = document.createDocumentFragment();

    renderFeaturedDailyArticle(selectedArticle);

    if (dailyArticles.length === 0) {
        const emptyItem = document.createElement("div");
        emptyItem.className = "science-feed__list-empty";
        emptyItem.textContent = "Laadimine";
        scienceArticleList.replaceChildren(emptyItem);
        updateScienceArticleMoreButton(0, 0);
        return;
    }

    otherArticles.slice(0, visibleCount).forEach(function (article) {
        listFragment.append(createDailyArticleListItem(article));
    });

    if (visibleCount >= otherArticles.length && otherArticles.length < DAILY_ARTICLES_LIMIT - 1) {
        const note = document.createElement("div");
        note.className = "science-feed__list-empty";
        note.textContent = "Arhiiv täieneb iga päev. Homme tuleb siia järgmine Lorien Velmore'i lugu.";
        listFragment.append(note);
    }

    scienceArticleList.replaceChildren(listFragment);
    updateScienceArticleMoreButton(visibleCount, otherArticles.length);
}

function getVisibleDailyArticles(otherArticles) {
    const totalArticles = otherArticles.length;

    if (!recentProblemsViewportQuery.matches) {
        lastDailyArticlesMobileView = false;
        return totalArticles;
    }

    if (!lastDailyArticlesMobileView || visibleDailyArticleCount === 0) {
        visibleDailyArticleCount = DAILY_ARTICLES_MOBILE_INITIAL_COUNT;
    }

    lastDailyArticlesMobileView = true;

    return Math.min(
        Math.max(DAILY_ARTICLES_MOBILE_INITIAL_COUNT, visibleDailyArticleCount),
        totalArticles
    );
}

function updateScienceArticleMoreButton(visibleCount, totalArticles) {
    if (!scienceArticleMoreButton) {
        return;
    }

    const hasMoreArticles = recentProblemsViewportQuery.matches && visibleCount < totalArticles;
    scienceArticleMoreButton.hidden = !hasMoreArticles;

    if (hasMoreArticles) {
        scienceArticleMoreButton.textContent = "Veel lugusid";
    }
}

function getSelectedDailyPersonaStory() {
    if (dailyPersonaStories.length === 0) {
        return null;
    }

    return dailyPersonaStories.find(function (story) {
        return story.id === selectedDailyPersonaStoryId;
    }) || dailyPersonaStories[0];
}

function createPersonaStoryPlaceholder() {
    const fragment = document.createDocumentFragment();
    const title = document.createElement("h3");
    const lead = document.createElement("p");

    title.className = "persona-story__title";
    lead.className = "persona-story__lead";
    title.textContent = "Persoonilugusid veel ei ole";
    lead.textContent = "See rubriik täitub alles siis, kui intervjuu on tehtud ja avaldatud.";
    fragment.append(title, lead);

    return fragment;
}

function getPersonaCoverImage(story) {
    if (story?.imageUrl) {
        return {
            src: story.imageUrl,
            alt: story.imageAlt || `${story.characterName || "Persoonilugu"} foto`,
            objectPosition: story.imageObjectPosition || "center center"
        };
    }

    const firstGalleryImage = Array.isArray(story?.galleryImages)
        ? story.galleryImages.find(function (image) {
            return image?.url;
        })
        : null;

    if (!firstGalleryImage) {
        return null;
    }

    return {
        src: firstGalleryImage.url,
        alt: firstGalleryImage.alt || `${story.characterName || "Persoonilugu"} foto`,
        objectPosition: "center center"
    };
}

function renderFeaturedPersonaStory(story, imageAsset = null) {
    if (!personaStoryFeatured) {
        return;
    }

    if (!story) {
        personaStoryFeatured.classList.add("persona-story--empty");
        personaStoryFeatured.classList.remove("is-preview", "is-expanded");
        personaStoryFeatured.replaceChildren(createPersonaStoryPlaceholder());
        return;
    }

    personaStoryFeatured.classList.remove("persona-story--empty");

    const fragment = document.createDocumentFragment();
    const isExpanded = story.id === expandedDailyPersonaStoryId;
    const media = document.createElement("div");
    const image = document.createElement("img");
    const content = document.createElement("div");
    const date = document.createElement("span");
    const title = document.createElement("h3");
    const lead = document.createElement("p");
    const highlight = document.createElement("blockquote");
    const body = document.createElement("div");
    const result = document.createElement("p");
    const gallery = document.createElement("div");
    const galleryImages = (Array.isArray(story.galleryImages) ? story.galleryImages : []).filter(function (galleryImage) {
        return galleryImage?.url && galleryImage.url !== imageAsset?.src;
    });
    const allParagraphs = (story.paragraphs || []).filter(Boolean);
    const visibleParagraphs = isExpanded ? allParagraphs : [];
    const hasResult = Boolean(story.resultNote);
    const hasGallery = galleryImages.length > 0;
    const hasMoreContent = allParagraphs.length > 0 || Boolean(story.highlight) || hasResult || hasGallery;

    media.className = "persona-story__media";
    image.className = "persona-story__image";
    content.className = "persona-story__content";
    date.className = "persona-story__date";
    title.className = "persona-story__title";
    lead.className = "persona-story__lead";
    highlight.className = "persona-story__highlight";
    body.className = "persona-story__body";
    result.className = "persona-story__result";
    gallery.className = "persona-story__gallery";
    personaStoryFeatured.classList.toggle("is-preview", hasMoreContent && !isExpanded);
    personaStoryFeatured.classList.toggle("is-expanded", hasMoreContent && isExpanded);

    if (imageAsset) {
        image.src = imageAsset.src;
        image.alt = imageAsset.alt || `${story.characterName || "Persoonilugu"} foto`;
        image.loading = "lazy";
        image.decoding = "async";
        image.style.objectPosition = imageAsset.objectPosition || "center center";
        media.append(image);
    }

    date.textContent = formatEditorialDate(story);
    title.textContent = story.title;

    visibleParagraphs.forEach(function (paragraphText) {
        const paragraph = document.createElement("p");
        paragraph.textContent = paragraphText;
        body.append(paragraph);
    });

    galleryImages.forEach(function (galleryImage) {
        const figure = document.createElement("figure");
        const galleryImageElement = document.createElement("img");
        const caption = document.createElement("figcaption");

        figure.className = "persona-story__gallery-item";
        galleryImageElement.className = "persona-story__gallery-image";
        caption.className = "persona-story__gallery-caption";
        galleryImageElement.src = galleryImage.url;
        galleryImageElement.alt = galleryImage.alt || `${story.characterName} persooniloo lisafoto`;
        galleryImageElement.loading = "lazy";
        galleryImageElement.decoding = "async";
        caption.textContent = galleryImage.caption || "";

        figure.append(galleryImageElement);

        if (caption.textContent) {
            figure.append(caption);
        }

        gallery.append(figure);
    });

    if (imageAsset) {
        fragment.append(media);
    }

    content.append(date, title);

    if (story.lead) {
        lead.textContent = story.lead;
        content.append(lead);
    }

    if (isExpanded && story.highlight) {
        highlight.textContent = story.highlight;
        content.append(highlight);
    }

    if (body.childElementCount > 0) {
        content.append(body);
    }

    if (isExpanded && story.resultNote) {
        result.textContent = story.resultNote;
        content.append(result);
    }

    if (isExpanded && gallery.childElementCount > 0) {
        content.append(gallery);
    }

    if (hasMoreContent) {
        content.append(createStoryPreviewToggle({
            expanded: isExpanded,
            onClick: function () {
                expandedDailyPersonaStoryId = isExpanded ? "" : story.id;
                renderDailyPersonaStories();
            }
        }));
    }

    fragment.append(content);
    personaStoryFeatured.replaceChildren(fragment);
}

function scrollFeaturedPersonaStoryIntoView() {
    if (!personaStoryFeatured) {
        return;
    }

    window.requestAnimationFrame(function () {
        personaStoryFeatured.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    });
}

function createPersonaStoryListItem(story, imageAsset = null) {
    const button = document.createElement("button");
    const thumb = document.createElement("div");
    const thumbImage = document.createElement("img");
    const body = document.createElement("div");
    const meta = document.createElement("div");
    const date = document.createElement("span");
    const theme = document.createElement("span");
    const title = document.createElement("strong");
    const isSelected = story.id === getSelectedDailyPersonaStory()?.id;

    button.type = "button";
    button.className = "persona-feed__list-item";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(isSelected));
    button.classList.toggle("is-selected", isSelected);

    thumb.className = "persona-feed__thumb";
    thumbImage.className = "persona-feed__thumb-image";
    body.className = "persona-feed__list-body";
    meta.className = "persona-feed__list-meta";
    date.className = "persona-feed__list-date";
    theme.className = "persona-feed__list-theme";
    title.className = "persona-feed__list-title";

    if (imageAsset) {
        thumbImage.src = imageAsset.src;
        thumbImage.alt = "";
        thumbImage.loading = "lazy";
        thumbImage.decoding = "async";
        thumbImage.style.objectPosition = imageAsset.objectPosition || "center center";
        thumb.append(thumbImage);
    }

    date.textContent = formatEditorialDate(story);
    theme.textContent = story.theme;
    title.textContent = story.title;

    meta.append(date, theme);
    body.append(meta, title);
    if (imageAsset) {
        button.append(thumb);
    }

    button.append(body);
    button.addEventListener("click", function () {
        selectedDailyPersonaStoryId = story.id;
        expandedDailyPersonaStoryId = "";
        renderDailyPersonaStories();
        scrollFeaturedPersonaStoryIntoView();
    });

    return button;
}

function getVisiblePersonaStories(otherStories) {
    const totalStories = otherStories.length;

    if (!recentProblemsViewportQuery.matches) {
        lastPersonaStoriesMobileView = false;
        return totalStories;
    }

    if (!lastPersonaStoriesMobileView || visiblePersonaStoryCount === 0) {
        visiblePersonaStoryCount = DAILY_PERSONA_STORIES_MOBILE_INITIAL_COUNT;
    }

    lastPersonaStoriesMobileView = true;

    return Math.min(
        Math.max(DAILY_PERSONA_STORIES_MOBILE_INITIAL_COUNT, visiblePersonaStoryCount),
        totalStories
    );
}

function updatePersonaStoryMoreButton(visibleCount, totalStories) {
    if (!personaStoryMoreButton) {
        return;
    }

    const hasMoreStories = recentProblemsViewportQuery.matches && visibleCount < totalStories;
    personaStoryMoreButton.hidden = !hasMoreStories;

    if (hasMoreStories) {
        personaStoryMoreButton.textContent = "Veel lugusid";
    }
}

function renderDailyPersonaStories() {
    if (!personaStoryFeatured || !personaStoryList) {
        return;
    }

    const selectedStory = getSelectedDailyPersonaStory();
    const otherStories = dailyPersonaStories.filter(function (story) {
        return story.id !== selectedStory?.id;
    });
    const visibleCount = getVisiblePersonaStories(otherStories);
    const listFragment = document.createDocumentFragment();

    renderFeaturedPersonaStory(selectedStory, getPersonaCoverImage(selectedStory));

    if (dailyPersonaStories.length === 0) {
        const emptyItem = document.createElement("div");
        emptyItem.className = "persona-feed__list-empty";
        emptyItem.textContent = "Avaldatud intervjuud ilmuvad siia.";
        personaStoryList.replaceChildren(emptyItem);
        updatePersonaStoryMoreButton(0, 0);
        return;
    }

    otherStories.slice(0, visibleCount).forEach(function (story) {
        listFragment.append(createPersonaStoryListItem(story, getPersonaCoverImage(story)));
    });

    if (visibleCount >= otherStories.length && otherStories.length < DAILY_PERSONA_STORIES_LIMIT - 1) {
        const note = document.createElement("div");
        note.className = "persona-feed__list-empty";
        note.textContent = "Uued intervjuupõhised persoonilood ilmuvad siia pärast avaldamist.";
        listFragment.append(note);
    }

    personaStoryList.replaceChildren(listFragment);
    updatePersonaStoryMoreButton(visibleCount, otherStories.length);
}

function setDailyCoverStory(nextStory) {
    dailyCoverStory = normalizeDailyCoverStory(nextStory);
    renderDailyCoverStory();
}

function setDailyArticles(nextArticles) {
    dailyArticles = nextArticles
        .map(normalizeDailyArticle)
        .filter(Boolean)
        .sort(function (firstArticle, secondArticle) {
            return getRecordDateTimestamp(secondArticle) - getRecordDateTimestamp(firstArticle);
        })
        .slice(0, DAILY_ARTICLES_LIMIT);

    if (!dailyArticles.some(function (article) {
        return article.id === selectedDailyArticleId;
    })) {
        selectedDailyArticleId = dailyArticles[0]?.id || "";
    }

    if (!dailyArticles.some(function (article) {
        return article.id === expandedDailyArticleId;
    })) {
        expandedDailyArticleId = "";
    }

    renderDailyArticles();
}

function setDailyPersonaStories(nextStories) {
    dailyPersonaStories = nextStories
        .map(normalizeDailyPersonaStory)
        .filter(Boolean)
        .sort(function (firstStory, secondStory) {
            return getRecordDateTimestamp(secondStory) - getRecordDateTimestamp(firstStory);
        })
        .slice(0, DAILY_PERSONA_STORIES_LIMIT);

    if (!dailyPersonaStories.some(function (story) {
        return story.id === selectedDailyPersonaStoryId;
    })) {
        selectedDailyPersonaStoryId = dailyPersonaStories[0]?.id || "";
    }

    if (!dailyPersonaStories.some(function (story) {
        return story.id === expandedDailyPersonaStoryId;
    })) {
        expandedDailyPersonaStoryId = "";
    }

    renderDailyPersonaStories();
}

function setRecentProblems(nextProblems) {
    const mergedProblems = mergeRecentProblems(nextProblems);
    const nextSelectedPreview = mergedProblems.find(function (problem) {
        return problem.reportId && problem.reportId === selectedRecentProblemReportId;
    }) || null;
    const isSameList = areRecentProblemListsEqual(recentProblems, mergedProblems);
    const hasSelectionMismatch = Boolean(selectedRecentProblemReportId) && !nextSelectedPreview;

    recentProblems = mergedProblems;
    selectedRecentProblemPreview = nextSelectedPreview || selectedRecentProblemPreview;

    if (hasSelectionMismatch) {
        selectedRecentProblemReportId = "";
        selectedRecentProblemPreview = null;
        selectedRecentProblemDetail = null;
        isRecentProblemOriginalVisible = false;
        recentProblemDetailError = "";
        isRecentProblemDetailLoading = false;
    }

    if (isSameList && !hasSelectionMismatch) {
        return;
    }

    persistRecentProblems();
    renderRecentProblems();
}

function pushRecentProblem(problem) {
    recentProblems = mergeRecentProblems([problem], recentProblems);
    selectedRecentProblemPreview = recentProblems.find(function (entry) {
        return entry.reportId && entry.reportId === selectedRecentProblemReportId;
    }) || selectedRecentProblemPreview;
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

    if (recentProblemsSection && recentProblemsList) {
        if (persistedReport.recentProblem) {
            pushRecentProblem(persistedReport.recentProblem);
        } else {
            void refreshRecentProblems().catch(function (error) {
                console.error("Failed to refresh recent problems.", error);
            });
        }
    }

    void refreshProblemCategoryStats().catch(function (error) {
        console.error("Failed to refresh problem category stats.", error);
    });
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

async function fetchDailyCoverStoryFromServer() {
    try {
        const response = await fetch("/api/daily-cover-story", {
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("Daily cover story request failed.");
        }

        const payload = await response.json();
        return payload?.story || null;
    } catch (error) {
        console.error("Failed to fetch daily cover story from local server.", error);
        return null;
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

async function fetchDailyPersonaStoriesFromServer() {
    try {
        const response = await fetch("/api/daily-personas", {
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("Daily persona stories request failed.");
        }

        const payload = await response.json();

        return Array.isArray(payload?.stories) ? payload.stories : [];
    } catch (error) {
        console.error("Failed to fetch daily persona stories from local server.", error);
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
    if (!recentProblemsSection || !recentProblemsList) {
        return;
    }

    const [serverProblems, remoteProblems] = await Promise.all([
        fetchRecentProblemsFromServer(),
        refreshRecentProblemsFromSupabase()
    ]);

    setRecentProblems(mergeRecentProblems(serverProblems, remoteProblems, recentProblems));
}

async function refreshProblemCategoryStats() {
    if (!isSupabaseConfigured) {
        setProblemStatsStoryData({
            stats: [],
            trends: [],
            timeSegments: []
        });
        return;
    }

    try {
        const stats = await fetchProblemCategoryStats(PROBLEM_CATEGORY_STATS_DAYS);
        const [trendResult, timeResult] = await Promise.allSettled([
            fetchProblemCategoryTrends(PROBLEM_CATEGORY_STATS_DAYS),
            fetchProblemTimeSegments(PROBLEM_CATEGORY_STATS_DAYS)
        ]);
        const trends = trendResult.status === "fulfilled" ? trendResult.value : [];
        const timeSegments = timeResult.status === "fulfilled" ? timeResult.value : [];

        if (trendResult.status === "rejected") {
            console.error("Failed to sync problem category trends from Supabase.", trendResult.reason);
        }

        if (timeResult.status === "rejected") {
            console.error("Failed to sync problem time segments from Supabase.", timeResult.reason);
        }

        setProblemStatsStoryData({
            stats,
            trends,
            timeSegments
        });
    } catch (error) {
        console.error("Failed to sync problem category stats from Supabase.", error);
        setProblemStatsStoryData({
            stats: [],
            trends: [],
            timeSegments: []
        });
    }
}

async function refreshDailyCoverStory() {
    const story = await fetchDailyCoverStoryFromServer();

    if (story) {
        setDailyCoverStory(story);
    } else if (!dailyCoverStory) {
        renderDailyCoverStory();
    }
}

async function refreshDailyArticles() {
    const articles = await fetchDailyArticlesFromServer();

    if (articles.length > 0) {
        setDailyArticles(articles);
    } else if (dailyArticles.length === 0) {
        renderDailyArticles();
    }
}

async function refreshDailyPersonaStories() {
    const stories = await fetchDailyPersonaStoriesFromServer();

    if (stories.length > 0) {
        setDailyPersonaStories(stories);
    } else if (dailyPersonaStories.length === 0) {
        renderDailyPersonaStories();
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
    currentSolveStartedAt = 0;
    problemInput.value = "";
    resetRating();
    if (solutionLead) {
        solutionLead.textContent = "Valmis mõne sekundiga.";
    }
    showPanel(container, "idle");
    problemInput.focus();
}

function initializeRecentProblems() {
    if (!recentProblemsSection || !recentProblemsList) {
        recentProblems = [];
        recentProblemsUnlocked = false;
        return;
    }

    recentProblems = mergeRecentProblems(loadRecentProblems());
    recentProblemsUnlocked = loadRecentProblemsUnlocked();
    likedRecentProblemIds = loadLikedRecentProblemIds();
    renderRecentProblems();

    if (recentProblemsSyncTimer) {
        window.clearInterval(recentProblemsSyncTimer);
    }

    void refreshRecentProblems();
    recentProblemsSyncTimer = window.setInterval(function () {
        void refreshRecentProblems();
    }, RECENT_PROBLEMS_REFRESH_INTERVAL);
}

function initializeProblemCategoryStats() {
    renderProblemCategoryStats();

    if (problemCategoryStatsSyncTimer) {
        window.clearInterval(problemCategoryStatsSyncTimer);
    }

    if (typeof problemCategoryStatsRealtimeCleanup === "function") {
        problemCategoryStatsRealtimeCleanup();
    }

    void refreshProblemCategoryStats();
    problemCategoryStatsSyncTimer = window.setInterval(function () {
        void refreshProblemCategoryStats();
    }, PROBLEM_CATEGORY_STATS_REFRESH_INTERVAL);

    if (isSupabaseConfigured) {
        problemCategoryStatsRealtimeCleanup = subscribeToReportInserts(
            function () {
                void refreshProblemCategoryStats();
            },
            "reports-insert-problem-stats"
        );
    }
}

function initializeDailyCoverStory() {
    if (!coverStoryHero || !coverStoryHeroToggle) {
        return;
    }

    if (coverStoryHeroToggle.dataset.coverStoryToggleBound !== "true") {
        coverStoryHeroToggle.addEventListener("click", function () {
            if (!hasDailyCoverStoryFeature()) {
                return;
            }

            setDailyCoverStoryExpanded(!isDailyCoverStoryOpen);
        });

        coverStoryHeroToggle.addEventListener("keydown", function (event) {
            if (!hasDailyCoverStoryFeature()) {
                return;
            }

            if (event.key !== "Enter" && event.key !== " ") {
                return;
            }

            event.preventDefault();
            setDailyCoverStoryExpanded(!isDailyCoverStoryOpen);
        });

        coverStoryHeroToggle.dataset.coverStoryToggleBound = "true";
    }

    renderDailyCoverStory();

    if (dailyCoverStorySyncTimer) {
        window.clearInterval(dailyCoverStorySyncTimer);
    }

    void refreshDailyCoverStory();
    dailyCoverStorySyncTimer = window.setInterval(function () {
        void refreshDailyCoverStory();
    }, DAILY_COVER_STORY_REFRESH_INTERVAL);
}

recentProblemsMoreButton?.addEventListener("click", function () {
    const initialCount = getInitialRecentProblemsCount();

    if (visibleRecentProblemsCount < recentProblems.length) {
        visibleRecentProblemsCount = Math.min(
            recentProblems.length,
            visibleRecentProblemsCount + RECENT_PROBLEMS_LOAD_STEP
        );
    } else {
        visibleRecentProblemsCount = Math.min(initialCount, recentProblems.length);
    }

    renderRecentProblems();
});

scienceArticleMoreButton?.addEventListener("click", function () {
    const selectedArticle = getSelectedDailyArticle();
    const otherArticlesCount = dailyArticles.filter(function (article) {
        return article.id !== selectedArticle?.id;
    }).length;

    visibleDailyArticleCount = Math.min(
        otherArticlesCount,
        visibleDailyArticleCount + DAILY_ARTICLES_LOAD_STEP
    );
    renderDailyArticles();
});

personaStoryMoreButton?.addEventListener("click", function () {
    const selectedStory = getSelectedDailyPersonaStory();
    const otherStoriesCount = dailyPersonaStories.filter(function (story) {
        return story.id !== selectedStory?.id;
    }).length;

    visiblePersonaStoryCount = Math.min(
        otherStoriesCount,
        visiblePersonaStoryCount + DAILY_PERSONA_STORIES_LOAD_STEP
    );
    renderDailyPersonaStories();
});

if (typeof recentProblemsViewportQuery.addEventListener === "function") {
    recentProblemsViewportQuery.addEventListener("change", function () {
        renderRecentProblems();
        renderDailyArticles();
        renderDailyPersonaStories();
    });
} else if (typeof recentProblemsViewportQuery.addListener === "function") {
    recentProblemsViewportQuery.addListener(function () {
        renderRecentProblems();
        renderDailyArticles();
        renderDailyPersonaStories();
    });
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

function initializeDailyPersonaStories() {
    renderDailyPersonaStories();

    if (dailyPersonaStoriesSyncTimer) {
        window.clearInterval(dailyPersonaStoriesSyncTimer);
    }

    void refreshDailyPersonaStories();
    dailyPersonaStoriesSyncTimer = window.setInterval(function () {
        void refreshDailyPersonaStories();
    }, DAILY_PERSONA_STORIES_REFRESH_INTERVAL);
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

    const problemText = normalizeProblemInputText(problemInput.value);

    if (problemText === "") {
        setProblemFeedback("Sisesta enne probleem, mida lahendada.", "error");
        problemInput.focus();
        return;
    }

    setProblemFeedback("", "");
    isGeneratingReport = true;
    currentSolveStartedAt = performance.now();
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
        if (solutionLead) {
            solutionLead.textContent = formatSolveDurationLabel(performance.now() - currentSolveStartedAt);
        }
        setRecentProblemsUnlocked(true);
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
    if (problemFeedback?.dataset.state) {
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

window.addEventListener("storage", function (event) {
    if (event.key === DAILY_PERSONA_REFRESH_SIGNAL_KEY) {
        void refreshDailyPersonaStories();
        return;
    }

    if (event.key === RECENT_PROBLEM_LIKES_STORAGE_KEY) {
        likedRecentProblemIds = loadLikedRecentProblemIds();
        renderRecentProblems();
        return;
    }

    if (event.key === SOLVER_SKIN_STORAGE_KEY) {
        applySolverSkin(event.newValue || "");
    }
});

setLoadingProgress(0);
resetRating();
initializeCoverIssueMeta();
initializeSolverSkinSwipe();
initializeUrgitsBannerRotation();
initializeDailyCoverStory();
initializeDailyWeather();
initializeRecentProblems();
initializeProblemCategoryStats();
initializeDailyArticles();
initializeDailyPersonaStories();
initializeDailyHoroscope();
initializeProblemQuiz();
initializeNewsletterForm();
startSolvedCountSync();

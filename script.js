import {
    createProblemReport,
    fetchRecentProblemReports,
    fetchSolvedReportsTotal,
    getOrCreateSessionId,
    isSupabaseConfigured,
    subscribeToReportInserts,
    submitProblemRating
} from "./supabase.js";

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
const personaStoryImageModules = import.meta.glob("./assets/persona-stories/story-*.{png,jpg,jpeg,webp,avif}", {
    eager: true,
    import: "default"
});
const PERSONA_STORY_IMAGE_METADATA = {
    "story-2026-04-12.jpg": {
        intent: "couple",
        subject: "pair",
        tags: ["paar", "köök", "kodune otsus", "30s", "eesti", "kaasaegne"],
        objectPosition: "center center"
    },
    "story-2026-04-11.jpg": {
        intent: "finance",
        subject: "male",
        tags: ["mees", "raha", "arve", "asjaajamine", "bussijuht", "30s", "40s", "eesti"],
        objectPosition: "center center"
    },
    "story-2026-04-10.jpg": {
        intent: "work",
        subject: "female",
        tags: ["naine", "töö", "tudeng", "stuudio", "20s", "eesti", "kaasaegne"],
        objectPosition: "center center"
    },
    "story-2026-04-09.jpg": {
        intent: "conversation",
        subject: "female",
        tags: ["naine", "telefon", "vestlus", "juuksur", "20s", "eesti", "kaasaegne"],
        objectPosition: "center center"
    },
    "story-2026-04-08.jpg": {
        intent: "moving",
        subject: "female",
        tags: ["naine", "kolimine", "kastid", "uus kodu", "40s", "eesti"],
        objectPosition: "center center"
    },
    "story-2026-04-07.jpg": {
        intent: "couple",
        subject: "pair",
        tags: ["paar", "kodu", "otsus", "40s", "50s", "eesti"],
        objectPosition: "center center"
    },
    "story-2026-04-06.jpg": {
        intent: "finance",
        subject: "female",
        tags: ["naine", "raha", "asjaajamine", "kohvik", "40s", "eesti"],
        objectPosition: "center center"
    },
    "story-2026-04-05.jpg": {
        intent: "work",
        subject: "female",
        tags: ["naine", "töö", "muusikaõpetaja", "40s", "eesti"],
        objectPosition: "center center"
    }
};
const PERSONA_STORY_FEMALE_NAMES = new Set([
    "Airi", "Andra", "Anna", "Anni", "Birgit", "Egle", "Eha", "Ene", "Eve", "Heleri", "Kaire", "Karin", "Kärt", "Katrin", "Kristina", "Külli", "Liina", "Liis", "Maarja", "Margit", "Mariliis", "Marje", "Marju", "Reet", "Sandra", "Sirje", "Tiina"
]);
const PERSONA_STORY_MALE_NAMES = new Set([
    "Ain", "Jaan", "Karl", "Kaur", "Kristjan", "Marten", "Rain", "Rasmus", "Toomas", "Vahur"
]);
const PERSONA_STORY_IMAGE_LIBRARY = Object.entries(personaStoryImageModules)
    .sort(function ([firstPath], [secondPath]) {
        const firstName = firstPath.split("/").pop() || "";
        const secondName = secondPath.split("/").pop() || "";
        return firstName.localeCompare(secondName, "et");
    })
    .map(function ([filePath, src]) {
        const name = filePath.split("/").pop() || "persona-story";
        const metadata = PERSONA_STORY_IMAGE_METADATA[name] || {};

        return {
            id: name.replace(/\.[^.]+$/, ""),
            src,
            name,
            intent: metadata.intent || "general",
            subject: metadata.subject || "unknown",
            tags: Array.isArray(metadata.tags) ? metadata.tags : [],
            objectPosition: metadata.objectPosition || "center center"
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
const newsletterSection = document.getElementById("newsletter");
const newsletterForm = document.getElementById("newsletterForm");
const newsletterEmail = document.getElementById("newsletterEmail");
const newsletterSubmitButton = document.getElementById("newsletterSubmitButton");
const newsletterFeedback = document.getElementById("newsletterFeedback");
const recentProblemsList = document.getElementById("recentProblemsList");
const scienceArticleFeatured = document.getElementById("scienceArticleFeatured");
const scienceArticleList = document.getElementById("scienceArticleList");
const personaStoryFeatured = document.getElementById("personaStoryFeatured");
const personaStoryList = document.getElementById("personaStoryList");
const horoscopeFeatured = document.getElementById("horoscopeFeatured");
const horoscopeSignGrid = document.getElementById("horoscopeSignGrid");
const problemQuizSection = document.getElementById("problemQuiz");
const problemQuizCard = document.getElementById("problemQuizCard");
const problemQuizSnapshot = document.getElementById("problemQuizSnapshot");
const problemQuizStepLabel = document.getElementById("problemQuizStepLabel");
const problemQuizProgressBar = document.getElementById("problemQuizProgressBar");
const problemQuizStepDots = document.getElementById("problemQuizStepDots");
const problemQuizRestartButton = document.getElementById("problemQuizRestartButton");
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
let dailyPersonaStories = [];
let dailyPersonaStoriesSyncTimer;
let selectedDailyPersonaStoryId = "";
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

const MIN_SOLVE_DURATION = 3200;
const LOADING_PROGRESS_CAP = 0.92;
const REMOTE_METRICS_REFRESH_INTERVAL = 15000;
const REPORT_REQUEST_TIMEOUT = 18000;
const RECENT_PROBLEMS_LIMIT = 6;
const RECENT_PROBLEMS_STORAGE_KEY = "probleemilahendaja_recent_problems";
const RECENT_PROBLEM_EQUIVALENT_WINDOW_MS = 15000;
const RECENT_PROBLEMS_REFRESH_INTERVAL = 10000;
const DAILY_ARTICLES_LIMIT = 8;
const DAILY_ARTICLES_REFRESH_INTERVAL = 60 * 60 * 1000;
const DAILY_PERSONA_STORIES_LIMIT = 8;
const DAILY_PERSONA_STORIES_REFRESH_INTERVAL = 60 * 60 * 1000;
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
    const fallbackName = "Kärt";
    const fallbackMeta = "34, turundusjuht Tallinnast";
    const fallbackLead = "Üks õigesti sõnastatud probleem võib olla palju suurem kergendus kui järgmine eneseabi-trikk.";

    return {
        id: sanitizeProblemText(record.id || record.dateKey || record.date_key || String(index + 1)),
        dateKey: sanitizeProblemText(record.dateKey || record.date_key || ""),
        theme: capitalizeFirst(truncate(sanitizeAdministrativeUiText(sanitizeProblemText(record.theme || "Persoonilugu")), 42)),
        characterName: truncate(sanitizeProblemText(record.characterName || record.character_name || fallbackName), 48),
        characterMeta: truncate(sanitizeProblemText(record.characterMeta || record.character_meta || fallbackMeta), 72),
        title: truncate(sanitizeAdministrativeUiText(title), 110),
        lead: truncate(sanitizeAdministrativeUiText(sanitizeProblemText(record.lead || fallbackLead)), 190),
        highlight: truncate(
            sanitizeAdministrativeUiText(sanitizeProblemText(
                record.highlight
                || "Kui probleem sai lõpuks õigesti sõnastatud, muutus ka järgmine samm palju väiksemaks."
            )),
            190
        ),
        resultNote: truncate(
            sanitizeAdministrativeUiText(sanitizeProblemText(
                record.resultNote
                || record.result_note
                || "Probleemilahendaja aitas selle loo peategelasel tõmmata ühe suure hägu tagasi üheks päris lahendatavaks küsimuseks."
            )),
            210
        ),
        paragraphs: normalizeTextArray(
            Array.isArray(record.paragraphs) ? record.paragraphs.map(sanitizeAdministrativeUiText) : record.paragraphs,
            [
                fallbackLead,
                "Tüütu ei olnud ainult probleem ise, vaid see, kui palju ruumi see inimese peas iga päev märkamatult ära võttis.",
                "Kui teema sai lõpuks piisavalt täpseks, muutus ka lahendus ootamatult praktiliseks.",
                "Suur muutus ei olnud draama, vaid see, et sama asi ei hakanud järgmisel päeval enam nullist uuesti pihta."
            ],
            4,
            360
        ),
        takeaways: normalizeTextArray(
            Array.isArray(record.takeaways) ? record.takeaways.map(sanitizeAdministrativeUiText) : record.takeaways,
            ["üks selge tuum", "vähem taustapinget", "järgmine samm olemas"],
            3,
            48
        ).map(function (value, index) {
            return compactLabel(
                value,
                ["üks selge tuum", "vähem taustapinget", "järgmine samm olemas"][index],
                34
            );
        }),
        readingTime: truncate(sanitizeProblemText(record.readingTime || record.reading_time || "4 min lugemine"), 24),
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
        resetProblemQuiz();
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

    renderProblemQuizProgress();
    renderProblemQuizSnapshot();

    if (currentProblemQuizStep >= PROBLEM_QUIZ_QUESTIONS.length) {
        renderProblemQuizResult();
        return;
    }

    renderProblemQuizQuestion();
}

function resetProblemQuiz() {
    clearProblemQuizAdvanceTimer();
    problemQuizAnswers = PROBLEM_QUIZ_QUESTIONS.map(function () {
        return null;
    });
    currentProblemQuizStep = 0;
    renderProblemQuiz();
}

function initializeProblemQuiz() {
    if (!problemQuizSection || !problemQuizCard) {
        return;
    }

    problemQuizRestartButton?.addEventListener("click", resetProblemQuiz);
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

function createLorienStoryInsert(article) {
    const mockup = pickLorienMockupImage(article);

    if (!mockup) {
        return null;
    }

    const figure = document.createElement("figure");
    const image = document.createElement("img");
    const caption = document.createElement("figcaption");
    const note = document.createElement("p");

    figure.className = "science-article__mockup";
    image.className = "science-article__mockup-image";
    caption.className = "science-article__mockup-caption";
    note.className = "science-article__mockup-note";

    image.src = mockup.src;
    image.alt = `Lorien Velmore'i teose mockup teemal "${article.theme}"`;
    image.loading = "lazy";
    image.decoding = "async";

    caption.textContent = "Lorien Velmore";
    note.textContent = article.bannerNote;

    figure.append(image, caption, note);
    return figure;
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
    const top = document.createElement("div");
    const eyebrowRow = document.createElement("div");
    const metaRow = document.createElement("div");
    const eyebrow = document.createElement("span");
    const theme = document.createElement("span");
    const date = document.createElement("span");
    const readingTime = document.createElement("span");
    const title = document.createElement("h3");
    const lead = document.createElement("p");
    const highlight = document.createElement("blockquote");
    const body = document.createElement("div");
    const tags = document.createElement("div");
    const takeaways = document.createElement("div");
    const takeawaysLabel = document.createElement("span");

    top.className = "science-article__top";
    eyebrowRow.className = "science-article__eyebrow-row";
    metaRow.className = "science-article__meta-row";
    eyebrow.className = "science-article__eyebrow";
    theme.className = "science-article__theme";
    date.className = "science-article__date";
    readingTime.className = "science-article__reading-time";
    title.className = "science-article__title";
    lead.className = "science-article__lead";
    highlight.className = "science-article__highlight";
    body.className = "science-article__body";
    tags.className = "science-article__lenses";
    takeaways.className = "science-article__takeaways";
    takeawaysLabel.className = "science-article__section-label";

    eyebrow.textContent = "Kunst";
    theme.textContent = article.theme;
    date.textContent = formatEditorialDate(article);
    readingTime.textContent = article.readingTime;
    title.textContent = article.title;
    lead.textContent = article.lead;
    highlight.textContent = article.highlight;
    takeawaysLabel.textContent = "Miks see töötab";

    eyebrowRow.append(eyebrow, theme);
    metaRow.append(date, readingTime);
    top.append(eyebrowRow, metaRow);

    article.lenses.forEach(function (label) {
        const pill = document.createElement("span");
        pill.className = "science-article__lens";
        pill.textContent = label;
        tags.append(pill);
    });

    article.paragraphs.forEach(function (paragraphText, index) {
        const paragraph = document.createElement("p");
        paragraph.textContent = paragraphText;
        body.append(paragraph);

        if (index === 1) {
            const storyInsert = createLorienStoryInsert(article);

            if (storyInsert) {
                body.append(storyInsert);
            }
        }
    });

    article.takeaways.forEach(function (takeawayText) {
        const pill = document.createElement("span");
        pill.className = "science-article__takeaway";
        pill.textContent = takeawayText;
        takeaways.append(pill);
    });

    fragment.append(top, title, lead, highlight, tags, body, takeawaysLabel, takeaways);
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
    const listFragment = document.createDocumentFragment();

    renderFeaturedDailyArticle(selectedArticle);

    if (dailyArticles.length === 0) {
        const emptyItem = document.createElement("div");
        emptyItem.className = "science-feed__list-empty";
        emptyItem.textContent = "Laadimine";
        scienceArticleList.replaceChildren(emptyItem);
        return;
    }

    otherArticles.forEach(function (article) {
        listFragment.append(createDailyArticleListItem(article));
    });

    if (otherArticles.length < DAILY_ARTICLES_LIMIT - 1) {
        const note = document.createElement("div");
        note.className = "science-feed__list-empty";
        note.textContent = "Arhiiv täieneb iga päev. Homme tuleb siia järgmine Lorien Velmore'i lugu.";
        listFragment.append(note);
    }

    scienceArticleList.replaceChildren(listFragment);
}

function getSelectedDailyPersonaStory() {
    if (dailyPersonaStories.length === 0) {
        return null;
    }

    return dailyPersonaStories.find(function (story) {
        return story.id === selectedDailyPersonaStoryId;
    }) || dailyPersonaStories[0];
}

function extractPersonaAge(story) {
    const ageMatch = String(story?.characterMeta || "").match(/\b(\d{2})\b/);
    return ageMatch ? Number(ageMatch[1]) : null;
}

function getPersonaImageAgeTags(age) {
    if (!Number.isFinite(age)) {
        return [];
    }

    if (age < 30) {
        return ["20s"];
    }

    if (age < 40) {
        return ["30s"];
    }

    if (age < 50) {
        return ["40s"];
    }

    return ["50s", "senior"];
}

function isPersonaPairStory(story) {
    const nameText = String(story?.characterName || "").toLocaleLowerCase("et-EE");
    const metaText = String(story?.characterMeta || "").toLocaleLowerCase("et-EE");
    const themeText = String(story?.theme || "").toLocaleLowerCase("et-EE");

    return /\b.+\sja\s.+\b/.test(nameText) || /paar|vanemad|kahepeale/.test(`${metaText} ${themeText}`);
}

function inferPersonaStorySubject(story) {
    if (isPersonaPairStory(story)) {
        return "pair";
    }

    const firstName = String(story?.characterName || "")
        .split(/\s|,/)
        .map(function (value) {
            return value.trim();
        })
        .filter(Boolean)[0] || "";

    if (PERSONA_STORY_FEMALE_NAMES.has(firstName)) {
        return "female";
    }

    if (PERSONA_STORY_MALE_NAMES.has(firstName)) {
        return "male";
    }

    return "unknown";
}

function getPersonaStoryIntent(story) {
    const priorityText = [
        story?.theme,
        story?.title,
        story?.lead
    ].join(" ").toLocaleLowerCase("et-EE");

    if (/kolim|korter|kast|uus kodu/.test(priorityText)) {
        return "moving";
    }

    if (/raha|arve|asjaaj|nõude|raamatupid|paberi/.test(priorityText)) {
        return "finance";
    }

    if (isPersonaPairStory(story)) {
        return "couple";
    }

    if (/vestlus|jutu|rääki|kõne|kolleeg/.test(priorityText)) {
        return "conversation";
    }

    if (/töö|projekt|ülesann|tempo|koosolek|kontor/.test(priorityText)) {
        return "work";
    }

    return "general";
}

function scorePersonaStoryImage(story, imageAsset) {
    const combinedText = [
        story?.theme,
        story?.title,
        story?.lead,
        story?.characterName,
        story?.characterMeta,
        ...(Array.isArray(story?.paragraphs) ? story.paragraphs : [])
    ].join(" ").toLocaleLowerCase("et-EE");
    const ageTags = getPersonaImageAgeTags(extractPersonaAge(story));
    const storyIntent = getPersonaStoryIntent(story);
    const isPairStory = isPersonaPairStory(story);
    const storySubject = inferPersonaStorySubject(story);
    let score = 0;

    if (imageAsset.intent === storyIntent) {
        score += 90;
    } else if (storyIntent === "finance" && imageAsset.intent === "work") {
        score += 12;
    } else if (storyIntent === "work" && imageAsset.intent === "finance") {
        score += 8;
    }

    if (isPairStory && imageAsset.tags.includes("paar")) {
        score += 36;
    }

    if (!isPairStory && imageAsset.tags.includes("paar")) {
        score -= 60;
    }

    if (storySubject !== "unknown") {
        if (imageAsset.subject === storySubject) {
            score += 70;
        } else if (imageAsset.subject !== "unknown") {
            score -= 120;
        }
    }

    if (storyIntent !== "conversation" && imageAsset.intent === "conversation") {
        score -= 10;
    }

    imageAsset.tags.forEach(function (tag) {
        if (combinedText.includes(tag)) {
            score += 10;
        }
    });

    if ((/kolim|korter|kast|uus kodu/.test(combinedText)) && imageAsset.intent === "moving") {
        score += 32;
    }

    if ((/vestlus|jutu|rääki|kõne|kolleeg/.test(combinedText)) && imageAsset.intent === "conversation") {
        score += 32;
    }

    if ((/raha|arve|asjaaj|paberi|numbri/.test(combinedText)) && imageAsset.intent === "finance") {
        score += 32;
    }

    if ((/töö|projekt|ülesann|tempo|kontor/.test(combinedText)) && imageAsset.intent === "work") {
        score += 32;
    }

    ageTags.forEach(function (tag) {
        if (imageAsset.tags.includes(tag)) {
            score += 18;
        }
    });

    const tieBreakerSeed = `${story?.id || story?.dateKey || ""}:${imageAsset.id}`;
    let tieBreaker = 0;

    for (const character of tieBreakerSeed) {
        tieBreaker = ((tieBreaker * 31) + character.charCodeAt(0)) >>> 0;
    }

    return score + ((tieBreaker % 1000) / 1000);
}

function getFixedPersonaStoryImageName(story) {
    const dateKey = String(story?.dateKey || story?.id || "").trim();

    if (!dateKey) {
        return "";
    }

    return `story-${dateKey}.jpg`;
}

function getPersonaStoryImageAssignments(stories) {
    const assignments = new Map();
    const usedImageIds = new Set();
    const normalizedStories = (Array.isArray(stories) ? stories : []).filter(Boolean);

    normalizedStories.forEach(function (story) {
        const fixedImageName = getFixedPersonaStoryImageName(story);
        const fixedImage = PERSONA_STORY_IMAGE_LIBRARY.find(function (imageAsset) {
            return imageAsset.name === fixedImageName;
        });

        if (fixedImage && !assignments.has(story.id)) {
            assignments.set(story.id, fixedImage);
            usedImageIds.add(fixedImage.id);
        }
    });

    normalizedStories.forEach(function (story) {
        if (assignments.has(story.id)) {
            return;
        }

        const availableImages = PERSONA_STORY_IMAGE_LIBRARY.filter(function (imageAsset) {
            return !usedImageIds.has(imageAsset.id);
        });
        const candidateImages = availableImages.length > 0 ? availableImages : PERSONA_STORY_IMAGE_LIBRARY;
        const bestImage = candidateImages
            .slice()
            .sort(function (firstImage, secondImage) {
                return scorePersonaStoryImage(story, secondImage) - scorePersonaStoryImage(story, firstImage);
            })[0] || null;

        if (bestImage) {
            assignments.set(story.id, bestImage);
            usedImageIds.add(bestImage.id);
        }
    });

    return assignments;
}

function createPersonaStoryPlaceholder() {
    const fragment = document.createDocumentFragment();
    const title = document.createElement("h3");
    const lead = document.createElement("p");

    title.className = "persona-story__title";
    lead.className = "persona-story__lead";
    title.textContent = "Persoonilugu valmistub";
    lead.textContent = "Probleemilahendaja järgmine päevane case-lugu laeb ennast sisse.";
    fragment.append(title, lead);

    return fragment;
}

function renderFeaturedPersonaStory(story, imageAsset = null) {
    if (!personaStoryFeatured) {
        return;
    }

    if (!story) {
        personaStoryFeatured.classList.add("persona-story--empty");
        personaStoryFeatured.replaceChildren(createPersonaStoryPlaceholder());
        return;
    }

    personaStoryFeatured.classList.remove("persona-story--empty");

    const fragment = document.createDocumentFragment();
    const media = document.createElement("div");
    const image = document.createElement("img");
    const mediaMeta = document.createElement("div");
    const eyebrow = document.createElement("span");
    const theme = document.createElement("span");
    const content = document.createElement("div");
    const metaRow = document.createElement("div");
    const profile = document.createElement("div");
    const name = document.createElement("strong");
    const characterMeta = document.createElement("span");
    const date = document.createElement("span");
    const readingTime = document.createElement("span");
    const title = document.createElement("h3");
    const lead = document.createElement("p");
    const highlight = document.createElement("blockquote");
    const body = document.createElement("div");
    const result = document.createElement("p");
    const takeawaysLabel = document.createElement("span");
    const takeaways = document.createElement("div");

    media.className = "persona-story__media";
    image.className = "persona-story__image";
    mediaMeta.className = "persona-story__media-meta";
    eyebrow.className = "persona-story__eyebrow";
    theme.className = "persona-story__theme";
    content.className = "persona-story__content";
    metaRow.className = "persona-story__meta-row";
    profile.className = "persona-story__profile";
    name.className = "persona-story__name";
    characterMeta.className = "persona-story__character-meta";
    date.className = "persona-story__date";
    readingTime.className = "persona-story__reading-time";
    title.className = "persona-story__title";
    lead.className = "persona-story__lead";
    highlight.className = "persona-story__highlight";
    body.className = "persona-story__body";
    result.className = "persona-story__result";
    takeawaysLabel.className = "persona-story__section-label";
    takeaways.className = "persona-story__takeaways";

    if (imageAsset) {
        image.src = imageAsset.src;
        image.alt = `${story.characterName} persooniloo illustratsioon teemal "${story.theme}"`;
        image.loading = "lazy";
        image.decoding = "async";
        image.style.objectPosition = imageAsset.objectPosition;
        media.append(image);
    }

    eyebrow.textContent = "Persoonilugu";
    theme.textContent = story.theme;
    name.textContent = story.characterName;
    characterMeta.textContent = story.characterMeta;
    date.textContent = formatEditorialDate(story);
    readingTime.textContent = story.readingTime;
    title.textContent = story.title;
    lead.textContent = story.lead;
    highlight.textContent = story.highlight;
    result.textContent = story.resultNote;
    takeawaysLabel.textContent = "Mis muutus";

    mediaMeta.append(eyebrow, theme);
    media.append(mediaMeta);
    profile.append(name, characterMeta);
    metaRow.append(profile, date, readingTime);

    story.paragraphs.forEach(function (paragraphText) {
        const paragraph = document.createElement("p");
        paragraph.textContent = paragraphText;
        body.append(paragraph);
    });

    story.takeaways.forEach(function (takeawayText) {
        const pill = document.createElement("span");
        pill.className = "persona-story__takeaway";
        pill.textContent = takeawayText;
        takeaways.append(pill);
    });

    content.append(metaRow, title, lead, highlight, body, result, takeawaysLabel, takeaways);
    fragment.append(media, content);
    personaStoryFeatured.replaceChildren(fragment);
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
    const person = document.createElement("span");
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
    person.className = "persona-feed__list-person";

    if (imageAsset) {
        thumbImage.src = imageAsset.src;
        thumbImage.alt = "";
        thumbImage.loading = "lazy";
        thumbImage.decoding = "async";
        thumbImage.style.objectPosition = imageAsset.objectPosition;
        thumb.append(thumbImage);
    }

    date.textContent = formatEditorialDate(story);
    theme.textContent = story.theme;
    title.textContent = story.title;
    person.textContent = `${story.characterName} · ${story.characterMeta}`;

    meta.append(date, theme);
    body.append(meta, title, person);
    button.append(thumb, body);
    button.addEventListener("click", function () {
        selectedDailyPersonaStoryId = story.id;
        renderDailyPersonaStories();
    });

    return button;
}

function renderDailyPersonaStories() {
    if (!personaStoryFeatured || !personaStoryList) {
        return;
    }

    const selectedStory = getSelectedDailyPersonaStory();
    const otherStories = dailyPersonaStories.filter(function (story) {
        return story.id !== selectedStory?.id;
    });
    const imageAssignments = getPersonaStoryImageAssignments(dailyPersonaStories);
    const listFragment = document.createDocumentFragment();

    renderFeaturedPersonaStory(selectedStory, imageAssignments.get(selectedStory?.id || ""));

    if (dailyPersonaStories.length === 0) {
        const emptyItem = document.createElement("div");
        emptyItem.className = "persona-feed__list-empty";
        emptyItem.textContent = "Laadimine";
        personaStoryList.replaceChildren(emptyItem);
        return;
    }

    otherStories.forEach(function (story) {
        listFragment.append(createPersonaStoryListItem(story, imageAssignments.get(story.id) || null));
    });

    if (otherStories.length < DAILY_PERSONA_STORIES_LIMIT - 1) {
        const note = document.createElement("div");
        note.className = "persona-feed__list-empty";
        note.textContent = "Arhiiv täieneb iga päev. Homme tuleb siia järgmine persoonilugu.";
        listFragment.append(note);
    }

    personaStoryList.replaceChildren(listFragment);
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

    renderDailyPersonaStories();
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

setLoadingProgress(0);
resetRating();
initializeRecentProblems();
initializeDailyArticles();
initializeDailyPersonaStories();
initializeDailyHoroscope();
initializeProblemQuiz();
initializeNewsletterForm();
startSolvedCountSync();

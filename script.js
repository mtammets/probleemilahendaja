import {
    createProblemReport,
    fetchSolvedReportsTotal,
    getOrCreateSessionId,
    isSupabaseConfigured,
    submitProblemRating
} from "./supabase.js";

const body = document.body;
const container = document.querySelector(".container");
const loadingDiv = document.getElementById("loading");
const solutionDiv = document.getElementById("solution");
const reportDiv = document.getElementById("report");
const problemInput = document.getElementById("problemInput");
const solveButton = document.getElementById("solveButton");
const loadingProgressBar = document.getElementById("loadingProgressBar");
const loadingProgressValue = document.getElementById("loadingProgressValue");
const reportButton = document.getElementById("reportButton");
const resetButton = document.getElementById("resetButton");
const reportBackButton = document.getElementById("reportBackButton");
const reportResetButton = document.getElementById("reportResetButton");
const solvedCount = document.getElementById("solvedCount");
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

let solvedCountTimer;
let solvedCountSyncTimer;
let loadingProgressFrame;
let currentSolvedCount = 0;
let fallbackSolvedBoost = 0;
let currentProblemText = "";
let currentReportId = null;
let pendingReportSave = null;
let selectedRating = 0;
let remoteSolvedCount = null;
let isGeneratingReport = false;

const COUNTER_BASE = 1284320;
const COUNTER_EPOCH = Date.UTC(2026, 0, 1, 9, 0, 0);
const MIN_SOLVE_DURATION = 3200;
const LOADING_PROGRESS_CAP = 0.92;
const REMOTE_METRICS_REFRESH_INTERVAL = 15000;
const numberFormatter = new Intl.NumberFormat("et-EE");
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
    resolution: 96,
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

function getFallbackSolvedCountAt(timestamp) {
    const elapsedSeconds = Math.max(0, Math.floor((timestamp - COUNTER_EPOCH) / 1000));

    return COUNTER_BASE
        + elapsedSeconds
        + Math.floor(elapsedSeconds / 6)
        + Math.floor(elapsedSeconds / 17) * 2
        + Math.floor(elapsedSeconds / 43) * 5
        + Math.floor(elapsedSeconds / 173) * 9
        + fallbackSolvedBoost;
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

function getDisplayedSolvedCount() {
    return typeof remoteSolvedCount === "number"
        ? remoteSolvedCount
        : getFallbackSolvedCountAt(Date.now());
}

function renderSolvedCount() {
    const total = getDisplayedSolvedCount();

    animateValue(solvedCount, currentSolvedCount, total, 420);
    currentSolvedCount = total;
}

function setRemoteSolvedCount(total) {
    if (typeof total === "number" && Number.isFinite(total)) {
        remoteSolvedCount = total;
        renderSolvedCount();
    }
}

async function refreshSolvedCountFromSupabase() {
    if (!isSupabaseConfigured) {
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
    solvedCountTimer = window.setInterval(renderSolvedCount, 1000);

    if (isSupabaseConfigured) {
        refreshSolvedCountFromSupabase();
        solvedCountSyncTimer = window.setInterval(
            refreshSolvedCountFromSupabase,
            REMOTE_METRICS_REFRESH_INTERVAL
        );
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

async function fetchGeneratedReport(problemText) {
    try {
        const response = await fetch("/api/report", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
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

        return normalizeGeneratedReport(problemText, payload.report);
    } catch (error) {
        console.error("Failed to generate report via API.", error);
        return buildFallbackReport(problemText);
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

async function settleReportSaveAfterLoading() {
    if (!pendingReportSave) {
        fallbackSolvedBoost += 1;
        renderSolvedCount();
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

    if (!result && typeof remoteSolvedCount !== "number") {
        fallbackSolvedBoost += 1;
        renderSolvedCount();
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
    currentReportId = null;
    pendingReportSave = null;
    problemInput.value = "";
    resetRating();
    showPanel(container, "idle");
    problemInput.focus();
}

solveButton.addEventListener("click", async function () {
    if (isGeneratingReport) {
        return;
    }

    const problemText = sanitizeProblemText(problemInput.value);

    if (problemText === "") {
        alert("Palun kirjuta oma probleem.");
        return;
    }

    isGeneratingReport = true;
    currentProblemText = problemText;
    resetRating();
    showPanel(loadingDiv, "loading");
    startLoadingProgress();

    try {
        const [report] = await Promise.all([
            fetchGeneratedReport(problemText),
            new Promise(function (resolve) {
                window.setTimeout(resolve, MIN_SOLVE_DURATION);
            })
        ]);

        stopLoadingProgress();
        setLoadingProgress(1);
        populateReport(report);
        queueReportPersistence(report);
        await settleReportSaveAfterLoading();
        showPanel(solutionDiv, "done");
    } finally {
        isGeneratingReport = false;
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
startSolvedCountSync();

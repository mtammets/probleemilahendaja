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

let solveTimer;
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

const COUNTER_BASE = 1284320;
const COUNTER_EPOCH = Date.UTC(2026, 0, 1, 9, 0, 0);
const SOLVE_DURATION = 5000;
const REMOTE_METRICS_REFRESH_INTERVAL = 15000;
const numberFormatter = new Intl.NumberFormat("et-EE");
const sections = [container, loadingDiv, solutionDiv, reportDiv];

const CATEGORY_RULES = [
    {
        label: "Töö ja vastutus",
        meta: "Peamine surve on seotud ootuste, vastutuse või tähtajaga.",
        keywords: ["töö", "projekt", "tähtaeg", "klient", "boss", "juht", "koosolek", "kolleeg", "karjäär"],
        analysis: "Probleemi keskmes on tööalane pinge, kus ootused või prioriteedid vajasid selgemat järjestust.",
        summary: "Olukord stabiliseerus, prioriteedid muutusid selgemaks ning tööalane pinge taandus juhitavale tasemele."
    },
    {
        label: "Raha ja kohustused",
        meta: "Peamine pinge tuleb kuludest, kohustustest või rahalisest ebakindlusest.",
        keywords: ["raha", "palk", "eelarve", "võlg", "laen", "arve", "kulud", "sissetulek", "makse"],
        analysis: "Probleemi keskmes on rahaline surve, kus selgus pidi tulema numbritest, piiridest ja otsustusjärjekorrast.",
        summary: "Rahaga seotud ebakindlus vähenes, olukord muutus arusaadavamaks ning kontrollitunne taastus."
    },
    {
        label: "Suhted ja suhtlus",
        meta: "Pinge tuleb inimestevahelisest ebaselgusest, konfliktist või ootuste erinevusest.",
        keywords: ["suhe", "partner", "sõber", "pere", "ema", "isa", "abikaasa", "tüli", "konflikt", "suhtlus"],
        analysis: "Probleemi keskmes oli suhe või suhtlus, kus lahendus nõudis esmalt selget sõnastust ja rahulikumat vaadet.",
        summary: "Suhtluses tekkis suurem selgus, pinge vähenes ning olukord liikus tasakaalukama tulemuse suunas."
    },
    {
        label: "Tervis ja koormus",
        meta: "Pinge viitab ülekoormusele, taastumise puudusele või sisemisele pingele.",
        keywords: ["stress", "ärevus", "väsimus", "tervis", "uni", "läbipõlemine", "kurnatus", "pinge", "depressioon"],
        analysis: "Probleemi keskmes oli koormus või sisemine pinge, mis vajas esmalt stabiliseerimist ja rahunemist.",
        summary: "Koormus sai selgema kuju, pinge vähenes ning olukord muutus rahulikumaks ja paremini juhitavaks."
    },
    {
        label: "Otsus ja suunavalik",
        meta: "Põhiküsimus on valikus, suunamuutuses või otsustusjulguses.",
        keywords: ["otsus", "valik", "valima", "kas", "kolida", "lahkuda", "jääda", "suund", "variant"],
        analysis: "Probleemi keskmes oli otsus, kus pinge ei tulenenud valikute puudumisest, vaid sellest, et suund polnud veel piisavalt selge.",
        summary: "Otsuse suund muutus selgemaks, ebakindlus taandus ning olukord jõudis kindlama lahenduseni."
    }
];

const RATING_MESSAGES = {
    1: "Tagasiside salvestatud. Tulemus ei vastanud ootusele.",
    2: "Tagasiside salvestatud. Tulemus jäi pigem nõrgaks.",
    3: "Tagasiside salvestatud. Tulemus oli rahuldav.",
    4: "Tagasiside salvestatud. Tulemus oli tugev ja selge.",
    5: "Tagasiside salvestatud. Tulemus vastas väga hästi ootusele."
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
        const progress = Math.min(1, (now - startTime) / SOLVE_DURATION);
        setLoadingProgress(progress);

        if (progress < 1) {
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
        meta: "Olukorra tuum sai selge kuju ning lahendus kujunes positiivseks.",
        analysis: "Probleemi keskmes oli ebaselgus või kuhjunud pinge, mis vajas struktureerimist ja rahulikumat vaadet.",
        summary: "Algne segadus taandus, olukord muutus arusaadavamaks ning tulemus jõudis selgema tasakaaluni."
    };
}

function getClarity(problemText) {
    const wordCount = problemText.split(/\s+/).filter(Boolean).length;

    if (wordCount >= 22) {
        return {
            value: "Väga hea",
            meta: "Kirjeldus oli piisavalt konkreetne ning kokkuvõte mõjub veenva ja kindlana."
        };
    }

    if (wordCount >= 10) {
        return {
            value: "Hea",
            meta: "Probleem oli piisavalt selge, et kokkuvõte saaks olla kindel ja terviklik."
        };
    }

    return {
        value: "Positiivne",
        meta: "Ka lühike kirjeldus võimaldas anda selge ja lõpetatud kokkuvõtte."
    };
}

function buildReport(problemText) {
    const cleanProblem = sanitizeProblemText(problemText);
    const category = detectCategory(cleanProblem);
    const clarity = getClarity(cleanProblem);
    const shortProblem = truncate(cleanProblem, 220);

    return {
        title: "Raport on valmis",
        lead: "Sisestatud olukorra põhjal valmis kokkuvõte, mis kirjeldab probleemi tuuma ja kinnitab lahenduse tulemust.",
        statusValue: "Lahendatud",
        statusMeta: "Olukord jõudis selge tulemuseni ning probleem loetakse lahendatuks.",
        typeValue: category.label,
        typeMeta: category.meta,
        clarityValue: clarity.value,
        clarityMeta: clarity.meta,
        originalProblem: shortProblem,
        analysis: category.analysis + " Lahenduse tugevus seisnes selles, et olukorra põhjus muutus selgelt nähtavaks.",
        resolution: "Jah. Probleem on lahendatud ning olukord on liikunud selgema, rahulikuma ja positiivsema tulemuse suunas.",
        summary: category.summary
    };
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

    ratingButtons.forEach(function (button) {
        button.classList.remove("is-selected");
        button.setAttribute("aria-pressed", "false");
    });

    ratingFeedback.textContent = "Vali hinnang 1 kuni 5.";
}

function setRating(rating) {
    selectedRating = rating;

    ratingButtons.forEach(function (button) {
        const buttonRating = Number(button.dataset.rating);
        const isSelected = buttonRating === rating;

        button.classList.toggle("is-selected", isSelected);
        button.setAttribute("aria-pressed", String(isSelected));
    });

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
    window.clearTimeout(solveTimer);
    stopLoadingProgress();
    setLoadingProgress(0);
    currentProblemText = "";
    currentReportId = null;
    pendingReportSave = null;
    problemInput.value = "";
    resetRating();
    showPanel(container, "idle");
    problemInput.focus();
}

solveButton.addEventListener("click", function () {
    const problemText = sanitizeProblemText(problemInput.value);

    if (problemText === "") {
        alert("Palun kirjuta oma probleem.");
        return;
    }

    const report = buildReport(problemText);

    currentProblemText = problemText;
    populateReport(report);
    resetRating();
    queueReportPersistence(report);
    window.clearTimeout(solveTimer);
    showPanel(loadingDiv, "loading");
    startLoadingProgress();

    solveTimer = window.setTimeout(async function () {
        stopLoadingProgress();
        setLoadingProgress(1);
        await settleReportSaveAfterLoading();
        showPanel(solutionDiv, "done");
    }, SOLVE_DURATION);
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

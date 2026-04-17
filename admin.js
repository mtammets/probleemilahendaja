const loginCard = document.getElementById("adminLoginCard");
const loginForm = document.getElementById("adminLoginForm");
const loginInput = document.getElementById("adminAccessCode");
const loginFeedback = document.getElementById("adminLoginFeedback");
const adminApp = document.getElementById("adminApp");
const logoutButton = document.getElementById("adminLogoutButton");
const adminMetricsUpdated = document.getElementById("adminMetricsUpdated");
const adminMetricsSummary = document.getElementById("adminMetricsSummary");
const adminMetricsCounts = document.getElementById("adminMetricsCounts");
const adminMetricsCostBreakdown = document.getElementById("adminMetricsCostBreakdown");
const adminMetricsRecent = document.getElementById("adminMetricsRecent");

const createInterviewForm = document.getElementById("createInterviewForm");
const createInterviewEmail = document.getElementById("createInterviewEmail");
const createInterviewName = document.getElementById("createInterviewName");
const createInterviewBrief = document.getElementById("createInterviewBrief");
const createInterviewFeedback = document.getElementById("createInterviewFeedback");
const createStoryKindPersonaButton = document.getElementById("createStoryKindPersona");
const createStoryKindCoverButton = document.getElementById("createStoryKindCover");
const createInviteLinkBox = document.getElementById("createInviteLinkBox");
const createInviteLinkValue = document.getElementById("createInviteLinkValue");
const copyInviteLinkButton = document.getElementById("copyInviteLinkButton");

const interviewFilterBar = document.getElementById("interviewFilterBar");
const interviewList = document.getElementById("interviewList");
const adminEmptyState = document.getElementById("adminEmptyState");
const adminDetail = document.getElementById("adminDetail");
const detailStoryKind = document.getElementById("detailStoryKind");
const detailStatus = document.getElementById("detailStatus");
const detailInvitee = document.getElementById("detailInvitee");
const detailMeta = document.getElementById("detailMeta");
const detailBrief = document.getElementById("detailBrief");
const adminDetailFeedback = document.getElementById("adminDetailFeedback");
const detailProgress = document.getElementById("detailProgress");
const detailInviteLinkBox = document.getElementById("detailInviteLinkBox");
const detailInviteLinkValue = document.getElementById("detailInviteLinkValue");
const detailCopyInviteLinkButton = document.getElementById("detailCopyInviteLinkButton");

const sendInviteButton = document.getElementById("sendInviteButton");
const publishStoryButton = document.getElementById("publishStoryButton");
const deleteInterviewButton = document.getElementById("deleteInterviewButton");

const detailTabPreview = document.getElementById("detailTabPreview");
const detailTabMessages = document.getElementById("detailTabMessages");
const detailTabAssets = document.getElementById("detailTabAssets");
const previewPanel = document.getElementById("previewPanel");
const messagesPanel = document.getElementById("messagesPanel");
const assetsPanel = document.getElementById("assetsPanel");

const inspectorSummary = document.getElementById("inspectorSummary");
const inlineEditorCard = document.getElementById("inlineEditorCard");
const editorFieldLabel = document.getElementById("editorFieldLabel");
const editorFieldHint = document.getElementById("editorFieldHint");
const editorFieldInput = document.getElementById("editorFieldInput");
const saveFieldButton = document.getElementById("saveFieldButton");
const cancelFieldButton = document.getElementById("cancelFieldButton");

const ADMIN_REFRESH_INTERVAL = 5 * 1000;
const DAILY_PERSONA_REFRESH_SIGNAL_KEY = "probleemilahendaja:daily-persona-refresh";
const JOURNALIST_LABEL = "Ajakirjanik Liisi";
const numberFormatter = new Intl.NumberFormat("et-EE");
const usdFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const STORY_KIND = {
    persona: "persona",
    cover: "cover"
};

const FILTERS = [
    {
        id: "review",
        label: "Toimetuses",
        statuses: ["ready_for_review"],
        empty: "Kui keegi saadab loo toimetusele, ilmub see siia."
    },
    {
        id: "active",
        label: "Aktiivsed",
        statuses: ["draft", "invited", "in_progress", "awaiting_images"],
        empty: "Siin on intervjuud, mille link on väljas, aga mida pole veel toimetusele saadetud."
    },
    {
        id: "published",
        label: "Avaldatud",
        statuses: ["published"],
        empty: "Avaldatud lood jäävad siia alles."
    }
];

const TAB_IDS = ["preview", "messages", "assets"];

const FIELD_META = {
    cover: {
        subjectName: { label: "Nimi", hint: "See tekst ilmub kaaneloos nime real.", rows: 2 },
        title: { label: "Pealkiri", hint: "Seda välja coveris enam ei kuvata.", rows: 3 },
        summary: { label: "Sissejuhatus", hint: "Seda välja coveris enam ei kuvata.", rows: 4 }
    },
    persona: {
        theme: { label: "Teema", hint: "Lühike märksõna loosse.", rows: 2 },
        characterName: { label: "Peategelase nimi", hint: "Nimi loos ja pildiallkirjades.", rows: 2 },
        characterMeta: { label: "Meta", hint: "Vanus, roll või koht, kui need on teada.", rows: 3 },
        title: { label: "Pealkiri", hint: "Avalik loo pealkiri.", rows: 3 },
        lead: { label: "Lead", hint: "Esimene sissejuhatav lõik või lause.", rows: 4 },
        highlight: { label: "Tsitaat", hint: "Tugev esiletõstetud lause.", rows: 4 },
        resultNote: { label: "Mis muutus", hint: "Lühike kokkuvõte sellest, mis pärast selgemaks läks.", rows: 4 },
        "paragraphs.0": { label: "Lõik 1", hint: "Esimene põhiteksti lõik.", rows: 5 },
        "paragraphs.1": { label: "Lõik 2", hint: "Teine põhiteksti lõik.", rows: 5 },
        "paragraphs.2": { label: "Lõik 3", hint: "Kolmas põhiteksti lõik.", rows: 5 },
        "paragraphs.3": { label: "Lõik 4", hint: "Neljas põhiteksti lõik.", rows: 5 },
        "galleryCaptions.0": { label: "Pildi allkiri 1", hint: "Esimese lisapildi allkiri.", rows: 3 },
        "galleryCaptions.1": { label: "Pildi allkiri 2", hint: "Teise lisapildi allkiri.", rows: 3 }
    }
};

const state = {
    interviews: [],
    selectedInterviewId: "",
    selectedInterview: null,
    activeFilter: "review",
    activeTab: "preview",
    composeStoryKind: STORY_KIND.persona,
    draftInviteLink: "",
    inviteLinks: {},
    publicSolvedCount: 0,
    adminMetrics: null,
    editor: {
        fieldKey: "",
        value: ""
    }
};

let adminRefreshTimer = 0;
let publicMetricsModulePromise = null;

function presentInterviewMessageContent(message = "") {
    return String(message || "")
        .replaceAll("Probleemilahendaja AI-ajakirjanik", "Probleemilahendaja ajakirjanik Liisi")
        .replaceAll("AI-ajakirjanik", "ajakirjanik Liisi");
}

function setEditorAuthState(nextState) {
    document.body.dataset.editorAuth = nextState;
}

async function loadPublicMetricsModule() {
    if (!publicMetricsModulePromise) {
        publicMetricsModulePromise = import("./supabase.js");
    }

    return publicMetricsModulePromise;
}

function setFeedback(element, message = "", isError = true) {
    if (!element) {
        return;
    }

    element.hidden = !message;
    element.textContent = message;
    element.style.background = message
        ? (isError ? "rgba(255, 241, 235, 0.94)" : "rgba(238, 250, 244, 0.9)")
        : "";
    element.style.color = message
        ? (isError ? "#7d2f1a" : "#17613f")
        : "";
}

async function api(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    let payload = null;

    try {
        payload = await response.json();
    } catch (_error) {
        payload = null;
    }

    if (!response.ok) {
        throw new Error(payload?.error || "Päring ebaõnnestus.");
    }

    return payload;
}

async function copyToClipboard(value) {
    if (!value) {
        return false;
    }

    try {
        await navigator.clipboard.writeText(value);
        return true;
    } catch (_error) {
        return false;
    }
}

function getISOWeekNumber(date) {
    const normalizedDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const weekday = normalizedDate.getUTCDay() || 7;

    normalizedDate.setUTCDate(normalizedDate.getUTCDate() + 4 - weekday);

    const yearStart = new Date(Date.UTC(normalizedDate.getUTCFullYear(), 0, 1));
    return Math.ceil((((normalizedDate - yearStart) / 86400000) + 1) / 7);
}

function formatDateTime(value) {
    if (!value) {
        return "";
    }

    return new Intl.DateTimeFormat("et-EE", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(new Date(value));
}

function formatDate(value) {
    if (!value) {
        return "";
    }

    return new Intl.DateTimeFormat("et-EE", {
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(new Date(value));
}

function formatUsd(value) {
    const amount = Number(value) || 0;

    if (amount > 0 && amount < 0.01) {
        return `$${amount.toFixed(4)}`;
    }

    return usdFormatter.format(amount);
}

function formatCompactMetric(value) {
    return numberFormatter.format(Number(value) || 0);
}

function renderAdminMetricsEmpty(message = "Statistikat ei ole veel saadaval.") {
    if (adminMetricsUpdated) {
        adminMetricsUpdated.textContent = message;
    }

    [adminMetricsSummary, adminMetricsCounts, adminMetricsCostBreakdown, adminMetricsRecent].forEach(function (element) {
        if (!element) {
            return;
        }

        element.replaceChildren();
        const empty = document.createElement("p");
        empty.className = "analytics-empty";
        empty.textContent = message;
        element.append(empty);
    });
}

function buildAnalyticsStatCard(title, value, meta) {
    const card = document.createElement("article");
    const kicker = document.createElement("span");
    const strong = document.createElement("strong");
    const copy = document.createElement("p");

    card.className = "analytics-stat";
    kicker.className = "analytics-stat__label";
    strong.className = "analytics-stat__value";
    copy.className = "analytics-stat__meta";
    kicker.textContent = title;
    strong.textContent = value;
    copy.textContent = meta;
    card.append(kicker, strong, copy);
    return card;
}

function buildAnalyticsMiniCard(title, total, today, extra = "") {
    const card = document.createElement("article");
    const header = document.createElement("div");
    const titleElement = document.createElement("strong");
    const totalElement = document.createElement("span");
    const meta = document.createElement("p");

    card.className = "analytics-mini-card";
    header.className = "analytics-mini-card__header";
    titleElement.textContent = title;
    totalElement.className = "analytics-mini-card__total";
    totalElement.textContent = formatCompactMetric(total);
    meta.className = "analytics-mini-card__meta";
    meta.textContent = `Täna ${formatCompactMetric(today)}`;
    header.append(titleElement, totalElement);
    card.append(header, meta);

    if (extra) {
        const note = document.createElement("p");
        note.className = "analytics-mini-card__note";
        note.textContent = extra;
        card.append(note);
    }

    return card;
}

function renderAdminMetricsSummary(metrics) {
    adminMetricsSummary.replaceChildren();

    const cards = [
        buildAnalyticsStatCard(
            "OpenAI kulu kokku",
            formatUsd(metrics.costs.totalUsd),
            `Täna ${formatUsd(metrics.costs.todayUsd)} · 30 päeva ${formatUsd(metrics.costs.last30DaysUsd)}`
        ),
        buildAnalyticsStatCard(
            "Lahendatud probleemid",
            formatCompactMetric(metrics.counts.solvedProblems.total),
            `Täna ${formatCompactMetric(metrics.counts.solvedProblems.today)}`
        ),
        buildAnalyticsStatCard(
            "Intervjuud",
            formatCompactMetric(metrics.counts.interviews.total),
            `Aktiivsed ${formatCompactMetric(metrics.counts.interviews.active)} · Toimetuses ${formatCompactMetric(metrics.counts.interviews.review)} · Avaldatud ${formatCompactMetric(metrics.counts.interviews.published)}`
        ),
        buildAnalyticsStatCard(
            "AI jooksud",
            formatCompactMetric(metrics.aiRuns.totals.completed),
            `Käib ${formatCompactMetric(metrics.aiRuns.totals.started)} · Ebaõnnestunud ${formatCompactMetric(metrics.aiRuns.totals.failed)}`
        )
    ];

    adminMetricsSummary.append(...cards);
}

function renderAdminMetricsCounts(metrics) {
    adminMetricsCounts.replaceChildren();

    const cards = [
        buildAnalyticsMiniCard("Persooniloo mustandid", metrics.counts.personaDrafts.total, metrics.counts.personaDrafts.today, `Avaldatud persoonilood ${formatCompactMetric(metrics.counts.personaStoriesPublished.total)}`),
        buildAnalyticsMiniCard("Kaaneloo mustandid", metrics.counts.coverDrafts.total, metrics.counts.coverDrafts.today),
        buildAnalyticsMiniCard("Intervjuu järelküsimused", metrics.counts.interviewFollowUps.total, metrics.counts.interviewFollowUps.today),
        buildAnalyticsMiniCard("Kunstiartiklid", metrics.counts.artArticles.total, metrics.counts.artArticles.today),
        buildAnalyticsMiniCard("Horoskoobid", metrics.counts.horoscopes.total, metrics.counts.horoscopes.today),
        buildAnalyticsMiniCard("Ilmatekstid", metrics.counts.weatherTexts.total, metrics.counts.weatherTexts.today),
        buildAnalyticsMiniCard("Ilmapildid", metrics.counts.weatherImages.total, metrics.counts.weatherImages.today),
        buildAnalyticsMiniCard("Lahendatud probleemid", metrics.counts.solvedProblems.total, metrics.counts.solvedProblems.today)
    ];

    adminMetricsCounts.append(...cards);
}

function renderAdminMetricsCosts(metrics) {
    adminMetricsCostBreakdown.replaceChildren();

    const maxCategoryCost = Math.max(1, ...metrics.costs.byCategory.map(function (item) {
        return Number(item.totalUsd) || 0;
    }));
    const topSummary = buildAnalyticsStatCard(
        "Kulu täpsus",
        formatUsd(metrics.costs.exactUsd),
        `Hinnanguline osa ${formatUsd(metrics.costs.estimatedUsd)}`
    );
    topSummary.classList.add("analytics-stat--compact");
    adminMetricsCostBreakdown.append(topSummary);

    metrics.costs.byCategory.forEach(function (item) {
        const row = document.createElement("article");
        const header = document.createElement("div");
        const title = document.createElement("strong");
        const total = document.createElement("span");
        const bar = document.createElement("span");
        const barFill = document.createElement("span");
        const meta = document.createElement("p");

        row.className = "analytics-list-row";
        header.className = "analytics-list-row__header";
        title.textContent = item.label;
        total.textContent = formatUsd(item.totalUsd);
        bar.className = "analytics-bar";
        barFill.className = "analytics-bar__fill";
        barFill.style.width = `${Math.max(6, ((Number(item.totalUsd) || 0) / maxCategoryCost) * 100)}%`;
        meta.className = "analytics-list-row__meta";
        meta.textContent = `Täna ${formatUsd(item.todayUsd)} · 30 päeva ${formatUsd(item.last30DaysUsd)} · Jookse ${formatCompactMetric(item.totalRuns)}`;
        bar.append(barFill);
        header.append(title, total);
        row.append(header, bar, meta);
        adminMetricsCostBreakdown.append(row);
    });

    if (metrics.costs.legacyProblemSolveCount > 0) {
        const note = document.createElement("p");
        note.className = "analytics-footnote";
        note.textContent = `Vanemate probleemilahenduste jaoks lisati hinnanguline kulu ${formatUsd(metrics.costs.legacyProblemSolveCostUsd)} ${formatCompactMetric(metrics.costs.legacyProblemSolveCount)} logita lahenduse põhjal.`;
        adminMetricsCostBreakdown.append(note);
    }
}

function renderAdminMetricsRecent(metrics) {
    adminMetricsRecent.replaceChildren();

    if (!Array.isArray(metrics.aiRuns.recent) || metrics.aiRuns.recent.length === 0) {
        const empty = document.createElement("p");
        empty.className = "analytics-empty";
        empty.textContent = "Hiljutisi AI jookse veel ei ole.";
        adminMetricsRecent.append(empty);
        return;
    }

    metrics.aiRuns.recent.forEach(function (run) {
        const row = document.createElement("article");
        const header = document.createElement("div");
        const title = document.createElement("strong");
        const status = document.createElement("span");
        const meta = document.createElement("p");

        row.className = "analytics-list-row";
        header.className = "analytics-list-row__header";
        title.textContent = run.label;
        status.className = "analytics-pill";
        status.classList.toggle("is-success", run.status === "completed");
        status.classList.toggle("is-danger", run.status === "failed");
        status.textContent = run.status === "completed" ? formatUsd(run.costUsd) : (run.status === "failed" ? "Viga" : "Käib");
        meta.className = "analytics-list-row__meta";
        meta.textContent = [formatDateTime(run.createdAt), run.model, run.costSource === "fallback" ? "hinnanguline" : "täpne"]
            .filter(Boolean)
            .join(" · ");
        header.append(title, status);
        row.append(header, meta);
        adminMetricsRecent.append(row);
    });
}

function renderAdminMetrics() {
    if (!state.adminMetrics) {
        renderAdminMetricsEmpty();
        return;
    }

    renderAdminMetricsSummary(state.adminMetrics);
    renderAdminMetricsCounts(state.adminMetrics);
    renderAdminMetricsCosts(state.adminMetrics);
    renderAdminMetricsRecent(state.adminMetrics);

    if (adminMetricsUpdated) {
        const pricingDate = state.adminMetrics.pricingSnapshot?.checkedAt
            ? formatDate(state.adminMetrics.pricingSnapshot.checkedAt)
            : "";
        adminMetricsUpdated.textContent = [
            state.adminMetrics.generatedAt ? `Uuendatud ${formatDateTime(state.adminMetrics.generatedAt)}` : "",
            pricingDate ? `OpenAI hinnad kontrollitud ${pricingDate}` : ""
        ].filter(Boolean).join(" · ");
    }
}

function translateStatus(status) {
    const map = {
        draft: "Mustand",
        invited: "Link saadetud",
        in_progress: "Vestlus käib",
        awaiting_images: "Pildid ootel",
        ready_for_review: "Toimetuses",
        published: "Avaldatud",
        archived: "Arhiivis",
        cancelled: "Tühistatud"
    };

    return map[status] || status || "Mustand";
}

function translateStoryKind(storyKind) {
    return storyKind === STORY_KIND.cover ? "Kaanelugu" : "Persoonilugu";
}

function getStoryKindDescription(storyKind) {
    return storyKind === STORY_KIND.cover
        ? "Avalehe kaanelugu koos suure hero eelvaatega."
        : "Pikem intervjuupõhine persoonilugu koos fotodega.";
}

function getStatusSteps(interview) {
    const status = interview?.status || "draft";

    return [
        { label: "Link", active: ["invited", "in_progress", "awaiting_images", "ready_for_review", "published"].includes(status) },
        { label: "Vestlus", active: ["in_progress", "awaiting_images", "ready_for_review", "published"].includes(status) },
        { label: "Pildid", active: ["awaiting_images", "ready_for_review", "published"].includes(status) },
        { label: "Toimetus", active: ["ready_for_review", "published"].includes(status) },
        { label: "Avaldatud", active: status === "published" }
    ];
}

function getFilterConfig(filterId) {
    return FILTERS.find(function (filter) {
        return filter.id === filterId;
    }) || FILTERS[0];
}

function getFilteredInterviews() {
    const filterConfig = getFilterConfig(state.activeFilter);
    return state.interviews.filter(function (interview) {
        return filterConfig.statuses.includes(interview.status);
    });
}

function getSelectedInterview() {
    if (!state.selectedInterviewId) {
        return null;
    }

    return state.interviews.find(function (interview) {
        return interview.id === state.selectedInterviewId;
    }) || state.selectedInterview;
}

function shouldReloadSelectedInterviewDetail(nextInterviewSummary) {
    if (!nextInterviewSummary || !state.selectedInterview) {
        return true;
    }

    return state.selectedInterview.updatedAt !== nextInterviewSummary.updatedAt
        || state.selectedInterview.status !== nextInterviewSummary.status
        || state.selectedInterview.storyKind !== nextInterviewSummary.storyKind
        || state.selectedInterview.editorialItemId !== nextInterviewSummary.editorialItemId;
}

function getStoryPayload(interview = null) {
    const payload = interview?.storyPayload && typeof interview.storyPayload === "object"
        ? JSON.parse(JSON.stringify(interview.storyPayload))
        : {};

    if (!payload.storyKind) {
        payload.storyKind = interview?.storyKind || STORY_KIND.persona;
    }

    return payload;
}

function getFieldValue(record, fieldKey) {
    return String(fieldKey.split(".").reduce(function (value, part) {
        if (value == null) {
            return "";
        }

        if (Array.isArray(value)) {
            return value[Number(part)] || "";
        }

        return value[part];
    }, record) || "");
}

function setFieldValue(record, fieldKey, nextValue) {
    const parts = fieldKey.split(".");
    const root = JSON.parse(JSON.stringify(record || {}));
    let current = root;

    for (let index = 0; index < parts.length - 1; index += 1) {
        const part = parts[index];
        const nextPart = parts[index + 1];
        const nextIndex = Number(nextPart);

        if (Array.isArray(current)) {
            const targetIndex = Number(part);

            if (current[targetIndex] == null) {
                current[targetIndex] = Number.isFinite(nextIndex) ? [] : {};
            }

            current = current[targetIndex];
            continue;
        }

        if (current[part] == null) {
            current[part] = Number.isFinite(nextIndex) ? [] : {};
        }

        current = current[part];
    }

    const lastPart = parts[parts.length - 1];

    if (Array.isArray(current)) {
        current[Number(lastPart)] = nextValue;
    } else {
        current[lastPart] = nextValue;
    }

    return root;
}

function getFieldMeta(storyKind, fieldKey) {
    const fieldMap = FIELD_META[storyKind] || FIELD_META.persona;
    return fieldMap[fieldKey] || {
        label: "Muudetav väli",
        hint: "Muuda valitud teksti.",
        rows: 4
    };
}

function getStorySnippet(interview) {
    const storyPayload = getStoryPayload(interview);

    return storyPayload.title
        || storyPayload.summary
        || storyPayload.lead
        || interview.transcriptSummary
        || interview.brief
        || "Intervjuu ootab vastuseid.";
}

function getStoryCoverAsset(interview) {
    const assets = Array.isArray(interview?.assets) ? interview.assets : [];
    const coverSlot = Number(interview?.coverAssetSlot) || 1;

    return assets.find(function (asset) {
        return Number(asset.slot) === coverSlot;
    }) || assets[0] || null;
}

function getSecondaryAssets(interview) {
    const assets = Array.isArray(interview?.assets) ? interview.assets : [];
    const coverAsset = getStoryCoverAsset(interview);

    return assets.filter(function (asset) {
        return asset.id !== coverAsset?.id;
    });
}

function renderStoryKindPicker() {
    [createStoryKindPersonaButton, createStoryKindCoverButton].forEach(function (button) {
        if (!button) {
            return;
        }

        const isActive = button.dataset.storyKind === state.composeStoryKind;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
}

function renderInterviewFilters() {
    interviewFilterBar.replaceChildren();
    const fragment = document.createDocumentFragment();

    FILTERS.forEach(function (filter) {
        const button = document.createElement("button");
        const count = state.interviews.filter(function (interview) {
            return filter.statuses.includes(interview.status);
        }).length;

        button.type = "button";
        button.className = "filter-chip";
        button.classList.toggle("is-active", state.activeFilter === filter.id);
        button.textContent = `${filter.label} · ${count}`;
        button.addEventListener("click", function () {
            state.activeFilter = filter.id;
            const filteredInterviews = getFilteredInterviews();

            if (!filteredInterviews.some(function (interview) {
                return interview.id === state.selectedInterviewId;
            })) {
                state.selectedInterviewId = filteredInterviews[0]?.id || "";
            }

            renderInterviewFilters();
            renderInterviewList();
            if (state.selectedInterviewId) {
                void loadInterviewDetail(state.selectedInterviewId);
            } else {
                state.selectedInterview = null;
                renderDetail();
            }
        });

        fragment.append(button);
    });

    interviewFilterBar.append(fragment);
}

function renderInterviewList() {
    interviewList.replaceChildren();

    const interviews = getFilteredInterviews();

    if (interviews.length === 0) {
        const empty = document.createElement("p");
        empty.className = "queue-empty";
        empty.textContent = getFilterConfig(state.activeFilter).empty;
        interviewList.append(empty);
        return;
    }

    const fragment = document.createDocumentFragment();

    interviews.forEach(function (interview) {
        const button = document.createElement("button");
        const header = document.createElement("div");
        const meta = document.createElement("div");
        const title = document.createElement("strong");
        const badges = document.createElement("div");
        const storyKindBadge = document.createElement("span");
        const statusBadge = document.createElement("span");
        const snippet = document.createElement("p");

        button.type = "button";
        button.className = "queue-item";
        button.classList.toggle("is-selected", interview.id === state.selectedInterviewId);

        header.className = "queue-item__header";
        meta.className = "queue-item__meta";
        badges.className = "queue-item__badges";
        storyKindBadge.className = "mini-pill";
        statusBadge.className = "mini-pill mini-pill--soft";
        snippet.className = "queue-item__snippet";

        title.textContent = interview.inviteName || interview.subjectName || interview.inviteEmail;
        storyKindBadge.textContent = translateStoryKind(interview.storyKind);
        statusBadge.textContent = translateStatus(interview.status);
        meta.textContent = interview.inviteEmail;
        snippet.textContent = getStorySnippet(interview);

        badges.append(storyKindBadge, statusBadge);
        header.append(title, badges);
        button.append(header, meta, snippet);
        button.addEventListener("click", function () {
            void loadInterviewDetail(interview.id);
        });

        fragment.append(button);
    });

    interviewList.append(fragment);
}

function buildEditableElement(tagName, className, fieldKey, storyKind, value) {
    const element = document.createElement(tagName);
    const meta = getFieldMeta(storyKind, fieldKey);

    element.className = `${className} preview-editable`;
    element.dataset.editKey = fieldKey;
    element.dataset.editLabel = meta.label;
    element.dataset.editHint = meta.hint;
    element.dataset.editRows = String(meta.rows || 4);
    element.textContent = value || "Puudub";

    if (!value) {
        element.classList.add("is-placeholder");
    }

    return element;
}

function renderCoverPreview(interview, storyPayload) {
    const shell = document.createElement("article");
    const coverAsset = getStoryCoverAsset(interview);
    const frame = document.createElement("div");
    const hero = document.createElement("header");
    const folio = document.createElement("div");
    const folioDate = document.createElement("span");
    const folioIssue = document.createElement("span");
    const brand = document.createElement("div");
    const brandCopy = document.createElement("div");
    const kicker = document.createElement("span");
    const wordmark = document.createElement("h1");
    const wordmarkName = document.createElement("span");
    const wordmarkLinePrimary = document.createElement("span");
    const wordmarkLineAccent = document.createElement("span");
    const coverline = document.createElement("div");
    const subject = buildEditableElement("p", "intake-coverline__name", "subjectName", STORY_KIND.cover, storyPayload.subjectName);
    const counter = document.createElement("div");
    const counterLabel = document.createElement("span");
    const counterValue = document.createElement("strong");
    const counterSuffix = document.createElement("span");
    const stage = document.createElement("div");
    const stageInput = document.createElement("div");
    const stageButton = document.createElement("div");
    const today = new Date();

    shell.className = "cover-preview cover-preview-live";
    frame.className = "cover-preview-live__panel-frame";
    hero.className = "intake-hero";
    folio.className = "intake-folio";
    folioDate.className = "intake-folio__date";
    folioIssue.className = "intake-folio__issue";
    brand.className = "brand-lockup";
    brandCopy.className = "brand-lockup__copy";
    kicker.className = "brand-kicker";
    wordmark.className = "brand-wordmark brand-wordmark--hero";
    wordmarkName.className = "brand-wordmark__name";
    wordmarkLinePrimary.className = "brand-wordmark__line";
    wordmarkLineAccent.className = "brand-wordmark__line brand-wordmark__line--accent";
    coverline.className = "intake-coverline";
    counter.className = "counter-line";
    counterLabel.className = "counter-line__label";
    counterValue.className = "counter-line__value";
    counterSuffix.className = "counter-line__suffix";
    stage.className = "cover-preview-live__stage-frame";
    stageInput.className = "cover-preview-live__input";
    stageButton.className = "cover-preview-live__button";

    if (coverAsset?.previewUrl) {
        hero.style.setProperty("--intake-hero-image", `url("${coverAsset.previewUrl}")`);
    }

    folioDate.textContent = formatDate(today);
    folioIssue.textContent = "Nr " + getISOWeekNumber(today);
    kicker.textContent = "Eesti digiajakiri";
    wordmarkLinePrimary.textContent = "Probleemi";
    wordmarkLineAccent.textContent = "lahendaja";
    counterLabel.textContent = "Kokku lahendatud";
    counterValue.textContent = numberFormatter.format(Math.max(0, Number(state.publicSolvedCount) || 0));
    counterSuffix.textContent = "Probleemi";
    stageInput.textContent = "Kirjuta oma probleem siia...";
    stageButton.textContent = "Lahenda probleem!";

    folio.append(folioDate, folioIssue);
    wordmarkName.append(wordmarkLinePrimary, wordmarkLineAccent);
    wordmark.append(wordmarkName);
    coverline.append(subject);
    brandCopy.append(kicker, wordmark, coverline);
    brand.append(brandCopy);
    counter.append(counterLabel, counterValue, counterSuffix);
    hero.append(folio, brand, counter);
    stage.append(stageInput, stageButton);
    frame.append(hero, stage);
    shell.append(frame);

    return shell;
}

function renderPersonaPreview(interview, storyPayload) {
    const shell = document.createElement("article");
    const coverAsset = getStoryCoverAsset(interview);
    const hero = document.createElement("div");
    const image = document.createElement("img");
    const body = document.createElement("div");
    const meta = document.createElement("div");
    const theme = buildEditableElement("span", "persona-preview__theme", "theme", STORY_KIND.persona, storyPayload.theme);
    const date = document.createElement("span");
    const character = buildEditableElement("p", "persona-preview__character", "characterName", STORY_KIND.persona, storyPayload.characterName);
    const characterMeta = buildEditableElement("p", "persona-preview__character-meta", "characterMeta", STORY_KIND.persona, storyPayload.characterMeta);
    const title = buildEditableElement("h2", "persona-preview__title", "title", STORY_KIND.persona, storyPayload.title);
    const lead = buildEditableElement("p", "persona-preview__lead", "lead", STORY_KIND.persona, storyPayload.lead);
    const highlight = buildEditableElement("blockquote", "persona-preview__highlight", "highlight", STORY_KIND.persona, storyPayload.highlight);
    const paragraphs = document.createElement("div");
    const gallery = document.createElement("div");

    shell.className = "persona-preview";
    hero.className = "persona-preview__hero";
    body.className = "persona-preview__body";
    meta.className = "persona-preview__meta";
    paragraphs.className = "persona-preview__paragraphs";
    gallery.className = "persona-preview__gallery";
    date.className = "persona-preview__date";
    date.textContent = formatDate(interview.publishedAt || new Date().toISOString());

    if (coverAsset?.previewUrl) {
        image.src = coverAsset.previewUrl;
        image.alt = storyPayload.imageAlt || storyPayload.characterName || "Persooniloo pilt";
        image.className = "persona-preview__image";
        hero.append(image);
    } else {
        const placeholder = document.createElement("div");
        placeholder.className = "persona-preview__image persona-preview__image--empty";
        placeholder.textContent = "Pilt lisatakse siia";
        hero.append(placeholder);
    }

    meta.append(theme, date);
    body.append(meta, character, characterMeta, title, lead, highlight);

    [0, 1, 2, 3].forEach(function (index) {
        paragraphs.append(
            buildEditableElement("p", "persona-preview__paragraph", `paragraphs.${index}`, STORY_KIND.persona, storyPayload.paragraphs?.[index] || "")
        );
    });

    body.append(paragraphs);
    body.append(
        buildEditableElement("p", "persona-preview__result", "resultNote", STORY_KIND.persona, storyPayload.resultNote)
    );

    getSecondaryAssets(interview).forEach(function (asset, index) {
        const figure = document.createElement("figure");
        const galleryImage = document.createElement("img");
        const caption = buildEditableElement("figcaption", "persona-preview__caption", `galleryCaptions.${index}`, STORY_KIND.persona, storyPayload.galleryCaptions?.[index] || asset.caption || "");

        figure.className = "persona-preview__gallery-item";
        galleryImage.className = "persona-preview__gallery-image";
        galleryImage.src = asset.previewUrl;
        galleryImage.alt = asset.caption || `Lisapilt ${index + 1}`;
        figure.append(galleryImage, caption);
        gallery.append(figure);
    });

    if (gallery.childElementCount > 0) {
        body.append(gallery);
    }

    shell.append(hero, body);
    return shell;
}

function renderPreviewPanel() {
    previewPanel.replaceChildren();
    const interview = state.selectedInterview;

    if (!interview) {
        return;
    }

    const storyPayload = getStoryPayload(interview);
    const hasDraft = Boolean(storyPayload.title || storyPayload.summary || storyPayload.lead);
    const header = document.createElement("div");
    const kicker = document.createElement("span");
    const title = document.createElement("h3");
    const note = document.createElement("p");

    header.className = "panel-head";
    kicker.className = "section-kicker";
    title.textContent = "Avalik eelvaade";
    note.className = "muted-copy";
    kicker.textContent = interview.storyKind === STORY_KIND.cover ? "Kodulehe kaanelugu" : "Kodulehe persoonilugu";
    note.textContent = hasDraft
        ? "Puuduta pealkirja, lõiku või tsitaati, et seda muuta."
        : "Kui lugu pole veel toimetusse jõudnud, tekib eelvaade siia automaatselt pärast saatmist.";
    header.append(kicker, title, note);
    previewPanel.append(header);

    if (!hasDraft) {
        const empty = document.createElement("div");
        empty.className = "preview-empty";
        empty.textContent = "Selle loo eelvaade ilmub siia siis, kui intervjueeritav on vastused ja pildid toimetusele saatnud.";
        previewPanel.append(empty);
        return;
    }

    previewPanel.append(
        interview.storyKind === STORY_KIND.cover
            ? renderCoverPreview(interview, storyPayload)
            : renderPersonaPreview(interview, storyPayload)
    );
}

function renderMessagesPanel() {
    messagesPanel.replaceChildren();
    const interview = state.selectedInterview;
    const header = document.createElement("div");
    const kicker = document.createElement("span");
    const title = document.createElement("h3");
    const body = document.createElement("div");
    const messages = Array.isArray(interview?.messages) ? interview.messages : [];

    header.className = "panel-head";
    kicker.className = "section-kicker";
    title.textContent = "Vestlus";
    kicker.textContent = "Intervjuu transkript";
    header.append(kicker, title);
    body.className = "conversation-log conversation-log--admin";
    messagesPanel.append(header, body);

    if (messages.length === 0) {
        const empty = document.createElement("p");
        empty.className = "queue-empty";
        empty.textContent = "Vestlus ilmub siia siis, kui link avatakse ja intervjuu algab.";
        body.append(empty);
        return;
    }

    const fragment = document.createDocumentFragment();

    messages.forEach(function (message) {
        const item = document.createElement("article");
        const role = document.createElement("span");
        const content = document.createElement("p");

        item.className = "conversation-bubble";
        item.dataset.role = message.role;
        role.className = "conversation-bubble__role";
        content.className = "conversation-bubble__content";
        role.textContent = message.role === "assistant" ? JOURNALIST_LABEL : "Intervjueeritav";
        content.textContent = presentInterviewMessageContent(message.content || "");
        item.append(role, content);
        fragment.append(item);
    });

    body.append(fragment);
}

function renderAssetsPanel() {
    assetsPanel.replaceChildren();
    const interview = state.selectedInterview;
    const assets = Array.isArray(interview?.assets) ? interview.assets : [];
    const header = document.createElement("div");
    const kicker = document.createElement("span");
    const title = document.createElement("h3");
    const note = document.createElement("p");
    const grid = document.createElement("div");

    header.className = "panel-head";
    kicker.className = "section-kicker";
    title.textContent = "Pildid";
    note.className = "muted-copy";
    grid.className = "asset-grid asset-grid--editor";
    kicker.textContent = "Visuaalid";
    note.textContent = interview.storyKind === STORY_KIND.cover
        ? "Vali, kumb üles laaditud pilt läheb avalehe kaaneloosse."
        : "Vali, kumb pilt läheb loo põhifotoks. Teine jääb loo galeriisse.";
    header.append(kicker, title, note);
    assetsPanel.append(header, grid);

    if (assets.length === 0) {
        const empty = document.createElement("p");
        empty.className = "queue-empty";
        empty.textContent = "Pildid ilmuvad siia pärast üleslaadimist.";
        grid.append(empty);
        return;
    }

    assets.forEach(function (asset) {
        const card = document.createElement("article");
        const image = document.createElement("img");
        const titleElement = document.createElement("strong");
        const caption = document.createElement("p");
        const button = document.createElement("button");
        const isCover = Number(asset.slot) === Number(interview.coverAssetSlot || 1);

        card.className = "asset-card asset-card--editor";
        image.src = asset.previewUrl;
        image.alt = asset.caption || `Pilt ${asset.slot}`;
        titleElement.textContent = `Pilt ${asset.slot}`;
        caption.className = "asset-card__caption";
        caption.textContent = asset.caption || "Kirjeldus puudub.";
        button.type = "button";
        button.className = isCover ? "primary-button" : "ghost-button";
        button.textContent = isCover ? "Praegune põhifoto" : "Tee põhifotoks";
        button.disabled = isCover;
        button.addEventListener("click", function () {
            void saveCoverAssetSlot(asset.slot);
        });

        card.append(titleElement, image, caption, button);
        grid.append(card);
    });
}

function renderInspectorSummary() {
    inspectorSummary.replaceChildren();
    const interview = state.selectedInterview;

    if (!interview) {
        return;
    }

    const heading = document.createElement("div");
    const kicker = document.createElement("span");
    const title = document.createElement("h3");
    const list = document.createElement("div");

    heading.className = "panel-head";
    kicker.className = "section-kicker";
    title.textContent = "Loo kokkuvõte";
    kicker.textContent = "Valitud intervjuu";
    list.className = "summary-list";
    heading.append(kicker, title);

    [
        ["Tüüp", translateStoryKind(interview.storyKind)],
        ["Staatus", translateStatus(interview.status)],
        ["Nimi", interview.inviteName || interview.subjectName || "Puudub"],
        ["E-post", interview.inviteEmail || "Puudub"],
        ["Fookus", interview.brief || "Fookus puudub"],
        ["Viimati uuendatud", formatDateTime(interview.updatedAt) || "Puudub"]
    ].forEach(function ([label, value]) {
        const row = document.createElement("div");
        const key = document.createElement("span");
        const content = document.createElement("strong");

        row.className = "summary-row";
        key.className = "summary-row__label";
        content.className = "summary-row__value";
        key.textContent = label;
        content.textContent = value;
        row.append(key, content);
        list.append(row);
    });

    inspectorSummary.append(heading, list);
}

function openFieldEditor(fieldKey) {
    const interview = state.selectedInterview;

    if (!interview) {
        return;
    }

    const storyPayload = getStoryPayload(interview);
    const meta = getFieldMeta(interview.storyKind, fieldKey);

    state.editor.fieldKey = fieldKey;
    state.editor.value = getFieldValue(storyPayload, fieldKey);
    editorFieldLabel.textContent = meta.label;
    editorFieldHint.textContent = meta.hint;
    editorFieldInput.rows = meta.rows || 4;
    editorFieldInput.value = state.editor.value;
    inlineEditorCard.hidden = false;
    editorFieldInput.focus();
    editorFieldInput.setSelectionRange(editorFieldInput.value.length, editorFieldInput.value.length);
}

function closeFieldEditor() {
    state.editor.fieldKey = "";
    state.editor.value = "";
    inlineEditorCard.hidden = true;
    editorFieldInput.value = "";
}

async function saveCoverAssetSlot(slot) {
    if (!state.selectedInterview) {
        return;
    }

    const payload = await api(`/api/admin/interviews/${state.selectedInterview.id}`, {
        method: "PATCH",
        body: JSON.stringify({
            coverAssetSlot: slot
        })
    });

    state.selectedInterview = payload.interview || null;
    setFeedback(adminDetailFeedback, "Põhifoto uuendatud.", false);
    renderDetail();
    await loadInterviewList();
}

async function saveSelectedField() {
    if (!state.selectedInterview || !state.editor.fieldKey) {
        return;
    }

    const nextStoryPayload = setFieldValue(
        getStoryPayload(state.selectedInterview),
        state.editor.fieldKey,
        editorFieldInput.value
    );

    const payload = await api(`/api/admin/interviews/${state.selectedInterview.id}`, {
        method: "PATCH",
        body: JSON.stringify({
            storyPayload: nextStoryPayload
        })
    });

    state.selectedInterview = payload.interview || null;
    setFeedback(adminDetailFeedback, "Muudatus salvestati.", false);
    renderDetail();
}

function renderActiveTab() {
    const tabMap = {
        preview: previewPanel,
        messages: messagesPanel,
        assets: assetsPanel
    };

    TAB_IDS.forEach(function (tabId) {
        const button = {
            preview: detailTabPreview,
            messages: detailTabMessages,
            assets: detailTabAssets
        }[tabId];
        const panel = tabMap[tabId];
        const isActive = state.activeTab === tabId;

        button?.classList.toggle("is-active", isActive);
        button?.setAttribute("aria-selected", String(isActive));
        if (panel) {
            panel.hidden = !isActive;
        }
    });
}

function renderDetail() {
    const interview = state.selectedInterview;

    if (!interview) {
        adminEmptyState.hidden = false;
        adminDetail.hidden = true;
        return;
    }

    adminEmptyState.hidden = true;
    adminDetail.hidden = false;

    detailStoryKind.textContent = translateStoryKind(interview.storyKind);
    detailStatus.textContent = translateStatus(interview.status);
    detailInvitee.textContent = interview.inviteName || interview.subjectName || interview.inviteEmail;
    detailMeta.textContent = [
        interview.inviteEmail,
        interview.inviteSentAt ? `Link saadetud ${formatDateTime(interview.inviteSentAt)}` : "",
        interview.submittedAt ? `Toimetusse jõudis ${formatDateTime(interview.submittedAt)}` : "",
        interview.publishedAt ? `Avaldatud ${formatDateTime(interview.publishedAt)}` : ""
    ].filter(Boolean).join(" · ");
    detailBrief.textContent = interview.brief || getStoryKindDescription(interview.storyKind);
    sendInviteButton.textContent = interview.inviteReady ? "Saada uuesti" : "Saada link";
    publishStoryButton.textContent = interview.status === "published" ? "Uuenda avaldatud lugu" : "Avalda lugu";
    publishStoryButton.disabled = !(interview.status === "ready_for_review" || interview.status === "published");

    detailProgress.replaceChildren();
    getStatusSteps(interview).forEach(function (step) {
        const item = document.createElement("span");
        item.className = "progress-step";
        item.classList.toggle("is-active", step.active);
        item.textContent = step.label;
        detailProgress.append(item);
    });

    const inviteLink = state.inviteLinks[interview.id] || "";
    detailInviteLinkBox.hidden = !inviteLink;
    detailInviteLinkValue.textContent = inviteLink;

    renderPreviewPanel();
    renderMessagesPanel();
    renderAssetsPanel();
    renderInspectorSummary();
    renderActiveTab();

    if (state.editor.fieldKey) {
        openFieldEditor(state.editor.fieldKey);
    } else {
        inlineEditorCard.hidden = true;
    }
}

async function loadInterviewList() {
    const payload = await api("/api/admin/interviews");
    state.interviews = Array.isArray(payload.interviews) ? payload.interviews : [];
    renderInterviewFilters();
    renderInterviewList();

    if (state.selectedInterviewId) {
        const matchingInterview = state.interviews.find(function (item) {
            return item.id === state.selectedInterviewId;
        });

        if (matchingInterview) {
            if (shouldReloadSelectedInterviewDetail(matchingInterview)) {
                await loadInterviewDetail(matchingInterview.id);
            }
            return;
        }
    }

    const filteredInterviews = getFilteredInterviews();

    if (filteredInterviews[0]?.id) {
        await loadInterviewDetail(filteredInterviews[0].id);
        return;
    }

    state.selectedInterviewId = "";
    state.selectedInterview = null;
    renderDetail();
}

async function loadInterviewDetail(interviewId) {
    if (state.selectedInterviewId && state.selectedInterviewId !== interviewId) {
        closeFieldEditor();
    }

    const payload = await api(`/api/admin/interviews/${interviewId}`);
    state.selectedInterviewId = interviewId;
    state.selectedInterview = payload.interview || null;
    renderInterviewList();
    renderDetail();
}

async function publishSelectedInterview() {
    if (!state.selectedInterview) {
        return;
    }

    const payload = await api(`/api/admin/interviews/${state.selectedInterview.id}/publish`, {
        method: "POST",
        body: JSON.stringify({})
    });

    state.selectedInterview = payload.interview || null;
    state.activeFilter = "published";
    window.localStorage.setItem(DAILY_PERSONA_REFRESH_SIGNAL_KEY, String(Date.now()));
    setFeedback(adminDetailFeedback, "Lugu avaldati.", false);
    renderInterviewFilters();
    await loadInterviewList();
    void loadAdminMetrics().catch(function () {
        // Ignore non-blocking metrics refresh errors after publish.
    });
}

async function sendInvite(interviewId) {
    const payload = await api(`/api/admin/interviews/${interviewId}/send`, {
        method: "POST",
        body: JSON.stringify({
            baseUrl: window.location.origin
        })
    });

    if (payload.inviteLink) {
        state.inviteLinks[interviewId] = payload.inviteLink;
    }

    state.selectedInterview = payload.interview || state.selectedInterview;
    setFeedback(
        adminDetailFeedback,
        payload.delivery === "resend" ? "Link saadeti edukalt." : "Resend puudub, kasuta all olevat linki käsitsi.",
        false
    );
    renderDetail();
    await loadInterviewList();
}

async function deleteSelectedInterview() {
    if (!state.selectedInterview) {
        return;
    }

    const interviewLabel = state.selectedInterview.inviteName || state.selectedInterview.subjectName || state.selectedInterview.inviteEmail;
    const confirmed = window.confirm(`Kas kustutada intervjuu "${interviewLabel}"? See eemaldab ka pildid ja võimaliku avaldatud loo.`);

    if (!confirmed) {
        return;
    }

    await api(`/api/admin/interviews/${state.selectedInterview.id}`, {
        method: "DELETE"
    });

    delete state.inviteLinks[state.selectedInterview.id];
    state.selectedInterviewId = "";
    state.selectedInterview = null;
    closeFieldEditor();
    setFeedback(adminDetailFeedback, "Intervjuu kustutati.", false);
    await loadInterviewList();
    void loadAdminMetrics().catch(function () {
        // Ignore non-blocking metrics refresh errors after delete.
    });
}

function isEditingDetailForm() {
    const activeElement = document.activeElement;

    if (!activeElement || !adminDetail.contains(activeElement)) {
        return false;
    }

    return ["INPUT", "TEXTAREA", "SELECT"].includes(activeElement.tagName);
}

function stopAdminRefresh() {
    if (adminRefreshTimer) {
        window.clearInterval(adminRefreshTimer);
        adminRefreshTimer = 0;
    }
}

function startAdminRefresh() {
    stopAdminRefresh();
    adminRefreshTimer = window.setInterval(function () {
        if (adminApp.hidden || document.hidden) {
            return;
        }

        void loadAdminMetrics().catch(function () {
            // Ignore background refresh errors.
        });

        if (isEditingDetailForm()) {
            return;
        }

        void loadInterviewList().catch(function () {
            // Ignore background refresh errors.
        });
    }, ADMIN_REFRESH_INTERVAL);
}

async function refreshPublicSolvedCount() {
    try {
        const publicMetrics = await loadPublicMetricsModule();

        if (!publicMetrics.isSupabaseConfigured) {
            return;
        }

        state.publicSolvedCount = await publicMetrics.fetchSolvedReportsTotal();

        if (!previewPanel.hidden && state.activeTab === "preview" && state.selectedInterview?.storyKind === STORY_KIND.cover) {
            renderPreviewPanel();
        }
    } catch (error) {
        console.error("Failed to refresh public solved count for admin preview.", error);
    }
}

async function loadAdminMetrics() {
    const payload = await api("/api/admin/metrics");
    state.adminMetrics = payload || null;
    renderAdminMetrics();
}

async function checkSession() {
    try {
        const payload = await api("/api/admin/session", {
            method: "GET"
        });

        const authenticated = Boolean(payload.authenticated);
        loginCard.hidden = authenticated;
        adminApp.hidden = !authenticated;

        if (authenticated) {
            setEditorAuthState("unlocked");
            void refreshPublicSolvedCount();
            await loadInterviewList();
            void loadAdminMetrics().catch(function () {
                renderAdminMetricsEmpty("Statistika laadimine ebaõnnestus.");
            });
            startAdminRefresh();
        } else {
            setEditorAuthState("locked");
            stopAdminRefresh();
            state.adminMetrics = null;
            renderAdminMetricsEmpty("Logi sisse, et näha live statistikat.");
        }
    } catch (error) {
        setEditorAuthState("locked");
        loginCard.hidden = false;
        adminApp.hidden = true;
        state.adminMetrics = null;
        renderAdminMetricsEmpty("Admini statistika laadimine ebaõnnestus.");
        setFeedback(loginFeedback, error.message);
    }
}

loginForm?.addEventListener("submit", async function (event) {
    event.preventDefault();
    setFeedback(loginFeedback, "");

    try {
        await api("/api/admin/session", {
            method: "POST",
            body: JSON.stringify({
                accessCode: loginInput.value
            })
        });
        loginInput.value = "";
        await checkSession();
    } catch (error) {
        setFeedback(loginFeedback, error.message);
    }
});

logoutButton?.addEventListener("click", async function () {
    await api("/api/admin/session", {
        method: "DELETE",
        body: JSON.stringify({})
    });

    stopAdminRefresh();
    setEditorAuthState("locked");
    state.selectedInterviewId = "";
    state.selectedInterview = null;
    state.adminMetrics = null;
    closeFieldEditor();
    renderAdminMetricsEmpty();
    loginCard.hidden = false;
    adminApp.hidden = true;
});

[createStoryKindPersonaButton, createStoryKindCoverButton].forEach(function (button) {
    button?.addEventListener("click", function () {
        state.composeStoryKind = button.dataset.storyKind === STORY_KIND.cover ? STORY_KIND.cover : STORY_KIND.persona;
        renderStoryKindPicker();
    });
});

createInterviewForm?.addEventListener("submit", async function (event) {
    event.preventDefault();
    setFeedback(createInterviewFeedback, "");
    createInviteLinkBox.hidden = true;

    try {
        const createPayload = await api("/api/admin/interviews", {
            method: "POST",
            body: JSON.stringify({
                email: createInterviewEmail.value,
                inviteName: createInterviewName.value,
                brief: createInterviewBrief.value,
                storyKind: state.composeStoryKind
            })
        });

        const interviewId = createPayload.interview?.id;

        if (!interviewId) {
            throw new Error("Intervjuu loomine ebaõnnestus.");
        }

        const sendPayload = await api(`/api/admin/interviews/${interviewId}/send`, {
            method: "POST",
            body: JSON.stringify({
                baseUrl: window.location.origin
            })
        });

        if (sendPayload.inviteLink) {
            state.draftInviteLink = sendPayload.inviteLink;
            state.inviteLinks[interviewId] = sendPayload.inviteLink;
            createInviteLinkValue.textContent = sendPayload.inviteLink;
            createInviteLinkBox.hidden = false;
        }

        createInterviewName.value = "";
        createInterviewEmail.value = "";
        createInterviewBrief.value = "";
        state.activeFilter = "active";
        setFeedback(createInterviewFeedback, "Link on valmis ja saadetud.", false);
        renderInterviewFilters();
        await loadInterviewList();
        void loadAdminMetrics().catch(function () {
            // Ignore non-blocking metrics refresh errors after invite creation.
        });
        await loadInterviewDetail(interviewId);
    } catch (error) {
        setFeedback(createInterviewFeedback, error.message);
    }
});

copyInviteLinkButton?.addEventListener("click", async function () {
    const success = await copyToClipboard(createInviteLinkValue.textContent || state.draftInviteLink);
    setFeedback(createInterviewFeedback, success ? "Link kopeeriti." : "Linki ei õnnestunud kopeerida.", !success);
});

detailCopyInviteLinkButton?.addEventListener("click", async function () {
    const success = await copyToClipboard(detailInviteLinkValue.textContent);
    setFeedback(adminDetailFeedback, success ? "Link kopeeriti." : "Linki ei õnnestunud kopeerida.", !success);
});

sendInviteButton?.addEventListener("click", function () {
    if (!state.selectedInterview) {
        return;
    }

    setFeedback(adminDetailFeedback, "");
    void sendInvite(state.selectedInterview.id).catch(function (error) {
        setFeedback(adminDetailFeedback, error.message);
    });
});

publishStoryButton?.addEventListener("click", function () {
    void publishSelectedInterview().catch(function (error) {
        setFeedback(adminDetailFeedback, error.message);
    });
});

deleteInterviewButton?.addEventListener("click", function () {
    void deleteSelectedInterview().catch(function (error) {
        setFeedback(adminDetailFeedback, error.message);
    });
});

[detailTabPreview, detailTabMessages, detailTabAssets].forEach(function (button) {
    button?.addEventListener("click", function () {
        state.activeTab = button.dataset.tab;
        renderActiveTab();
    });
});

previewPanel?.addEventListener("click", function (event) {
    const target = event.target.closest("[data-edit-key]");

    if (!target) {
        return;
    }

    openFieldEditor(target.dataset.editKey);
});

saveFieldButton?.addEventListener("click", function () {
    void saveSelectedField().catch(function (error) {
        setFeedback(adminDetailFeedback, error.message);
    });
});

cancelFieldButton?.addEventListener("click", function () {
    closeFieldEditor();
});

document.addEventListener("visibilitychange", function () {
    if (!adminApp.hidden && !document.hidden) {
        void loadAdminMetrics().catch(function () {
            // Ignore passive refresh errors.
        });
        void loadInterviewList().catch(function () {
            // Ignore passive refresh errors.
        });
    }
});

renderStoryKindPicker();
renderAdminMetricsEmpty("Logi sisse, et näha live statistikat.");
void checkSession();

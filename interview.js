import { fetchSolvedReportsTotal } from "./supabase.js";

const token = new URLSearchParams(window.location.search).get("token") || "";

const feedback = document.getElementById("interviewFeedback");
const content = document.getElementById("interviewContent");
const messagesContainer = document.getElementById("publicInterviewMessages");
const messageForm = document.getElementById("interviewMessageForm");
const messageInput = document.getElementById("interviewMessageInput");
const sendButton = document.getElementById("sendInterviewMessageButton");
const uploadSection = document.getElementById("uploadSection");
const previewInterviewButton = document.getElementById("previewInterviewButton");
const submitInterviewButton = document.getElementById("submitInterviewButton");
const storyPreviewSection = document.getElementById("storyPreviewSection");
const storyPreviewNote = document.getElementById("storyPreviewNote");
const storyPreviewContainer = document.getElementById("storyPreviewContainer");
const hidePreviewButton = document.getElementById("hidePreviewButton");
const storyEditorForm = document.getElementById("storyEditorForm");
const storyEditorFields = document.getElementById("storyEditorFields");
const saveStoryEditsButton = document.getElementById("saveStoryEditsButton");
const submittedState = document.getElementById("submittedState");

const uploadRefs = {
    1: {
        container: document.getElementById("uploadFormSlot1"),
        dropzone: document.querySelector("#uploadFormSlot1 .upload-dropzone"),
        replaceButton: document.getElementById("uploadReplaceSlot1"),
        fileInput: document.getElementById("uploadFileSlot1"),
        captionInput: document.getElementById("uploadCaptionSlot1"),
        preview: document.getElementById("uploadPreviewSlot1"),
        status: document.getElementById("uploadStatusSlot1")
    },
    2: {
        container: document.getElementById("uploadFormSlot2"),
        dropzone: document.querySelector("#uploadFormSlot2 .upload-dropzone"),
        replaceButton: document.getElementById("uploadReplaceSlot2"),
        fileInput: document.getElementById("uploadFileSlot2"),
        captionInput: document.getElementById("uploadCaptionSlot2"),
        preview: document.getElementById("uploadPreviewSlot2"),
        status: document.getElementById("uploadStatusSlot2")
    }
};

const STORY_KIND = {
    persona: "persona",
    cover: "cover"
};
const JOURNALIST_LABEL = "Ajakirjanik Liisi";
const numberFormatter = new Intl.NumberFormat("et-EE");

const FIELD_META = {
    cover: {
        subjectName: { label: "Nimi", hint: "See nimi jääb kaaneloo peale.", rows: 2 }
    },
    persona: {
        theme: { label: "Teema", hint: "Lühike märksõna, mis loo avab.", rows: 2 },
        characterName: { label: "Sinu nimi", hint: "Nimi loos ja pildiallkirjades.", rows: 2 },
        characterMeta: { label: "Lühike taust", hint: "Vanus, roll või koht, kui see on oluline.", rows: 3 },
        title: { label: "Pealkiri", hint: "See on loo pealkiri avalikus vaates.", rows: 3 },
        lead: { label: "Sissejuhatus", hint: "Esimene lühike sissejuhatav lõik.", rows: 4 },
        highlight: { label: "Esiletõstetud tsitaat", hint: "Tugev lause, mis loost välja tõuseb.", rows: 4 },
        resultNote: { label: "Mida see lugu näitab", hint: "Lühike kokkuvõttev märkus lõppu.", rows: 4 },
        "paragraphs.0": { label: "Lõik 1", hint: "Esimene põhiteksti lõik.", rows: 5 },
        "paragraphs.1": { label: "Lõik 2", hint: "Teine põhiteksti lõik.", rows: 5 },
        "paragraphs.2": { label: "Lõik 3", hint: "Kolmas põhiteksti lõik.", rows: 5 },
        "paragraphs.3": { label: "Lõik 4", hint: "Neljas põhiteksti lõik.", rows: 5 },
        "galleryCaptions.0": { label: "Lisapildi allkiri", hint: "See tekst ilmub loo sees teise pildi all.", rows: 3 },
        "galleryCaptions.1": { label: "Lisapildi allkiri 2", hint: "Kui loos on teine lisapilt, saad ka selle teksti muuta.", rows: 3 }
    }
};

const state = {
    interview: null,
    shouldScrollToLatestMessage: false,
    previewVisible: false,
    isPreparingPreview: false,
    isSavingStory: false,
    publicSolvedCount: 0,
    storyDraft: null,
    uploads: {
        1: {
            localPreviewUrl: "",
            isUploading: false,
            statusMessage: "",
            isError: false
        },
        2: {
            localPreviewUrl: "",
            isUploading: false,
            statusMessage: "",
            isError: false
        }
    }
};

function presentInterviewMessageContent(message = "") {
    return String(message || "")
        .replaceAll("Probleemilahendaja AI-ajakirjanik", "Probleemilahendaja ajakirjanik Liisi")
        .replaceAll("AI-ajakirjanik", "ajakirjanik Liisi");
}

function setFeedback(message = "", isError = true) {
    feedback.hidden = !message;
    feedback.textContent = message;
    feedback.style.background = message
        ? (isError ? "rgba(255, 241, 235, 0.94)" : "rgba(238, 250, 244, 0.9)")
        : "";
    feedback.style.color = message
        ? (isError ? "#7d2f1a" : "#17613f")
        : "";
}

async function api(url, options = {}) {
    const response = await fetch(url, options);
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

function translateStatus(status) {
    const map = {
        draft: "Ootel",
        invited: "Link avatud",
        in_progress: "Vestlus käib",
        awaiting_images: "Lisa pildid",
        ready_for_review: "Toimetuses",
        published: "Avaldatud"
    };

    return map[status] || status || "Ootel";
}

function translateStoryKind(storyKind) {
    return storyKind === STORY_KIND.cover ? "Kaanelugu" : "Persoonilugu";
}

function canMoveToImages(interview) {
    return Boolean(interview?.canMoveToImages)
        || ["awaiting_images", "ready_for_review", "published"].includes(interview?.status);
}

function hasTwoAssets(interview) {
    return (Array.isArray(interview?.assets) ? interview.assets.length : 0) >= 2;
}

function isSubmitted(interview) {
    return ["ready_for_review", "published"].includes(interview?.status);
}

function isStoryEditable(interview) {
    return Boolean(interview) && !isSubmitted(interview);
}

function setUploadState(slot, patch = {}) {
    state.uploads[slot] = {
        ...state.uploads[slot],
        ...patch
    };
}

function revokeLocalPreview(slot) {
    const previewUrl = state.uploads[slot]?.localPreviewUrl;

    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
    }
}

function setLocalPreview(slot, file) {
    revokeLocalPreview(slot);

    if (!file) {
        setUploadState(slot, {
            localPreviewUrl: ""
        });
        return;
    }

    setUploadState(slot, {
        localPreviewUrl: URL.createObjectURL(file)
    });
}

function setUploadStatus(slot, message = "", isError = false) {
    setUploadState(slot, {
        statusMessage: message,
        isError
    });
}

function scrollMessagesToBottom() {
    messagesContainer.lastElementChild?.scrollIntoView({
        block: "end",
        behavior: "smooth"
    });
}

function scrollPreviewIntoView() {
    storyPreviewSection?.scrollIntoView({
        block: "start",
        behavior: "smooth"
    });
}

function getISOWeekNumber(date) {
    const normalizedDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const weekday = normalizedDate.getUTCDay() || 7;

    normalizedDate.setUTCDate(normalizedDate.getUTCDate() + 4 - weekday);

    const yearStart = new Date(Date.UTC(normalizedDate.getUTCFullYear(), 0, 1));
    return Math.ceil((((normalizedDate - yearStart) / 86400000) + 1) / 7);
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

function getStoryPayload(interview = null) {
    const payload = interview?.storyPayload && typeof interview.storyPayload === "object"
        ? JSON.parse(JSON.stringify(interview.storyPayload))
        : {};

    if (!payload.storyKind) {
        payload.storyKind = interview?.storyKind || STORY_KIND.persona;
    }

    return payload;
}

function hasDraftContent(draft = null, interview = state.interview) {
    const payload = draft || getStoryPayload(interview);

    if (!payload || typeof payload !== "object") {
        return false;
    }

    if ((payload.storyKind || interview?.storyKind) === STORY_KIND.cover) {
        return Boolean(payload.subjectName || payload.title || payload.summary);
    }

    return Boolean(
        payload.title
        || payload.lead
        || payload.highlight
        || payload.characterName
        || payload.theme
        || payload.resultNote
        || (Array.isArray(payload.paragraphs) && payload.paragraphs.some(Boolean))
    );
}

function syncStoryDraftFromInterview(interview, force = false) {
    if (!interview) {
        if (force) {
            state.storyDraft = null;
        }
        return;
    }

    if (force || !hasDraftContent(state.storyDraft, interview)) {
        const nextDraft = getStoryPayload(interview);
        state.storyDraft = hasDraftContent(nextDraft, interview) ? nextDraft : null;
    }
}

function getCurrentStoryDraft() {
    if (hasDraftContent(state.storyDraft, state.interview)) {
        return JSON.parse(JSON.stringify(state.storyDraft));
    }

    const fallbackDraft = getStoryPayload(state.interview);
    return hasDraftContent(fallbackDraft, state.interview) ? fallbackDraft : null;
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
        hint: "Muuda selle välja teksti.",
        rows: 4
    };
}

function getStoryCoverAsset(interview) {
    const assets = Array.isArray(interview?.assets) ? interview.assets : [];
    const coverSlot = Number(interview?.coverAssetSlot) === 2 ? 2 : 1;

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

function createPreviewText(tagName, className, value, fallback = "Puudub") {
    const element = document.createElement(tagName);

    element.className = className;
    element.textContent = value || fallback;

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
    const subject = createPreviewText("p", "intake-coverline__name", storyPayload.subjectName);
    const title = createPreviewText("h2", "intake-coverline__title", storyPayload.title);
    const summary = createPreviewText("p", "intake-coverline__summary", storyPayload.summary);
    const counter = document.createElement("div");
    const counterLabel = document.createElement("span");
    const counterValue = document.createElement("strong");
    const counterSuffix = document.createElement("span");
    const stage = document.createElement("div");
    const stageInput = document.createElement("div");
    const stageButton = document.createElement("div");
    const story = document.createElement("section");
    const storyKicker = document.createElement("span");
    const storyLead = createPreviewText("p", "cover-preview-live__story-lead", storyPayload.lead);
    const storyQuote = createPreviewText("blockquote", "cover-preview-live__story-quote", storyPayload.pullQuote);
    const paragraphs = document.createElement("div");
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
    story.className = "cover-preview-live__story";
    storyKicker.className = "cover-preview-live__story-kicker";
    paragraphs.className = "cover-preview-live__story-paragraphs";

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
    storyKicker.textContent = "Loo eelvaade";

    folio.append(folioDate, folioIssue);
    wordmarkName.append(wordmarkLinePrimary, wordmarkLineAccent);
    wordmark.append(wordmarkName);
    coverline.append(subject, title, summary);
    brandCopy.append(kicker, wordmark, coverline);
    brand.append(brandCopy);
    counter.append(counterLabel, counterValue, counterSuffix);
    hero.append(folio, brand, counter);
    stage.append(stageInput, stageButton);

    (Array.isArray(storyPayload.paragraphs) ? storyPayload.paragraphs : []).forEach(function (paragraph) {
        paragraphs.append(createPreviewText("p", "cover-preview-live__story-paragraph", paragraph || "", ""));
    });

    story.append(storyKicker, storyLead, storyQuote, paragraphs);
    frame.append(hero, stage, story);
    shell.append(frame);

    return shell;
}

function renderPersonaPreview(interview, storyPayload) {
    const shell = document.createElement("article");
    const coverAsset = getStoryCoverAsset(interview);
    const hero = document.createElement("div");
    const body = document.createElement("div");
    const meta = document.createElement("div");
    const theme = createPreviewText("span", "persona-preview__theme", storyPayload.theme);
    const date = document.createElement("span");
    const character = createPreviewText("p", "persona-preview__character", storyPayload.characterName);
    const characterMeta = createPreviewText("p", "persona-preview__character-meta", storyPayload.characterMeta);
    const title = createPreviewText("h2", "persona-preview__title", storyPayload.title);
    const lead = createPreviewText("p", "persona-preview__lead", storyPayload.lead);
    const highlight = createPreviewText("blockquote", "persona-preview__highlight", storyPayload.highlight);
    const paragraphs = document.createElement("div");
    const gallery = document.createElement("div");

    shell.className = "persona-preview";
    hero.className = "persona-preview__hero";
    body.className = "persona-preview__body";
    meta.className = "persona-preview__meta";
    paragraphs.className = "persona-preview__paragraphs";
    gallery.className = "persona-preview__gallery";
    date.className = "persona-preview__date";
    date.textContent = formatDate(interview?.publishedAt || new Date().toISOString());

    if (coverAsset?.previewUrl) {
        const image = document.createElement("img");

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
            createPreviewText("p", "persona-preview__paragraph", storyPayload.paragraphs?.[index] || "")
        );
    });

    body.append(paragraphs);
    body.append(
        createPreviewText("p", "persona-preview__result", storyPayload.resultNote)
    );

    getSecondaryAssets(interview).forEach(function (asset, index) {
        const figure = document.createElement("figure");
        const galleryImage = document.createElement("img");
        const caption = createPreviewText("figcaption", "persona-preview__caption", storyPayload.galleryCaptions?.[index] || asset.caption || "", "");

        figure.className = "persona-preview__gallery-item";
        galleryImage.className = "persona-preview__gallery-image";
        galleryImage.src = asset.previewUrl;
        galleryImage.alt = asset.caption || `Lisapilt ${index + 1}`;
        figure.append(galleryImage);

        if (caption.textContent) {
            figure.append(caption);
        }

        gallery.append(figure);
    });

    if (gallery.childElementCount > 0) {
        body.append(gallery);
    }

    shell.append(hero, body);
    return shell;
}

function getEditorFieldKeys(interview, storyDraft) {
    const storyKind = storyDraft?.storyKind || interview?.storyKind || STORY_KIND.persona;

    if (storyKind === STORY_KIND.cover) {
        return ["subjectName"];
    }

    const fieldKeys = [
        "theme",
        "characterName",
        "characterMeta",
        "title",
        "lead",
        "highlight",
        "paragraphs.0",
        "paragraphs.1",
        "paragraphs.2",
        "paragraphs.3",
        "resultNote"
    ];

    getSecondaryAssets(interview).forEach(function (_asset, index) {
        fieldKeys.push(`galleryCaptions.${index}`);
    });

    return fieldKeys;
}

function renderStoryPreview() {
    storyPreviewContainer.replaceChildren();
    const interview = state.interview;
    const storyDraft = getCurrentStoryDraft();

    if (!interview || !storyDraft) {
        return;
    }

    storyPreviewContainer.append(
        (storyDraft.storyKind || interview.storyKind) === STORY_KIND.cover
            ? renderCoverPreview(interview, storyDraft)
            : renderPersonaPreview(interview, storyDraft)
    );
}

function renderStoryEditor() {
    storyEditorFields.replaceChildren();
    const interview = state.interview;
    const storyDraft = getCurrentStoryDraft();
    const editable = isStoryEditable(interview);

    storyEditorForm.hidden = !state.previewVisible || !storyDraft || !editable;

    if (storyEditorForm.hidden || !storyDraft) {
        return;
    }

    const fragment = document.createDocumentFragment();

    getEditorFieldKeys(interview, storyDraft).forEach(function (fieldKey) {
        const meta = getFieldMeta(storyDraft.storyKind || interview.storyKind, fieldKey);
        const field = document.createElement("label");
        const label = document.createElement("span");
        const hint = document.createElement("p");
        const currentValue = getFieldValue(storyDraft, fieldKey);
        const rows = Number(meta.rows) || 4;
        const input = rows <= 2
            ? document.createElement("input")
            : document.createElement("textarea");

        field.className = "field story-editor__field";
        label.textContent = meta.label;
        hint.className = "story-editor__hint";
        hint.textContent = meta.hint;

        if (input.tagName === "TEXTAREA") {
            input.rows = rows;
        } else {
            input.type = "text";
        }

        input.value = currentValue;
        input.placeholder = meta.label;
        input.disabled = state.isSavingStory;
        input.addEventListener("input", function (event) {
            state.storyDraft = setFieldValue(getCurrentStoryDraft() || storyDraft, fieldKey, event.target.value);
            renderStoryPreview();
        });

        field.append(label, input, hint);
        fragment.append(field);
    });

    storyEditorFields.append(fragment);
}

function renderStoryPreviewSection() {
    const storyDraft = getCurrentStoryDraft();
    const interview = state.interview;
    const shouldShow = state.previewVisible && Boolean(interview) && Boolean(storyDraft);

    storyPreviewSection.hidden = !shouldShow;

    if (!shouldShow) {
        storyPreviewContainer.replaceChildren();
        storyEditorFields.replaceChildren();
        return;
    }

    storyPreviewNote.textContent = isStoryEditable(interview)
        ? "Vaata lugu üle. Teksti saad all muuta ja pilte ülal asendada."
        : "Lugu on juba toimetuses. Siin näed seda samas vormis, nagu see avalikult välja hakkab nägema.";

    renderStoryPreview();
    renderStoryEditor();
}

function renderMessages(messages = []) {
    messagesContainer.replaceChildren();

    if (messages.length === 0) {
        const empty = document.createElement("p");

        empty.className = "queue-empty";
        empty.textContent = "Vestlus ilmub siia kohe, kui esimene küsimus on käes.";
        messagesContainer.append(empty);
        return;
    }

    const fragment = document.createDocumentFragment();

    messages.forEach(function (message) {
        const item = document.createElement("article");
        const role = document.createElement("span");
        const contentElement = document.createElement("p");

        item.className = "conversation-bubble";
        item.dataset.role = message.role;
        role.className = "conversation-bubble__role";
        contentElement.className = "conversation-bubble__content";
        role.textContent = message.role === "assistant" ? JOURNALIST_LABEL : "Sina";
        contentElement.textContent = presentInterviewMessageContent(message.content || "");
        item.append(role, contentElement);
        fragment.append(item);
    });

    messagesContainer.append(fragment);

    if (state.shouldScrollToLatestMessage) {
        window.requestAnimationFrame(function () {
            scrollMessagesToBottom();
        });
        state.shouldScrollToLatestMessage = false;
    }
}

function renderUploads(assets = []) {
    const assetsBySlot = new Map(assets.map(function (asset) {
        return [Number(asset.slot), asset];
    }));

    [1, 2].forEach(function (slot) {
        const refs = uploadRefs[slot];
        const asset = assetsBySlot.get(slot);
        const uploadState = state.uploads[slot];
        const previewUrl = asset?.previewUrl || uploadState.localPreviewUrl;
        const previewCaption = asset?.caption || refs.captionInput.value || "";
        const hasImage = Boolean(previewUrl);

        refs.preview.replaceChildren();
        refs.captionInput.value = asset?.caption || refs.captionInput.value || "";
        refs.fileInput.disabled = uploadState.isUploading;
        refs.captionInput.disabled = uploadState.isUploading || isSubmitted(state.interview);
        refs.dropzone.hidden = hasImage;
        refs.replaceButton.hidden = !hasImage || uploadState.isUploading || isSubmitted(state.interview);
        refs.replaceButton.disabled = uploadState.isUploading;
        refs.container.classList.toggle("is-uploading", uploadState.isUploading);
        refs.status.hidden = !uploadState.statusMessage;
        refs.status.textContent = uploadState.statusMessage;
        refs.status.classList.toggle("is-error", uploadState.isError);

        if (previewUrl) {
            const image = document.createElement("img");
            const caption = document.createElement("p");

            image.src = previewUrl;
            image.alt = previewCaption || `Pilt ${slot}`;
            caption.className = "upload-preview__caption";
            caption.textContent = previewCaption || `Pilt ${slot} on lisatud.`;
            refs.preview.append(image, caption);
        }
    });
}

function renderInterview() {
    const interview = state.interview;

    if (!interview) {
        return;
    }

    const lockChat = ["awaiting_images", "ready_for_review", "published"].includes(interview.status);
    const readyForImages = canMoveToImages(interview);
    const submitted = isSubmitted(interview);
    const storyDraft = getCurrentStoryDraft();
    const canPreview = hasTwoAssets(interview) || Boolean(storyDraft);

    content.hidden = false;
    renderMessages(interview.messages || []);
    renderUploads(interview.assets || []);

    messageInput.disabled = lockChat;
    sendButton.disabled = lockChat;
    uploadSection.hidden = !readyForImages || submitted;

    if (previewInterviewButton) {
        previewInterviewButton.hidden = !canPreview || submitted;
        previewInterviewButton.disabled = state.isPreparingPreview;
        previewInterviewButton.textContent = state.isPreparingPreview
            ? "Koostan eelvaadet..."
            : (state.previewVisible ? "Värskenda eelvaadet" : "Vaata eelvaadet");
    }

    submitInterviewButton.disabled = submitted || !hasTwoAssets(interview) || state.isSavingStory || state.isPreparingPreview;
    submittedState.hidden = !submitted;
    submittedState.querySelector("p").textContent = submitted
        ? "Sinu vastused ja pildid on käes. Järgmine samm on toimetuse ülevaatus ja avaldamine."
        : "Sinu vastused ja pildid on käes. Järgmine samm on toimetuse ülevaatus ja avaldamine.";

    saveStoryEditsButton.disabled = state.isSavingStory;
    saveStoryEditsButton.textContent = state.isSavingStory
        ? "Salvestan..."
        : "Salvesta tekstimuudatused";

    if (!state.previewVisible || !storyDraft) {
        storyPreviewSection.hidden = true;
    }

    renderStoryPreviewSection();
}

async function loadPublicMetrics() {
    try {
        state.publicSolvedCount = await fetchSolvedReportsTotal();

        if (state.previewVisible) {
            renderStoryPreview();
        }
    } catch (_error) {
        state.publicSolvedCount = 0;
    }
}

async function loadInterview() {
    if (!token) {
        setFeedback("Intervjuu link puudub.");
        return;
    }

    try {
        const payload = await api(`/api/interview/session?token=${encodeURIComponent(token)}`, {
            method: "GET"
        });

        state.interview = payload.interview || null;
        syncStoryDraftFromInterview(state.interview, false);
        setFeedback("");
        renderInterview();
    } catch (error) {
        setFeedback(error.message);
    }
}

async function uploadSelectedFile(slot) {
    const refs = uploadRefs[slot];
    const file = refs.fileInput.files?.[0];

    if (!file) {
        return;
    }

    setFeedback("");
    setLocalPreview(slot, file);
    setUploadState(slot, {
        isUploading: true
    });
    setUploadStatus(slot, "Laen üles...");
    renderUploads(state.interview?.assets || []);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("caption", refs.captionInput.value);

    try {
        const payload = await api(`/api/interview/session/upload?token=${encodeURIComponent(token)}&slot=${slot}`, {
            method: "POST",
            body: formData
        });

        revokeLocalPreview(slot);
        setUploadState(slot, {
            localPreviewUrl: "",
            isUploading: false
        });
        setUploadStatus(slot, "Pilt on lisatud.", false);
        state.interview = payload.interview || null;
        refs.fileInput.value = "";
        syncStoryDraftFromInterview(state.interview, false);
        renderInterview();

        if (hasTwoAssets(state.interview)) {
            setFeedback("Mõlemad pildid on kohal. Soovi korral vaata eelvaadet ja saada siis lugu toimetusele.", false);
        } else {
            setFeedback(`Pilt ${slot} on lisatud.`, false);
        }
    } catch (error) {
        setUploadState(slot, {
            isUploading: false
        });
        setUploadStatus(slot, error.message, true);
        renderUploads(state.interview?.assets || []);
        setFeedback(error.message);
    }
}

async function preparePreview() {
    const interview = state.interview;

    if (!interview || !hasTwoAssets(interview)) {
        setFeedback("Eelvaate jaoks peavad mõlemad pildid olema lisatud.");
        return;
    }

    const localDraft = getCurrentStoryDraft();

    if (localDraft) {
        state.previewVisible = true;
        renderInterview();
        window.requestAnimationFrame(scrollPreviewIntoView);
        return;
    }

    state.isPreparingPreview = true;
    renderInterview();
    setFeedback("Koostan loo eelvaadet...", false);

    try {
        const payload = await api("/api/interview/session/preview", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                token
            })
        });

        state.interview = payload.interview || null;
        syncStoryDraftFromInterview(state.interview, true);
        state.previewVisible = true;
        renderInterview();
        setFeedback("Eelvaade on valmis. Vajadusel muuda teksti või asenda pilte enne saatmist.", false);
        window.requestAnimationFrame(scrollPreviewIntoView);
    } catch (error) {
        setFeedback(error.message);
    } finally {
        state.isPreparingPreview = false;
        renderInterview();
    }
}

async function saveStoryEdits() {
    const interview = state.interview;
    const storyDraft = getCurrentStoryDraft();

    if (!interview || !storyDraft || !isStoryEditable(interview)) {
        return;
    }

    state.isSavingStory = true;
    renderInterview();
    setFeedback("");

    try {
        const payload = await api("/api/interview/session/story", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                token,
                coverAssetSlot: interview.coverAssetSlot,
                storyPayload: storyDraft
            })
        });

        state.interview = payload.interview || null;
        syncStoryDraftFromInterview(state.interview, true);
        state.previewVisible = true;
        renderInterview();
        setFeedback("Tekstimuudatused on salvestatud.", false);
    } catch (error) {
        setFeedback(error.message);
    } finally {
        state.isSavingStory = false;
        renderInterview();
    }
}

messageForm?.addEventListener("submit", async function (event) {
    event.preventDefault();
    const message = messageInput.value.trim();

    if (!message) {
        setFeedback("Kirjuta enne vastus.");
        return;
    }

    sendButton.disabled = true;
    setFeedback("");

    try {
        const payload = await api("/api/interview/session/message", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                token,
                message
            })
        });

        state.interview = payload.interview || null;
        messageInput.value = "";
        state.shouldScrollToLatestMessage = true;
        syncStoryDraftFromInterview(state.interview, false);
        renderInterview();

        if (payload.readyForImages || canMoveToImages(state.interview)) {
            setFeedback("Vestlus on piisavalt koos. Kui soovid, võid nüüd pildid lisada.", false);
        }
    } catch (error) {
        setFeedback(error.message);
    } finally {
        sendButton.disabled = false;
    }
});

[1, 2].forEach(function (slot) {
    const refs = uploadRefs[slot];

    refs.fileInput?.addEventListener("change", function () {
        void uploadSelectedFile(slot);
    });

    refs.replaceButton?.addEventListener("click", function () {
        refs.fileInput.click();
    });
});

previewInterviewButton?.addEventListener("click", function () {
    void preparePreview();
});

hidePreviewButton?.addEventListener("click", function () {
    state.previewVisible = false;
    renderInterview();
});

saveStoryEditsButton?.addEventListener("click", function () {
    void saveStoryEdits();
});

submitInterviewButton?.addEventListener("click", async function () {
    submitInterviewButton.disabled = true;
    setFeedback("");

    try {
        const payload = await api("/api/interview/session/submit", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                token
            })
        });

        state.interview = payload.interview || null;
        syncStoryDraftFromInterview(state.interview, true);
        renderInterview();
        setFeedback("Vastused on toimetusele saadetud.", false);
    } catch (error) {
        setFeedback(error.message);
    } finally {
        submitInterviewButton.disabled = false;
    }
});

void Promise.all([
    loadInterview(),
    loadPublicMetrics()
]);

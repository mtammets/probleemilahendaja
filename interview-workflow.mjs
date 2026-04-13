import Busboy from "busboy";
import crypto from "node:crypto";

const ADMIN_SESSION_COOKIE = "probleemilahendaja_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12;
const INTERVIEW_TOKEN_TTL_DAYS = 14;
const INTERVIEW_UPLOAD_LIMIT_BYTES = 15 * 1024 * 1024;
const ALLOWED_UPLOAD_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const INTERVIEW_STATUS = {
    draft: "draft",
    invited: "invited",
    inProgress: "in_progress",
    awaitingImages: "awaiting_images",
    readyForReview: "ready_for_review",
    published: "published"
};
const INTERVIEW_STORY_KIND = {
    persona: "persona",
    cover: "cover"
};
const INTERVIEW_JOURNALIST_NAME = "Liisi";

const INTERVIEW_TURN_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["assistantMessage", "readyForImages"],
    properties: {
        assistantMessage: { type: "string" },
        readyForImages: { type: "boolean" }
    }
};

const INTERVIEW_STORY_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: [
        "transcriptSummary",
        "theme",
        "characterName",
        "characterMeta",
        "title",
        "lead",
        "highlight",
        "resultNote",
        "paragraphs",
        "takeaways",
        "readingTime",
        "photoBrief",
        "galleryCaptions",
        "imageAlt"
    ],
    properties: {
        transcriptSummary: { type: "string" },
        theme: { type: "string" },
        characterName: { type: "string" },
        characterMeta: { type: "string" },
        title: { type: "string" },
        lead: { type: "string" },
        highlight: { type: "string" },
        resultNote: { type: "string" },
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
        readingTime: { type: "string" },
        photoBrief: { type: "string" },
        galleryCaptions: {
            type: "array",
            minItems: 2,
            maxItems: 2,
            items: { type: "string" }
        },
        imageAlt: { type: "string" }
    }
};

const INTERVIEW_COVER_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: [
        "transcriptSummary",
        "subjectName",
        "title",
        "summary",
        "lead",
        "paragraphs",
        "pullQuote",
        "photoBrief",
        "imageAlt"
    ],
    properties: {
        transcriptSummary: { type: "string" },
        subjectName: { type: "string" },
        title: { type: "string" },
        summary: { type: "string" },
        lead: { type: "string" },
        paragraphs: {
            type: "array",
            minItems: 3,
            maxItems: 4,
            items: { type: "string" }
        },
        pullQuote: { type: "string" },
        photoBrief: { type: "string" },
        imageAlt: { type: "string" }
    }
};

function parseCookies(headerValue) {
    return String(headerValue || "")
        .split(";")
        .map(function (entry) {
            return entry.trim();
        })
        .filter(Boolean)
        .reduce(function (accumulator, entry) {
            const separatorIndex = entry.indexOf("=");

            if (separatorIndex === -1) {
                return accumulator;
            }

            const key = entry.slice(0, separatorIndex).trim();
            const value = entry.slice(separatorIndex + 1).trim();
            accumulator[key] = decodeURIComponent(value);
            return accumulator;
        }, {});
}

function serializeCookie(name, value, options = {}) {
    const segments = [`${name}=${encodeURIComponent(value)}`];

    if (Number.isFinite(options.maxAge)) {
        segments.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
    }

    if (options.path) {
        segments.push(`Path=${options.path}`);
    }

    if (options.httpOnly) {
        segments.push("HttpOnly");
    }

    if (options.sameSite) {
        segments.push(`SameSite=${options.sameSite}`);
    }

    if (options.secure) {
        segments.push("Secure");
    }

    return segments.join("; ");
}

function signValue(secret, value) {
    return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function createAdminSessionToken(secret) {
    const payload = Buffer.from(JSON.stringify({
        v: 1,
        iat: Date.now(),
        exp: Date.now() + (ADMIN_SESSION_TTL_SECONDS * 1000)
    })).toString("base64url");

    return `${payload}.${signValue(secret, payload)}`;
}

function verifyAdminSessionToken(secret, token) {
    if (!secret || !token || !token.includes(".")) {
        return false;
    }

    const [payload, signature] = token.split(".");
    const expectedSignature = signValue(secret, payload);

    if (!signature || signature !== expectedSignature) {
        return false;
    }

    try {
        const parsedPayload = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        return Number(parsedPayload?.exp) > Date.now();
    } catch (_error) {
        return false;
    }
}

function hashInterviewToken(token) {
    return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function createInterviewToken() {
    return crypto.randomBytes(24).toString("base64url");
}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}

function compactText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeCaptionList(values, maxLength = 180) {
    const list = Array.isArray(values) ? values : [];

    return [0, 1].map(function (index) {
        return compactText(list[index] || "").slice(0, maxLength);
    });
}

function parseJsonOutput(outputText) {
    if (!outputText) {
        throw new Error("Model did not return JSON output.");
    }

    return JSON.parse(outputText);
}

function slugify(value) {
    return compactText(value)
        .toLocaleLowerCase("et-EE")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "persoon";
}

function getMimeExtension(mimeType) {
    if (mimeType === "image/png") {
        return "png";
    }

    if (mimeType === "image/webp") {
        return "webp";
    }

    if (mimeType === "image/avif") {
        return "avif";
    }

    return "jpg";
}

function normalizeStoryKind(value) {
    return compactText(value).toLocaleLowerCase("en-US") === INTERVIEW_STORY_KIND.cover
        ? INTERVIEW_STORY_KIND.cover
        : INTERVIEW_STORY_KIND.persona;
}

function getStoryKindLabel(storyKind) {
    return normalizeStoryKind(storyKind) === INTERVIEW_STORY_KIND.cover
        ? "kaanelugu"
        : "persoonilugu";
}

function getModelVerbosity(model, fallback = "low") {
    return /^gpt-4\.1/i.test(String(model || "")) ? "medium" : fallback;
}

function getUserFacingError(error, fallbackMessage) {
    if (error?.status === 429 || error?.code === "insufficient_quota" || error?.type === "insufficient_quota") {
        return {
            status: 429,
            message: "OpenAI quota on otsas või billing vajab kontrolli. Lisa krediiti või kasuta teist API võtit."
        };
    }

    if (error?.status === 401) {
        return {
            status: 401,
            message: "OpenAI API võti on vigane või puudub."
        };
    }

    if (error?.status === 400 && error?.param) {
        return {
            status: 400,
            message: `OpenAI päring lükati tagasi: ${compactText(error?.message || error?.error?.message || "vigane sisend")}`
        };
    }

    return {
        status: 500,
        message: fallbackMessage
    };
}

async function storageDownloadToBuffer(downloadedFile) {
    if (!downloadedFile) {
        return Buffer.alloc(0);
    }

    if (Buffer.isBuffer(downloadedFile)) {
        return downloadedFile;
    }

    if (downloadedFile instanceof ArrayBuffer) {
        return Buffer.from(downloadedFile);
    }

    if (typeof downloadedFile.arrayBuffer === "function") {
        return Buffer.from(await downloadedFile.arrayBuffer());
    }

    if (typeof downloadedFile.text === "function") {
        return Buffer.from(await downloadedFile.text());
    }

    return Buffer.from(downloadedFile);
}

async function parseSingleImageUpload(request) {
    return await new Promise(function (resolve, reject) {
        const busboy = Busboy({
            headers: request.headers,
            limits: {
                files: 1,
                fileSize: INTERVIEW_UPLOAD_LIMIT_BYTES,
                fields: 8
            }
        });

        const chunks = [];
        let fileSeen = false;
        let mimeType = "";
        let originalFileName = "";
        let caption = "";
        let fileLimitExceeded = false;

        busboy.on("field", function (fieldName, value) {
            if (fieldName === "caption") {
                caption = compactText(value).slice(0, 180);
            }
        });

        busboy.on("file", function (_fieldName, file, info) {
            fileSeen = true;
            mimeType = info?.mimeType || "";
            originalFileName = info?.filename || "upload";

            file.on("data", function (chunk) {
                chunks.push(chunk);
            });

            file.on("limit", function () {
                fileLimitExceeded = true;
            });
        });

        busboy.on("error", reject);
        busboy.on("close", function () {
            if (!fileSeen) {
                reject(new Error("Image file is missing."));
                return;
            }

            if (fileLimitExceeded) {
                reject(new Error("Image file is too large."));
                return;
            }

            resolve({
                buffer: Buffer.concat(chunks),
                mimeType,
                originalFileName,
                caption
            });
        });

        request.pipe(busboy);
    });
}

export function registerInterviewWorkflow(options) {
    const {
        app,
        supabaseAdmin,
        openAiClient,
        resendClient,
        config,
        helpers
    } = options;

    const {
        appBaseUrl,
        adminAccessCode,
        interviewUploadBucketName,
        resendFromEmail,
        interviewerModel,
        interviewStoryModel,
        promptVersions,
        isProduction
    } = config;

    const {
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
        getLocalDateKey,
        editorialStatusPublished,
        dailyCoverStoryStyleVersion,
        dailyPersonaStyleVersion,
        upsertDailyCoverStoryInMemory,
        removeDailyCoverStoryFromMemory,
        upsertDailyPersonaInMemory,
        removeDailyPersonaFromMemory
    } = helpers;

    function ensureAdminConfigured(response) {
        if (!adminAccessCode) {
            response.status(503).json({
                error: "ADMIN_ACCESS_CODE puudub serveri seadistusest."
            });
            return false;
        }

        return true;
    }

    function ensureInterviewWorkflowConfigured(response) {
        if (!isSupabaseAdminConfigured()) {
            response.status(503).json({
                error: "Supabase service role puudub intervjuu-workflow jaoks."
            });
            return false;
        }

        return true;
    }

    function requireAdmin(request, response) {
        if (!ensureAdminConfigured(response) || !ensureInterviewWorkflowConfigured(response)) {
            return false;
        }

        const cookies = parseCookies(request.headers.cookie);
        const token = cookies[ADMIN_SESSION_COOKIE];

        if (!verifyAdminSessionToken(adminAccessCode, token)) {
            response.status(401).json({
                error: "Admini sessioon puudub või on aegunud."
            });
            return false;
        }

        return true;
    }

    function getInterviewStoryKind(interview) {
        return normalizeStoryKind(interview?.story_payload?.storyKind);
    }

    async function fetchInterviewById(id) {
        const { data, error } = await supabaseAdmin
            .from("interviews")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (error) {
            throw error;
        }

        return data || null;
    }

    async function fetchInterviewByToken(token) {
        const normalizedToken = compactText(token);

        if (!normalizedToken) {
            return null;
        }

        const { data, error } = await supabaseAdmin
            .from("interviews")
            .select("*")
            .eq("invite_token_hash", hashInterviewToken(normalizedToken))
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) {
            return null;
        }

        if (!data.invite_token_expires_at || Date.parse(data.invite_token_expires_at) <= Date.now()) {
            return null;
        }

        return data;
    }

    async function fetchInterviewMessages(interviewId) {
        const { data, error } = await supabaseAdmin
            .from("interview_messages")
            .select("id, role, content, metadata, created_at")
            .eq("interview_id", interviewId)
            .order("created_at", { ascending: true });

        if (error) {
            throw error;
        }

        return Array.isArray(data) ? data : [];
    }

    async function fetchInterviewAssets(interviewId) {
        const { data, error } = await supabaseAdmin
            .from("interview_assets")
            .select("id, slot, storage_bucket, storage_path, mime_type, original_file_name, byte_size, caption, created_at")
            .eq("interview_id", interviewId)
            .order("slot", { ascending: true });

        if (error) {
            throw error;
        }

        const assets = Array.isArray(data) ? data : [];

        return await Promise.all(assets.map(async function (asset) {
            const { data: signedData, error: signedError } = await supabaseAdmin.storage
                .from(asset.storage_bucket)
                .createSignedUrl(asset.storage_path, 60 * 60);

            if (signedError) {
                throw signedError;
            }

            return {
                id: asset.id,
                slot: asset.slot,
                mimeType: asset.mime_type,
                originalFileName: asset.original_file_name || "",
                byteSize: Number(asset.byte_size) || 0,
                caption: asset.caption || "",
                createdAt: asset.created_at,
                previewUrl: signedData?.signedUrl || ""
            };
        }));
    }

    async function fetchInterviewAssetStorageRows(interviewId) {
        const { data, error } = await supabaseAdmin
            .from("interview_assets")
            .select("storage_bucket, storage_path")
            .eq("interview_id", interviewId);

        if (error) {
            throw error;
        }

        return Array.isArray(data) ? data : [];
    }

    async function fetchEditorialItemById(editorialItemId) {
        if (!editorialItemId) {
            return null;
        }

        const { data, error } = await supabaseAdmin
            .from("editorial_items")
            .select("id, slug, content_type, date_key, payload")
            .eq("id", editorialItemId)
            .maybeSingle();

        if (error) {
            throw error;
        }

        return data || null;
    }

    async function fetchEditorialMediaStorageRows(editorialItemId) {
        if (!editorialItemId) {
            return [];
        }

        const { data, error } = await supabaseAdmin
            .from("media_assets")
            .select("storage_bucket, storage_path")
            .eq("editorial_item_id", editorialItemId);

        if (error) {
            throw error;
        }

        return Array.isArray(data) ? data : [];
    }

    async function removeStorageObjects(storageRows) {
        const rows = Array.isArray(storageRows) ? storageRows : [];

        if (rows.length === 0) {
            return;
        }

        const buckets = rows.reduce(function (accumulator, row) {
            const bucketName = compactText(row?.storage_bucket);
            const storagePath = compactText(row?.storage_path);

            if (!bucketName || !storagePath) {
                return accumulator;
            }

            if (!accumulator.has(bucketName)) {
                accumulator.set(bucketName, []);
            }

            accumulator.get(bucketName).push(storagePath);
            return accumulator;
        }, new Map());

        for (const [bucketName, paths] of buckets.entries()) {
            const uniquePaths = Array.from(new Set(paths));

            if (uniquePaths.length === 0) {
                continue;
            }

            const { error } = await supabaseAdmin.storage
                .from(bucketName)
                .remove(uniquePaths);

            if (error) {
                throw error;
            }
        }
    }

    async function unlinkPreviousInterviewsFromEditorialItem(editorialItemId, currentInterviewId) {
        if (!editorialItemId || !currentInterviewId) {
            return;
        }

        const { error } = await supabaseAdmin
            .from("interviews")
            .update({
                status: INTERVIEW_STATUS.readyForReview,
                published_at: null,
                editorial_item_id: null
            })
            .eq("editorial_item_id", editorialItemId)
            .neq("id", currentInterviewId);

        if (error) {
            throw error;
        }
    }

    async function insertInterviewMessage(interviewId, role, content, metadata = {}) {
        const { data, error } = await supabaseAdmin
            .from("interview_messages")
            .insert({
                interview_id: interviewId,
                role,
                content: compactText(content).slice(0, 6000),
                metadata
            })
            .select("id, role, content, metadata, created_at")
            .single();

        if (error) {
            throw error;
        }

        return data;
    }

    async function updateInterview(interviewId, values) {
        const { data, error } = await supabaseAdmin
            .from("interviews")
            .update(values)
            .eq("id", interviewId)
            .select("*")
            .single();

        if (error) {
            throw error;
        }

        return data;
    }

    async function ensureOpeningAssistantMessage(interview) {
        const messages = await fetchInterviewMessages(interview.id);

        if (messages.length > 0) {
            return messages;
        }

        const subjectName = compactText(interview.invite_name || interview.subject_name || "");
        const brief = compactText(interview.brief || "");
        const storyKindLabel = getStoryKindLabel(getInterviewStoryKind(interview));
        const openingMessage = [
            subjectName ? `Tere, ${subjectName}.` : "Tere.",
            `Mina olen ${INTERVIEW_JOURNALIST_NAME}, Probleemilahendaja ajakirjanik.`,
            `Teen sinuga rahuliku intervjuu, millest võib sündida ${storyKindLabel}.`,
            brief
                ? `Toimetus tahab eriti hästi mõista teemat: ${brief} Alustuseks kirjelda palun, kuidas see olukord sinu jaoks päriselt välja nägi.`
                : "Alustuseks kirjelda palun oma sõnadega, mis küsimus või pinge sind viimasel ajal päriselt saatnud on."
        ].join(" ");

        await insertInterviewMessage(interview.id, "assistant", openingMessage, {
            stage: "opening"
        });

        return await fetchInterviewMessages(interview.id);
    }

    function buildInterviewTranscript(messages) {
        return messages
            .map(function (message) {
                const label = message.role === "assistant" ? "Ajakirjanik" : "Intervjueeritav";
                return `${label}: ${compactText(message.content)}`;
            })
            .join("\n");
    }

    async function generateFollowUpMessage(interview, messages) {
        const userTurnCount = messages.filter(function (message) {
            return message.role === "user";
        }).length;
        const transcript = buildInterviewTranscript(messages);

        const response = await runWithAiGenerationLog({
            contentType: "interview_turn",
            itemSlug: `interview:${interview.id}`,
            model: interviewerModel,
            promptVersion: promptVersions.interview_turn,
            inputPayload: {
                interviewId: interview.id,
                status: interview.status,
                userTurnCount
            }
        }, async function () {
            return await openAiClient.responses.create({
                model: interviewerModel,
                max_output_tokens: 320,
                instructions: [
                    "Sa oled tugev eestikeelne ajakirjanik, kes teeb sooja ja professionaalse persooniloo eeltööd.",
                    "Sinu eesmärk on koguda ühes realistlikus intervjuus detailid, millest saab hiljem kirjutada usutava ajakirjaliku loo.",
                    "Küsi alati ainult üks järgmine küsimus korraga.",
                    "Ära kirjuta lugu valmis, ära tee kokkuvõtet ja ära anna nõuandeid.",
                    "Küsi loomulikult selliseid asju nagu: kes inimene on, mis olukord oli, mis täpselt kriipis, millal pinge kõige teravamalt välja tuli, mida ta ise märkas, mis muutus pärast lahendust, kuidas see mõjus igapäevaelule.",
                    "Hoia toon inimlik, konkreetne ja rahulik.",
                    "assistantMessage peab olema eesti keeles, 1 kuni 3 lauset ja lõppema ühe selge küsimusega.",
                    "Kui materjali tundub juba piisavalt ja intervjueeritav võiks liikuda piltide laadimise juurde, siis märgi readyForImages = true.",
                    "Tagasta ainult puhas JSON."
                ].join(" "),
                input: [
                    `Admini brief: ${compactText(interview.brief || "puudub")}`,
                    `Intervjueeritava nimi, kui teada: ${compactText(interview.invite_name || interview.subject_name || "teadmata")}`,
                    `Senine vestlus:\n${transcript}`,
                    `Praegune kasutaja vastuste arv: ${userTurnCount}`
                ].join("\n\n"),
                text: {
                    verbosity: getModelVerbosity(interviewerModel, "low"),
                    format: {
                        type: "json_schema",
                        name: "interview_turn",
                        strict: true,
                        schema: INTERVIEW_TURN_JSON_SCHEMA
                    }
                }
            });
        });

        if (response.status && response.status !== "completed") {
            const reason = response.incomplete_details?.reason || response.status;
            throw new Error(`Interview turn incomplete: ${reason}`);
        }

        return parseJsonOutput(response.output_text);
    }

    async function generatePersonaStoryDraft(interview, messages, assets) {
        const transcript = buildInterviewTranscript(messages);
        const assetContext = assets.map(function (asset) {
            return `Foto ${asset.slot}: ${compactText(asset.caption || "kirjeldus puudub")}`;
        }).join("\n");

        const response = await runWithAiGenerationLog({
            contentType: "interview_story",
            itemSlug: `interview:${interview.id}`,
            model: interviewStoryModel,
            promptVersion: promptVersions.interview_story,
            inputPayload: {
                interviewId: interview.id,
                assetCount: assets.length
            }
        }, async function () {
            return await openAiClient.responses.create({
                model: interviewStoryModel,
                max_output_tokens: 1400,
                instructions: [
                    "Kirjuta eestikeelse intervjuu põhjal ajakirjaliku kvaliteediga persooniloo mustand Probleemilahendaja rubriiki.",
                    "Kasuta ainult vestluses antud infot. Ära leiuta eluloolisi fakte, ametinimetusi ega suuri draamasid juurde.",
                    "Toon peab olema konkreetne, inimlik, rahulik ja usutav nagu hästi toimetatud Eesti digi-ajakirja persoonilugu.",
                    "Lugu peab näitama inimest, üht päris probleemi või pinget, olulist selgusehetke ja seda, mis pärast muutus.",
                    "Ära tee reklaami, ära maini AI-d ega loo tegemise protsessi.",
                    "characterMeta peab olema lühike identifitseeriv rida: vanus kui see tuli välja, roll/amet ja koht Eestis. Kui mõni neist puudub, ära leiuta, vaid kasuta ainult teadaolevat.",
                    "title peab olema konkreetne ja ajakirjalik, mitte klikimagnet.",
                    "lead peab olema lühike sissejuhatav lause.",
                    "highlight peab mõjuma nagu loo tugev keskne lause.",
                    "resultNote peab ütlema, mis pärast selgemaks või kergemaks läks.",
                    "paragraphs peab olema täpselt 4 lõiku.",
                    "takeaways peab olema täpselt 3 lühikest rida.",
                    "readingTime peab olema kujul '4 min lugemine'.",
                    "photoBrief peab olema ingliskeelne lühike editorial photography brief, mis sobib selle loo põhjal tehtud fotoseeriaga.",
                    "galleryCaptions peab andma mõlemale kasutaja üles laaditud pildile lühikese ajakirjaliku pildiallkirja. Kui kasutaja kirjeldus on olemas, kasuta seda.",
                    "imageAlt peab kirjeldama peamist portreefotot lühidalt ja arusaadavalt.",
                    "transcriptSummary peab olema üks lühike toimetuslik kokkuvõte.",
                    "Tagasta ainult puhas JSON."
                ].join(" "),
                input: [
                    `Admini brief: ${compactText(interview.brief || "puudub")}`,
                    `Intervjueeritava nimi, kui teada: ${compactText(interview.invite_name || "teadmata")}`,
                    `Vestluse transkript:\n${transcript}`,
                    `Üles laaditud piltide kontekst:\n${assetContext || "Kirjeldused puuduvad."}`
                ].join("\n\n"),
                text: {
                    verbosity: "medium",
                    format: {
                        type: "json_schema",
                        name: "interview_persona_story",
                        strict: true,
                        schema: INTERVIEW_STORY_JSON_SCHEMA
                    }
                }
            });
        });

        if (response.status && response.status !== "completed") {
            const reason = response.incomplete_details?.reason || response.status;
            throw new Error(`Interview story incomplete: ${reason}`);
        }

        return parseJsonOutput(response.output_text);
    }

    async function generateCoverStoryDraft(interview, messages, assets) {
        const transcript = buildInterviewTranscript(messages);
        const assetContext = assets.map(function (asset) {
            return `Foto ${asset.slot}: ${compactText(asset.caption || "kirjeldus puudub")}`;
        }).join("\n");

        const response = await runWithAiGenerationLog({
            contentType: "interview_cover_story",
            itemSlug: `interview:${interview.id}`,
            model: interviewStoryModel,
            promptVersion: `${promptVersions.interview_story}:cover`,
            inputPayload: {
                interviewId: interview.id,
                assetCount: assets.length
            }
        }, async function () {
            return await openAiClient.responses.create({
                model: interviewStoryModel,
                max_output_tokens: 900,
                instructions: [
                    "Kirjuta eestikeelse intervjuu põhjal tugev ja usutav digiajakirja kaaneloo mustand.",
                    "Kasuta ainult vestluses antud infot. Ära mõtle välja eluloolisi detaile, ameteid ega suuri pöördeid.",
                    "Tulemus peab sobima Probleemilahendaja avalehe kaaneloosse.",
                    "subjectName peab olema inimese nimi nii, nagu see vestlusest usutavalt välja tuleb.",
                    "title peab olema lühike, lööv ja ajakirjalik pealkiri.",
                    "summary peab olema üks tugev sissejuhatav coverline, mitte pikk lõik.",
                    "lead peab olema lühike ava-paragrahv, mis tundub nagu luksusajakirja juhtloo algus.",
                    "paragraphs peab olema 3 kuni 4 lühikest lõiku, mis avavad sama lugu edasi ilma uusi fakte juurde leiutamata.",
                    "pullQuote peab olema üks lühike tugev tsitaat, mis põhineb vestluse päris sõnastusel; ära leiuta.",
                    "photoBrief peab olema ingliskeelne 2 kuni 4 lausega editorial cover photography brief, mis kasutab vestluse päris konteksti.",
                    "imageAlt peab kirjeldama peamist portreefotot lühidalt ja arusaadavalt.",
                    "transcriptSummary peab olema üks lühike toimetuslik kokkuvõte.",
                    "Hoia toon inimlik, konkreetne ja elegantne. Ära maini AI-d ega tööprotsessi.",
                    "Tagasta ainult puhas JSON."
                ].join(" "),
                input: [
                    `Admini brief: ${compactText(interview.brief || "puudub")}`,
                    `Intervjueeritava nimi, kui teada: ${compactText(interview.invite_name || "teadmata")}`,
                    `Vestluse transkript:\n${transcript}`,
                    `Üles laaditud piltide kontekst:\n${assetContext || "Kirjeldused puuduvad."}`
                ].join("\n\n"),
                text: {
                    verbosity: "medium",
                    format: {
                        type: "json_schema",
                        name: "interview_cover_story",
                        strict: true,
                        schema: INTERVIEW_COVER_JSON_SCHEMA
                    }
                }
            });
        });

        if (response.status && response.status !== "completed") {
            const reason = response.incomplete_details?.reason || response.status;
            throw new Error(`Interview cover story incomplete: ${reason}`);
        }

        return parseJsonOutput(response.output_text);
    }

    async function generateStoryDraft(interview, messages, assets) {
        return getInterviewStoryKind(interview) === INTERVIEW_STORY_KIND.cover
            ? await generateCoverStoryDraft(interview, messages, assets)
            : await generatePersonaStoryDraft(interview, messages, assets);
    }

    function buildPersonaPublishSlug(interview, story, dateKey) {
        return `interview-persona-${dateKey}-${slugify(story.characterName || interview.invite_name || interview.invite_email)}-${interview.id.slice(0, 8)}`;
    }

    function resolveBaseUrl(baseUrlFromClient, request) {
        const explicitBaseUrl = compactText(appBaseUrl || baseUrlFromClient);

        if (/^https?:\/\//i.test(explicitBaseUrl)) {
            return explicitBaseUrl.replace(/\/$/, "");
        }

        const forwardedProto = compactText(request.headers["x-forwarded-proto"]);
        const forwardedHost = compactText(request.headers["x-forwarded-host"]);
        const host = forwardedHost || compactText(request.headers.host);
        const protocol = forwardedProto || (isProduction ? "https" : "http");

        if (!host) {
            return "";
        }

        return `${protocol}://${host}`;
    }

    function buildInviteEmailHtml(inviteLink, inviteName, storyKind) {
        const safeInviteName = escapeHtml(inviteName || "seal");
        const safeInviteLink = escapeHtml(inviteLink);
        const storyKindLabel = getStoryKindLabel(storyKind);

        return [
            "<div style=\"font-family:Manrope,Arial,sans-serif;max-width:640px;margin:0 auto;color:#1d1d1d;line-height:1.6\">",
            "<h1 style=\"font-size:28px;line-height:1.2;margin:0 0 18px\">Probleemilahendaja intervjuu</h1>",
            `<p style=\"margin:0 0 14px\">Tere, ${safeInviteName}.</p>`,
            `<p style=\"margin:0 0 14px\">Soovime teha sinuga lühikese intervjuu, millest sünnib ${storyKindLabel}. Vestluse viib läbi meie ajakirjanik ${INTERVIEW_JOURNALIST_NAME} ning lõpus saad lisada kaks pilti.</p>`,
            `<p style=\"margin:26px 0\"><a href=\"${safeInviteLink}\" style=\"display:inline-block;padding:14px 22px;background:#111827;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700\">Ava intervjuu</a></p>`,
            `<p style=\"margin:0 0 14px\">Kui nupp ei tööta, kasuta seda linki:<br><a href=\"${safeInviteLink}\">${safeInviteLink}</a></p>`,
            "<p style=\"margin:18px 0 0;color:#5b6472;font-size:14px\">Link on isiklik ja kehtib 14 päeva.</p>",
            "</div>"
        ].join("");
    }

    function normalizeInterviewList(values, count, maxLength, fallbackValue = "") {
        const list = Array.isArray(values) ? values : [];

        return Array.from({ length: count }, function (_entry, index) {
            return normalizeField(list[index], fallbackValue, maxLength);
        });
    }

    function buildInterviewDraftFallbacks(rawDraft, interview) {
        const storyKind = getInterviewStoryKind(interview);
        const inviteeName = normalizeField(
            rawDraft?.characterName || rawDraft?.subjectName,
            interview.subject_name || interview.invite_name || interview.invite_email || "Intervjueeritav",
            64
        );
        const summary = normalizeField(
            rawDraft?.transcriptSummary,
            interview.transcript_summary || interview.brief || `${inviteeName} jagab oma kogemust ausalt ja oma sõnadega.`,
            320
        );
        const theme = normalizeField(
            rawDraft?.theme,
            storyKind === INTERVIEW_STORY_KIND.cover ? (interview.brief || "Kaaneintervjuu") : (interview.brief || "Persoonilugu"),
            42
        );

        return {
            storyKind,
            inviteeName,
            summary,
            theme
        };
    }

    function normalizePersonaInterviewStoryDraft(rawDraft, interview, publishedAt = new Date().toISOString()) {
        const dateKey = getLocalDateKey();
        const fallbacks = buildInterviewDraftFallbacks(rawDraft, interview);

        return {
            id: interview.id,
            dateKey,
            storyKind: INTERVIEW_STORY_KIND.persona,
            styleVersion: dailyPersonaStyleVersion,
            publishedAt,
            theme: normalizeField(rawDraft?.theme, fallbacks.theme, 42),
            characterName: fallbacks.inviteeName,
            characterMeta: normalizeField(rawDraft?.characterMeta, "", 72),
            title: normalizeField(rawDraft?.title, fallbacks.summary, 110),
            lead: normalizeField(rawDraft?.lead, fallbacks.summary, 190),
            highlight: normalizeField(rawDraft?.highlight, fallbacks.summary, 190),
            resultNote: normalizeField(rawDraft?.resultNote, "", 210),
            photoBrief: normalizeField(rawDraft?.photoBrief, "", 320),
            paragraphs: normalizeInterviewList(rawDraft?.paragraphs, 4, 360, ""),
            takeaways: normalizeInterviewList(rawDraft?.takeaways, 3, 54, ""),
            readingTime: normalizeField(rawDraft?.readingTime, "4 min lugemine", 32),
            imageUrl: normalizeField(rawDraft?.imageUrl || rawDraft?.image_url, "", 500),
            imageAlt: normalizeField(rawDraft?.imageAlt || rawDraft?.image_alt, "", 180),
            imageObjectPosition: normalizeField(rawDraft?.imageObjectPosition || rawDraft?.image_object_position, "", 32),
            galleryImages: Array.isArray(rawDraft?.galleryImages) ? rawDraft.galleryImages : [],
            transcriptSummary: fallbacks.summary,
            galleryCaptions: normalizeCaptionList(rawDraft?.galleryCaptions)
        };
    }

    function normalizeCoverInterviewStoryDraft(rawDraft, interview, publishedAt = new Date().toISOString()) {
        const dateKey = getLocalDateKey();
        const fallbacks = buildInterviewDraftFallbacks(rawDraft, interview);
        const subjectName = normalizeField(rawDraft?.subjectName, fallbacks.inviteeName, 64);

        const normalizedCoverStory = normalizeDailyCoverStoryPayload(dateKey, {
            storyKind: INTERVIEW_STORY_KIND.cover,
            subjectName,
            title: normalizeField(rawDraft?.title, fallbacks.summary, 96),
            summary: normalizeField(rawDraft?.summary, fallbacks.summary, 220),
            lead: normalizeField(rawDraft?.lead, rawDraft?.summary || fallbacks.summary, 220),
            paragraphs: normalizeInterviewList(rawDraft?.paragraphs, 4, 360, ""),
            pullQuote: normalizeField(rawDraft?.pullQuote, "", 220),
            photoBrief: normalizeField(rawDraft?.photoBrief, "", 420),
            imageAlt: normalizeField(rawDraft?.imageAlt, `${subjectName} kaaneloo portree`, 180),
            transcriptSummary: fallbacks.summary
        }, publishedAt);

        return {
            ...normalizedCoverStory,
            storyKind: INTERVIEW_STORY_KIND.cover,
            transcriptSummary: fallbacks.summary
        };
    }

    function normalizeInterviewStoryDraft(rawDraft, interview, publishedAt = new Date().toISOString()) {
        return getInterviewStoryKind(interview) === INTERVIEW_STORY_KIND.cover
            ? normalizeCoverInterviewStoryDraft(rawDraft, interview, publishedAt)
            : normalizePersonaInterviewStoryDraft(rawDraft, interview, publishedAt);
    }

    function hasStoryDraft(interview) {
        const storyKind = getInterviewStoryKind(interview);

        return storyKind === INTERVIEW_STORY_KIND.cover
            ? Boolean(compactText(interview?.story_payload?.title || interview?.story_payload?.summary))
            : Boolean(compactText(interview?.story_payload?.title));
    }

    function isFallbackBackedInterviewDraft(interview) {
        if (!hasStoryDraft(interview)) {
            return false;
        }

        if (getInterviewStoryKind(interview) === INTERVIEW_STORY_KIND.cover) {
            return false;
        }

        const fallbackStory = normalizeDailyPersonaPayload(getLocalDateKey(), {});
        const draft = interview?.story_payload || {};

        return compactText(draft.title) === compactText(fallbackStory?.title)
            && compactText(draft.characterName) === compactText(fallbackStory?.characterName)
            && compactText(draft.theme) === compactText(fallbackStory?.theme);
    }

    function hasUsableStoryDraft(interview) {
        return hasStoryDraft(interview) && !isFallbackBackedInterviewDraft(interview);
    }

    function getInterviewDisplayNameFromDraft(draft, interview) {
        const storyKind = normalizeStoryKind(draft?.storyKind || getInterviewStoryKind(interview));
        const preferredName = storyKind === INTERVIEW_STORY_KIND.cover
            ? draft?.subjectName
            : draft?.characterName;

        return normalizeField(
            preferredName,
            interview?.subject_name || interview?.invite_name || interview?.invite_email || "",
            120
        ) || null;
    }

    async function ensureInterviewStoryDraft(interview, messages = null, assets = null) {
        const resolvedMessages = Array.isArray(messages) ? messages : await fetchInterviewMessages(interview.id);
        const resolvedAssets = Array.isArray(assets) ? assets : await fetchInterviewAssets(interview.id);

        if (resolvedAssets.length < 2) {
            const error = new Error("Enne eelvaadet või saatmist tuleb üles laadida kaks pilti.");
            error.status = 400;
            throw error;
        }

        if (hasUsableStoryDraft(interview)) {
            return {
                interview,
                messages: resolvedMessages,
                assets: resolvedAssets
            };
        }

        const draft = normalizeInterviewStoryDraft(await generateStoryDraft(interview, resolvedMessages, resolvedAssets), interview);
        const updatedInterview = await updateInterview(interview.id, {
            transcript_summary: draft.transcriptSummary || null,
            subject_name: getInterviewDisplayNameFromDraft(draft, interview),
            story_payload: draft
        });

        return {
            interview: updatedInterview,
            messages: resolvedMessages,
            assets: resolvedAssets
        };
    }

    async function submitInterviewForReview(interview, messages = null, assets = null) {
        const prepared = await ensureInterviewStoryDraft(interview, messages, assets);
        const draft = normalizeInterviewStoryDraft(prepared.interview.story_payload, prepared.interview);
        const updatedInterview = await updateInterview(prepared.interview.id, {
            status: INTERVIEW_STATUS.readyForReview,
            submitted_at: prepared.interview.submitted_at || new Date().toISOString(),
            transcript_summary: draft.transcriptSummary || null,
            subject_name: getInterviewDisplayNameFromDraft(draft, prepared.interview),
            story_payload: draft
        });

        return {
            interview: updatedInterview,
            messages: prepared.messages,
            assets: prepared.assets
        };
    }

    function serializeInterviewRow(interview, messages = [], assets = []) {
        const storyPayload = interview?.story_payload && typeof interview.story_payload === "object"
            ? interview.story_payload
            : {};
        const userMessageCount = Array.isArray(messages)
            ? messages.filter(function (message) {
                return message.role === "user";
            }).length
            : 0;
        const canMoveToImages = interview?.status === INTERVIEW_STATUS.awaitingImages
            || interview?.status === INTERVIEW_STATUS.readyForReview
            || interview?.status === INTERVIEW_STATUS.published
            || userMessageCount >= 3
            || Boolean(messages.find(function (message) {
                return message.role === "assistant" && message.metadata?.readyForImages;
            }));

        return {
            id: interview.id,
            inviteEmail: interview.invite_email,
            inviteName: interview.invite_name || "",
            brief: interview.brief || "",
            adminNotes: interview.admin_notes || "",
            status: interview.status,
            storyKind: getInterviewStoryKind(interview),
            subjectName: interview.subject_name || "",
            transcriptSummary: interview.transcript_summary || "",
            coverAssetSlot: Number(interview.cover_asset_slot) || 1,
            inviteSentAt: interview.invite_sent_at,
            startedAt: interview.started_at,
            completedAt: interview.completed_at,
            submittedAt: interview.submitted_at,
            publishedAt: interview.published_at,
            editorialItemId: interview.editorial_item_id || null,
            inviteReady: Boolean(interview.invite_token_hash),
            createdAt: interview.created_at || null,
            updatedAt: interview.updated_at || null,
            userMessageCount,
            canMoveToImages,
            storyPayload,
            messages,
            assets
        };
    }

    app.get("/api/admin/session", async function (request, response) {
        if (!ensureAdminConfigured(response)) {
            return;
        }

        const cookies = parseCookies(request.headers.cookie);
        const isAuthenticated = verifyAdminSessionToken(adminAccessCode, cookies[ADMIN_SESSION_COOKIE]);

        response.json({
            authenticated: isAuthenticated
        });
    });

    app.post("/api/admin/session", async function (request, response) {
        if (!ensureAdminConfigured(response)) {
            return;
        }

        const submittedCode = compactText(request.body?.accessCode);

        if (!submittedCode || submittedCode !== adminAccessCode) {
            response.status(401).json({
                error: "Vale admini ligipääsukood."
            });
            return;
        }

        response.setHeader("Set-Cookie", serializeCookie(ADMIN_SESSION_COOKIE, createAdminSessionToken(adminAccessCode), {
            maxAge: ADMIN_SESSION_TTL_SECONDS,
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
            secure: Boolean(isProduction)
        }));

        response.json({
            authenticated: true
        });
    });

    app.delete("/api/admin/session", async function (_request, response) {
        response.setHeader("Set-Cookie", serializeCookie(ADMIN_SESSION_COOKIE, "", {
            maxAge: 0,
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
            secure: Boolean(isProduction)
        }));

        response.json({
            authenticated: false
        });
    });

    app.get("/api/admin/interviews", async function (request, response) {
        if (!requireAdmin(request, response)) {
            return;
        }

        try {
            const { data, error } = await supabaseAdmin
                .from("interviews")
                .select("id, invite_email, invite_name, brief, status, subject_name, transcript_summary, cover_asset_slot, invite_sent_at, started_at, completed_at, submitted_at, published_at, editorial_item_id, created_at, updated_at, story_payload")
                .order("updated_at", { ascending: false })
                .limit(200);

            if (error) {
                throw error;
            }

            response.json({
                interviews: Array.isArray(data) ? data.map(function (row) {
                    return serializeInterviewRow(row);
                }) : []
            });
        } catch (error) {
            console.error("Failed to load interview list.", error);
            response.status(500).json({
                error: "Intervjuude laadimine ebaõnnestus."
            });
        }
    });

    app.post("/api/admin/interviews", async function (request, response) {
        if (!requireAdmin(request, response)) {
            return;
        }

        const email = compactText(request.body?.email).toLocaleLowerCase("en-US");
        const inviteName = compactText(request.body?.inviteName).slice(0, 120);
        const brief = compactText(request.body?.brief).slice(0, 500);
        const adminNotes = compactText(request.body?.adminNotes).slice(0, 1200);
        const storyKind = normalizeStoryKind(request.body?.storyKind);

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email)) {
            response.status(400).json({
                error: "Sisesta korrektne e-posti aadress."
            });
            return;
        }

        try {
            const { data, error } = await supabaseAdmin
                .from("interviews")
                .insert({
                    invite_email: email,
                    invite_email_normalized: email,
                    invite_name: inviteName || null,
                    brief: brief || null,
                    admin_notes: adminNotes || null,
                    story_payload: {
                        storyKind
                    },
                    status: INTERVIEW_STATUS.draft
                })
                .select("*")
                .single();

            if (error) {
                throw error;
            }

            response.status(201).json({
                interview: serializeInterviewRow(data)
            });
        } catch (error) {
            console.error("Failed to create interview.", error);
            response.status(500).json({
                error: "Intervjuu loomine ebaõnnestus."
            });
        }
    });

    app.get("/api/admin/interviews/:interviewId", async function (request, response) {
        if (!requireAdmin(request, response)) {
            return;
        }

        try {
            const interview = await fetchInterviewById(request.params.interviewId);

            if (!interview) {
                response.status(404).json({
                    error: "Intervjuud ei leitud."
                });
                return;
            }

            const [messages, assets] = await Promise.all([
                fetchInterviewMessages(interview.id),
                fetchInterviewAssets(interview.id)
            ]);

            response.json({
                interview: serializeInterviewRow(interview, messages, assets)
            });
        } catch (error) {
            console.error("Failed to load interview detail.", error);
            response.status(500).json({
                error: "Intervjuu detailide laadimine ebaõnnestus."
            });
        }
    });

    app.patch("/api/admin/interviews/:interviewId", async function (request, response) {
        if (!requireAdmin(request, response)) {
            return;
        }

        try {
            const interview = await fetchInterviewById(request.params.interviewId);

            if (!interview) {
                response.status(404).json({
                    error: "Intervjuud ei leitud."
                });
                return;
            }

            const requestedStoryKind = normalizeStoryKind(request.body?.storyKind || getInterviewStoryKind(interview));
            const currentStoryPayload = interview.story_payload && typeof interview.story_payload === "object"
                ? interview.story_payload
                : {};
            const nextStoryPayload = request.body?.storyPayload && typeof request.body.storyPayload === "object"
                ? normalizeInterviewStoryDraft({
                    ...currentStoryPayload,
                    ...request.body.storyPayload,
                    storyKind: requestedStoryKind
                }, {
                    ...interview,
                    story_payload: {
                        ...currentStoryPayload,
                        storyKind: requestedStoryKind
                    }
                })
                : {
                    ...currentStoryPayload,
                    storyKind: requestedStoryKind
                };

            const updatedInterview = await updateInterview(interview.id, {
                invite_name: normalizeField(request.body?.inviteName, interview.invite_name || "", 120) || null,
                brief: normalizeField(request.body?.brief, interview.brief || "", 500) || null,
                admin_notes: normalizeField(request.body?.adminNotes, interview.admin_notes || "", 1200) || null,
                subject_name: normalizeField(nextStoryPayload?.characterName, interview.subject_name || interview.invite_name || "", 120) || null,
                transcript_summary: normalizeField(nextStoryPayload?.transcriptSummary, interview.transcript_summary || "", 320) || null,
                cover_asset_slot: Number(request.body?.coverAssetSlot) === 2 ? 2 : 1,
                story_payload: nextStoryPayload && typeof nextStoryPayload === "object" ? nextStoryPayload : {}
            });

            const [messages, assets] = await Promise.all([
                fetchInterviewMessages(updatedInterview.id),
                fetchInterviewAssets(updatedInterview.id)
            ]);

            response.json({
                interview: serializeInterviewRow(updatedInterview, messages, assets)
            });
        } catch (error) {
            console.error("Failed to save interview draft.", error);
            response.status(500).json({
                error: "Intervjuu mustandi salvestamine ebaõnnestus."
            });
        }
    });

    app.post("/api/admin/interviews/:interviewId/send", async function (request, response) {
        if (!requireAdmin(request, response)) {
            return;
        }

        try {
            const interview = await fetchInterviewById(request.params.interviewId);

            if (!interview) {
                response.status(404).json({
                    error: "Intervjuud ei leitud."
                });
                return;
            }

            const inviteToken = createInterviewToken();
            const inviteLinkBase = resolveBaseUrl(request.body?.baseUrl, request);

            if (!inviteLinkBase) {
                response.status(400).json({
                    error: "Avaliku lingi baas-URL puudub."
                });
                return;
            }

            const inviteLink = `${inviteLinkBase}/interview.html?token=${inviteToken}`;
            const expiresAt = new Date(Date.now() + (INTERVIEW_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)).toISOString();
            let resendMessageId = null;
            let delivery = "preview_only";
            const storyKindLabel = getStoryKindLabel(getInterviewStoryKind(interview));

            if (resendClient && resendFromEmail) {
                const resendResult = await resendClient.emails.send({
                    from: resendFromEmail,
                    to: [interview.invite_email],
                    subject: `Probleemilahendaja ${storyKindLabel} intervjuu link`,
                    html: buildInviteEmailHtml(inviteLink, interview.invite_name, getInterviewStoryKind(interview)),
                    text: `Tere!\n\nAva oma ${storyKindLabel} intervjuu siit: ${inviteLink}\n\nLink kehtib ${INTERVIEW_TOKEN_TTL_DAYS} päeva.`
                });

                if (resendResult?.error) {
                    throw new Error(resendResult.error.message || "Resend delivery failed.");
                }

                resendMessageId = resendResult?.data?.id || null;
                delivery = "resend";
            }

            const updatedInterview = await updateInterview(interview.id, {
                invite_token_hash: hashInterviewToken(inviteToken),
                invite_token_expires_at: expiresAt,
                invite_sent_at: new Date().toISOString(),
                status: interview.status === INTERVIEW_STATUS.readyForReview || interview.status === INTERVIEW_STATUS.published
                    ? interview.status
                    : INTERVIEW_STATUS.invited,
                resend_message_id: resendMessageId
            });

            response.json({
                interview: serializeInterviewRow(updatedInterview),
                inviteLink,
                delivery
            });
        } catch (error) {
            console.error("Failed to send interview invite.", error);
            response.status(500).json({
                error: "Intervjuu lingi saatmine ebaõnnestus."
            });
        }
    });

    app.delete("/api/admin/interviews/:interviewId", async function (request, response) {
        if (!requireAdmin(request, response)) {
            return;
        }

        try {
            const interview = await fetchInterviewById(request.params.interviewId);

            if (!interview) {
                response.status(404).json({
                    error: "Intervjuud ei leitud."
                });
                return;
            }

            const [interviewAssetRows, editorialItem, editorialMediaRows] = await Promise.all([
                fetchInterviewAssetStorageRows(interview.id),
                fetchEditorialItemById(interview.editorial_item_id),
                fetchEditorialMediaStorageRows(interview.editorial_item_id)
            ]);

            await removeStorageObjects(interviewAssetRows);
            await removeStorageObjects(editorialMediaRows);

            if (editorialItem?.id) {
                const { error: editorialDeleteError } = await supabaseAdmin
                    .from("editorial_items")
                    .delete()
                    .eq("id", editorialItem.id);

                if (editorialDeleteError) {
                    throw editorialDeleteError;
                }

                if (editorialItem.content_type === "daily_persona") {
                    removeDailyPersonaFromMemory(editorialItem.slug);
                }

                if (
                    editorialItem.content_type === "daily_article"
                    && normalizeField(editorialItem?.payload?.variant, "", 32) === "cover_story"
                ) {
                    removeDailyCoverStoryFromMemory(editorialItem.date_key);
                }
            }

            const { error: interviewDeleteError } = await supabaseAdmin
                .from("interviews")
                .delete()
                .eq("id", interview.id);

            if (interviewDeleteError) {
                throw interviewDeleteError;
            }

            response.json({
                deleted: true,
                interviewId: interview.id
            });
        } catch (error) {
            console.error("Failed to delete interview.", error);
            response.status(500).json({
                error: "Intervjuu kustutamine ebaõnnestus."
            });
        }
    });

    app.post("/api/admin/interviews/:interviewId/publish", async function (request, response) {
        if (!requireAdmin(request, response)) {
            return;
        }

        try {
            const interview = await fetchInterviewById(request.params.interviewId);

            if (!interview) {
                response.status(404).json({
                    error: "Intervjuud ei leitud."
                });
                return;
            }

            let messages = await fetchInterviewMessages(interview.id);
            let assets = await fetchInterviewAssets(interview.id);

            if (assets.length < 2) {
                response.status(400).json({
                    error: "Avaldamiseks peab olema üles laaditud kaks pilti."
                });
                return;
            }

            let publishInterview = interview;

            if (!hasUsableStoryDraft(publishInterview)) {
                if (!openAiClient) {
                    response.status(503).json({
                        error: "OPENAI_API_KEY puudub mustandi loomiseks."
                    });
                    return;
                }

                const submission = await submitInterviewForReview(publishInterview, messages, assets);
                publishInterview = submission.interview;
                messages = submission.messages;
                assets = submission.assets;
            }

            const publishedAt = new Date().toISOString();
            const dateKey = getLocalDateKey();
            const storyKind = getInterviewStoryKind(publishInterview);
            const normalizedStory = normalizeInterviewStoryDraft(publishInterview.story_payload, publishInterview, publishedAt);
            const coverAssetSlot = Number(publishInterview.cover_asset_slot) === 2 ? 2 : 1;
            let itemRow = null;
            let editorialContentType = "daily_persona";
            let slug = "";

            if (storyKind === INTERVIEW_STORY_KIND.cover) {
                slug = buildDailyCoverStorySlug(dateKey);
                editorialContentType = "daily_article";

                itemRow = await upsertEditorialItemRecord({
                    slug,
                    content_type: "daily_article",
                    date_key: dateKey,
                    location_key: null,
                    generation_signature: `interview:${publishInterview.id}`,
                    status: editorialStatusPublished,
                    title: normalizedStory.title,
                    summary: normalizedStory.summary,
                    payload: {
                        id: dateKey,
                        variant: "cover_story",
                        styleVersion: dailyCoverStoryStyleVersion,
                        subjectName: normalizedStory.subjectName,
                        lead: normalizedStory.lead,
                        paragraphs: normalizedStory.paragraphs,
                        pullQuote: normalizedStory.pullQuote,
                        photoBrief: normalizedStory.photoBrief,
                        imageAlt: normalizedStory.imageAlt,
                        transcriptSummary: normalizedStory.transcriptSummary
                    },
                    source_model: interviewStoryModel,
                    prompt_version: `${promptVersions.interview_story}:cover`,
                    style_version: dailyCoverStoryStyleVersion,
                    published_at: publishedAt
                });

                for (const asset of assets) {
                    const { data: downloadedFile, error: downloadError } = await supabaseAdmin.storage
                        .from(interviewUploadBucketName)
                        .download(`interviews/${interview.id}/slot-${asset.slot}`);

                    if (downloadError) {
                        throw downloadError;
                    }

                    const buffer = await storageDownloadToBuffer(downloadedFile);
                    const media = await uploadEditorialImageAsset({
                        itemId: itemRow.id,
                        itemSlug: slug,
                        contentType: "daily_cover_story",
                        dateKey,
                        fileBaseName: `${slug}-slot-${asset.slot}`,
                        imageBuffer: buffer,
                        mimeType: asset.mimeType,
                        extension: getMimeExtension(asset.mimeType),
                        altText: asset.slot === coverAssetSlot
                            ? normalizeField(normalizedStory.imageAlt, `${normalizedStory.subjectName} kaaneloo portree`, 180)
                            : normalizeField(`${normalizedStory.subjectName} kaaneloo lisafoto`, `${normalizedStory.subjectName} kaaneloo lisafoto`, 180),
                        origin: "upload",
                        metadata: {
                            interviewId: publishInterview.id,
                            slot: asset.slot,
                            caption: asset.caption || ""
                        }
                    });

                    if (asset.slot === coverAssetSlot) {
                        itemRow = await updateEditorialItemMediaFields(slug, media);
                    }
                }

                await unlinkPreviousInterviewsFromEditorialItem(itemRow.id, publishInterview.id);
                upsertDailyCoverStoryInMemory(
                    normalizeStoredDailyCoverStory(buildCoverStoryRecordFromEditorialRow(itemRow))
                );
            } else {
                slug = buildPersonaPublishSlug(publishInterview, normalizedStory, dateKey);

                itemRow = await upsertEditorialItemRecord({
                    slug,
                    content_type: "daily_persona",
                    date_key: dateKey,
                    location_key: null,
                    generation_signature: `interview:${publishInterview.id}`,
                    status: editorialStatusPublished,
                    title: normalizedStory.title,
                    summary: normalizedStory.lead,
                    payload: {
                        id: slug,
                        theme: normalizedStory.theme,
                        characterName: normalizedStory.characterName,
                        characterMeta: normalizedStory.characterMeta,
                        highlight: normalizedStory.highlight,
                        resultNote: normalizedStory.resultNote,
                        photoBrief: normalizedStory.photoBrief,
                        paragraphs: normalizedStory.paragraphs,
                        takeaways: normalizedStory.takeaways,
                        readingTime: normalizedStory.readingTime,
                        imageAlt: normalizedStory.imageAlt,
                        transcriptSummary: normalizedStory.transcriptSummary,
                        galleryImages: []
                    },
                    source_model: interviewStoryModel,
                    prompt_version: promptVersions.interview_story,
                    style_version: dailyPersonaStyleVersion,
                    published_at: publishedAt
                });

                const publicAssets = [];

                for (const asset of assets) {
                    const { data: downloadedFile, error: downloadError } = await supabaseAdmin.storage
                        .from(interviewUploadBucketName)
                        .download(`interviews/${interview.id}/slot-${asset.slot}`);

                    if (downloadError) {
                        throw downloadError;
                    }

                    const buffer = await storageDownloadToBuffer(downloadedFile);
                    const media = await uploadEditorialImageAsset({
                        itemId: itemRow.id,
                        itemSlug: slug,
                        contentType: "daily_persona",
                        dateKey,
                        fileBaseName: `${slug}-slot-${asset.slot}`,
                        imageBuffer: buffer,
                        mimeType: asset.mimeType,
                        extension: getMimeExtension(asset.mimeType),
                        altText: asset.slot === coverAssetSlot
                            ? normalizeField(normalizedStory.imageAlt, `${normalizedStory.characterName} persooniloo portree`, 180)
                            : normalizeField(`${normalizedStory.characterName} persooniloo lisafoto`, `${normalizedStory.characterName} persooniloo lisafoto`, 180),
                        origin: "upload",
                        metadata: {
                            interviewId: publishInterview.id,
                            slot: asset.slot,
                            caption: normalizedStory.galleryCaptions[asset.slot - 1] || asset.caption || ""
                        }
                    });

                    publicAssets.push({
                        slot: asset.slot,
                        url: media.publicUrl,
                        alt: asset.slot === coverAssetSlot
                            ? normalizeField(normalizedStory.imageAlt, `${normalizedStory.characterName} persooniloo portree`, 180)
                            : normalizeField(`${normalizedStory.characterName} persooniloo lisafoto`, `${normalizedStory.characterName} persooniloo lisafoto`, 180),
                        caption: normalizeField(normalizedStory.galleryCaptions[asset.slot - 1] || asset.caption, "", 180)
                    });

                    if (asset.slot === coverAssetSlot) {
                        itemRow = await updateEditorialItemMediaFields(slug, media);
                    }
                }

                itemRow = await upsertEditorialItemRecord({
                    slug,
                    content_type: "daily_persona",
                    date_key: dateKey,
                    location_key: null,
                    generation_signature: `interview:${publishInterview.id}`,
                    status: editorialStatusPublished,
                    title: normalizedStory.title,
                    summary: normalizedStory.lead,
                    payload: {
                        id: slug,
                        theme: normalizedStory.theme,
                        characterName: normalizedStory.characterName,
                        characterMeta: normalizedStory.characterMeta,
                        highlight: normalizedStory.highlight,
                        resultNote: normalizedStory.resultNote,
                        photoBrief: normalizedStory.photoBrief,
                        paragraphs: normalizedStory.paragraphs,
                        takeaways: normalizedStory.takeaways,
                        readingTime: normalizedStory.readingTime,
                        imageAlt: normalizedStory.imageAlt,
                        transcriptSummary: normalizedStory.transcriptSummary,
                        galleryImages: publicAssets
                    },
                    source_model: interviewStoryModel,
                    prompt_version: promptVersions.interview_story,
                    style_version: dailyPersonaStyleVersion,
                    published_at: publishedAt
                });

                upsertDailyPersonaInMemory(
                    normalizeStoredDailyPersona(buildPersonaRecordFromEditorialRow(itemRow))
                );
            }

            const updatedInterview = await updateInterview(publishInterview.id, {
                status: INTERVIEW_STATUS.published,
                published_at: publishedAt,
                editorial_item_id: itemRow.id,
                subject_name: storyKind === INTERVIEW_STORY_KIND.cover
                    ? normalizedStory.subjectName
                    : normalizedStory.characterName,
                transcript_summary: normalizedStory.transcriptSummary,
                story_payload: normalizedStory
            });

            response.json({
                interview: serializeInterviewRow(updatedInterview, messages, assets),
                editorial: {
                    id: itemRow.id,
                    slug,
                    contentType: editorialContentType
                }
            });
        } catch (error) {
            console.error("Failed to publish interview story.", error);
            const userFacingError = getUserFacingError(error, "Loo avaldamine ebaõnnestus.");
            response.status(userFacingError.status).json({
                error: userFacingError.message
            });
        }
    });

    app.get("/api/interview/session", async function (request, response) {
        if (!ensureInterviewWorkflowConfigured(response)) {
            return;
        }

        try {
            const interview = await fetchInterviewByToken(request.query.token);

            if (!interview) {
                response.status(404).json({
                    error: "Intervjuu link on aegunud või vigane."
                });
                return;
            }

            const [messages, assets] = await Promise.all([
                ensureOpeningAssistantMessage(interview),
                fetchInterviewAssets(interview.id)
            ]);

            response.json({
                interview: serializeInterviewRow(interview, messages, assets)
            });
        } catch (error) {
            console.error("Failed to load interview session.", error);
            const userFacingError = getUserFacingError(error, "Intervjuu laadimine ebaõnnestus.");
            response.status(userFacingError.status).json({
                error: userFacingError.message
            });
        }
    });

    app.post("/api/interview/session/message", async function (request, response) {
        if (!ensureInterviewWorkflowConfigured(response)) {
            return;
        }

        if (!openAiClient) {
            response.status(503).json({
                error: "OPENAI_API_KEY puudub intervjuu jaoks."
            });
            return;
        }

        const userMessage = sanitizeProblemText(request.body?.message);

        if (!userMessage) {
            response.status(400).json({
                error: "Sõnum puudub."
            });
            return;
        }

        try {
            const interview = await fetchInterviewByToken(request.body?.token);

            if (!interview) {
                response.status(404).json({
                    error: "Intervjuu link on aegunud või vigane."
                });
                return;
            }

            if (interview.status === INTERVIEW_STATUS.awaitingImages || interview.status === INTERVIEW_STATUS.readyForReview || interview.status === INTERVIEW_STATUS.published) {
                response.status(409).json({
                    error: "Vestlusosa on selle intervjuu jaoks juba lõpetatud."
                });
                return;
            }

            await insertInterviewMessage(interview.id, "user", userMessage);
            const interviewAfterStart = await updateInterview(interview.id, {
                status: INTERVIEW_STATUS.inProgress,
                started_at: interview.started_at || new Date().toISOString()
            });
            const messages = await fetchInterviewMessages(interview.id);
            const followUp = await generateFollowUpMessage(interviewAfterStart, messages);
            await insertInterviewMessage(interview.id, "assistant", followUp.assistantMessage, {
                readyForImages: Boolean(followUp.readyForImages)
            });

            response.json({
                assistantMessage: followUp.assistantMessage,
                readyForImages: Boolean(followUp.readyForImages),
                interview: serializeInterviewRow(
                    await fetchInterviewById(interview.id),
                    await fetchInterviewMessages(interview.id),
                    await fetchInterviewAssets(interview.id)
                )
            });
        } catch (error) {
            console.error("Failed to continue interview.", error);
            const userFacingError = getUserFacingError(error, "Intervjuu jätkamine ebaõnnestus.");
            response.status(userFacingError.status).json({
                error: userFacingError.message
            });
        }
    });

    app.post("/api/interview/session/finish", async function (request, response) {
        if (!ensureInterviewWorkflowConfigured(response)) {
            return;
        }

        try {
            const interview = await fetchInterviewByToken(request.body?.token);

            if (!interview) {
                response.status(404).json({
                    error: "Intervjuu link on aegunud või vigane."
                });
                return;
            }

            const messages = await fetchInterviewMessages(interview.id);
            const userTurnCount = messages.filter(function (message) {
                return message.role === "user";
            }).length;

            if (userTurnCount < 3) {
                response.status(400).json({
                    error: "Enne lõpetamist peaks intervjuus olema vähemalt mõned sisukad vastused."
                });
                return;
            }

            const closingMessage = "Aitäh. Intervjuu tekstiosa on koos. Järgmine samm on laadida üles kaks pilti, mida saame selle loo juures kasutada.";
            await insertInterviewMessage(interview.id, "assistant", closingMessage, {
                stage: "awaiting_images"
            });

            const updatedInterview = await updateInterview(interview.id, {
                status: INTERVIEW_STATUS.awaitingImages,
                completed_at: new Date().toISOString()
            });

            response.json({
                interview: serializeInterviewRow(
                    updatedInterview,
                    await fetchInterviewMessages(interview.id),
                    await fetchInterviewAssets(interview.id)
                )
            });
        } catch (error) {
            console.error("Failed to finish interview.", error);
            response.status(500).json({
                error: "Intervjuu lõpetamine ebaõnnestus."
            });
        }
    });

    app.post("/api/interview/session/upload", async function (request, response) {
        if (!ensureInterviewWorkflowConfigured(response)) {
            return;
        }

        try {
            const token = request.query.token || request.body?.token;
            const interview = await fetchInterviewByToken(token);
            const slot = Number(request.query.slot || request.body?.slot);

            if (!interview) {
                response.status(404).json({
                    error: "Intervjuu link on aegunud või vigane."
                });
                return;
            }

            if (!(slot === 1 || slot === 2)) {
                response.status(400).json({
                    error: "Pildi koht peab olema 1 või 2."
                });
                return;
            }

            const upload = await parseSingleImageUpload(request);

            if (!ALLOWED_UPLOAD_MIME_TYPES.has(upload.mimeType)) {
                response.status(400).json({
                    error: "Lubatud on JPG, PNG, WEBP või AVIF pildid."
                });
                return;
            }

            const storagePath = `interviews/${interview.id}/slot-${slot}`;
            const uploadResult = await supabaseAdmin.storage
                .from(interviewUploadBucketName)
                .upload(storagePath, upload.buffer, {
                    upsert: true,
                    contentType: upload.mimeType,
                    cacheControl: "3600"
                });

            if (uploadResult.error) {
                throw uploadResult.error;
            }

            const { error } = await supabaseAdmin
                .from("interview_assets")
                .upsert({
                    interview_id: interview.id,
                    slot,
                    storage_bucket: interviewUploadBucketName,
                    storage_path: storagePath,
                    mime_type: upload.mimeType,
                    original_file_name: upload.originalFileName,
                    byte_size: upload.buffer.byteLength,
                    caption: upload.caption || null
                }, { onConflict: "interview_id,slot" });

            if (error) {
                throw error;
            }

            let updatedInterview = await fetchInterviewById(interview.id);
            let updatedMessages = await fetchInterviewMessages(interview.id);
            let updatedAssets = await fetchInterviewAssets(interview.id);

            response.json({
                interview: serializeInterviewRow(updatedInterview, updatedMessages, updatedAssets)
            });
        } catch (error) {
            console.error("Failed to upload interview image.", error);
            response.status(500).json({
                error: "Pildi üleslaadimine ebaõnnestus."
            });
        }
    });

    app.post("/api/interview/session/preview", async function (request, response) {
        if (!ensureInterviewWorkflowConfigured(response)) {
            return;
        }

        try {
            const interview = await fetchInterviewByToken(request.body?.token);

            if (!interview) {
                response.status(404).json({
                    error: "Intervjuu link on aegunud või vigane."
                });
                return;
            }

            if (!openAiClient && !hasUsableStoryDraft(interview)) {
                response.status(503).json({
                    error: "OPENAI_API_KEY puudub eelvaate loomiseks."
                });
                return;
            }

            const prepared = await ensureInterviewStoryDraft(interview);

            response.json({
                interview: serializeInterviewRow(prepared.interview, prepared.messages, prepared.assets)
            });
        } catch (error) {
            console.error("Failed to prepare interview preview.", error);
            const userFacingError = getUserFacingError(error, "Loo eelvaate loomine ebaõnnestus.");
            response.status(userFacingError.status).json({
                error: userFacingError.message
            });
        }
    });

    app.patch("/api/interview/session/story", async function (request, response) {
        if (!ensureInterviewWorkflowConfigured(response)) {
            return;
        }

        try {
            const interview = await fetchInterviewByToken(request.body?.token);

            if (!interview) {
                response.status(404).json({
                    error: "Intervjuu link on aegunud või vigane."
                });
                return;
            }

            if (interview.status === INTERVIEW_STATUS.published) {
                response.status(409).json({
                    error: "Avaldatud lugu ei saa enam selle lingi kaudu muuta."
                });
                return;
            }

            const currentStoryPayload = interview.story_payload && typeof interview.story_payload === "object"
                ? interview.story_payload
                : {};
            const requestedStoryKind = normalizeStoryKind(currentStoryPayload.storyKind || getInterviewStoryKind(interview));
            const nextStoryPayload = normalizeInterviewStoryDraft({
                ...currentStoryPayload,
                ...(request.body?.storyPayload && typeof request.body.storyPayload === "object" ? request.body.storyPayload : {}),
                storyKind: requestedStoryKind
            }, {
                ...interview,
                story_payload: {
                    ...currentStoryPayload,
                    storyKind: requestedStoryKind
                }
            });

            const updatedInterview = await updateInterview(interview.id, {
                subject_name: getInterviewDisplayNameFromDraft(nextStoryPayload, interview),
                transcript_summary: normalizeField(nextStoryPayload?.transcriptSummary, interview.transcript_summary || "", 320) || null,
                cover_asset_slot: Number(request.body?.coverAssetSlot) === 2 ? 2 : 1,
                story_payload: nextStoryPayload
            });

            const [messages, assets] = await Promise.all([
                fetchInterviewMessages(updatedInterview.id),
                fetchInterviewAssets(updatedInterview.id)
            ]);

            response.json({
                interview: serializeInterviewRow(updatedInterview, messages, assets)
            });
        } catch (error) {
            console.error("Failed to save user interview story draft.", error);
            const userFacingError = getUserFacingError(error, "Tekstimuudatuste salvestamine ebaõnnestus.");
            response.status(userFacingError.status).json({
                error: userFacingError.message
            });
        }
    });

    app.post("/api/interview/session/submit", async function (request, response) {
        if (!ensureInterviewWorkflowConfigured(response)) {
            return;
        }

        const requestedInterview = await fetchInterviewByToken(request.body?.token);

        if (!requestedInterview) {
            response.status(404).json({
                error: "Intervjuu link on aegunud või vigane."
            });
            return;
        }

        if (!openAiClient && !hasUsableStoryDraft(requestedInterview)) {
            response.status(503).json({
                error: "OPENAI_API_KEY puudub intervjuu jaoks."
            });
            return;
        }

        try {
            const [messages, assets] = await Promise.all([
                fetchInterviewMessages(requestedInterview.id),
                fetchInterviewAssets(requestedInterview.id)
            ]);

            if (assets.length < 2) {
                response.status(400).json({
                    error: "Enne saatmist tuleb üles laadida kaks pilti."
                });
                return;
            }

            const submission = await submitInterviewForReview(requestedInterview, messages, assets);

            response.json({
                interview: serializeInterviewRow(submission.interview, submission.messages, submission.assets)
            });
        } catch (error) {
            console.error("Failed to submit interview for review.", error);
            const userFacingError = getUserFacingError(error, "Intervjuu toimetusele saatmine ebaõnnestus.");
            response.status(userFacingError.status).json({
                error: userFacingError.message
            });
        }
    });
}

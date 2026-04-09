import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const isProduction = process.argv.includes("--production");
const port = Number(process.env.PORT || 8787);
const openAiModel = process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";
const publicFeedModel = process.env.OPENAI_PUBLIC_FEED_MODEL?.trim() || openAiModel;
const openAiApiKey = process.env.OPENAI_API_KEY?.trim() || "";
const client = openAiApiKey ? new OpenAI({ apiKey: openAiApiKey }) : null;
const recentProblemReports = [];
const RECENT_PROBLEMS_LIMIT = 6;
const PUBLIC_FEED_TEXT_LIMIT = 180;
const PUBLIC_FEED_FALLBACK_TEXT = "Üks terava sõnastusega probleem sai lahendatud.";
const PUBLIC_FEED_PROFANITY_REGEX = /\b(?:pers(?:e|se|es|et|ed|ega|ele|el|esse|est|i)?|t(?:ü|y)r(?:a|ad|aga|ale|al|ast|i)?|munn(?:i|e|id|idega|ile|il|ist)?|vitt(?:u|i|e|ud|idega|ile|is|a)?|niku(?:da|n|d|b|s|tud|ga|le)?|pask(?:a|e|i|aks|aga|ale|as|ast|u)?|sit(?:t|a|ad|ane|ase|aks|aga|ale|as|ast)?|hui(?:a|i|d|ga|le|s)?|fuck(?:ing|ed|er|s)?|shit(?:ty|ted|ting|s)?)\b/giu;

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

app.use(express.json({ limit: "1mb" }));

function sanitizeProblemText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
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

const USD_PER_MILLION = 1_000_000;

export const OPENAI_PRICING_SNAPSHOT = {
    checkedAt: "2026-04-17",
    sources: {
        gpt5Mini: "https://developers.openai.com/api/docs/models/gpt-5-mini",
        gpt41: "https://developers.openai.com/api/docs/models/gpt-4.1",
        gptImage1: "https://developers.openai.com/api/docs/models/gpt-image-1",
        moderation: "https://help.openai.com/en/articles/4936833-is-the-moderation-endpoint-free-to-use"
    }
};

const TEXT_MODEL_PRICING = [
    {
        match: /^gpt-5-mini(?:$|-)/iu,
        input: 0.25,
        cachedInput: 0.025,
        output: 2.0
    },
    {
        match: /^gpt-4\.1(?:$|-)/iu,
        input: 2.0,
        cachedInput: 0.5,
        output: 8.0
    }
];

const IMAGE_MODEL_PRICING = [
    {
        match: /^gpt-image-1(?:$|-)/iu,
        textInput: 5.0,
        imageInput: 10.0,
        imageOutput: 40.0,
        perImage: {
            low: {
                "1024x1024": 0.011,
                "1024x1536": 0.016,
                "1536x1024": 0.016
            },
            medium: {
                "1024x1024": 0.042,
                "1024x1536": 0.063,
                "1536x1024": 0.063
            },
            high: {
                "1024x1024": 0.167,
                "1024x1536": 0.25,
                "1536x1024": 0.25
            }
        }
    }
];

const FALLBACK_RUN_ESTIMATES = {
    problem_report: {
        model: "gpt-5-mini",
        inputTokens: 1000,
        cachedInputTokens: 0,
        outputTokens: 260,
        label: "Probleemi põhiraport"
    },
    problem_public_feed: {
        model: "gpt-5-mini",
        inputTokens: 550,
        cachedInputTokens: 0,
        outputTokens: 40,
        label: "Avaliku probleemi lühend"
    },
    problem_public_detail: {
        model: "gpt-5-mini",
        inputTokens: 950,
        cachedInputTokens: 0,
        outputTokens: 220,
        label: "Avalik probleemi detail"
    },
    problem_resolution_public: {
        model: "gpt-5-mini",
        inputTokens: 900,
        cachedInputTokens: 0,
        outputTokens: 120,
        label: "Avalik lahenduse tekst"
    },
    daily_weather: {
        model: "gpt-5-mini",
        inputTokens: 3000,
        cachedInputTokens: 0,
        outputTokens: 450,
        label: "Ilmatekst"
    },
    daily_weather_image: {
        model: "gpt-image-1",
        imageCount: 1,
        imageSize: "1536x1024",
        imageQuality: "high",
        label: "Ilmapilt"
    },
    daily_article: {
        model: "gpt-4.1",
        inputTokens: 1000,
        cachedInputTokens: 0,
        outputTokens: 700,
        label: "Kunstiartikkel"
    },
    daily_horoscope: {
        model: "gpt-5-mini",
        inputTokens: 2000,
        cachedInputTokens: 0,
        outputTokens: 1100,
        label: "Horoskoop"
    },
    interview_opening: {
        model: "gpt-4.1",
        inputTokens: 800,
        cachedInputTokens: 0,
        outputTokens: 120,
        label: "Intervjuu avafookus"
    },
    interview_turn: {
        model: "gpt-4.1",
        inputTokens: 2000,
        cachedInputTokens: 0,
        outputTokens: 90,
        label: "Intervjuu järelküsimus"
    },
    interview_story: {
        model: "gpt-4.1",
        inputTokens: 15000,
        cachedInputTokens: 0,
        outputTokens: 950,
        label: "Persooniloo mustand"
    },
    interview_cover_story: {
        model: "gpt-4.1",
        inputTokens: 14000,
        cachedInputTokens: 0,
        outputTokens: 700,
        label: "Kaaneloo mustand"
    }
};

function normalizeNumber(value, fallbackValue = 0) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
        const parsedValue = Number(value);

        if (Number.isFinite(parsedValue)) {
            return parsedValue;
        }
    }

    return fallbackValue;
}

function roundUsd(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Number(value.toFixed(6));
}

function getTextModelPricing(model) {
    const normalizedModel = String(model || "").trim();

    return TEXT_MODEL_PRICING.find(function (entry) {
        return entry.match.test(normalizedModel);
    }) || null;
}

function getImageModelPricing(model) {
    const normalizedModel = String(model || "").trim();

    return IMAGE_MODEL_PRICING.find(function (entry) {
        return entry.match.test(normalizedModel);
    }) || null;
}

export function calculateTextGenerationCost(model, usage) {
    const pricing = getTextModelPricing(model);

    if (!pricing) {
        return null;
    }

    const inputTokens = Math.max(0, normalizeNumber(usage?.inputTokens));
    const cachedInputTokens = Math.max(0, Math.min(inputTokens, normalizeNumber(usage?.cachedInputTokens)));
    const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
    const outputTokens = Math.max(0, normalizeNumber(usage?.outputTokens));

    return roundUsd(
        ((uncachedInputTokens * pricing.input) + (cachedInputTokens * pricing.cachedInput) + (outputTokens * pricing.output))
        / USD_PER_MILLION
    );
}

export function calculateImageGenerationCost(model, usage, options = {}) {
    const pricing = getImageModelPricing(model);

    if (!pricing) {
        return null;
    }

    const imageCount = Math.max(1, normalizeNumber(options.imageCount, 1));
    const imageQuality = String(options.imageQuality || "").trim().toLowerCase();
    const imageSize = String(options.imageSize || "").trim();
    const exactPerImageCost = pricing.perImage?.[imageQuality]?.[imageSize];

    if (Number.isFinite(exactPerImageCost)) {
        return roundUsd(exactPerImageCost * imageCount);
    }

    const textInputTokens = Math.max(0, normalizeNumber(usage?.textInputTokens));
    const imageInputTokens = Math.max(0, normalizeNumber(usage?.imageInputTokens));
    const imageOutputTokens = Math.max(0, normalizeNumber(usage?.imageOutputTokens, usage?.outputTokens));

    return roundUsd(
        ((textInputTokens * pricing.textInput) + (imageInputTokens * pricing.imageInput) + (imageOutputTokens * pricing.imageOutput))
        / USD_PER_MILLION
    );
}

export function extractAiBillingSnapshot(config = {}, result = null) {
    const model = String(config.model || "").trim();
    const usage = result?.usage;

    if (!usage || typeof usage !== "object") {
        return null;
    }

    if (Array.isArray(result?.data)) {
        const imageCount = Math.max(1, normalizeNumber(result.data.length, 1));
        const imageBilling = {
            kind: "image",
            imageCount,
            imageQuality: String(config.imageQuality || config.inputPayload?.imageQuality || "").trim().toLowerCase(),
            imageSize: String(config.imageSize || config.inputPayload?.imageSize || "").trim(),
            inputTokens: Math.max(0, normalizeNumber(usage.input_tokens)),
            outputTokens: Math.max(0, normalizeNumber(usage.output_tokens)),
            totalTokens: Math.max(0, normalizeNumber(usage.total_tokens)),
            textInputTokens: Math.max(0, normalizeNumber(usage.input_tokens_details?.text_tokens)),
            imageInputTokens: Math.max(0, normalizeNumber(usage.input_tokens_details?.image_tokens)),
            textOutputTokens: Math.max(0, normalizeNumber(usage.output_tokens_details?.text_tokens)),
            imageOutputTokens: Math.max(0, normalizeNumber(usage.output_tokens_details?.image_tokens, usage.output_tokens))
        };

        imageBilling.estimatedCostUsd = calculateImageGenerationCost(model, imageBilling, imageBilling);
        imageBilling.source = imageBilling.imageQuality && imageBilling.imageSize ? "per_image_pricing" : "usage";
        return imageBilling;
    }

    const textBilling = {
        kind: "text",
        inputTokens: Math.max(0, normalizeNumber(usage.input_tokens)),
        cachedInputTokens: Math.max(0, normalizeNumber(usage.input_tokens_details?.cached_tokens)),
        outputTokens: Math.max(0, normalizeNumber(usage.output_tokens)),
        reasoningTokens: Math.max(0, normalizeNumber(usage.output_tokens_details?.reasoning_tokens)),
        totalTokens: Math.max(0, normalizeNumber(usage.total_tokens))
    };

    textBilling.estimatedCostUsd = calculateTextGenerationCost(model, textBilling);
    textBilling.source = "usage";
    return textBilling;
}

export function estimateFallbackRunBilling(run = {}) {
    const fallback = FALLBACK_RUN_ESTIMATES[run?.content_type];

    if (!fallback) {
        return null;
    }

    if (fallback.imageSize && fallback.imageQuality) {
        const estimatedCostUsd = calculateImageGenerationCost(
            run?.model || fallback.model,
            null,
            {
                imageCount: fallback.imageCount || 1,
                imageQuality: fallback.imageQuality,
                imageSize: fallback.imageSize
            }
        );

        return {
            kind: "image",
            source: "fallback",
            estimatedCostUsd,
            imageCount: fallback.imageCount || 1,
            imageQuality: fallback.imageQuality,
            imageSize: fallback.imageSize,
            model: run?.model || fallback.model,
            label: fallback.label
        };
    }

    const estimatedCostUsd = calculateTextGenerationCost(run?.model || fallback.model, fallback);

    return {
        kind: "text",
        source: "fallback",
        estimatedCostUsd,
        inputTokens: fallback.inputTokens,
        cachedInputTokens: fallback.cachedInputTokens,
        outputTokens: fallback.outputTokens,
        model: run?.model || fallback.model,
        label: fallback.label
    };
}

export function getStoredRunBilling(run = {}) {
    const storedBilling = run?.output_payload?.billing;

    if (storedBilling && Number.isFinite(normalizeNumber(storedBilling.estimatedCostUsd, Number.NaN))) {
        return {
            ...storedBilling,
            estimatedCostUsd: roundUsd(normalizeNumber(storedBilling.estimatedCostUsd))
        };
    }

    return estimateFallbackRunBilling(run);
}

export function getFallbackCostForContentType(contentType) {
    const fallback = estimateFallbackRunBilling({
        content_type: contentType,
        model: FALLBACK_RUN_ESTIMATES[contentType]?.model
    });

    return roundUsd(fallback?.estimatedCostUsd || 0);
}

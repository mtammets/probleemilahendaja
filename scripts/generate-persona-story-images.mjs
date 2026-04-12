import "dotenv/config";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const cachePath = path.join(projectRoot, ".cache", "daily-personas.json");
const outputDir = path.join(projectRoot, "assets", "persona-stories");
const openAiApiKey = process.env.OPENAI_API_KEY?.trim() || "";
const imageModel = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";
const cliDateKeys = process.argv.slice(2).filter(function (value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
});
const requestedCount = cliDateKeys.length > 0
    ? cliDateKeys.length
    : Math.max(1, Math.min(8, Number(process.argv[2]) || 8));

if (!openAiApiKey) {
    throw new Error("OPENAI_API_KEY is required to generate persona story images.");
}

const client = new OpenAI({ apiKey: openAiApiKey });

function sortByDateDesc(firstStory, secondStory) {
    const firstTime = new Date(firstStory?.dateKey || 0).getTime();
    const secondTime = new Date(secondStory?.dateKey || 0).getTime();
    return secondTime - firstTime;
}

function isPairStory(story) {
    return /\sja\s/iu.test(String(story?.characterName || ""));
}

const EDITORIAL_PORTRAIT_DIRECTIONS = {
    pair: [
        {
            location: "on a quiet city side street between modern apartment buildings",
            wardrobe: "thoughtful, stylish everyday clothes chosen for a magazine shoot, not matching uniforms",
            pose: "slightly posed but natural, with subtle chemistry and believable eye contact"
        },
        {
            location: "in a spring park near the city, with clean paths and soft evening light",
            wardrobe: "beautiful everyday layers, polished but believable, as if they dressed up a little for the portrait",
            pose: "confident, relaxed, editorial, not overly smiling"
        },
        {
            location: "in an interesting concrete stairwell or underpass with strong natural light",
            wardrobe: "modern, well-fitted daily clothing with texture and shape, not workwear",
            pose: "fashion-aware but human, the kind of portrait a magazine photographer might direct after an interview"
        }
    ],
    female: [
        {
            location: "between clean modern buildings in a quiet urban corner",
            wardrobe: "beautiful contemporary daily clothes, subtle styling, not office uniform and not workwear",
            pose: "posed but natural, confident, relaxed face"
        },
        {
            location: "in a city park or garden path with soft light and open space",
            wardrobe: "well-chosen everyday clothing with an editorial touch, as if she made an effort for the shoot",
            pose: "graceful and composed, real person not model-perfect"
        },
        {
            location: "in an airy gallery-like corridor or minimalist stairwell",
            wardrobe: "current 2020s style, tasteful, elegant, normal but elevated",
            pose: "still, intentional, magazine-quality, not stiff"
        }
    ],
    male: [
        {
            location: "on a quiet side street or courtyard in a contemporary city setting",
            wardrobe: "good modern everyday clothes, neat and intentional, not work uniform",
            pose: "posed but believable, calm, self-possessed"
        },
        {
            location: "near an architectural concrete wall or open public square with soft light",
            wardrobe: "smart casual clothing chosen for a portrait session, not corporate suit unless it feels natural",
            pose: "editorial and grounded, not theatrical"
        },
        {
            location: "in a park edge or riverside walkway with urban buildings in the distance",
            wardrobe: "stylish daily layers, clean silhouette, natural texture",
            pose: "relaxed and quietly strong, not smiling directly to camera unless it feels earned"
        }
    ]
};

const EDITORIAL_PORTRAIT_VARIATIONS = {
    joyful: {
        energy: "warm, bright, approachable, lightly smiling or openly happy",
        framing: "allow movement or a lighter body posture, not static headshot energy",
        wardrobe: "colorful or textured everyday clothes with personality, clearly chosen for the shoot",
        locationFlavor: "fresh, open, inviting, visually alive",
        avoid: "avoid stern expression and avoid over-controlled fashion stiffness"
    },
    playful: {
        energy: "a little mischievous, charming, spontaneous, maybe mid-laugh or caught in a playful gesture",
        framing: "dynamic editorial framing, leaning, turning, walking, sitting in an unexpected way or interacting with the surroundings",
        wardrobe: "stylish everyday outfits with more edge, shape or color, still believable",
        locationFlavor: "slightly unexpected or visually witty place that still feels plausible for a magazine shoot",
        avoid: "avoid corporate stiffness, avoid obvious seriousness, avoid dead-center static pose"
    },
    elegant: {
        energy: "composed, magnetic, polished, fashion-aware but still human",
        framing: "clean deliberate portrait framing with strong lines and refined posture",
        wardrobe: "elevated everyday clothing, elegant cuts, beautiful layering, no uniforms",
        locationFlavor: "architectural, clean, modern, visually restrained",
        avoid: "avoid sadness, avoid costume-like fashion, avoid sterile ad look"
    },
    bold: {
        energy: "confident, memorable, slightly odd or surprising in a good way",
        framing: "editorial image with a stronger visual idea, unusual angle, more space, or more surprising body language",
        wardrobe: "distinctive but believable everyday styling, like someone made a real effort for the portrait",
        locationFlavor: "an unusual but tasteful location such as a concrete underpass, rooftop parking deck, empty tram stop, sports court or geometric courtyard",
        avoid: "avoid clownish exaggeration, avoid gimmicky props, avoid anything costume-y"
    },
    serious: {
        energy: "calm, intelligent, focused, reserved but still warm",
        framing: "simple and strong portrait composition, with emotional clarity",
        wardrobe: "refined understated clothes, not dull and not overly formal",
        locationFlavor: "quiet, beautiful, slightly contemplative place",
        avoid: "avoid gloom, avoid melodrama, avoid a frozen passport-photo expression"
    }
};

const EDITORIAL_VARIATION_SEQUENCE = ["joyful", "playful", "elegant", "joyful", "bold", "joyful", "playful", "serious"];
const EDITORIAL_VARIATION_OVERRIDES = {
    "2026-04-07": "bold"
};

function buildFallbackPhotoBrief(story) {
    const context = [
        story?.title,
        story?.lead,
        story?.theme,
        story?.characterMeta
    ].join(" ").toLocaleLowerCase("et-EE");

    if (/kolim|kast|uus kodu|korter/.test(context)) {
        return "Environmental editorial portrait of a believable Estonian person in the middle of a half-finished move, in a real stairwell, hallway or unpacked kitchen, warm and candid.";
    }

    if (/vestlus|rääki|kõne|telefon/.test(context)) {
        return "Environmental editorial portrait of a believable Estonian person just before or after an important phone call, in a real everyday setting, candid and warm, not posed.";
    }

    if (/raha|arve|asjaaj|paber/.test(context)) {
        return "Environmental editorial portrait of a believable Estonian person dealing with one practical paperwork or money decision in a real occupation-linked setting, warm and candid, not stock-like.";
    }

    if (isPairStory(story)) {
        return "Environmental editorial portrait of a believable Estonian couple in a real domestic decision moment, showing natural interaction, subtle warmth and lived-in detail.";
    }

    return "Environmental editorial portrait of a believable Estonian interview subject in a real everyday setting connected to the story, warm, human and candid, not stock-photo.";
}

function getStorySubject(story) {
    if (isPairStory(story)) {
        return "pair";
    }

    const meta = String(story?.characterMeta || "").toLocaleLowerCase("et-EE");

    if (/\b(mees|bussijuht|vend|isa|poeg|juht)\b/.test(meta)) {
        return "male";
    }

    return "female";
}

function getPortraitDirection(story) {
    const subject = getStorySubject(story);
    const options = EDITORIAL_PORTRAIT_DIRECTIONS[subject] || EDITORIAL_PORTRAIT_DIRECTIONS.female;
    const seed = String(story?.dateKey || story?.id || "");
    let hash = 0;

    for (const character of seed) {
        hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
    }

    return options[hash % options.length];
}

function getPortraitVariation(story) {
    const overrideKey = EDITORIAL_VARIATION_OVERRIDES[story?.dateKey || story?.id || ""];

    if (overrideKey && EDITORIAL_PORTRAIT_VARIATIONS[overrideKey]) {
        return EDITORIAL_PORTRAIT_VARIATIONS[overrideKey];
    }

    const seed = String(story?.dateKey || story?.id || "");
    let hash = 0;

    for (const character of seed) {
        hash = ((hash * 33) + character.charCodeAt(0)) >>> 0;
    }

    const variationKey = EDITORIAL_VARIATION_SEQUENCE[hash % EDITORIAL_VARIATION_SEQUENCE.length] || "joyful";
    return EDITORIAL_PORTRAIT_VARIATIONS[variationKey] || EDITORIAL_PORTRAIT_VARIATIONS.joyful;
}

function buildPrompt(story) {
    const photoBrief = story?.photoBrief || buildFallbackPhotoBrief(story);
    const pairHint = isPairStory(story)
        ? "Show both people clearly in the frame, photographed as one styled portrait rather than a candid work scene."
        : "Show one clear main subject with a strong, memorable presence.";
    const storyContext = [
        story?.theme || "",
        story?.lead || "",
        story?.characterMeta || ""
    ].filter(Boolean).join(" ");
    const portraitDirection = getPortraitDirection(story);
    const portraitVariation = getPortraitVariation(story);

    return [
        "Use case: photorealistic-natural",
        "Asset type: editorial magazine feature image",
        `Primary request: create a world-class magazine portrait for this persona story. ${photoBrief}`,
        `Story context: Estonia-based human-interest feature story about ${storyContext}.`,
        `Location direction: photograph the person ${portraitDirection.location}. The place should feel ${portraitVariation.locationFlavor}.`,
        `Wardrobe direction: ${portraitDirection.wardrobe}. Also: ${portraitVariation.wardrobe}.`,
        `Pose direction: ${portraitDirection.pose}. ${pairHint} Expression and energy should feel ${portraitVariation.energy}. ${portraitVariation.framing}.`,
        "Style/medium: top-tier contemporary magazine portrait photography, premium editorial quality, beautiful but believable, ultra-real, current and natural.",
        "Composition/framing: deliberate fashion-aware portrait composition with strong visual taste, but still emotionally truthful and human. The image should attract attention at first glance and feel memorable rather than neutral.",
        "Lighting/mood: clean natural light or elegant soft light, true-to-life color, subtle glow, modern and refined rather than nostalgic.",
        "Color palette: contemporary real-world color, crisp skin tones, no sepia cast, no yellow vintage wash. Not every image should live in beige and grey; allow tasteful color and contrast.",
        "Materials/textures: modern everyday clothing, good tailoring, real skin texture, believable hair and makeup, no costumes.",
        "Constraints: the subject must look like a real attractive Estonian person of the stated age; they should feel dressed with extra care for a magazine shoot but still like themselves; most portraits should feel warm, lively or playful rather than stern; do not literalize the job or the article problem with props, uniforms or work clothing unless extremely subtle; do not render any text, caption, headline, lettering, logo or magazine cover element anywhere in the image.",
        `Avoid: sad stock realism, old-fashioned interiors, visible brand logos, uniforms, obvious work props, retro styling, awkward hands, plastic skin, AI artifacts, text, watermark, overlaid typography. ${portraitVariation.avoid}.`
    ].join("\n");
}

async function clearExistingStoryImages() {
    await mkdir(outputDir, { recursive: true });
    const entries = await readdir(outputDir);
    const deletions = entries
        .filter(function (name) {
            return /^story-\d{4}-\d{2}-\d{2}\.(?:png|jpe?g|webp|avif)$/i.test(name)
                || /^story-\d{4}-\d{2}-\d{2}-.*\.(?:png|jpe?g|webp|avif)$/i.test(name);
        })
        .map(function (name) {
            return rm(path.join(outputDir, name), { force: true });
        });

    await Promise.all(deletions);
}

async function loadStories() {
    const raw = await readFile(cachePath, "utf8");
    const payload = JSON.parse(raw);
    const stories = (Array.isArray(payload?.stories) ? payload.stories : [])
        .slice()
        .sort(sortByDateDesc)
        .slice(0, Math.max(8, requestedCount));

    if (cliDateKeys.length > 0) {
        const keySet = new Set(cliDateKeys);
        return stories.filter(function (story) {
            return keySet.has(story?.dateKey);
        });
    }

    return stories.slice(0, requestedCount);
}

async function generateImageForStory(story) {
    const prompt = buildPrompt(story);
    const response = await client.images.generate({
        model: imageModel,
        prompt,
        size: "1536x1024",
        quality: "high",
        output_format: "jpeg",
        output_compression: 84
    });
    const imageBase64 = response?.data?.[0]?.b64_json;

    if (!imageBase64) {
        throw new Error(`Image generation failed for ${story?.dateKey || "unknown story"}`);
    }

    const fileName = `story-${story.dateKey}.jpg`;
    const filePath = path.join(outputDir, fileName);
    await writeFile(filePath, Buffer.from(imageBase64, "base64"));
    return { fileName, filePath, prompt };
}

async function main() {
    const stories = await loadStories();

    for (const story of stories) {
        const result = await generateImageForStory(story);
        console.log(`${story.dateKey}\t${story.characterName}\t${result.fileName}`);
    }
}

main().catch(function (error) {
    console.error(error);
    process.exitCode = 1;
});

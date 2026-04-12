import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "assets");
const outputPath = path.join(outputDir, "cover-story-feature.jpg");
const openAiApiKey = process.env.OPENAI_API_KEY?.trim() || "";
const imageModel = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";

if (!openAiApiKey) {
    throw new Error("OPENAI_API_KEY is required to generate the cover story image.");
}

const client = new OpenAI({ apiKey: openAiApiKey });

const prompt = [
    "Use case: photorealistic-natural",
    "Asset type: homepage masthead background for a premium Estonian digital magazine cover story",
    "Primary request: create one believable standalone cover-story portrait of a specific Estonian woman, separate from all other article images, for a magazine called Probleemilahendaja.",
    "Scene/backdrop: tasteful contemporary Estonian apartment interior with elegant natural light, clean but lived-in, warm and credible, no dramatic props.",
    "Subject: one believable Estonian woman around 38 years old, poised, intelligent, attractive in a real human way, soft confident expression, not smiling too broadly, not sad.",
    "Style/medium: top-tier editorial magazine photography, ultra realistic, premium and truthful, like a major lifestyle magazine cover story.",
    "Composition/framing: wide horizontal composition. The upper left quadrant must stay visually calm and mostly empty for the magazine masthead and slogan. Place the woman on the right half of the image, but not too close to the edge. Keep her entire head, hair and shoulders fully inside frame with generous margin. No face near the left edge, top edge, or right edge. Do not crop the head. Do not place any second person anywhere.",
    "Lighting/mood: warm late-afternoon daylight, luminous, calm, solved-problem feeling, optimistic and assured.",
    "Color palette: warm cream, muted wood, soft navy clothing accents, subtle gold warmth, natural skin tones.",
    "Materials/textures: beautiful knitwear or soft tailoring, real hair texture, natural skin, authentic home materials.",
    "Constraints: absolutely no text, no logos, no watermark, no couple, no background people, no melancholy, no funeral mood, no face cut off by the frame.",
    "Avoid: edge-cropped portrait, subject too large, person hiding behind title area, dark grief tone, AI artifacts, extra fingers, plastic skin, showroom kitchen, typography."
].join("\n");

async function main() {
    await mkdir(outputDir, { recursive: true });

    const response = await client.images.generate({
        model: imageModel,
        prompt,
        size: "1536x1024",
        quality: "high",
        output_format: "jpeg",
        output_compression: 86
    });

    const imageBase64 = response?.data?.[0]?.b64_json;

    if (!imageBase64) {
        throw new Error("Image generation returned no image data.");
    }

    await writeFile(outputPath, Buffer.from(imageBase64, "base64"));

    console.log(outputPath);
    console.log("");
    console.log(prompt);
}

main().catch(function (error) {
    console.error(error);
    process.exitCode = 1;
});

// ocr.js — OCR via Google Gemini Vision (gemini-1.5-flash)
//
// Replaces Google Cloud Vision API entirely. Gemini 1.5 Flash can read
// images natively and extract text — including ingredients from label
// photos, barcodes context, and ingredient lists on tubes/packets.
//
// Advantages over Cloud Vision for this use case:
//  - Same API key already used for ingredient AI analysis (GEMINI_API_KEY)
//  - Free tier: 15 req/min, 1M tokens/day — ample for demo + personal use
//  - No separate Google Cloud project, billing setup, or API enablement
//  - Understands cosmetic context — extracts ingredients more cleanly than
//    raw OCR because it can reason about label layout
//  - Can handle barcodes conceptually (reads surrounding text/brand info)

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export class OcrServiceError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "OcrServiceError";
    this.code = code;
  }
}

const OCR_PROMPT = `You are reading a skincare or cosmetic product label photo.

Your task: Extract ONLY the ingredient list from this image.

Rules:
1. Return ONLY the comma-separated ingredient list — nothing else.
2. If you see "Ingredients:", "INCI:", or "Composition:" on the label, extract everything after that heading.
3. Do NOT include brand name, product name, instructions, warnings, volume, or marketing text.
4. If you see a barcode, ignore it — focus on the text ingredient list near it.
5. Preserve the original ingredient names exactly as printed (INCI format preferred).
6. If no ingredient list is visible or readable, respond with exactly: NO_INGREDIENTS_FOUND

Respond with ONLY the ingredient list string, or NO_INGREDIENTS_FOUND. No explanation.`;

/**
 * Extract ingredients from an image buffer using Gemini Vision.
 * Supports JPEG, PNG, WEBP, HEIC.
 *
 * @param {Buffer} imageBuffer
 * @param {string} apiKey — GEMINI_API_KEY
 * @returns {Promise<{rawText: string, cleanedGuess: string}>}
 */
export async function extractIngredientsFromImage(imageBuffer, apiKey) {
  if (!apiKey) {
    throw new OcrServiceError(
      "OCR is not configured. Set GEMINI_API_KEY in backend/.env — it's the same key used for AI ingredient analysis. See the deployment guide.",
      "NO_API_KEY"
    );
  }

  // Detect MIME type from magic bytes
  const mimeType = detectMimeType(imageBuffer);
  if (!mimeType) {
    throw new OcrServiceError(
      "Unsupported image format. Please upload a JPEG, PNG, WEBP, or HEIC photo.",
      "INVALID_IMAGE"
    );
  }

  const base64Image = imageBuffer.toString("base64");

  const requestBody = {
    contents: [{
      parts: [
        {
          inline_data: {
            mime_type: mimeType,
            data: base64Image,
          },
        },
        { text: OCR_PROMPT },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 800,
    },
  };

  let response;
  try {
    response = await fetch(`${GEMINI_API_BASE}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    throw new OcrServiceError(
      `Could not reach Gemini API: ${err.message}`,
      "API_ERROR"
    );
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    if (response.status === 429) {
      throw new OcrServiceError(
        "Gemini rate limit reached. Please wait a moment before uploading another photo.",
        "RATE_LIMITED"
      );
    }
    throw new OcrServiceError(
      `Gemini API error (${response.status}). Check your GEMINI_API_KEY is valid. Details: ${errBody.slice(0, 200)}`,
      "API_ERROR"
    );
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!rawText || rawText === "NO_INGREDIENTS_FOUND") {
    throw new OcrServiceError(
      "No ingredient list could be found in this photo. Try a clearer, well-lit photo showing the ingredients section of the label.",
      "NO_TEXT_FOUND"
    );
  }

  // The cleaned guess IS the raw text since Gemini already extracted cleanly,
  // but we still expose rawText for user review (transparency principle).
  return {
    rawText,
    cleanedGuess: rawText,
  };
}

/**
 * Detect image MIME type from magic bytes.
 * Also validates the upload server-side (Bug Fix 10 from previous audit).
 */
function detectMimeType(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return "image/jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return "image/png";
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return "image/webp";
  if (buffer.length >= 12 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return "image/heic";
  return null;
}

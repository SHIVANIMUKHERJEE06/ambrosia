// ocr.js (route)
import express from "express";
import multer from "multer";
import { extractIngredientsFromImage, OcrServiceError } from "../services/ocr.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, WEBP, or HEIC images are supported."));
  },
});

// Issue 10 fix: verify actual file contents via magic bytes,
// not just the client-supplied Content-Type header.
function validateMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  // WebP: 52 49 46 46 ... 57 45 42 50 (RIFF....WEBP)
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return true;
  // HEIC: starts with ftyp box (common HEIC/HEIF signature at byte 4)
  if (buffer.length >= 12 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return true;
  return false;
}

router.post("/ocr", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No photo uploaded. Field name must be 'photo'." });
    }

    // Issue 10: reject files that don't match their claimed type by content
    if (!validateMagicBytes(req.file.buffer)) {
      return res.status(400).json({
        error: "The uploaded file does not appear to be a valid image. Please upload a real JPEG, PNG, or WEBP photo.",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const result = await extractIngredientsFromImage(req.file.buffer, apiKey);

    res.json({
      rawText: result.rawText,
      cleanedGuess: result.cleanedGuess,
      note: "Automatic best-effort extraction. Please review and correct the text before analyzing — OCR can misread small or low-contrast label text.",
    });
  } catch (err) {
    if (err instanceof OcrServiceError) {
      const statusMap = { NO_API_KEY: 503, API_ERROR: 502, NO_TEXT_FOUND: 422 };
      return res.status(statusMap[err.code] || 500).json({ error: err.message, code: err.code });
    }
    console.error("Error in /api/ocr:", err);
    res.status(500).json({ error: "Something went wrong processing this image. Please try again." });
  }
});

export default router;

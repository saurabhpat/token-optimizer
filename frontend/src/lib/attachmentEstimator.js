import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import { countTokens } from "./tokenCounter";

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const IMAGE_TILE_SIZE = 512;
const IMAGE_BASE_TOKENS = 85;
const IMAGE_TILE_TOKENS = 170;
const SCANNED_PDF_PAGE_TOKENS = 1500;
const GENERIC_FILE_BYTES_PER_TOKEN = 8;
const TEXT_FILE_EXTENSIONS = new Set([
  ".bat",
  ".c",
  ".conf",
  ".cpp",
  ".cs",
  ".css",
  ".csv",
  ".dart",
  ".env",
  ".go",
  ".h",
  ".html",
  ".ini",
  ".java",
  ".js",
  ".json",
  ".jsonl",
  ".jsx",
  ".kt",
  ".log",
  ".md",
  ".php",
  ".ps1",
  ".py",
  ".r",
  ".rb",
  ".rs",
  ".scala",
  ".sh",
  ".sql",
  ".svelte",
  ".swift",
  ".toml",
  ".ts",
  ".tsx",
  ".tsv",
  ".txt",
  ".vue",
  ".xml",
  ".yaml",
  ".yml"
]);

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toFileType(file) {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return "document";
  }

  if (file.type.startsWith("image/")) {
    return "image";
  }

  if (file.type.startsWith("audio/")) {
    return "audio";
  }

  if (file.type.startsWith("video/")) {
    return "video";
  }

  if (isTextLikeFile(file)) {
    return "text";
  }

  return "file";
}

function getExtension(file) {
  const normalizedName = file.name.toLowerCase();
  const lastDotIndex = normalizedName.lastIndexOf(".");

  return lastDotIndex >= 0 ? normalizedName.slice(lastDotIndex) : "";
}

function isTextLikeFile(file) {
  const mimeType = file.type.toLowerCase();

  return (
    mimeType.startsWith("text/") ||
    [
      "application/javascript",
      "application/json",
      "application/ld+json",
      "application/sql",
      "application/x-javascript",
      "application/x-ndjson",
      "application/xml",
      "image/svg+xml"
    ].includes(mimeType) ||
    TEXT_FILE_EXTENSIONS.has(getExtension(file))
  );
}

function estimateFromFileSize(file, type, method) {
  return {
    id: createId(),
    type,
    name: file.name,
    size_bytes: file.size,
    mime_type: file.type || "application/octet-stream",
    token_estimate:
      file.size > 0
        ? Math.max(64, Math.ceil(file.size / GENERIC_FILE_BYTES_PER_TOKEN))
        : 0,
    confidence: "low",
    method
  };
}

function loadImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read image dimensions."));
    };

    image.src = objectUrl;
  });
}

async function estimatePdf(file, modelId) {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pageTexts = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => (typeof item.str === "string" ? item.str : ""))
      .filter(Boolean)
      .join(" ");

    if (pageText.trim()) {
      pageTexts.push(pageText);
    }
  }

  const extractedText = pageTexts.join("\n").trim();

  if (extractedText.length >= 40) {
    return {
      id: createId(),
      type: "document",
      name: file.name,
      size_bytes: file.size,
      mime_type: file.type || "application/pdf",
      pages: pdf.numPages,
      token_estimate: await countTokens(extractedText, modelId),
      confidence: "high",
      method: "pdf_text_extraction"
    };
  }

  return {
    id: createId(),
    type: "document",
    name: file.name,
    size_bytes: file.size,
    mime_type: file.type || "application/pdf",
    pages: pdf.numPages,
    token_estimate: pdf.numPages * SCANNED_PDF_PAGE_TOKENS,
    confidence: "low",
    method: "scanned_pdf_page_estimate"
  };
}

async function estimateImage(file) {
  const { width, height } = await loadImageDimensions(file);
  const tiles =
    Math.ceil(width / IMAGE_TILE_SIZE) * Math.ceil(height / IMAGE_TILE_SIZE);

  return {
    id: createId(),
    type: "image",
    name: file.name,
    size_bytes: file.size,
    mime_type: file.type || "image/*",
    width,
    height,
    token_estimate: IMAGE_BASE_TOKENS + IMAGE_TILE_TOKENS * tiles,
    confidence: "medium",
    method: "image_dimension_tile_estimate"
  };
}

async function estimateTextFile(file, modelId) {
  const text = await file.text();
  const tokenEstimate = text.trim() ? await countTokens(text, modelId) : 0;

  return {
    id: createId(),
    type: "text",
    name: file.name,
    size_bytes: file.size,
    mime_type: file.type || "text/plain",
    token_estimate: tokenEstimate,
    confidence: text.trim() ? "high" : "low",
    method: "text_file_token_count"
  };
}

export async function estimateAttachment(file, modelId) {
  const fileType = toFileType(file);

  if (fileType === "document") {
    try {
      return await estimatePdf(file, modelId);
    } catch {
      return estimateFromFileSize(file, "document", "pdf_parse_failed_size_estimate");
    }
  }

  if (fileType === "image") {
    try {
      return await estimateImage(file);
    } catch {
      return estimateFromFileSize(file, "image", "image_metadata_unavailable_size_estimate");
    }
  }

  if (fileType === "text") {
    try {
      return await estimateTextFile(file, modelId);
    } catch {
      return estimateFromFileSize(file, "text", "text_read_failed_size_estimate");
    }
  }

  if (fileType === "audio") {
    return estimateFromFileSize(file, "audio", "audio_file_size_estimate");
  }

  if (fileType === "video") {
    return estimateFromFileSize(file, "video", "video_file_size_estimate");
  }

  return estimateFromFileSize(file, "file", "generic_file_size_estimate");
}

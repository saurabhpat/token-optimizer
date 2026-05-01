import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import { countTokens } from "./tokenCounter";

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const IMAGE_TILE_SIZE = 512;
const IMAGE_BASE_TOKENS = 85;
const IMAGE_TILE_TOKENS = 170;
const SCANNED_PDF_PAGE_TOKENS = 1500;

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

  return "";
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
    width,
    height,
    token_estimate: IMAGE_BASE_TOKENS + IMAGE_TILE_TOKENS * tiles,
    confidence: "medium",
    method: "image_dimension_tile_estimate"
  };
}

export async function estimateAttachment(file, modelId) {
  const fileType = toFileType(file);

  if (fileType === "document") {
    return estimatePdf(file, modelId);
  }

  if (fileType === "image") {
    return estimateImage(file);
  }

  throw new Error("Only PDF and image attachments are supported.");
}

import {
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Loader2,
  Upload,
  X
} from "lucide-react";
import { formatNumber } from "../lib/formatters";

function formatBytes(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getAttachmentDetail(attachment) {
  if (attachment.type === "document") {
    return `${formatBytes(attachment.size_bytes)}${
      Number.isFinite(attachment.pages) ? `, ${attachment.pages} pages` : ""
    }`;
  }

  if (attachment.type === "image") {
    return `${formatBytes(attachment.size_bytes)}${
      attachment.width && attachment.height
        ? `, ${attachment.width}x${attachment.height}px`
        : ""
    }`;
  }

  return formatBytes(attachment.size_bytes);
}

export default function InputAttachments({
  attachments,
  isEstimating,
  errorMessage,
  onAddFiles,
  onRemoveAttachment
}) {
  function handleFileChange(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length > 0) {
      onAddFiles(files);
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-soft px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">Input attachments</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            PDFs and images stay local; only token metadata is analyzed.
          </p>
        </div>

        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:border-primary/40 hover:bg-blue-50">
        <input
          type="file"
          multiple
          accept="application/pdf,image/*"
          onChange={handleFileChange}
          className="sr-only"
        />
        {isEstimating ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <Upload className="h-4 w-4 text-primary" />
        )}
          {isEstimating ? "Estimating..." : "Attach PDF/Image"}
        </label>
      </div>

      {errorMessage ? (
        <div className="flex items-start gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {errorMessage}
        </div>
      ) : null}

      {attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const Icon = attachment.type === "image" ? ImageIcon : FileText;

            return (
              <div
                key={attachment.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-white px-3 py-2"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-3">
                  <p className="truncate text-sm font-semibold text-ink">
                    {attachment.name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs sm:mt-0">
                    <span className="text-slate-500">
                      {getAttachmentDetail(attachment)}
                    </span>
                    <span className="rounded-full border border-border bg-soft px-2 py-1 font-medium text-slate-600">
                      {formatNumber(attachment.token_estimate)} tokens
                    </span>
                    <span className="rounded-full border border-border bg-soft px-2 py-1 font-medium capitalize text-slate-600">
                      {attachment.confidence} confidence
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(attachment.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`Remove ${attachment.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

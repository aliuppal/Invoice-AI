"use client";

import { useRef, type ChangeEvent } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Camera, FileUp, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ACCEPT = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/bmp": [".bmp"],
  "image/gif": [".gif"],
  "application/pdf": [".pdf"],
};

function describeRejection(rejections: FileRejection[]) {
  if (rejections.length > 1) return "Drop one document at a time.";
  const code = rejections[0]?.errors[0]?.code;
  if (code === "file-too-large") return "That file is over 10 MB. Try a smaller scan or photo.";
  if (code === "file-invalid-type") return "That file type isn't supported. Use a PNG, JPG, WEBP or PDF.";
  return "That file couldn't be used. Try another one.";
}

type Props = {
  error: string | null;
  onFile: (file: File) => void;
  onError: (message: string) => void;
};

export function UploadZone({ error, onFile, onError }: Props) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPT,
    maxSize: MAX_UPLOAD_BYTES,
    multiple: false,
    onDropAccepted: ([file]) => onFile(file),
    onDropRejected: (rejections) => onError(describeRejection(rejections)),
  });

  function handleCameraCapture(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) return onError("That photo is over 10 MB. Try a lower resolution.");
    onFile(file);
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps({
          className: cn(
            "group relative flex min-h-[24rem] cursor-pointer flex-col items-center justify-center gap-7 rounded-media border-2 border-dashed px-6 py-14 text-center transition-colors duration-200",
            "border-hairline bg-white hover:border-deep-green hover:bg-pale-green/50",
            isDragActive && "border-deep-green bg-pale-green",
          ),
        })}
      >
        <input {...getInputProps({ "aria-label": "Upload invoice or purchase order" })} />

        <span className="grid size-14 place-items-center rounded-full bg-stone text-deep-green transition-colors group-hover:bg-deep-green group-hover:text-white">
          <FileUp className="size-6" strokeWidth={1.5} />
        </span>

        <div className="max-w-lg">
          <p className="font-display text-2xl leading-tight tracking-[-0.02em] text-black sm:text-[32px]">
            {isDragActive ? "Drop it. Invoq will read it." : "Drag & drop invoice/PO image or PDF here, or click to browse"}
          </p>
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.02em] text-slate">PNG · JPG · WEBP · PDF — max 10 MB</p>
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            cameraInput.current?.click();
          }}
          className="inline-flex items-center gap-2 rounded-pill border border-primary px-5 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white"
        >
          <Camera className="size-4" strokeWidth={1.75} />
          Use Camera
        </button>
      </div>

      {/* Opens the rear camera on phones; falls back to a file picker on desktop. */}
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleCameraCapture}
      />

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-chip border border-error/30 bg-[#fff0ec] px-4 py-3 text-sm text-error">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

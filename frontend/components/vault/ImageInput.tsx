"use client";

import { useRef, useEffect, useState } from "react";
import { TkButton } from "@/components/ds";

type ImageMode = "file" | "fileOrUrl";

interface ImageInputProps {
  value: File | string | null;
  onChange: (value: File | string | null) => void;
  label?: string;
  /** When false, no label row is rendered (parent supplies heading copy). */
  showLabel?: boolean;
  required?: boolean;
  /** "file" = upload only, "fileOrUrl" = toggle between file upload and URL input */
  mode?: ImageMode;
}

const inputClass =
  "w-full bg-[#141414] border border-white/[0.08] focus:border-[var(--azure)] focus:shadow-[0_0_0_3px_rgba(26,111,255,0.15)] rounded-xl px-3 py-2 text-sm text-white placeholder-white/35 outline-none transition-colors";

const toggleBtnClass = (active: boolean) =>
  active
    ? "bg-[rgba(26,111,255,0.12)] text-[var(--azure)]"
    : "bg-[#141414] text-white/40 hover:text-white";

export function ImageInput({
  value,
  onChange,
  label = "Card Image",
  showLabel = true,
  required = false,
  mode = "fileOrUrl",
}: ImageInputProps) {
  const [toggleMode, setToggleMode] = useState<"file" | "url">(
    value instanceof File ? "file" : typeof value === "string" && value ? "url" : "file",
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (value instanceof File) {
      const url = URL.createObjectURL(value);
      setBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setBlobUrl(null);
  }, [value]);

  const previewUrl =
    value instanceof File && blobUrl
      ? blobUrl
      : typeof value === "string" && value
        ? value
        : null;

  const showUrlInput = mode === "fileOrUrl" && toggleMode === "url";
  const showFileUpload = mode === "file" || (mode === "fileOrUrl" && toggleMode === "file");

  function handleModeSwitch(newMode: "file" | "url") {
    setToggleMode(newMode);
    onChange(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.files?.[0] ?? null);
  }

  function handleUrlChange(url: string) {
    onChange(url.trim() ? url.trim() : null);
  }

  function handleClear() {
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      {showLabel && (
        <label className="mb-1.5 block text-sm text-white/55">
          {label}
          {required && <span className="ml-0.5 text-[var(--neg)]">*</span>}
        </label>
      )}

      {mode === "fileOrUrl" && (
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={() => handleModeSwitch("file")}
            className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${toggleBtnClass(toggleMode === "file")}`}
          >
            Upload File
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch("url")}
            className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${toggleBtnClass(toggleMode === "url")}`}
          >
            Image URL
          </button>
        </div>
      )}

      {showFileUpload && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          {!previewUrl ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="group w-full rounded-2xl border-2 border-dashed border-white/[0.12] bg-[#141414]/60 px-5 py-10 text-center transition-all hover:border-white/20 hover:bg-[#141414] sm:py-12"
            >
              <span className="flex flex-col items-center gap-3">
                <TkButton decorative variant="primary" size="md" className="px-10 py-3.5 text-base sm:px-12 sm:py-4 sm:text-lg">
                  Upload photo
                </TkButton>
                <span className="max-w-sm text-[11px] font-medium leading-relaxed text-white/35 sm:text-xs">
                  Upload a front photo of your PSA graded card (PSA 1–10 or AUTH). *PNG, JPG or WEBP
                </span>
              </span>
            </button>
          ) : (
            <div
              onClick={() => inputRef.current?.click()}
              className="group w-full cursor-pointer rounded-xl border border-white/[0.08] bg-[#141414]/60 px-4 py-4 text-center transition-colors hover:border-[rgba(26,111,255,0.35)]"
            >
              <div className="relative inline-block">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="mx-auto max-h-40 rounded-lg object-contain sm:max-h-44"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--neg)]/90 text-sm font-bold text-white opacity-0 transition-opacity hover:bg-[var(--neg)] group-hover:opacity-100"
                >
                  ×
                </button>
              </div>
              <p className="mt-2 text-[11px] text-white/35">Tap to replace</p>
            </div>
          )}
        </>
      )}

      {showUrlInput && (
        <>
          <input
            type="url"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => handleUrlChange(e.target.value)}
            required={required && toggleMode === "url"}
            placeholder="https://example.com/image.png"
            className={inputClass}
          />
          {previewUrl && (
            <div className="mt-2">
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-32 rounded-lg border border-white/[0.08] object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

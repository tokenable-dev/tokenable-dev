"use client";

import { useRef, useEffect, useState } from "react";

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
  "w-full bg-gray-800 border border-gray-700 focus:border-mint rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors";

export function ImageInput({
  value,
  onChange,
  label = "Card Image",
  showLabel = true,
  required = false,
  mode = "fileOrUrl",
}: ImageInputProps) {
  const [toggleMode, setToggleMode] = useState<"file" | "url">(
    value instanceof File ? "file" : typeof value === "string" && value ? "url" : "file"
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
        <label className="block text-sm text-gray-400 mb-1.5">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}

      {mode === "fileOrUrl" && (
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => handleModeSwitch("file")}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              toggleMode === "file"
                ? "bg-mint-dim text-mint-ink"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            Upload File
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch("url")}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              toggleMode === "url"
                ? "bg-mint-dim text-mint-ink"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
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
              className="group w-full rounded-2xl border-2 border-dashed border-mint/45 bg-gradient-to-b from-mint/[0.14] to-mint/[0.04] px-5 py-10 text-center shadow-[inset_0_1px_0_0_rgba(16,211,51,0.15)] transition-all hover:border-mint/80 hover:from-mint/[0.2] hover:to-mint/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-mint/50 sm:py-12"
            >
              <span className="flex flex-col items-center gap-3">
                <span className="rounded-xl bg-mint px-10 py-3.5 text-base font-bold tracking-tight text-[#030712] shadow-lg shadow-mint/35 transition group-hover:brightness-110 sm:px-12 sm:py-4 sm:text-lg">
                  Upload photo
                </span>
                <span className="text-[11px] font-medium text-gray-500 sm:text-xs">
                  Front of slab · PNG, JPG, or WEBP
                </span>
              </span>
            </button>
          ) : (
            <div
              onClick={() => inputRef.current?.click()}
              className="group w-full cursor-pointer rounded-xl border border-gray-700 bg-gray-900/40 py-4 px-4 text-center transition-colors hover:border-mint/40"
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
                  className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-500/90 text-sm font-bold text-white opacity-0 transition-opacity hover:bg-red-500 group-hover:opacity-100"
                >
                  ×
                </button>
              </div>
              <p className="mt-2 text-[11px] text-gray-500">Tap to replace</p>
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
                className="max-h-32 rounded-lg object-contain border border-gray-700"
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

"use client";

import { useRef, useEffect, useState } from "react";

type ImageMode = "file" | "fileOrUrl";

interface ImageInputProps {
  value: File | string | null;
  onChange: (value: File | string | null) => void;
  label?: string;
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
      <label className="block text-sm text-gray-400 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>

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
          <div
            onClick={() => inputRef.current?.click()}
            className="w-full border border-dashed border-gray-700 hover:border-mint/50 rounded-lg py-6 px-4 text-center cursor-pointer transition-all duration-200 group"
          >
            {previewUrl ? (
              <div className="relative inline-block">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-32 mx-auto rounded-lg object-contain"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500/90 hover:bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ) : (
              <span className="text-sm text-gray-500 group-hover:text-gray-300 transition-colors">
                Click to select PNG, JPG, GIF, WEBP
              </span>
            )}
          </div>
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

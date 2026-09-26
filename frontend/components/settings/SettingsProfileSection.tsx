"use client";

import { useRef, useState } from "react";
import type { AuthUser } from "@/lib/auth";
import { updateAuthProfile, uploadAuthAvatar } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";
import { SettingsBtn } from "./SettingsBtn";

const AVATAR_MAX_BYTES = 8 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function displayNameFor(user: AuthUser): string {
  const name = user.name?.trim();
  if (name) return name;
  if (user.walletAddress) {
    return `${user.walletAddress.slice(0, 6)}…${user.walletAddress.slice(-4)}`;
  }
  return user.email.split("@")[0] || "User";
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

export function SettingsProfileSection({ user }: { user: AuthUser }) {
  const setUser = useAuthStore((s) => s.setUser);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(() => user.name?.trim() || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayName = displayNameFor(user);

  async function save() {
    const name = draftName.trim();
    if (!name) {
      setError("Display name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await updateAuthProfile({ name });
      setUser(next);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function onAvatarSelected(file: File | null) {
    if (!file) return;
    if (!AVATAR_TYPES.has(file.type)) {
      setError("Avatar must be a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError("Avatar must be 8MB or smaller.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const next = await uploadAuthAvatar(file);
      setUser(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload avatar.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="tk-settings__sec">
      <h1 className="tk-settings__sec-h">Profile</h1>
      <p className="tk-settings__sec-sub">
        How you appear on Tokenable. Only your display name is public.
      </p>
      <div className="tk-settings__card">
        <div className="mb-2 flex flex-wrap items-center gap-3 sm:gap-[18px]">
          {user.pictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.pictureUrl} alt="" className="tk-settings__avatar" />
          ) : (
            <span className="tk-settings__avatar" aria-hidden>
              {initialsFor(displayName)}
            </span>
          )}
          <div className="min-w-0 flex-1 basis-[12rem]">
            <div className="truncate text-lg font-bold text-white">{displayName}</div>
            <div className="mt-0.5 truncate text-[13px] text-[var(--t2)]">{user.email}</div>
          </div>
          <SettingsBtn
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => {
              setDraftName(user.name?.trim() || "");
              setError(null);
              setEditing(true);
            }}
          >
            Edit
          </SettingsBtn>
        </div>

        {editing ? (
          <div className="mt-[18px] border-t border-white/[0.06] pt-[18px]">
            <label className="tk-settings__lbl" htmlFor="settings-display-name">
              Display name
            </label>
            <input
              id="settings-display-name"
              className="tk-settings__inp mb-4"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              maxLength={200}
              disabled={saving || uploading}
            />
            <label className="tk-settings__lbl" htmlFor="settings-avatar-file">
              Avatar
            </label>
            <div className="flex flex-wrap items-center gap-2.5">
              <input
                ref={fileRef}
                id="settings-avatar-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={saving || uploading}
                onChange={(e) => void onAvatarSelected(e.target.files?.[0] ?? null)}
              />
              <SettingsBtn
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving || uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? "Uploading…" : "Upload image"}
              </SettingsBtn>
              <span className="tk-settings__hint">
                PNG, JPG, or WebP · up to 8MB · replaces your login avatar
              </span>
            </div>
            <div className="mt-5 flex gap-2.5">
              <SettingsBtn
                variant="primary"
                size="sm"
                disabled={saving || uploading}
                onClick={() => void save()}
              >
                {saving ? "Saving…" : "Save"}
              </SettingsBtn>
              <SettingsBtn
                variant="ghost"
                size="sm"
                disabled={saving || uploading}
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
              >
                Cancel
              </SettingsBtn>
            </div>
            {error ? (
              <p className="mt-3 text-xs text-[var(--warn)]" role="status">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

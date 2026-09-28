"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { TkButton, TkInput } from "@/components/ds";
import { TkDialog } from "@/components/ds/Dialog";
import { isWalletOnlyPlaceholderEmail } from "@/lib/auth/walletOnlyEmail";
import { useAuthStore } from "@/store/authStore";

const NOTIFICATIONS_SETTINGS_HREF = "/settings?section=notifications";

function defaultUnsubscribeEmail(
  queryEmail: string | null,
  sessionEmail: string | null | undefined,
): string {
  const fromQuery = queryEmail?.trim() ?? "";
  if (fromQuery.includes("@")) return fromQuery;
  const fromSession = sessionEmail?.trim() ?? "";
  if (fromSession && !isWalletOnlyPlaceholderEmail(fromSession)) {
    return fromSession;
  }
  return "";
}

export function UnsubscribePageView() {
  const searchParams = useSearchParams();
  const queryEmail = searchParams.get("email");
  const sessionEmail = useAuthStore((s) => s.user?.email);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const next = defaultUnsubscribeEmail(queryEmail, sessionEmail);
    if (!next) return;
    setEmail((current) => (current.trim() === "" ? next : current));
  }, [queryEmail, sessionEmail]);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function openConfirm() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError(null);
    setConfirmOpen(true);
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    openConfirm();
  }

  function onConfirmUnsubscribe() {
    setConfirmOpen(false);
  }

  return (
    <>
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#e5e5e5] px-4 py-12">
        <div className="w-full max-w-[520px] border border-[#c8c8c8] bg-white px-10 py-12 sm:px-14">
          <h1 className="m-0 text-center text-[28px] font-bold leading-tight text-[#111]">
            Unsubscribe
          </h1>

          <form className="mt-10 flex flex-col gap-6" onSubmit={onSubmit}>
            <div className="tk-field">
              <label
                className="mb-2 block text-sm font-medium text-[#111]"
                htmlFor="unsubscribe-email"
              >
                Email <span className="text-[#e53935]" aria-hidden>*</span>
              </label>
              <TkInput
                id="unsubscribe-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                hasError={emailError != null}
                className="w-full"
              />
              {emailError ? (
                <span className="tk-field__hint tk-field__hint--error mt-1 block">
                  {emailError}
                </span>
              ) : null}
            </div>

            <div className="flex justify-center pt-2">
              <TkButton
                type="submit"
                variant="primary"
                size="md"
                className="min-w-[200px] justify-center px-10"
              >
                Unsubscribe
              </TkButton>
            </div>
          </form>

          <p className="m-0 mt-10 text-center text-sm">
            <Link
              href={NOTIFICATIONS_SETTINGS_HREF}
              className="font-medium text-[#1a6fff] no-underline hover:underline"
            >
              Update your preferences
            </Link>
          </p>
        </div>
      </div>

      <TkDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Unsubscribe from all emails?"
        description="You will not receive any further emails from Tokenable at this address."
        footer={
          <div className="flex w-full flex-col gap-2">
            <TkButton
              variant="primary"
              size="sm"
              className="w-full justify-center"
              onClick={onConfirmUnsubscribe}
            >
              Unsubscribe
            </TkButton>
            <TkButton
              variant="ghost"
              size="sm"
              className="w-full justify-center"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </TkButton>
          </div>
        }
      />
    </>
  );
}

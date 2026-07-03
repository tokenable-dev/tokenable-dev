"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthModalShell } from "./AuthModalShell";
import { deleteAccount } from "@/lib/auth/auth";
import { useAuthStore } from "@/store/authStore";
import { AUTH_MINT_LINK } from "./authUiStyles";

function DeleteAccountModal({
  open,
  onClose,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setError(null);
    onClose();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await deleteAccount();
      onDeleted();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete account.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthModalShell open={open} onClose={handleClose} titleId="delete-account-title" maxWidthClass="max-w-sm">
      <div className="px-6 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-6 sm:px-7 sm:pb-7">
        <h2 id="delete-account-title" className="text-lg font-bold text-white">
          Delete account
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-400">
          This permanently removes your account, watchlist, and linked wallets. This cannot be undone.
        </p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-3.5">
          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl border border-red-500/40 bg-red-500/10 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/15 disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Delete account"}
            </button>
            <button type="button" onClick={handleClose} className={`${AUTH_MINT_LINK} py-2 text-center`}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </AuthModalShell>
  );
}

export function DeleteAccountSettingsRow() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [open, setOpen] = useState(false);

  function handleDeleted() {
    setUser(null);
    router.replace("/");
  }

  return (
    <>
      <section className="rounded-xl border border-red-500/20 bg-red-500/[0.04] px-5 py-4">
        <h2 className="text-sm font-semibold text-red-300">Delete account</h2>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          Permanently remove your account and linked data.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-400 transition-colors hover:border-red-500/50 hover:bg-red-500/10"
        >
          Delete account
        </button>
      </section>
      <DeleteAccountModal
        open={open}
        onClose={() => setOpen(false)}
        onDeleted={handleDeleted}
      />
    </>
  );
}

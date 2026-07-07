"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TkButton, TkDialog } from "@/components/ds";
import { deleteAccount } from "@/lib/auth/auth";
import { useAuthStore } from "@/store/authStore";

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

  async function onSubmit() {
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
    <TkDialog
      open={open}
      onClose={handleClose}
      title="Delete account"
      description="This permanently removes your account, watchlist, and linked wallets. This cannot be undone."
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
          <TkButton variant="subtle" onClick={handleClose} className="sm:min-w-[7rem]">
            Cancel
          </TkButton>
          <TkButton
            variant="danger"
            disabled={pending}
            onClick={() => void onSubmit()}
            className="sm:min-w-[9rem]"
          >
            {pending ? "Deleting…" : "Delete account"}
          </TkButton>
        </div>
      }
    >
      {error ? (
        <p className="text-sm text-[var(--neg)]" role="alert">
          {error}
        </p>
      ) : null}
    </TkDialog>
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
      <section className="secondary-panel secondary-panel--danger">
        <h2 className="secondary-panel__title">Delete account</h2>
        <p className="secondary-panel__text">
          Permanently remove your account and linked data.
        </p>
        <TkButton
          type="button"
          variant="danger"
          size="sm"
          className="mt-3"
          onClick={() => setOpen(true)}
        >
          Delete account
        </TkButton>
      </section>
      <DeleteAccountModal
        open={open}
        onClose={() => setOpen(false)}
        onDeleted={handleDeleted}
      />
    </>
  );
}

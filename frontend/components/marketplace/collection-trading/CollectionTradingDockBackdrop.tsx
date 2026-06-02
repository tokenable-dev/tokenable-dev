"use client";

export function CollectionTradingDockBackdrop({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  if (!visible) return null;
  return (
    <button
      type="button"
      className="fixed inset-0 z-[95] cursor-default bg-black/55"
      aria-label="Close trade panel"
      onClick={onClose}
    />
  );
}

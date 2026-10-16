/** Live specimens for `typography-ui.css` — `/dev/design-system` optional embed. */
export function DsTypographyUiShowcase() {
  const rows = [
    { cls: "tk-ui-num-xl", label: "num-xl · 30" },
    { cls: "tk-ui-title", label: "title · 24" },
    { cls: "tk-ui-heading", label: "heading · 20" },
    { cls: "tk-ui-subheading", label: "subheading · 17" },
    { cls: "tk-ui-section", label: "section · 15" },
    { cls: "tk-ui-body-lg", label: "body-lg · 14" },
    { cls: "tk-ui-body", label: "body · 13" },
    { cls: "tk-ui-body-sm", label: "body-sm · 12" },
    { cls: "tk-ui-caption", label: "caption · 11" },
    { cls: "tk-ui-label", label: "label · 10" },
  ] as const;

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-[#141414] p-6">
      <h2 className="tk-ui-section text-white">UI typography scale</h2>
      <p className="tk-ui-body-sm text-[var(--t2)]">
        Figma `typography/ui` — Inter, tnum + cv11 on sans.
      </p>
      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li key={row.cls} className="flex flex-wrap items-baseline gap-4 border-b border-white/6 pb-2">
            <span className="tk-ui-caption w-28 shrink-0 text-[var(--t3)]">{row.cls}</span>
            <span className={row.cls}>Tokenized collectibles</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

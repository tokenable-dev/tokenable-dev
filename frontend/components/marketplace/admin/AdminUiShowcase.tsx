"use client";

import {
  ADMIN_ARTICLE,
  ADMIN_BTN_DANGER,
  ADMIN_BTN_DANGER_EMPHASIS,
  ADMIN_BTN_GHOST,
  ADMIN_BTN_LOAD_MORE,
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_INPUT,
  ADMIN_LABEL,
  ADMIN_LINK,
  ADMIN_LINK_SM,
  ADMIN_PANEL_DANGER,
  ADMIN_SEGMENT,
  ADMIN_SEGMENT_BTN,
  ADMIN_SEGMENT_BTN_ACTIVE,
  ADMIN_SHELL_BG,
  ADMIN_STAT_CARD,
  ADMIN_TABLE,
  ADMIN_TABLE_HEAD,
  ADMIN_TABLE_TD,
  ADMIN_TABLE_TH,
  ADMIN_TABLE_WRAP,
  ADMIN_TEXT_BODY,
  ADMIN_TEXT_SECONDARY,
  ADMIN_TITLE_DANGER,
} from "./adminUi";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2
        className="text-base font-semibold text-zinc-900 sm:text-lg"
        style={{ marginBottom: 16 }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

const BUTTON_ROWS = [
  { label: "Primary", className: ADMIN_BTN_PRIMARY },
  { label: "Secondary", className: ADMIN_BTN_SECONDARY },
  { label: "Ghost", className: ADMIN_BTN_GHOST },
  { label: "Load more", className: ADMIN_BTN_LOAD_MORE },
  { label: "Danger", className: ADMIN_BTN_DANGER },
  { label: "Danger emphasis", className: ADMIN_BTN_DANGER_EMPHASIS },
] as const;

export function AdminUiShowcase() {
  return (
    <div className={`admin-console min-h-screen ${ADMIN_SHELL_BG}`}>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Admin QA
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
          Marketplace admin UI
        </h1>
        <p className={`mt-2 max-w-2xl text-sm leading-relaxed ${ADMIN_TEXT_SECONDARY}`}>
          Visual contract for <code className="font-mono text-xs">adminUi.ts</code>. Internal
          backoffice uses light Tailwind — not pixel <code className="font-mono text-xs">tk-btn</code>.
          Compare after changing admin styles or brand tokens.
        </p>

        <div className="mt-10">
          <Section title="Buttons">
            <div className="flex flex-col gap-3">
              {BUTTON_ROWS.map(({ label, className }) => (
                <div key={label} className="flex flex-wrap items-center gap-3">
                  <span className={`w-32 text-xs font-medium ${ADMIN_TEXT_SECONDARY}`}>
                    {label}
                  </span>
                  <button type="button" className={className}>
                    {label}
                  </button>
                  <button type="button" className={className} disabled>
                    Disabled
                  </button>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Links">
            <div className={`${ADMIN_ARTICLE} flex flex-col gap-2 text-sm`}>
              <a href="#admin-qa" className={ADMIN_LINK}>
                ADMIN_LINK
              </a>
              <a href="#admin-qa" className={ADMIN_LINK_SM}>
                ADMIN_LINK_SM
              </a>
            </div>
          </Section>

          <Section title="Form">
            <div className={`${ADMIN_ARTICLE} max-w-sm`}>
              <label className="block">
                <span className={ADMIN_LABEL}>Cert number</span>
                <input type="text" className={ADMIN_INPUT} placeholder="84956785" />
              </label>
            </div>
          </Section>

          <Section title="Segments and stat card">
            <div className={ADMIN_SEGMENT}>
              <button type="button" className={ADMIN_SEGMENT_BTN_ACTIVE}>
                Active
              </button>
              <button type="button" className={ADMIN_SEGMENT_BTN}>
                Inactive
              </button>
            </div>
            <div className={`${ADMIN_STAT_CARD} mt-4 max-w-xs`}>
              <p className={`text-sm font-semibold ${ADMIN_TEXT_BODY}`}>Stat card</p>
              <p className={`mt-1 text-xs ${ADMIN_TEXT_SECONDARY}`}>ADMIN_STAT_CARD pattern</p>
              <p className="mt-2 font-mono text-lg font-semibold text-zinc-800">1,204</p>
            </div>
          </Section>

          <Section title="Table">
            <div className={ADMIN_TABLE_WRAP}>
              <table className={ADMIN_TABLE}>
                <thead className={ADMIN_TABLE_HEAD}>
                  <tr>
                    <th className={ADMIN_TABLE_TH}>Column</th>
                    <th className={ADMIN_TABLE_TH}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={ADMIN_TABLE_TD}>Example</td>
                    <td className={ADMIN_TABLE_TD}>42</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Danger panel">
            <div className={`${ADMIN_PANEL_DANGER} mb-0`}>
              <h3 className={ADMIN_TITLE_DANGER}>Destructive action</h3>
              <p className={`mt-2 text-sm ${ADMIN_TEXT_SECONDARY}`}>
                ADMIN_PANEL_DANGER + ADMIN_BTN_DANGER for burn/delete flows.
              </p>
              <button type="button" className={`${ADMIN_BTN_DANGER} mt-4`}>
                Confirm danger
              </button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

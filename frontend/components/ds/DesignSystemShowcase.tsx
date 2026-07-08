"use client";

import { useState } from "react";
import {
  TkActionSheet,
  TkBadge,
  TkButton,
  TkCard,
  TkCheckbox,
  TkDialog,
  TkDivider,
  TkField,
  TkInput,
  TkNote,
  TkSearchInput,
  TkStat,
  TkSwitch,
  TkTab,
  TkTable,
  TkTabs,
  TkTag,
} from "@/components/ds";
import type { TkButtonVariant } from "@/components/ds";

const BUTTON_VARIANTS: { variant: TkButtonVariant; label: string }[] = [
  { variant: "primary", label: "Primary" },
  { variant: "primaryInv", label: "Primary inv" },
  { variant: "neutral", label: "Neutral" },
  { variant: "subtle", label: "Subtle" },
  { variant: "danger", label: "Danger" },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 className="tk-heading" style={{ marginBottom: 16 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function DesignSystemShowcase() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="tk-ds-surface tkl-wrap" style={{ paddingTop: 32, paddingBottom: 64 }}>
      <p className="tkl-eyebrow">Designer QA</p>
      <h1 className="tkl-sec-title">Tokenable design system</h1>
      <p className="tkl-sec-sub">
        Visual contract for committed DS primitives. Compare this page after any merge to{" "}
        <code className="tkl-mono">frontend/design-system/</code> (especially{" "}
        <code className="tkl-mono">components/components.css</code> and tokens).
      </p>

      <div style={{ marginTop: 24, maxWidth: 640 }}>
        <TkNote
          tone="brand"
          title="After a DS CSS merge"
          message="Open /dev/design-system and spot-check buttons, inputs, and overlays against the prototype baseline before shipping."
        />
      </div>

      <div style={{ marginTop: 40 }}>
        <Section title="Buttons — variant × size">
          <p className="tk-body-sm" style={{ color: "var(--text-default-secondary)", marginBottom: 16 }}>
            All <code className="tkl-mono">TkButton</code> variants at <code className="tkl-mono">md</code> (default)
            and <code className="tkl-mono">sm</code>.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(7rem, auto) 1fr 1fr",
              gap: "12px 20px",
              alignItems: "center",
              maxWidth: 520,
            }}
          >
            <div />
            <span
              className="tk-body-sm"
              style={{ color: "var(--text-default-tertiary)", fontWeight: 600 }}
            >
              md
            </span>
            <span
              className="tk-body-sm"
              style={{ color: "var(--text-default-tertiary)", fontWeight: 600 }}
            >
              sm
            </span>
            {BUTTON_VARIANTS.map(({ variant, label }) => (
              <ButtonMatrixRow key={variant} variant={variant} label={label} />
            ))}
          </div>

          <p
            className="tk-body-sm"
            style={{ color: "var(--text-default-secondary)", marginTop: 28, marginBottom: 12 }}
          >
            Primary inv on brand panel (typical hero / CTA band usage):
          </p>
          <div
            style={{
              maxWidth: 520,
              padding: "20px 24px",
              background: "var(--brand-500)",
              clipPath: "var(--pixel-notch-lg)",
            }}
          >
            <TkButton variant="primaryInv" size="md">
              Primary inv
            </TkButton>
            <TkButton variant="primaryInv" size="sm" style={{ marginLeft: 12 }}>
              Small
            </TkButton>
          </div>

          <p
            className="tk-body-sm"
            style={{ color: "var(--text-default-secondary)", marginTop: 28, marginBottom: 12 }}
          >
            Disabled (md):
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, maxWidth: 640 }}>
            {BUTTON_VARIANTS.map(({ variant, label }) => (
              <TkButton key={variant} variant={variant} disabled>
                {label}
              </TkButton>
            ))}
          </div>

          <p
            className="tk-body-sm"
            style={{ color: "var(--text-default-secondary)", marginTop: 28, marginBottom: 12 }}
          >
            Decorative <code className="tkl-mono">decorative</code> — labels inside a parent{" "}
            <code className="tkl-mono">Link</code> (watchlist card, not focusable):
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, maxWidth: 640 }}>
            <TkButton variant="primary" size="sm" decorative>
              Buy
            </TkButton>
            <TkButton variant="neutral" size="sm" decorative>
              Bid
            </TkButton>
          </div>
        </Section>

        <Section title="Form">
          <div style={{ maxWidth: 360, display: "flex", flexDirection: "column", gap: 16 }}>
            <TkField label="Cert number" htmlFor="ds-cert" hint="PSA cert digits only">
              <TkInput id="ds-cert" placeholder="84956785" />
            </TkField>
            <TkSearchInput placeholder="Search cards, sets, players…" />
            <TkCheckbox label="Remember me" defaultChecked />
            <TkSwitch label="Email alerts" />
          </div>
        </Section>

        <Section title="Tags & stats">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <TkTag>Base</TkTag>
            <TkTag tone="brand">PSA 10</TkTag>
            <TkTag tone="positive">Vaulted</TkTag>
            <TkTag tone="warning">Rare</TkTag>
            <TkBadge>3</TkBadge>
            <TkStat label="POP" value="1,204" />
          </div>
        </Section>

        <Section title="Tabs">
          <TkTabs>
            <TkTab active={activeTab === 0} onClick={() => setActiveTab(0)}>
              Holdings
            </TkTab>
            <TkTab active={activeTab === 1} onClick={() => setActiveTab(1)}>
              Activity
            </TkTab>
            <TkTab active={activeTab === 2} onClick={() => setActiveTab(2)}>
              Offers
            </TkTab>
          </TkTabs>
        </Section>

        <Section title="Card & note">
          <TkCard padded style={{ maxWidth: 420, marginBottom: 16 }}>
            <p className="tk-body-strong">Van Gogh Pikachu #085</p>
            <p className="tk-body-sm" style={{ color: "var(--text-default-secondary)" }}>
              PSA 10 · Scarlet &amp; Violet Black Star Promos
            </p>
            <p className="tk-title-page-sm" style={{ fontSize: 28, marginTop: 12 }}>
              $2,929
            </p>
          </TkCard>
          <TkNote
            tone="brand"
            title="Vault secured"
            message="Slab is insured while in custody."
          />
        </Section>

        <Section title="Table">
          <TkTable>
            <thead>
              <tr>
                <th>Card</th>
                <th>Grade</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Pikachu Van Gogh</td>
                <td>PSA 10</td>
                <td className="tkl-mono">$2,929</td>
              </tr>
              <tr>
                <td>Charizard Base</td>
                <td>PSA 9</td>
                <td className="tkl-mono">$12,400</td>
              </tr>
            </tbody>
          </TkTable>
        </Section>

        <Section title="Overlays">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <TkButton variant="primary" onClick={() => setDialogOpen(true)}>
              Open dialog
            </TkButton>
            <TkButton variant="neutral" onClick={() => setSheetOpen(true)}>
              Open action sheet
            </TkButton>
          </div>
        </Section>

        <TkDivider />
        <p className="tk-body-sm" style={{ color: "var(--text-default-tertiary)" }}>
          Layout utilities: <code className="tkl-mono">tkl-wrap</code>,{" "}
          <code className="tkl-mono">tkl-eyebrow</code>,{" "}
          <code className="tkl-mono">tk-ds-surface</code>
        </p>
      </div>

      <TkDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Confirm purchase"
        description="Review the listing before you sign the Seaport order."
        footer={
          <>
            <TkButton variant="subtle" onClick={() => setDialogOpen(false)}>
              Cancel
            </TkButton>
            <TkButton variant="primary">Confirm</TkButton>
          </>
        }
      />

      <TkActionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        aria-label="List card"
        actions={
          <>
            <TkButton variant="primary" style={{ width: "100%" }}>
              Confirm list
            </TkButton>
            <TkButton variant="neutral" style={{ width: "100%" }} onClick={() => setSheetOpen(false)}>
              Cancel
            </TkButton>
          </>
        }
      >
        <p
          className="tkl-mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--t3)",
            marginBottom: 6,
          }}
        >
          List card
        </p>
        <p className="tk-body-strong" style={{ marginBottom: 20 }}>
          Van Gogh Pikachu #085
        </p>
        <TkField label="List price (USDC)" htmlFor="ds-list-price">
          <TkInput id="ds-list-price" placeholder="2900" inputMode="decimal" />
        </TkField>
      </TkActionSheet>
    </div>
  );
}

function ButtonMatrixRow({
  variant,
  label,
}: {
  variant: TkButtonVariant;
  label: string;
}) {
  return (
    <>
      <span className="tk-body-sm" style={{ color: "var(--text-default-secondary)", fontWeight: 600 }}>
        {label}
      </span>
      <TkButton variant={variant} size="md">
        {label}
      </TkButton>
      <TkButton variant={variant} size="sm">
        {label}
      </TkButton>
    </>
  );
}

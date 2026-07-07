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
      <p className="tkl-eyebrow">Phase 1</p>
      <h1 className="tkl-sec-title">Tokenable design system</h1>
      <p className="tkl-sec-sub">
        Primitives for the Azure pixel UI. Production routes still use the legacy
        shell until Phase 2.
      </p>

      <div style={{ marginTop: 40 }}>
        <Section title="Buttons">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <TkButton variant="primary">Primary</TkButton>
            <TkButton variant="neutral">Neutral</TkButton>
            <TkButton variant="subtle">Subtle</TkButton>
            <TkButton variant="danger">Danger</TkButton>
            <TkButton variant="primary" size="sm">
              Small
            </TkButton>
            <TkButton variant="primary" disabled>
              Disabled
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

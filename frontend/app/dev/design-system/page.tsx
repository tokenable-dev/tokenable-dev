import { DsButtonShowcase } from "@/components/ds/DsButtonShowcase";

/** Designer handoff showcase — live TkButton strip + standalone bundle iframe. */
export default function DesignSystemDevPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <DsButtonShowcase />
      <iframe
        title="Tokenable Design System"
        src="/design-system-standalone.html"
        style={{
          display: "block",
          width: "100%",
          flex: 1,
          minHeight: "80vh",
          border: 0,
          background: "#0e0e0e",
        }}
      />
    </div>
  );
}

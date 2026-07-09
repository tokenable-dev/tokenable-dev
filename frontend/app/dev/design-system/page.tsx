/** Designer handoff showcase — full standalone bundle (chrome hidden via TkHeader). */
export default function DesignSystemDevPage() {
  return (
    <iframe
      title="Tokenable Design System"
      src="/design-system-standalone.html"
      style={{
        display: "block",
        width: "100%",
        minHeight: "100vh",
        border: 0,
        background: "#0e0e0e",
      }}
    />
  );
}

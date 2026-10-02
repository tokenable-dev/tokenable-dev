"use client";

import { TkStepper, type TkStepperProps } from "@/components/ds/Stepper";

const samples: { title: string; props: TkStepperProps }[] = [
  {
    title: "Vaulting — in progress",
    props: {
      theme: "dark",
      steps: [
        { label: "Submit", sub: "Verified", state: "done" },
        { label: "Ship", sub: "In transit", state: "done" },
        { label: "PSA", sub: "Reviewing", state: "current" },
        { label: "Live", state: "todo" },
      ],
    },
  },
  {
    title: "All complete",
    props: {
      theme: "dark",
      steps: [
        { label: "Submit", sub: "Verified", state: "done" },
        { label: "Ship", sub: "Delivered", state: "done" },
        { label: "PSA", sub: "Approved", state: "done" },
        { label: "Live", sub: "Listed", state: "done" },
      ],
    },
  },
  {
    title: "Rejected at intake",
    props: {
      theme: "dark",
      steps: [
        { label: "Submit", sub: "Verified", state: "done" },
        { label: "Ship", sub: "Delivered", state: "done" },
        { label: "PSA", sub: "Rejected", state: "rejected" },
        { label: "Live", state: "todo" },
      ],
    },
  },
  {
    title: "Ship to PSA — current (light)",
    props: {
      theme: "light",
      steps: [
        { label: "Submit", sub: "Verified", state: "done" },
        { label: "Ship", sub: "Pending", state: "current" },
        { label: "PSA", state: "todo" },
        { label: "Live", state: "todo" },
      ],
    },
  },
  {
    title: "All complete (light)",
    props: {
      theme: "light",
      steps: [
        { label: "Submit", sub: "Verified", state: "done" },
        { label: "Ship", sub: "Delivered", state: "done" },
        { label: "PSA", sub: "Approved", state: "done" },
        { label: "Live", sub: "Listed", state: "done" },
      ],
    },
  },
  {
    title: "Refund — in progress",
    props: {
      theme: "dark",
      orientation: "vertical",
      steps: [
        { label: "Report approved", sub: "Aug 28", state: "done" },
        { label: "Return the card", sub: "Ship it back", state: "current" },
        { label: "Seller confirms", state: "todo" },
        { label: "Refunded", state: "todo" },
      ],
    },
  },
  {
    title: "Withdrawal — complete",
    props: {
      theme: "dark",
      orientation: "vertical",
      steps: [
        { label: "Requested", sub: "Aug 7", state: "done" },
        { label: "Processing", sub: "1–3 days", state: "done" },
        { label: "Paid to your bank", state: "done" },
      ],
    },
  },
];

export function DsStepperShowcase() {
  return (
    <section
      aria-label="TkStepper variants"
      style={{
        padding: "20px clamp(16px, 4vw, 40px) 28px",
        background: "#0e0e0e",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--t3)",
          marginBottom: 6,
        }}
      >
        TkStepper · live (Progress-standalone)
      </div>
      <p
        style={{
          fontSize: 13,
          color: "rgba(255,255,255,0.55)",
          maxWidth: 640,
          lineHeight: 1.5,
          margin: "0 0 18px",
        }}
      >
        Shared progress stepper — dark / light palettes, horizontal and vertical.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {samples.map((sample) => {
          const light = sample.props.theme === "light";
          return (
            <div
              key={sample.title}
              style={{
                background: light ? "#DCE4E7" : "#141419",
                border: light
                  ? "1px solid rgba(22,48,43,0.10)"
                  : "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16,
                padding: "22px 20px",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: light ? "rgba(22,48,43,0.55)" : "rgba(255,255,255,0.4)",
                  marginBottom: 16,
                }}
              >
                {sample.title}
              </div>
              <TkStepper {...sample.props} aria-label={sample.title} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

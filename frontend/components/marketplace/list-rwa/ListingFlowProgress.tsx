"use client";

import type { ListRwaModalStep } from "@/lib/seaport/listing/listRwaModalTypes";

const LIST_FLOW_STEPS = ["Approve", "Sign", "Submit"] as const;

/** 0 = Approve, 1 = Sign, 2 = Submit (+ hidden instant match). -1 = not started. */
function listFlowActiveIndex(step: ListRwaModalStep): number {
  if (step === "approving") return 0;
  if (step === "signing") return 1;
  if (step === "submitting" || step === "matching") return 2;
  return -1;
}

type ListFlowStepStatus = "upcoming" | "current" | "complete";

function listFlowStepStatus(step: ListRwaModalStep, index: number): ListFlowStepStatus {
  const active = listFlowActiveIndex(step);
  if (active < 0) return "upcoming";
  if (index < active) return "complete";
  if (index === active) return "current";
  return "upcoming";
}

function ListFlowStepNode({
  title,
  status,
}: {
  title: string;
  status: ListFlowStepStatus;
}) {
  return (
    <div className="flex min-w-[3.25rem] shrink-0 flex-col items-center gap-1 sm:min-w-[3.5rem]">
      <div className="flex h-2.5 items-center justify-center" aria-hidden>
        {status === "complete" ? (
          <span className="h-1.5 w-1.5 rounded-full bg-mint/70 transition-colors duration-500" />
        ) : status === "current" ? (
          <span className="relative flex h-2 w-2 items-center justify-center">
            <span className="absolute inset-0 rounded-full border border-mint/45" />
            <span className="h-1 w-1 rounded-full bg-mint/80 animate-pulse" />
          </span>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-600/70" />
        )}
      </div>
      <span
        className={`text-center text-[10px] leading-none tracking-wide transition-colors duration-500 ${
          status === "complete"
            ? "text-zinc-400"
            : status === "current"
              ? "font-medium text-mint/85"
              : "text-zinc-600"
        }`}
      >
        {status === "complete" ? (
          <span className="text-mint/55" aria-hidden>
            ✓{" "}
          </span>
        ) : null}
        {title}
      </span>
    </div>
  );
}

function ListFlowConnector({
  fill,
  inProgress,
}: {
  fill: "none" | "partial" | "full";
  inProgress: boolean;
}) {
  return (
    <div
      className="relative mx-0.5 h-px min-w-[0.5rem] flex-1 overflow-hidden rounded-full bg-zinc-800"
      aria-hidden
    >
      <div
        className={`absolute inset-y-0 left-0 rounded-full bg-mint/45 transition-[width] duration-700 ease-out ${
          fill === "full" ? "w-full" : fill === "partial" ? "w-[36%]" : "w-0"
        } ${inProgress && fill === "partial" ? "opacity-90" : ""}`}
      />
    </div>
  );
}

/** Approve → Sign → Submit with animated connectors (instant match not shown). */
export function ListingFlowProgress({ step }: { step: ListRwaModalStep }) {
  const activeIdx = listFlowActiveIndex(step);
  const busy =
    step === "approving" ||
    step === "signing" ||
    step === "submitting" ||
    step === "matching";

  return (
    <div
      className="w-full"
      role="group"
      aria-label="Listing progress"
      aria-busy={busy}
    >
      <div className="flex w-full items-center px-0.5 py-1">
        {LIST_FLOW_STEPS.flatMap((title, i) => {
          const nodes = [];
          if (i > 0) {
            nodes.push(
              <ListFlowConnector
                key={`flow-connector-${i}`}
                fill={
                  activeIdx >= i
                    ? "full"
                    : activeIdx === i - 1
                      ? "partial"
                      : "none"
                }
                inProgress={busy && activeIdx === i - 1}
              />,
            );
          }
          nodes.push(
            <ListFlowStepNode
              key={`flow-step-${title}`}
              title={title}
              status={listFlowStepStatus(step, i)}
            />,
          );
          return nodes;
        })}
      </div>
    </div>
  );
}

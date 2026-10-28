"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { FAQ_SUPPORT_EMAIL, useFaqGroups } from "./faqContent";

function FaqChevron() {
  return (
    <svg className="tkfd-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export type FaqDrawerProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Bottom drawer mirroring `/faq` content (`tk-faq-drawer.js`).
 * Opened by any `[data-faq-open]` click (see FaqDrawerHost).
 */
export function FaqDrawer({ open, onClose }: FaqDrawerProps) {
  const t = useTranslations("Faq");
  const groups = useFaqGroups();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const groupRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setExpanded({});
      setActiveTab(0);
    }
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const scrollToGroup = (index: number) => {
    setActiveTab(index);
    const body = bodyRef.current;
    const group = groupRefs.current[index];
    if (!body || !group) return;
    const top = group.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 8;
    body.scrollTo({ top, behavior: "smooth" });
  };

  return createPortal(
    <div
      id="tk-faq-drawer"
      className="tk-faq-drawer open"
      aria-hidden="false"
    >
      <div className="tkfd-scrim" data-faq-close onClick={onClose} />
      <div className="tkfd-sheet" role="dialog" aria-modal="true" aria-label={t("drawerLabel")}>
        <div className="tkfd-top">
          <div className="tkfd-grip" aria-hidden />
          <div className="tkfd-head">
            <h3>{t("title")}</h3>
            <button type="button" className="tkfd-close" data-faq-close aria-label={t("close")} onClick={onClose}>
              ✕
            </button>
          </div>
          <p className="tkfd-sub">
            {t("drawerSub")}{" "}
            <a className="tkfd-mail" href={FAQ_SUPPORT_EMAIL}>
              {t("emailUs")}
            </a>
          </p>
          <div className="tkfd-tabs" role="tablist" aria-label={t("categories")}>
            {groups.map((group, i) => (
              <button
                key={group.id}
                type="button"
                role="tab"
                aria-selected={activeTab === i}
                className={`tkfd-tab${activeTab === i ? " on" : ""}`}
                data-faq-tab={i}
                onClick={() => scrollToGroup(i)}
              >
                {group.heading}
              </button>
            ))}
          </div>
        </div>
        <div className="tkfd-body" ref={bodyRef}>
          {groups.map((group, gi) => (
            <div
              key={group.id}
              className="tkfd-group"
              id={`tkfd-g${gi}`}
              ref={(el) => {
                groupRefs.current[gi] = el;
              }}
            >
              <div className="tkfd-group__h">{group.heading}</div>
              {group.items.map((item) => {
                const id = `${group.id}:${item.id}`;
                const isOpen = Boolean(expanded[id]);
                return (
                  <div key={item.id} className={`tkfd-item${isOpen ? " open" : ""}`}>
                    <button
                      type="button"
                      className="tkfd-q"
                      aria-expanded={isOpen}
                      onClick={() => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))}
                    >
                      {item.q}
                      <FaqChevron />
                    </button>
                    <div className="tkfd-a">
                      <div className="tkfd-a__inner">{item.a}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div className="tkfd-tail" aria-hidden />
        </div>
      </div>
    </div>,
    document.body,
  );
}

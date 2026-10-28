"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FAQ_SUPPORT_EMAIL, useFaqGroups } from "./faqContent";

function FaqChevron() {
  return (
    <svg className="faq-page__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function FaqPage() {
  const t = useTranslations("Faq");
  const groups = useFaqGroups();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <section className="faq-page">
      <div className="faq-page__inner">
      <span className="faq-page__eyebrow">{t("eyebrow")}</span>
      <h1 className="faq-page__title">{t("title")}</h1>
      <p className="faq-page__sub">
        {t("sub")}{" "}
        <a className="faq-page__tlink" href={FAQ_SUPPORT_EMAIL}>
          {t("contact")}
        </a>
        .
      </p>

      <div className="faq-page__groups">
        {groups.map((group) => (
          <div key={group.id} className="faq-page__group">
            <h2 className="faq-page__group-h">{group.heading}</h2>
            {group.items.map((item) => {
              const id = `${group.id}:${item.id}`;
              const isOpen = Boolean(open[id]);
              return (
                <div key={item.id} className={`faq-page__item${isOpen ? " faq-page__item--open" : ""}`}>
                  <button
                    type="button"
                    className="faq-page__q"
                    aria-expanded={isOpen}
                    onClick={() => setOpen((prev) => ({ ...prev, [id]: !prev[id] }))}
                  >
                    {item.q}
                    <FaqChevron />
                  </button>
                  <div className="faq-page__a">
                    <div className="faq-page__a-inner">{item.a}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="faq-page__cta">
        <div>
          <h2>{t("still")}</h2>
          <p>{t("reply")}</p>
        </div>
        <a className="faq-page__cta-btn" href={FAQ_SUPPORT_EMAIL}>
          {t("contact")}
        </a>
      </div>
      </div>
    </section>
  );
}

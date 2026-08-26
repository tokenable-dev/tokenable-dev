import Link from "next/link";

/** Partner-Portfolio.html page header — copy + quiet link to redeem queue. */
export function PartnerPortfolioHeader() {
  return (
    <header className="pf-hero partner-portfolio-header" aria-label="Partner portfolio">
      <div className="partner-portfolio-header__row">
        <div className="partner-portfolio-header__copy">
          <span className="pf-hero__eyebrow">Partner portfolio</span>
          <h1 className="pf-sec-title tkl-sec-title">Your trading history</h1>
        </div>
        <Link href="/partner/shipments" className="tkl-view-all">
          Redeem requests →
        </Link>
      </div>
    </header>
  );
}

function AuthIcon() {
  return (
    <svg width={30} height={30} viewBox="0 0 12 12" shapeRendering="crispEdges" fill="currentColor" aria-hidden>
      <path d="M6 0 1 2v4c0 3 2 4.5 5 6 3-1.5 5-3 5-6V2L6 0Zm0 2.4 3 1.2V6c0 1.8-1.1 2.9-3 3.8C4.1 8.9 3 7.8 3 6V3.6l3-1.2Z" />
      <rect x={5} y={4} width={2} height={4} />
      <rect x={4} y={5} width={4} height={2} />
    </svg>
  );
}

function VaultIcon() {
  return (
    <svg width={30} height={30} viewBox="0 0 12 12" shapeRendering="crispEdges" fill="currentColor" aria-hidden>
      <rect x={1} y={3} width={10} height={8} />
      <rect x={3} y={3} width={6} height={2} fill="#1a1a1e" />
      <rect x={3} y={1} width={6} height={3} />
      <rect x={5} y={6} width={2} height={3} fill="#1a1a1e" />
    </svg>
  );
}

function LiquidityIcon() {
  return (
    <svg width={30} height={30} viewBox="0 0 12 12" shapeRendering="crispEdges" fill="currentColor" aria-hidden>
      <rect x={1} y={7} width={2} height={4} />
      <rect x={5} y={4} width={2} height={7} />
      <rect x={9} y={1} width={2} height={10} />
    </svg>
  );
}

export function HomeFeatures() {
  return (
    <section id="home-features" className="home-features-band">
      <div className="tkl-wrap home-features-band__inner">
          <div className="home-features-band__intro">
            <h2 className="tkl-sec-title">
              Three guarantees
              <br />
              for every token.
            </h2>
            <p className="tkl-sec-sub">
              Every card is graded, custodied, and tokenized before it ever reaches the
              order book — so what you trade is exactly what you own.
            </p>
          </div>

          <div className="feat-grid">
            <div className="feat">
              <div className="feat__head">
                <div className="feat__ix">
                  <AuthIcon />
                </div>
                <span className="feat__num">01</span>
              </div>
              <h3>Authentication &amp; grading</h3>
              <p>
                Only cards graded by trusted authorities are accepted onto the platform —
                no raw, no self-reported condition.
              </p>
              <div className="feat__chips">
                {["PSA", "BGS", "SGC", "CGC", "TAG"].map((label) => (
                  <span key={label} className="pchip">
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="feat">
              <div className="feat__head">
                <div className="feat__ix">
                  <VaultIcon />
                </div>
                <span className="feat__num">02</span>
              </div>
              <h3>Vaulting</h3>
              <p>
                Cards are held in secure custody with intake verified against the
                grader&apos;s certification database — so every token is backed by a
                specific, verified card.
              </p>
              <div className="feat__chips feat__chips--wide">
                <span className="pstat">
                  <span className="k">Intake</span>
                  <b>Cert-matched</b>
                </span>
                <span className="pstat">
                  <span className="k">Backing</span>
                  <b>1:1</b>
                </span>
              </div>
            </div>

            <div className="feat">
              <div className="feat__head">
                <div className="feat__ix">
                  <LiquidityIcon />
                </div>
                <span className="feat__num">03</span>
              </div>
              <h3>Liquidity via on-chain settlement</h3>
              <p>
                Cards stay vaulted while transactions settle atomically — continuous
                trading with no shipping, fees, customs, chargebacks, returns, or
                counterfeit risk.
              </p>
              <div className="feat__chips feat__chips--wide">
                <span className="pchip">
                  <span className="dot" />
                  Atomic
                </span>
                <span className="pchip">
                  <span className="dot" />
                  No counterfeit risk
                </span>
              </div>
            </div>
          </div>
        </div>
    </section>
  );
}

function AuthIcon() {
  return (
    <svg width={42} height={42} viewBox="0 0 12 12" shapeRendering="crispEdges" fill="currentColor" aria-hidden>
      <path d="M6 0 1 2v4c0 3 2 4.5 5 6 3-1.5 5-3 5-6V2L6 0Zm0 2.4 3 1.2V6c0 1.8-1.1 2.9-3 3.8C4.1 8.9 3 7.8 3 6V3.6l3-1.2Z" />
      <rect x={5} y={4} width={2} height={4} />
      <rect x={4} y={5} width={4} height={2} />
    </svg>
  );
}

function VaultIcon() {
  return (
    <svg width={42} height={42} viewBox="0 0 12 12" shapeRendering="crispEdges" fill="currentColor" aria-hidden>
      <rect x={1} y={3} width={10} height={8} />
      <rect x={3} y={3} width={6} height={2} fill="#0e0e0e" />
      <rect x={3} y={1} width={6} height={3} />
      <rect x={5} y={6} width={2} height={3} fill="#0e0e0e" />
    </svg>
  );
}

function SettlementIcon() {
  return (
    <svg width={40} height={40} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 2 L4 13 L10.5 13 L9 22 L20 10 L13.5 10 Z" />
    </svg>
  );
}

export function HomeFeatures() {
  return (
    <section id="home-features" className="home-features-band">
      <div className="tkl-wrap home-features-band__inner">
          <div className="home-features-band__intro">
            <h2 className="tkl-sec-title">Three guarantees for every card</h2>
            <p className="tkl-sec-sub">
              All tokenized cards listed on our platform are graded, verified,
              vaulted, insured, and settle instantly on-chain.
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
              <h3>Authenticated and graded</h3>
              <p>
                Only PSA and BGS 10 graded cards are vaulted and listed for trading on our platform.
              </p>
              <div className="feat__chips">
                {["PSA", "BGS"].map((label) => (
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
                All cards are held in PSA or Tokenable vaults and fully insured.
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
                  <SettlementIcon />
                </div>
                <span className="feat__num">03</span>
              </div>
              <h3>Instant settlement</h3>
              <p>
                Trades settle on-chain in seconds. No shipping, customs, or chargebacks.
              </p>
              <div className="feat__chips feat__chips--wide">
                <span className="pchip">
                  <span className="dot" />
                  Atomic
                </span>
                <span className="pchip">
                  <span className="dot" />
                  Onchain
                </span>
              </div>
            </div>
          </div>
        </div>
    </section>
  );
}

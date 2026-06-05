import { ASSETS } from "@/constants/assets";

const OFFERS = [
  {
    icon: ASSETS.icons.landingOffersAuthenticity,
    title: "Authenticity.",
    body: "Only cards graded by the best: PSA, BGS, SGC, CGC, and TAG are accepted to provide assurance of the authenticity of all collectibles on the Tokenable platform.",
  },
  {
    icon: ASSETS.icons.landingOffersPsaVaults,
    title: "PSA Vaults.",
    body: "Cards are held in secure custody at PSA with intake verification against the PSA certification database, ensuring each token is backed by re-verified and authenticated graded card.",
  },
  {
    icon: ASSETS.icons.landingOffersLiquidity,
    title: "Liquidity.",
    body: "Cards stay vaulted while transactions settle onchain instantly, enabling continuous trading with no shipping, fees, customs, chargebacks, returns, or counterfeit risk.",
  },
] as const;

const OFFER_ICON_CLASS =
  "h-11 w-11 shrink-0 object-contain object-center invert sm:h-12 sm:w-12";

function OfferRow({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="grid grid-cols-[3rem_1fr] items-start gap-x-5 sm:grid-cols-[3.25rem_1fr] sm:gap-x-8">
      <div className="flex h-full items-center justify-center pt-0.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon} alt="" width={48} height={48} className={OFFER_ICON_CLASS} aria-hidden />
      </div>
      <p className="text-[15px] leading-relaxed text-gray-400 sm:text-base sm:leading-[1.65]">
        <span className="font-semibold text-white">{title}</span> {body}
      </p>
    </div>
  );
}

/** Landing bottom — value props (Authenticity, PSA Vaults, Liquidity). */
export function LandingOffersSection() {
  return (
    <section className="relative z-10 mx-auto max-w-3xl border-t border-white/[0.06] px-6 py-14 sm:max-w-4xl sm:py-20">
      <h2 className="mb-10 text-lg font-bold leading-snug text-white sm:mb-12 sm:text-xl sm:leading-snug">
        Trading Collectibles on Tokenable
      </h2>

      <div className="flex flex-col gap-10 sm:gap-12">
        {OFFERS.map((offer) => (
          <OfferRow key={offer.title} {...offer} />
        ))}
      </div>
    </section>
  );
}

import { ASSETS } from "@/constants/assets";

const OFFERS = [
  {
    icon: ASSETS.icons.landingOffersAuthenticity,
    title: "Authenticity",
    body: "Only cards graded 9+ by PSA, BGS, SGC, and TAG are accepted to provide the highest grades and authenticity.",
  },
  {
    icon: ASSETS.icons.landingOffersPsaVaults,
    title: "Security",
    body: "Cards are held in secure custody at PSA vaults with intake verification ensuring that each graded card is authentic and safely stored.",
  },
  {
    icon: ASSETS.icons.landingOffersLiquidity,
    title: "Liquidity",
    body: "Transactions settle on-chain instantly, enabling continuous trading with no delivery, customs, chargebacks, or returns.",
  },
] as const;

const OFFER_ICON_CLASS =
  "mx-auto h-20 w-20 object-contain object-center invert sm:h-24 sm:w-24 md:h-28 md:w-28";

function OfferColumn({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={icon} alt="" width={112} height={112} className={OFFER_ICON_CLASS} aria-hidden />
      <h3 className="mt-6 text-xl font-bold text-white sm:mt-8 sm:text-2xl md:text-[1.625rem]">{title}</h3>
      <p className="mt-4 max-w-[20rem] text-base leading-relaxed text-gray-400 sm:mt-5 sm:max-w-[17rem] sm:text-lg sm:leading-[1.7] md:max-w-[18rem]">
        {body}
      </p>
    </div>
  );
}

/** Landing — value props (Authenticity, Security, Liquidity). */
export function LandingOffersSection() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl border-t border-white/[0.06] px-6 py-16 sm:max-w-7xl sm:py-24">
      <h2 className="mb-14 text-center text-xl font-medium leading-snug text-gray-400 sm:mb-20 sm:text-2xl md:text-3xl lg:text-[2rem]">
        What value does Tokenable provide users?
      </h2>

      <div className="grid grid-cols-1 gap-14 sm:grid-cols-3 sm:gap-10 md:gap-12 lg:gap-14">
        {OFFERS.map((offer) => (
          <OfferColumn key={offer.title} {...offer} />
        ))}
      </div>
    </section>
  );
}

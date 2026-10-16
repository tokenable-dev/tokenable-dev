import type { ReactNode } from "react";

export type FaqItem = { q: string; a: ReactNode };
export type FaqGroup = { heading: string; items: FaqItem[] };

/** Answers in faq.js use a few `<strong>` spans. */
function faqAnswer(html: string): ReactNode {
  const parts = html.split(/(<strong>.*?<\/strong>)/g);
  return parts.map((part, i) => {
    const marked = part.match(/^<strong>(.*)<\/strong>$/);
    if (marked) return <strong key={i}>{marked[1]}</strong>;
    return part;
  });
}

/** Shared FAQ copy — `/faq` and the footer drawer both mirror faq.js. */
export const FAQ_GROUPS: FaqGroup[] = [
  {
    heading: "Payments and funding",
    items: [
      {
        q: "Do I need crypto or a wallet to buy?",
        a: "No. Sign in with your email or a social login and a secure wallet is created for you automatically, nothing to install or set up. Already have a wallet? Log in with it and use it directly. Either way, only you control it. Pay with a card or with crypto, whichever you prefer.",
      },
      {
        q: "What is Add funds for?",
        a: "Add funds tops up your own wallet so you can bid and buy instantly, without re-entering card details each time. Pay by debit or credit card, or send crypto, and the money lands as USDC in your wallet, which only you control. Tokenable never holds your balance.",
      },
      {
        q: "Does Tokenable hold my money?",
        a: "No. Your funds stay in your own wallet, created for you when you sign in, held as USDC and controlled only by you. Adding funds simply moves money into your wallet, and we never hold or move your balance.",
      },
      {
        q: "Can I pay with a credit or debit card?",
        a: "Yes, including Apple Pay and Google Pay. Use it to add funds or to check out.",
      },
      {
        q: "What currency is my balance in?",
        a: "US dollars. Prices and fees are shown in USD, and your funds are held as USDC in your own wallet. Tokenable is non-custodial and never holds your money.",
      },
      {
        q: "Can I cash out?",
        a: "Yes. Withdraw from your wallet anytime, to your bank or to an external crypto wallet. You’ll see the amount, fee and destination before you confirm.",
      },
    ],
  },
  {
    heading: "Buying",
    items: [
      {
        q: "How does buying a card work?",
        a: "Every card is already graded and vaulted. When you tap Buy, you purchase at the lowest listed price and own it instantly, while the physical card stays safely in the vault. No shipping unless you choose to redeem it.",
      },
      {
        q: "What fees do I pay when I buy?",
        a: "There’s no percentage fee and no Tokenable commission. When you buy a listing you settle the trade on Ethereum, so you pay the network (gas) fee, which varies and is shown at checkout before you confirm. Placing a bid is free, and if your bid is later filled, the seller settles it, so you pay nothing.",
      },
      {
        q: "Do I pay gas or network fees?",
        a: "Trades settle on Ethereum, and whoever settles a trade pays the network (gas) fee, shown at checkout. That’s you when you buy a listing, and the seller when they accept a bid. Posting a bid or a listing is free. The fee goes to the network, not to Tokenable.",
      },
      {
        q: "How do I buy with confidence?",
        a: "Most listings are PSA Vault cards: verified against their PSA certification and insured before they go live, marked with the PSA Vault badge. Partner-vault cards come directly from a seller, so we show the cert number, grade, vault, and seller up front, and every card has an Asset Passport you can review. If you want only verified, insured cards, filter for the PSA Vault badge.",
      },
      {
        q: "What does “Select your card” mean?",
        a: "When several cards are listed at the same lowest price, buying opens Select your card so you choose the exact one. You can see how many cards are at that price, filter by vault, and pick by cert number. Same price, but the individual card is your choice.",
      },
    ],
  },
  {
    heading: "Custody and ownership",
    items: [
      {
        q: "Where is my card physically kept?",
        a: "In an access-controlled vault. Cards in PSA Vault are stored and insured there; partner-vault cards are held by the seller who listed them. You own it outright, and ownership is recorded to your account and independently verifiable.",
      },
      {
        q: "How do I prove I own it?",
        a: faqAnswer(
          "Your <strong>Certificate of Ownership</strong> records the cert number and your ownership on-chain, so anyone can independently verify it. The card can be checked against its PSA certification.",
        ),
      },
      {
        q: "Is my card insured?",
        a: faqAnswer(
          "Cards are insured for full replacement value while stored at <strong>PSA Vault</strong>. Partner-vault cards are held by the seller who listed them and are not insured by us.",
        ),
      },
    ],
  },
  {
    heading: "Vaults",
    items: [
      {
        q: "What is a vault?",
        a: "A vault is where a card sits while it is listed and traded. Because the card stays in one place, it can be bought and sold without being shipped each time. When you want the physical card, you redeem it.",
      },
      {
        q: "What’s the difference between PSA Vault and Partner vault?",
        a: faqAnswer(
          "With <strong>PSA Vault</strong>, the card is sent to PSA, checked against its certification, and stored and insured there. With <strong>Partner vault</strong>, the owner keeps the card themselves, so we do not hold, verify or insure it.",
        ),
      },
      {
        q: "Which vault should I choose?",
        a: faqAnswer(
          "Choose <strong>PSA Vault</strong> if you want the card verified, stored, and insured before it goes live, and can wait for shipping and intake. Choose <strong>Partner vault</strong> if you want to list today without shipping and are comfortable standing behind the card yourself.",
        ),
      },
      {
        q: "Which cards can be listed?",
        a: "High-grade PSA and BGS cards: PSA 9 and 10, and BGS 9.5, 10, and Pristine (Black Label).",
      },
      {
        q: "If I sell a Partner-vault card, what am I responsible for?",
        a: "When you list a partner-vault card, you’re standing behind it. Make sure it’s authentic, the grade and cert number are correct, and the condition matches your listing. You’ll ship it when a redemption calls for it.",
      },
      {
        q: "Who verifies the card is real?",
        a: "Cards sent to PSA Vault are matched to their PSA certification at intake, so they’re verified before they go live. Partner-vault cards aren’t verified by us at listing, so the seller stands behind them. Look for the PSA Vault badge for cards checked before listing.",
      },
    ],
  },
  {
    heading: "Selling",
    items: [
      {
        q: "How do I sell a card I own?",
        a: faqAnswer(
          "Open the card and choose <strong>Sell / List</strong>. First-time sellers complete a one-time identity check (KYC, handled by Sumsub); after that you just confirm the seller terms and set a price.",
        ),
      },
      {
        q: "What fees do I pay when I sell?",
        a: faqAnswer(
          "There’s a <strong>5% platform fee</strong> on the sale, taken from your proceeds (e.g. sell at $25,000 → you receive $23,750). Listing is free; the first time you sell, a one-time approval (a small Ethereum network fee) lets the marketplace move your cards. If you accept a bid, you settle it on-chain and pay that network fee. Storage at PSA Vault is free; redeeming later has its own per-card fee plus shipping. All costs are shown before you confirm.",
        ),
      },
      {
        q: "When is the selling fee charged?",
        a: "There’s nothing to pay to list, and no platform fee until a sale settles. That’s when the 5% applies. The only upfront cost is a one-time approval (a small Ethereum network fee) the first time you sell.",
      },
    ],
  },
  {
    heading: "Redemption",
    items: [
      {
        q: "Can I get the physical card shipped to me?",
        a: faqAnswer(
          "Anytime. Choose <strong>Ship from vault</strong> to redeem. The physical card is then shipped to your address by whoever holds it: PSA for PSA Vault cards, or the seller for partner-vault cards. It ships with tracking.",
        ),
      },
      {
        q: "What does it cost to get the physical card (redeem)?",
        a: faqAnswer(
          "A per-card <strong>Redemption fee</strong> plus shipping at cost. Shown before you confirm.",
        ),
      },
      {
        q: "How long does redemption take?",
        a: "Until you redeem, the physical card stays in the vault; a trade only moves ownership on-chain. When you redeem, it is shipped by whoever holds it: PSA for a PSA Vault card, or the seller for a partner-vault card. A partner-vault seller has 5 days to ship, and if they miss it, your request is cancelled and fully refunded. After it ships, delivery time depends on your destination and customs, and you’ll always have tracking.",
      },
    ],
  },
];

export const FAQ_SUPPORT_EMAIL = "mailto:dev@tokenable.io";

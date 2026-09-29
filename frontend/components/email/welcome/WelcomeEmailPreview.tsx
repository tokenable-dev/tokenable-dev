import Image from "next/image";
import Link from "next/link";

function FeatureIconBox({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] bg-white/[0.05]"
      aria-hidden
    >
      {children}
    </span>
  );
}

function FeatureRow({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl bg-[#101016] py-4 pl-0 pr-4">
      <FeatureIconBox>{icon}</FeatureIconBox>
      <div className="min-w-0">
        <p className="m-0 text-base font-bold leading-[1.35] text-white sm:text-[14.5px]">
          {title}
        </p>
        <p className="m-0 mt-0.5 text-[15px] leading-normal text-[rgba(233,238,251,0.55)] sm:text-[13.5px]">
          {body}
        </p>
      </div>
    </div>
  );
}

const shieldIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
    viewBox="0 0 22 22"
    fill="none"
  >
    <path
      d="M18.3239 1.8324H3.66479V3.66478H18.3239V1.8324Z"
      fill="#E9EEFB"
    />
    <path
      d="M3.66478 3.66479H1.8324V12.8267H3.66478V3.66479Z"
      fill="#E9EEFB"
    />
    <path
      d="M20.1574 3.66498H18.325V12.8269H20.1574V3.66498Z"
      fill="#E9EEFB"
    />
    <path
      d="M5.49718 12.8275H3.66479V14.6599H5.49718V12.8275Z"
      fill="#E9EEFB"
    />
    <path
      d="M7.32988 14.66H5.4975V16.4924H7.32988V14.66Z"
      fill="#E9EEFB"
    />
    <path
      d="M12.8272 18.325H9.16248V20.1574H12.8272V18.325Z"
      fill="#E9EEFB"
    />
    <path
      d="M16.4921 12.8275H18.3245V14.6599H16.4921V12.8275Z"
      fill="#E9EEFB"
    />
    <path
      d="M14.6601 14.66H16.4925V16.4924H14.6601V14.66Z"
      fill="#E9EEFB"
    />
    <path
      d="M12.8272 16.4925H14.6595V18.3249H12.8272V16.4925Z"
      fill="#E9EEFB"
    />
    <path
      d="M7.33009 16.4925H9.16248V18.3249H7.33009V16.4925Z"
      fill="#E9EEFB"
    />
  </svg>
);

const vaultIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
    viewBox="0 0 22 22"
    fill="none"
  >
    <path
      d="M19.2411 1.8324H2.7486V3.6649H19.2411V1.8324Z"
      fill="#E9EEFB"
    />
    <path
      d="M19.2413 6.41376H2.74878V8.24626H19.2413V6.41376Z"
      fill="#E9EEFB"
    />
    <path
      d="M2.74858 3.66479H0.916199V6.41337H2.74858V3.66479Z"
      fill="#E9EEFB"
    />
    <path
      d="M21.0737 3.66498H19.2413V6.41355H21.0737V3.66498Z"
      fill="#E9EEFB"
    />
    <path
      d="M19.2411 8.24628H17.4088V18.3244H19.2411V8.24628Z"
      fill="#E9EEFB"
    />
    <path
      d="M4.58116 8.24628H2.74878V18.3244H4.58116V8.24628Z"
      fill="#E9EEFB"
    />
    <path
      d="M17.4079 18.325H4.58124V20.1574H17.4079V18.325Z"
      fill="#E9EEFB"
    />
    <path
      d="M13.7434 10.0787H8.24628V11.9111H13.7434V10.0787Z"
      fill="#E9EEFB"
    />
  </svg>
);

const settleIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
    viewBox="0 0 22 22"
    fill="none"
  >
    <path
      d="M3.6649 11.9112H10.9949V17.4087H12.8274V19.2412H10.9949V21.0737H9.1624V13.7437H1.8324V10.0787H3.6649V11.9112ZM14.6599 17.4087H12.8274V15.5762H14.6599V17.4087ZM16.4924 15.5762H14.6599V13.7437H16.4924V15.5762ZM18.3249 13.7437H16.4924V11.9112H18.3249V13.7437ZM12.8274 8.2462H20.1574V11.9112H18.3249V10.0787H10.9949V4.5812H9.1624V2.7487H10.9949V0.916199H12.8274V8.2462ZM5.4974 10.0787H3.6649V8.2462H5.4974V10.0787ZM7.3299 8.2462H5.4974V6.4137H7.3299V8.2462ZM9.1624 6.4137H7.3299V4.5812H9.1624V6.4137Z"
      fill="#E9EEFB"
    />
  </svg>
);

/** Dev preview — mirrors backend `email/templates/welcome/welcome.template.ts`. */
export function WelcomeEmailPreview() {
  return (
    <div
      className="flex min-h-screen w-full flex-col items-center bg-[#04060F] px-3 py-7"
      style={{ maxWidth: "100%", margin: "0 auto" }}
    >
      <article
        className="w-full max-w-[600px] overflow-hidden border border-white/[0.08] bg-[#0D0F16]"
      >
        <div className="w-full overflow-hidden bg-[#0d0f16] leading-[0]">
          <Image
            src="/assets/email/welcome-hero-composite.png"
            alt="Welcome to Tokenable"
            width={600}
            height={330}
            className="block h-auto w-full max-w-[600px]"
            priority
            sizes="(max-width: 620px) 100vw, 600px"
          />
        </div>

        <div className="flex w-full flex-col items-start bg-[#0D0F16] px-[30px] pb-1 pt-7">
          <p className="m-0 mb-3.5 text-[17px] font-extrabold leading-tight text-white sm:text-base">
            What Tokenable provides everyone
          </p>
          <div className="flex w-full flex-col gap-3">
            <FeatureRow
              title="Authentication"
              body="Only verified PSA and BGS 10 graded cards."
              icon={shieldIcon}
            />
            <FeatureRow
              title="Vaulting"
              body="All graded cards are vaulted with either PSA or Tokenable partner vaults."
              icon={vaultIcon}
            />
            <FeatureRow
              title="Instant settlement"
              body="Sellers get paid instantly with on-chain transactions."
              icon={settleIcon}
            />
          </div>
        </div>

        <div className="flex flex-col items-center bg-[#0D0F16] px-[30px] pb-2 pt-[26px] text-center">
          <a
            href="https://app.tokenable.io/markets"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1A6FFF] px-7 py-3.5 text-[15px] font-bold leading-tight text-white no-underline"
          >
            Browse markets
            <Image
              src="/assets/email/welcome-arrow-white.png"
              alt=""
              width={15}
              height={15}
              className="h-[15px] w-[15px]"
              aria-hidden
            />
          </a>
          <p className="m-0 mt-5 whitespace-nowrap text-center text-[13px] leading-normal text-[rgba(233,238,251,0.5)]">
            New to Tokenable?{" "}
            <Link
              href="/#home-features"
              className="inline-flex items-center gap-0.5 font-semibold text-[#5B9AFF] no-underline"
            >
              See how it works
              <Image
                src="/assets/email/welcome-arrow-link.png"
                alt=""
                width={15}
                height={15}
                className="inline-block h-[15px] w-[15px]"
                aria-hidden
              />
            </Link>
          </p>
          <p className="m-0 mt-4 text-sm text-[rgba(233,238,251,0.76)]">
            The Tokenable team
          </p>
        </div>

        <footer className="border-t border-white/[0.08] bg-[#0D0F16] px-[30px] pb-[26px] pt-[22px] text-center text-xs leading-[1.8] text-[rgba(233,238,251,0.5)]">
          <Link
            href="/settings?section=notifications"
            className="text-[rgba(233,238,251,0.72)] underline"
          >
            Manage email preferences
          </Link>
          {" · "}
          <Link href="/unsubscribe" className="text-[rgba(233,238,251,0.72)] underline">
            Unsubscribe
          </Link>
          {" · "}
          <a href="https://tokenable.io" className="text-[rgba(233,238,251,0.72)] underline">
            tokenable.io
          </a>
          {" · "}
          <a
            href="https://www.instagram.com/tokenable_io"
            className="text-[rgba(233,238,251,0.72)] underline"
          >
            Instagram
          </a>
        </footer>
      </article>
    </div>
  );
}

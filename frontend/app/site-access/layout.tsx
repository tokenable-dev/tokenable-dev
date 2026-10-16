export default function SiteAccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="secondary-page secondary-page--full">{children}</div>;
}

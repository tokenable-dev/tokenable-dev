export default function SiteAccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-gray-950">
      {children}
    </div>
  );
}

import { CollectionDetailsScrollScope } from "./CollectionDetailsScrollScope";

export default function CollectionDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <CollectionDetailsScrollScope />
      {children}
    </>
  );
}

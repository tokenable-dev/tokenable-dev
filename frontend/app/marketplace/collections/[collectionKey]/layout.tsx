import { CollectionDetailsScrollScope } from "./CollectionDetailsScrollScope";
import "@/styles/tokenable-collection-detail.css";

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

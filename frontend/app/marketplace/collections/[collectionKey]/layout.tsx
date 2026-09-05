import { CollectionDetailsScrollScope } from "./CollectionDetailsScrollScope";
import "@/styles/tokenable-collection-detail.css";
/* CollectionOwnedRwaListModal / ListRwaModal sheet (`tk-price`) */
import "@/styles/tokenable-rwa-detail.css";

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


import CollectionDetailContent from "./CollectionDetailContent";

export default function CollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <CollectionDetailContent params={params} />;
}


import ProductsidContent from "./ProductsidContent";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ProductsidContent params={params} />;
}

import SellerAuthWrapper from "@/src/components/seller/SellerAuthWrapper";


export default function SellerRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SellerAuthWrapper>{children}</SellerAuthWrapper>;
}

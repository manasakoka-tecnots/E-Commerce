import StaffEditContent from "./StaffEditContent";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <StaffEditContent params={params} />;
}

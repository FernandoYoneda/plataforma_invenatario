import EmployeeDetailView from "@/components/EmployeeDetailView";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EmployeeDetailView employeeId={id} />;
}

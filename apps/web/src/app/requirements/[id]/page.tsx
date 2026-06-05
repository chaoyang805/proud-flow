import { RequirementDetailPage } from "../../../components/requirements/requirement-detail-page";

export default function RequirementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <RequirementDetailPage params={params} />;
}

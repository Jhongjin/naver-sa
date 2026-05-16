import { HistoryDetailClient } from "@/app/components/history/HistoryDetailClient";

type HistoryDetailPageProps = {
  params: Promise<{
    planningRunId: string;
  }>;
};

export default async function HistoryDetailPage({ params }: HistoryDetailPageProps) {
  const { planningRunId } = await params;

  return <HistoryDetailClient planningRunId={planningRunId} />;
}

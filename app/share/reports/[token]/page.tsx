import { SharedReportClient } from "@/app/components/share/SharedReportClient";

type SharedReportPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function SharedReportPage({ params }: SharedReportPageProps) {
  const { token } = await params;

  return <SharedReportClient token={token} />;
}

import { notFound } from "next/navigation";
import { getCafeBySlug } from "@/lib/cafe";
import { JoinForm } from "@/components/enroll/JoinForm";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ cafeSlug: string }>;
}) {
  const { cafeSlug } = await params;
  const cafe = await getCafeBySlug(cafeSlug);
  if (!cafe) notFound();

  return <JoinForm cafeSlug={cafe.slug} />;
}

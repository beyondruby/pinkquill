import StudioProfile from "@/components/studio/StudioProfile";

interface Props {
  params: Promise<{ username: string }>;
}

export default async function StudioPage({ params }: Props) {
  const { username } = await params;
  return <StudioProfile username={username} />;
}
import QRCode from "qrcode";
import { getBaseUrl } from "@/lib/base-url";
import { Card } from "@/components/ui/Card";

export async function PublicShareCard({ slug }: { slug: string }) {
  const baseUrl = await getBaseUrl();
  const publicUrl = `${baseUrl}/t/${slug}`;
  const qrSvg = await QRCode.toString(publicUrl, { type: "svg", margin: 1, width: 200 });

  return (
    <Card title="Share with players">
      <div className="flex flex-col items-center gap-3">
        <div className="w-40 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <a href={publicUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-[var(--color-navy)] underline">
          {publicUrl}
        </a>
      </div>
    </Card>
  );
}

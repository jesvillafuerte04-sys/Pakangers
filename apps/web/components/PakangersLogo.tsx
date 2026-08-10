import Image from "next/image";

export function PakangersLogo({ size = 56 }: { size?: number }) {
  const width = Math.round(size * (432 / 578));
  return (
    <Image
      src="/pakangers-logo.png"
      alt="Pakangers"
      width={width}
      height={size}
      className="shrink-0 object-contain"
      priority
    />
  );
}

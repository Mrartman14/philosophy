import Image from "next/image";

export default function Home() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <div>
      <Image src={`${basePath}/logo.png`} alt="Logo" width={500} height={500} />
    </div>
  );
}

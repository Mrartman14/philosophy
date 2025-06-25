import Image from "next/image";
// import { PhilosophersTimeline } from "@/components/lessons-timeline/timeline";

export default function Home() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <div>
      <Image
        src={`${basePath}/logo.png`}
        alt="Logo"
        width={500}
        height={500}
        priority
      />
      {/* <PhilosophersTimeline /> */}
      <ol className="list-inside list-decimal text-sm/6 text-center sm:text-left font-[family-name:var(--font-geist-mono)]">
        {/* <li className="mb-2 tracking-[-.01em]">
          Get started by editing{" "}
          <code className="bg-black/[.05] dark:bg-white/[.06] px-1 py-0.5 rounded font-[family-name:var(--font-geist-mono)] font-semibold">
            src/app/page.tsx
          </code>
          .
        </li>
        <li className="tracking-[-.01em]">
          Save and see your changes instantly.
        </li> */}
      </ol>
    </div>
  );
}

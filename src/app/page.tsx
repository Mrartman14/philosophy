import Image from "next/image";
import { PhilosophersTimeline } from "@/components/lessons-timeline/timeline";

export default function Home() {
  return (
    <div>
      <Image
        // className="dark:invert"
        src="/main-image.jpeg"
        alt="Logo"
        width={300}
        height={300}
        priority
      />
      <PhilosophersTimeline />
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

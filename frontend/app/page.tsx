import { GlobePanel } from "@/components/GlobePanel";
import { SwapPanel } from "@/components/SwapPanel";

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="md:sticky md:top-20 md:self-start">
          <SwapPanel />
        </div>
        <GlobePanel />
      </div>
    </div>
  );
}

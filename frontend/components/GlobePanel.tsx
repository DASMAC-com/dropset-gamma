"use client";

import dynamic from "next/dynamic";
import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MeshBasicMaterial } from "three";
import { COUNTRY_PINS, type CountryPin, findPin } from "@/lib/countries";
import { useSwapStore } from "@/lib/store";
import { type CountryFeature, WORLD_POLYGONS } from "@/lib/world-polygons";

const Globe = dynamic(() => import("react-globe.gl"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] w-full items-center justify-center text-muted-fg text-sm">
      Loading globe…
    </div>
  ),
});

const FROM_COLOR = "#ffffff";
const TO_COLOR = "#0f172a";
const IDLE_COLOR = "#64748b";
const ARC_COLOR = "#facc15";
const OCEAN_COLOR = 0x0b1726;

type GlobeHandle = {
  controls: () => { autoRotate: boolean; autoRotateSpeed: number };
};

class GlobeErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[GlobePanel] crash:", error, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-[480px] w-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-fg text-sm">
          <span className="font-medium">Globe failed to load.</span>
          <code className="max-w-full overflow-auto rounded bg-background px-2 py-1 font-mono text-xs">
            {String(this.state.error?.message ?? this.state.error)}
          </code>
        </div>
      );
    }
    return this.props.children;
  }
}

function GlobeInner() {
  const globeRef = useRef<GlobeHandle | null>(null);
  const from = useSwapStore((s) => s.from);
  const to = useSwapStore((s) => s.to);
  const setPinClicked = useSwapStore((s) => s.setPinClicked);

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 480, height: 480 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth || 480;
      setSize({ width: w, height: Math.min(Math.max(w, 360), 560) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const oceanMaterial = useMemo(
    () => new MeshBasicMaterial({ color: OCEAN_COLOR }),
    [],
  );

  const handleGlobeReady = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
  }, []);

  const arcs = useMemo(() => {
    const start = findPin(from.cca2);
    const end = findPin(to.cca2);
    if (!start || !end) return [];
    return [
      {
        startLat: start.lat,
        startLng: start.lng,
        endLat: end.lat,
        endLng: end.lng,
      },
    ];
  }, [from.cca2, to.cca2]);

  const colorFor = (pin: CountryPin) => {
    if (pin.currency === from.currency) return FROM_COLOR;
    if (pin.currency === to.currency) return TO_COLOR;
    return IDLE_COLOR;
  };

  const altitudeFor = (pin: CountryPin) => {
    if (pin.cca2 === from.cca2 || pin.cca2 === to.cca2) return 0.08;
    return 0.04;
  };

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden rounded-xl border border-border bg-muted"
    >
      <Globe
        ref={globeRef as never}
        width={size.width}
        height={size.height}
        backgroundColor="rgba(0,0,0,0)"
        globeMaterial={oceanMaterial}
        showAtmosphere={true}
        atmosphereColor="#7dd3fc"
        atmosphereAltitude={0.18}
        onGlobeReady={handleGlobeReady}
        polygonsData={WORLD_POLYGONS}
        polygonAltitude={0.006}
        polygonCapColor={(d: object) =>
          (d as CountryFeature).properties.fillColor
        }
        polygonSideColor={() => "rgba(0,0,0,0.2)"}
        polygonStrokeColor={() => "rgba(255,255,255,0.25)"}
        polygonLabel={(d: object) =>
          `<div style="font-family: var(--font-geist-sans); font-size: 12px; padding: 4px 8px; background: rgba(0,0,0,0.7); border-radius: 4px; color: white;">${(d as CountryFeature).properties.name}</div>`
        }
        pointsData={COUNTRY_PINS}
        pointLat={(d: object) => (d as CountryPin).lat}
        pointLng={(d: object) => (d as CountryPin).lng}
        pointColor={(d: object) => colorFor(d as CountryPin)}
        pointAltitude={(d: object) => altitudeFor(d as CountryPin)}
        pointRadius={0.45}
        pointLabel={(d: object) => {
          const p = d as CountryPin;
          return `<div style="font-family: var(--font-geist-sans); font-size: 12px; padding: 4px 8px; background: rgba(0,0,0,0.7); border-radius: 4px; color: white;">${p.name} · ${p.currency}</div>`;
        }}
        onPointClick={(pt: object) => setPinClicked(pt as CountryPin)}
        arcsData={arcs}
        arcStartLat={(d: object) => (d as { startLat: number }).startLat}
        arcStartLng={(d: object) => (d as { startLng: number }).startLng}
        arcEndLat={(d: object) => (d as { endLat: number }).endLat}
        arcEndLng={(d: object) => (d as { endLng: number }).endLng}
        arcColor={() => ARC_COLOR}
        arcStroke={0.8}
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={2000}
        arcAltitude={0.3}
      />
    </div>
  );
}

export function GlobePanel() {
  return (
    <GlobeErrorBoundary>
      <GlobeInner />
    </GlobeErrorBoundary>
  );
}

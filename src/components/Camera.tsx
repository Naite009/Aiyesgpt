import { useEffect, useRef, useState } from "react";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(facing: "user" | "environment" = "environment") {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => {});
        await new Promise<void>((res) => {
          if (videoRef.current?.readyState! >= 2) return res();
          videoRef.current?.addEventListener("loadedmetadata", () => res(), { once: true });
        });
        setReady(true);
      }
    } catch (e: any) {
      setError(e?.message ?? "Camera start failed");
    }
  }

  function stop() {
    setReady(false);
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }

  function capture(quality = 0.8): string | null {
    const v = videoRef.current;
    if (!v || !ready || v.videoWidth === 0 || v.videoHeight === 0) return null;

    const c = canvasRef.current ?? document.createElement("canvas");
    if (!canvasRef.current) canvasRef.current = c;

    const maxW = 960;
    const scale = Math.min(1, maxW / v.videoWidth);
    c.width = Math.max(1, Math.floor(v.videoWidth * scale));
    c.height = Math.max(1, Math.floor(v.videoHeight * scale));

    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, c.width, c.height);

    const dataUrl = c.toDataURL("image/jpeg", quality);
    return dataUrl;
  }

  return { videoRef, ready, error, start, stop, capture };
}

export function CameraPreview({ hook }: { hook: ReturnType<typeof useCamera> }) {
  const { videoRef, ready, error } = hook;

  useEffect(() => {
    hook.start().catch(() => {});
    return () => hook.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card p-3 space-y-2">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="w-full rounded-xl bg-black aspect-video object-cover"
      />
      {!ready && !error && <div className="text-sm text-white/70">Waiting for camera…</div>}
      {error && <div className="text-sm text-red-400">Camera error: {error}</div>}
    </div>
  );
}

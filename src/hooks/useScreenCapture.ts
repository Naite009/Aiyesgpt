import { useCallback, useRef, useState } from "react";

export type CaptureMode = "screen" | "camera";

type UseScreenCapture = {
  recording: boolean;
  stream: MediaStream | null;
  blob: Blob | null;
  start: (mode: CaptureMode) => Promise<void>;
  stop: () => Promise<void>;
  reset: () => void;
};

export function useScreenCapture(): UseScreenCapture {
  const [recording, setRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const start = useCallback(async (mode: CaptureMode) => {
    // reset any prior state
    if (recRef.current) {
      try { recRef.current.stop(); } catch {}
      recRef.current = null;
    }
    chunksRef.current = [];
    setBlob(null);

    // capture stream
    const s: MediaStream =
      mode === "screen"
        ? await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: true })
        : await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

    setStream(s);

    // pick a mime if supported
    let mime = "";
    if ("MediaRecorder" in window) {
      if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) mime = "video/webm;codecs=vp9,opus";
      else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) mime = "video/webm;codecs=vp8,opus";
      else if (MediaRecorder.isTypeSupported("video/webm")) mime = "video/webm";
    }

    const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
    recRef.current = rec;

    rec.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const finalBlob = new Blob(chunksRef.current, { type: mime || "video/webm" });
      setBlob(finalBlob);
      chunksRef.current = [];
      setRecording(false);
      // stop tracks (end live preview)
      try { s.getTracks().forEach((t: MediaStreamTrack) => t.stop()); } catch {}
      setStream(null);
    };

    rec.start(200); // gather chunks
    setRecording(true);
  }, []);

  const stop = useCallback(async () => {
    if (recRef.current && recRef.current.state !== "inactive") {
      recRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    try {
      if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    } catch {}
    try { stream?.getTracks().forEach((t: MediaStreamTrack) => t.stop()); } catch {}
    recRef.current = null;
    chunksRef.current = [];
    setStream(null);
    setBlob(null);
    setRecording(false);
  }, [stream]);

  return { recording, stream, blob, start, stop, reset };
}

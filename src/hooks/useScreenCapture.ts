import { useRef, useState } from "react";

export function useScreenCapture() {
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function start(kind: "screen" | "camera" = "screen") {
    let stream: MediaStream;
    if (kind === "screen") {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 } as any },
        audio: false,
      });
    } else {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    }
    streamRef.current = stream;

    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm;codecs=vp8";
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3_000_000 });
    recRef.current = rec;
    chunksRef.current = [];

    rec.ondataavailable = (e) => e.data && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const out = new Blob(chunksRef.current, { type: mime });
      setBlob(out);
    };

    rec.start(250);
    setRecording(true);
  }

  function stop() {
    recRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setRecording(false);
  }

  function reset() {
    setBlob(null);
    chunksRef.current = [];
  }

  return { start, stop, reset, recording, blob };
}

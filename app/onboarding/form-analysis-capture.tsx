"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface FormAnalysisCaptureProps {
  onFramesReady: (frames: string[]) => void;
  onSkip: () => void;
}

type Phase = "idle" | "preview" | "countdown" | "recording" | "processing" | "error";

const RECORD_SECONDS = 30;
const FRAME_INTERVAL_MS = 2500;

export function FormAnalysisCapture({
  onFramesReady,
  onSkip,
}: FormAnalysisCaptureProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState(3);
  const [secondsLeft, setSecondsLeft] = useState(RECORD_SECONDS);
  const [errorMsg, setErrorMsg] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<string[]>([]);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (frameTimerRef.current) clearInterval(frameTimerRef.current);
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    };
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setPhase("preview");
    } catch (err) {
      console.error("Camera error:", err);
      setErrorMsg("Could not access the camera. Check permissions and try again.");
      setPhase("error");
    }
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const canvas = document.createElement("canvas");
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    const scale = Math.min(1, 640 / w);
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    framesRef.current.push(canvas.toDataURL("image/jpeg", 0.7));
  }

  function startRecording() {
    setPhase("countdown");
    setCountdown(3);
    let n = 3;
    const tick = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(tick);
        beginRecord();
      } else {
        setCountdown(n);
      }
    }, 1000);
  }

  function beginRecord() {
    framesRef.current = [];
    setSecondsLeft(RECORD_SECONDS);
    setPhase("recording");

    captureFrame();
    frameTimerRef.current = setInterval(captureFrame, FRAME_INTERVAL_MS);

    let left = RECORD_SECONDS;
    tickTimerRef.current = setInterval(() => {
      left -= 1;
      setSecondsLeft(left);
      if (left <= 0) {
        finishRecording();
      }
    }, 1000);
  }

  function finishRecording() {
    if (frameTimerRef.current) clearInterval(frameTimerRef.current);
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    captureFrame();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setPhase("processing");
    onFramesReady(framesRef.current.slice());
  }

  return (
    <div className="flex flex-col gap-4 p-6 border">
      <div className="flex items-center gap-3">
        <span className="text-2xl">📹</span>
        <div>
          <h3 className="font-semibold">Running Form Analysis</h3>
          <p className="text-sm text-muted-foreground">
            Record 30 seconds of running. Place the camera so your full body is visible from the side.
          </p>
        </div>
      </div>

      <div className="relative bg-black aspect-video overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {phase === "idle" && (
          <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">
            Camera off
          </div>
        )}
        {phase === "countdown" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-white text-7xl font-bold">{countdown}</span>
          </div>
        )}
        {phase === "recording" && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-600 text-white text-xs font-medium px-2 py-1 rounded-full">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            REC {secondsLeft}s
          </div>
        )}
        {phase === "processing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white gap-3">
            <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Sending frames to coach for analysis…</p>
          </div>
        )}
      </div>

      {phase === "error" && (
        <p className="text-sm text-destructive">{errorMsg}</p>
      )}

      <div className="flex gap-2 flex-wrap">
        {phase === "idle" && (
          <>
            <Button onClick={startCamera}>Enable Camera</Button>
            <Button variant="outline" onClick={onSkip}>
              Skip this step
            </Button>
          </>
        )}
        {phase === "preview" && (
          <>
            <Button onClick={startRecording}>Start 30s Recording</Button>
            <Button variant="outline" onClick={onSkip}>
              Skip
            </Button>
          </>
        )}
        {phase === "recording" && (
          <Button variant="outline" onClick={finishRecording}>
            Stop Early
          </Button>
        )}
        {phase === "error" && (
          <>
            <Button onClick={startCamera}>Try Again</Button>
            <Button variant="outline" onClick={onSkip}>
              Skip
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

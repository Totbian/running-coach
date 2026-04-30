"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface RunFeedback {
  summary: string;
  strengths: string[];
  improvements: string[];
}

export interface RunPayload {
  distance_km?: number;
  duration_seconds?: number;
  avg_pace_per_km?: string;
  avg_heart_rate?: number;
  max_heart_rate?: number;
  active_calories?: number;
  elevation_gain_m?: number;
  perceived_effort?: number;
  notes?: string;
  feedback: RunFeedback;
}

interface Props {
  onRunLogged: (payload: RunPayload) => void;
  onComplete: () => void;
  onTranscript: (text: string) => void;
}

export function RunVoiceSession({ onRunLogged, onComplete, onTranscript }: Props) {
  const [status, setStatus] = useState<"connecting" | "active" | "error">("connecting");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [manualMute, setManualMute] = useState(true);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);
  const isSpeakingRef = useRef(false);
  const manualMuteRef = useRef(true);

  const onRunLoggedRef = useRef(onRunLogged);
  const onCompleteRef = useRef(onComplete);
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onRunLoggedRef.current = onRunLogged;
    onCompleteRef.current = onComplete;
    onTranscriptRef.current = onTranscript;
  }, [onRunLogged, onComplete, onTranscript]);

  const setMicEnabled = useCallback((enabled: boolean) => {
    if (audioTrackRef.current) {
      audioTrackRef.current.enabled = enabled;
    }
    setIsMuted(!enabled);
  }, []);

  const toggleManualMute = useCallback(() => {
    const newMuteState = !manualMuteRef.current;
    manualMuteRef.current = newMuteState;
    setManualMute(newMuteState);
    if (newMuteState) {
      setMicEnabled(false);
    } else if (!isSpeakingRef.current) {
      setMicEnabled(true);
    }
  }, [setMicEnabled]);

  useEffect(() => {
    let mounted = true;

    function sendFunctionResult(callId: string, payload: unknown, triggerResponse = true) {
      const dc = dcRef.current;
      if (!dc || dc.readyState !== "open") return;
      dc.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify(payload),
          },
        })
      );
      if (triggerResponse) {
        dc.send(JSON.stringify({ type: "response.create" }));
      }
    }

    async function handleMessage(event: MessageEvent) {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "response.function_call_arguments.done") {
          const { name, arguments: args, call_id } = msg;
          const parsed = JSON.parse(args);

          if (name === "log_run") {
            try {
              const res = await fetch("/api/run/log", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(parsed),
              });
              const json = await res.json();
              onRunLoggedRef.current(parsed as RunPayload);
              sendFunctionResult(call_id, res.ok ? json : { error: json.error ?? "Failed" });
            } catch (err) {
              sendFunctionResult(call_id, { error: String(err) });
            }
          } else if (name === "finish_run_review") {
            onCompleteRef.current();
            sendFunctionResult(call_id, { success: true }, false);
          }
        }

        if (msg.type === "conversation.item.input_audio_transcription.completed") {
          onTranscriptRef.current(msg.transcript || "");
        }

        if (msg.type === "response.audio.delta" && !isSpeakingRef.current) {
          isSpeakingRef.current = true;
          setIsSpeaking(true);
          if (audioTrackRef.current) {
            audioTrackRef.current.enabled = false;
          }
          setIsMuted(true);
        }

        if (msg.type === "response.done") {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          if (!manualMuteRef.current) {
            if (audioTrackRef.current) {
              audioTrackRef.current.enabled = true;
            }
            setIsMuted(false);
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    async function connect() {
      try {
        const tokenResponse = await fetch("/api/run/session", { method: "POST" });
        if (!tokenResponse.ok) {
          throw new Error("Failed to get session token");
        }
        const { clientSecret } = await tokenResponse.json();

        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        const audio = new Audio();
        audio.autoplay = true;
        pc.ontrack = (e) => {
          audio.srcObject = e.streams[0];
        };

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTrack = stream.getTracks()[0];
        audioTrackRef.current = audioTrack;
        audioTrack.enabled = false;
        pc.addTrack(audioTrack);

        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;

        dc.onopen = () => {
          if (mounted) setStatus("active");
          dc.send(JSON.stringify({ type: "response.create" }));
        };

        dc.onmessage = handleMessage;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sdpResponse = await fetch(
          "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${clientSecret}`,
              "Content-Type": "application/sdp",
            },
            body: offer.sdp,
          }
        );

        if (!sdpResponse.ok) {
          const err = await sdpResponse.text();
          console.error("OpenAI SDP error:", err);
          throw new Error("Failed to connect to OpenAI");
        }

        const answerSdp = await sdpResponse.text();
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      } catch (err) {
        console.error("Connection error:", err);
        if (mounted) setStatus("error");
      }
    }

    connect();

    return () => {
      mounted = false;
      pcRef.current?.close();
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 p-6 border">
      <div className="relative flex items-center justify-center w-20 h-20">
        {status === "connecting" && (
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )}
        {status === "active" && (
          <>
            <div
              className={`absolute inset-0 bg-primary/10 rounded-full transition-transform duration-300 ${
                isSpeaking ? "scale-100 animate-pulse" : "scale-75"
              }`}
            />
            <div
              className={`relative w-12 h-12 bg-primary rounded-full flex items-center justify-center transition-transform duration-150 ${
                isSpeaking ? "scale-110" : "scale-100"
              }`}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-primary-foreground"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </div>
          </>
        )}
        {status === "error" && (
          <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
            <span className="text-xl">⚠️</span>
          </div>
        )}
      </div>

      <div className="text-center">
        {status === "connecting" && (
          <p className="text-sm text-muted-foreground">Connecting to coach...</p>
        )}
        {status === "active" && (
          <p className="text-sm text-muted-foreground">
            {isSpeaking
              ? "🔊 Coach is speaking..."
              : isMuted
              ? "🔇 Muted"
              : "🎤 Listening..."}
          </p>
        )}
        {status === "error" && (
          <div>
            <p className="text-sm text-destructive font-medium">Connection failed</p>
            <p className="text-xs text-muted-foreground mt-1">
              Check microphone permissions and try again
            </p>
          </div>
        )}
      </div>

      {status === "active" && (
        <button
          onClick={toggleManualMute}
          className={`mt-2 px-4 py-2 text-sm font-medium border transition-colors ${
            manualMute
              ? "bg-destructive/10 border-destructive/30 text-destructive"
              : "bg-muted border-border text-foreground"
          }`}
        >
          {manualMute ? "🔇 Unmute Mic" : "🎤 Mute Mic"}
        </button>
      )}
    </div>
  );
}

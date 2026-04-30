"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { StepData } from "@/lib/onboarding-steps";

interface VoiceSessionProps {
  onStepUpdate: (data: StepData) => void;
  onComplete: () => void;
  onTranscript: (text: string) => void;
}

export function VoiceSession({
  onStepUpdate,
  onComplete,
  onTranscript,
}: VoiceSessionProps) {
  const [status, setStatus] = useState<"connecting" | "active" | "error">("connecting");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Start muted - AI speaks first
  const [manualMute, setManualMute] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);

  // Mute/unmute the microphone track
  const setMicEnabled = useCallback((enabled: boolean) => {
    if (audioTrackRef.current) {
      audioTrackRef.current.enabled = enabled;
    }
    setIsMuted(!enabled);
  }, []);

  const handleDataChannelMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);

        // Handle function calls from the AI
        if (msg.type === "response.function_call_arguments.done") {
          const { name, arguments: args, call_id } = msg;
          const parsed = JSON.parse(args);

          if (name === "update_onboarding_data") {
            onStepUpdate({
              step: parsed.step,
              data: parsed.data,
              skipped: parsed.skipped || false,
            });
            if (dcRef.current?.readyState === "open") {
              dcRef.current.send(
                JSON.stringify({
                  type: "conversation.item.create",
                  item: {
                    type: "function_call_output",
                    call_id: call_id,
                    output: JSON.stringify({ success: true }),
                  },
                })
              );
              dcRef.current.send(
                JSON.stringify({ type: "response.create" })
              );
            }
          } else if (name === "complete_onboarding") {
            onComplete();
            if (dcRef.current?.readyState === "open") {
              dcRef.current.send(
                JSON.stringify({
                  type: "conversation.item.create",
                  item: {
                    type: "function_call_output",
                    call_id: call_id,
                    output: JSON.stringify({ success: true }),
                  },
                })
              );
            }
          }
        }

        // Handle transcription of user speech
        if (msg.type === "conversation.item.input_audio_transcription.completed") {
          onTranscript(msg.transcript || "");
        }

        // AI starts generating a response - MUTE the user
        if (msg.type === "response.audio.delta" && !isSpeaking) {
          setIsSpeaking(true);
          setMicEnabled(false);
        }

        // AI finished speaking - UNMUTE the user (unless manual mute is on)
        if (msg.type === "response.done") {
          setIsSpeaking(false);
          if (!manualMute) {
            setMicEnabled(true);
          }
        }
      } catch {
        // ignore parse errors
      }
    },
    [onStepUpdate, onComplete, onTranscript, isSpeaking, manualMute, setMicEnabled]
  );

  // Handle manual mute toggle
  const toggleManualMute = useCallback(() => {
    const newMuteState = !manualMute;
    setManualMute(newMuteState);
    if (newMuteState) {
      // User wants to mute
      setMicEnabled(false);
    } else if (!isSpeaking) {
      // User wants to unmute, only allow if AI is not speaking
      setMicEnabled(true);
    }
  }, [manualMute, isSpeaking, setMicEnabled]);

  useEffect(() => {
    let mounted = true;

    async function connect() {
      try {
        // Step 1: Get ephemeral key from our backend
        const tokenResponse = await fetch("/api/session", { method: "POST" });
        if (!tokenResponse.ok) {
          throw new Error("Failed to get session token");
        }
        const { clientSecret } = await tokenResponse.json();

        // Step 2: Create peer connection
        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        // Set up audio playback
        const audio = new Audio();
        audio.autoplay = true;
        pc.ontrack = (e) => {
          audio.srcObject = e.streams[0];
        };

        // Get microphone access
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const audioTrack = stream.getTracks()[0];
        audioTrackRef.current = audioTrack;
        // Start with mic DISABLED - AI speaks first
        audioTrack.enabled = false;
        pc.addTrack(audioTrack);

        // Create data channel
        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;

        dc.onopen = () => {
          if (mounted) setStatus("active");
          // Kick off: AI asks the first question proactively
          dc.send(JSON.stringify({ type: "response.create" }));
        };

        dc.onmessage = handleDataChannelMessage;

        // Step 3: Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Step 4: Send SDP to OpenAI directly using the ephemeral key
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

        // Step 5: Set remote description
        const answerSdp = await sdpResponse.text();
        await pc.setRemoteDescription({
          type: "answer",
          sdp: answerSdp,
        });
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
  }, [handleDataChannelMessage]);

  return (
    <div className="flex flex-col items-center gap-4 p-6 border">
      {/* Voice indicator */}
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

      {/* Status text */}
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
              Check your microphone permissions and try again
            </p>
          </div>
        )}
      </div>

      {/* Mute button */}
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

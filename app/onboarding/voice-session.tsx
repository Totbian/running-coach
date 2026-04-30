"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { StepData } from "@/lib/onboarding-steps";
import { FormAnalysisCapture } from "./form-analysis-capture";

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
  const [manualMute, setManualMute] = useState(true);
  const [formAnalysisCallId, setFormAnalysisCallId] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);
  const isSpeakingRef = useRef(false);
  const manualMuteRef = useRef(true);
  const formAnalysisCallIdRef = useRef<string | null>(null);

  // Stable refs for callbacks
  const onStepUpdateRef = useRef(onStepUpdate);
  const onCompleteRef = useRef(onComplete);
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onStepUpdateRef.current = onStepUpdate;
    onCompleteRef.current = onComplete;
    onTranscriptRef.current = onTranscript;
  });

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

  const handleFramesReady = useCallback((frames: string[]) => {
    const callId = formAnalysisCallIdRef.current;
    formAnalysisCallIdRef.current = null;
    setFormAnalysisCallId(null);
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open" || !callId) return;

    if (frames.length === 0) {
      dc.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({ success: false, skipped: true }),
          },
        })
      );
      dc.send(JSON.stringify({ type: "response.create" }));
      return;
    }

    dc.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            ...frames.map((f) => ({ type: "input_image", image_url: f })),
            {
              type: "input_text",
              text: `Here are ${frames.length} frames sampled from a 30-second clip of my running form, in chronological order. Please analyze cadence, posture, foot strike, arm swing, hip drop, and knee drive. Give me 2-3 concrete pieces of feedback, then call update_onboarding_data with step="FORM_ANALYSIS" and a 1-2 sentence summary as data.`,
            },
          ],
        },
      })
    );
    dc.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify({ success: true, frame_count: frames.length }),
        },
      })
    );
    dc.send(JSON.stringify({ type: "response.create" }));
  }, []);

  const handleSkipForm = useCallback(() => {
    const callId = formAnalysisCallIdRef.current;
    formAnalysisCallIdRef.current = null;
    setFormAnalysisCallId(null);
    const dc = dcRef.current;
    if (dc && dc.readyState === "open" && callId) {
      dc.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({ success: false, skipped: true }),
          },
        })
      );
      dc.send(JSON.stringify({ type: "response.create" }));
    }
    onStepUpdateRef.current({ step: "FORM_ANALYSIS", data: "Skipped", skipped: true });
  }, []);

  useEffect(() => {
    let mounted = true;

    function sendFunctionResult(
      callId: string,
      payload: unknown,
      triggerResponse = true,
    ) {
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

        // Handle function calls from the AI
        if (msg.type === "response.function_call_arguments.done") {
          const { name, arguments: args, call_id } = msg;
          const parsed = JSON.parse(args);

          if (name === "update_onboarding_data") {
            onStepUpdateRef.current({
              step: parsed.step,
              data: parsed.data,
              skipped: parsed.skipped || false,
            });
            sendFunctionResult(call_id, { success: true });
          } else if (name === "start_form_analysis") {
            // Open camera; we'll respond to this call_id once frames are ready (or user skips)
            formAnalysisCallIdRef.current = call_id;
            setFormAnalysisCallId(call_id);
          } else if (name === "complete_onboarding") {
            onCompleteRef.current();
            sendFunctionResult(call_id, { success: true }, false);
          } else if (name === "find_free_slots") {
            try {
              const params = new URLSearchParams();
              params.set("from", parsed.from_date);
              params.set("to", parsed.to_date);
              params.set("durationMinutes", String(parsed.duration_minutes));
              if (parsed.earliest_hour != null) {
                params.set("earliestHour", String(parsed.earliest_hour));
              }
              if (parsed.latest_hour != null) {
                params.set("latestHour", String(parsed.latest_hour));
              }
              const res = await fetch(`/api/calendar/free-slots?${params.toString()}`);
              const json = await res.json();
              sendFunctionResult(call_id, res.ok ? json : { error: json.error ?? "Failed" });
            } catch (err) {
              sendFunctionResult(call_id, { error: String(err) });
            }
          } else if (name === "create_calendar_event") {
            try {
              const res = await fetch("/api/calendar/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: parsed.title,
                  description: parsed.description,
                  start: parsed.start,
                  end: parsed.end,
                  location: parsed.location,
                }),
              });
              const json = await res.json();
              sendFunctionResult(call_id, res.ok ? json : { error: json.error ?? "Failed" });
            } catch (err) {
              sendFunctionResult(call_id, { error: String(err) });
            }
          } else if (name === "plan_route") {
            try {
              const params = new URLSearchParams();
              if (parsed.destination) {
                params.set("destination", parsed.destination);
              } else if (parsed.distance_meters != null) {
                params.set("distanceMeters", String(parsed.distance_meters));
                if (parsed.bearing_degrees != null) {
                  params.set("bearing", String(parsed.bearing_degrees));
                }
              }
              const res = await fetch(`/api/route/plan?${params.toString()}`);
              const json = await res.json();
              sendFunctionResult(call_id, res.ok ? json : { error: json.error ?? "Failed" });
            } catch (err) {
              sendFunctionResult(call_id, { error: String(err) });
            }
          }
        }

        // Handle transcription of user speech
        if (msg.type === "conversation.item.input_audio_transcription.completed") {
          onTranscriptRef.current(msg.transcript || "");
        }

        // AI starts generating audio - MUTE the user
        if (msg.type === "response.audio.delta" && !isSpeakingRef.current) {
          isSpeakingRef.current = true;
          setIsSpeaking(true);
          if (audioTrackRef.current) {
            audioTrackRef.current.enabled = false;
          }
          setIsMuted(true);
        }

        // AI finished responding - UNMUTE the user (unless manual mute)
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

        dc.onmessage = handleMessage;

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
  }, []); // No dependencies - runs once

  return (
    <div className="flex flex-col gap-4">
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

      {formAnalysisCallId && (
        <FormAnalysisCapture
          onFramesReady={handleFramesReady}
          onSkip={handleSkipForm}
        />
      )}
    </div>
  );
}

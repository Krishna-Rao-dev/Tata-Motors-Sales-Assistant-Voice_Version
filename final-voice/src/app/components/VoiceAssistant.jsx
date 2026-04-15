import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "./ui/button";
import ComponentPanel from "./ComponentPanel";

// 🎨 COLOR CONFIGURATION - Easy to change!
const COLORS = {
  primary: "#00d9ff", // Vibrant blue
  secondary: "#48a7de", // Cyan
  accent: "#b08ef9", // Purple
  highlight: "#2283c9", // Pink
  background: "#000000", // Black background
};

export function VoiceAssistant() {
  const canvasRef = useRef(null);
  const [appState, setAppState] = useState("stopped"); // stopped, idle, listening, processing, speaking
  const [error, setError] = useState("");
  const websocketRef = useRef(null);
  const [sessionId, setSessionId] = useState(null);

  // Agentic response state
  const [lastResponse, setLastResponse] = useState(null);   // latest response from agentic flow
  const [activeComponent, setActiveComponent] = useState(null); // currently displayed component
  const [panelOpen, setPanelOpen] = useState(false);
  const [transcript, setTranscript] = useState("");         // what the user said
  const [responseText, setResponseText] = useState("");     // what the assistant replied

  const isListening = appState === "listening" || appState === "processing";
  const isSpeaking = appState === "speaking";

  const animationRef = useRef();
  const blobsRef = useRef([]);
  const currentCircleRadiusRef = useRef(120);

  // Initialize gradient blobs
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    blobsRef.current = [
      {
        x: centerX, y: centerY, radius: 150, color: COLORS.primary,
        vx: 0, vy: 0, targetX: centerX, targetY: centerY,
        pulsePhase: 0, pulseSpeed: 0.02, orbitRadius: 0, orbitAngle: 0, orbitSpeed: 0,
      },
      {
        x: centerX, y: centerY, radius: 140, color: COLORS.secondary,
        vx: 0, vy: 0, targetX: centerX, targetY: centerY,
        pulsePhase: 0, pulseSpeed: 0.012, orbitRadius: 70, orbitAngle: 0, orbitSpeed: 0.015,
      },
      {
        x: centerX, y: centerY, radius: 130, color: COLORS.accent,
        vx: 0, vy: 0, targetX: centerX, targetY: centerY,
        pulsePhase: Math.PI / 4, pulseSpeed: 0.04, orbitRadius: 75, orbitAngle: Math.PI / 2, orbitSpeed: 0.02,
      },
      {
        x: centerX, y: centerY, radius: 135, color: COLORS.highlight,
        vx: 0, vy: 0, targetX: centerX, targetY: centerY,
        pulsePhase: Math.PI / 2, pulseSpeed: 0.055, orbitRadius: 65, orbitAngle: Math.PI, orbitSpeed: 0.03,
      },
      {
        x: centerX, y: centerY, radius: 125, color: COLORS.primary,
        vx: 0, vy: 0, targetX: centerX, targetY: centerY,
        pulsePhase: Math.PI, pulseSpeed: 0.042, orbitRadius: 80, orbitAngle: Math.PI * 1.5, orbitSpeed: 0.028,
      },
      {
        x: centerX, y: centerY, radius: 120, color: COLORS.secondary,
        vx: 0, vy: 0, targetX: centerX, targetY: centerY,
        pulsePhase: Math.PI * 1.25, pulseSpeed: 0.048, orbitRadius: 70, orbitAngle: Math.PI / 4, orbitSpeed: 0.022,
      },
      {
        x: centerX, y: centerY, radius: 130, color: COLORS.accent,
        vx: 0, vy: 0, targetX: centerX, targetY: centerY,
        pulsePhase: Math.PI * 1.5, pulseSpeed: 0.052, orbitRadius: 75, orbitAngle: Math.PI * 1.75, orbitSpeed: 0.026,
      },
      {
        x: centerX, y: centerY, radius: 115, color: COLORS.highlight,
        vx: 0, vy: 0, targetX: centerX, targetY: centerY,
        pulsePhase: Math.PI * 1.75, pulseSpeed: 0.058, orbitRadius: 68, orbitAngle: Math.PI * 0.75, orbitSpeed: 0.024,
      },
    ];
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const idleRadius = 120;
    const listeningRadius = 130;
    const speakingRadius = 135;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let targetRadius = idleRadius;
      if (isSpeaking) {
        const time = Date.now() * 0.001;
        const pulse = Math.sin(time * 4) * 0.5 + 0.5;
        targetRadius = speakingRadius + pulse * 5;
      } else if (isListening) {
        targetRadius = listeningRadius;
      }

      currentCircleRadiusRef.current +=
        (targetRadius - currentCircleRadiusRef.current) * 0.1;

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, currentCircleRadiusRef.current, 0, Math.PI * 2);
      ctx.clip();

      blobsRef.current.forEach((blob, index) => {
        blob.pulsePhase += blob.pulseSpeed;

        if (isSpeaking) {
          const time = Date.now() * 0.001;
          const simAudioIntensity =
            (Math.sin(time * 4 + index * 1.5) * 0.5 + 0.5) *
            (Math.cos(time * 6 + index * 2) * 0.3 + 0.7);

          if (index === 0) {
            blob.targetX = centerX;
            blob.targetY = centerY;
          } else {
            const baseAngle = blob.orbitAngle;
            const radialPulse =
              blob.orbitRadius * (0.3 + simAudioIntensity * 1.2);
            const jitter = Math.sin(time * 12 + index) * 15 * simAudioIntensity;

            blob.targetX = centerX + Math.cos(baseAngle) * (radialPulse + jitter);
            blob.targetY = centerY + Math.sin(baseAngle) * (radialPulse + jitter);
          }

          const radiusBoost =
            1 + simAudioIntensity * 0.5 + Math.sin(blob.pulsePhase) * 0.2;
          const currentRadius = blob.radius * radiusBoost;

          blob.x += (blob.targetX - blob.x) * 0.35;
          blob.y += (blob.targetY - blob.y) * 0.35;

          const gradient = ctx.createRadialGradient(
            blob.x, blob.y, 0, blob.x, blob.y, currentRadius
          );
          gradient.addColorStop(0, blob.color + "FF");
          gradient.addColorStop(0.3, blob.color + "CC");
          gradient.addColorStop(0.7, blob.color + "66");
          gradient.addColorStop(1, blob.color + "00");

          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (isListening) {
          if (index === 0) {
            blob.targetX = centerX;
            blob.targetY = centerY;
          } else {
            blob.orbitAngle += blob.orbitSpeed;
            const radialDistance =
              blob.orbitRadius * (0.6 + Math.sin(blob.pulsePhase * 2) * 0.35);
            blob.targetX = centerX + Math.cos(blob.orbitAngle) * radialDistance;
            blob.targetY = centerY + Math.sin(blob.orbitAngle) * radialDistance;
          }

          blob.x += (blob.targetX - blob.x) * 0.15;
          blob.y += (blob.targetY - blob.y) * 0.15;

          const radiusBoost = 1 + Math.sin(blob.pulsePhase) * 0.15;
          const currentRadius = blob.radius * radiusBoost;

          const gradient = ctx.createRadialGradient(
            blob.x, blob.y, 0, blob.x, blob.y, currentRadius
          );
          gradient.addColorStop(0, blob.color + "FF");
          gradient.addColorStop(0.3, blob.color + "DD");
          gradient.addColorStop(0.7, blob.color + "77");
          gradient.addColorStop(1, blob.color + "00");

          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
          if (index === 0) {
            blob.targetX = centerX;
            blob.targetY = centerY;
          } else {
            blob.orbitAngle += blob.orbitSpeed * 0.5;
            const radialDistance =
              blob.orbitRadius * (0.5 + Math.sin(blob.pulsePhase) * 0.3);
            blob.targetX = centerX + Math.cos(blob.orbitAngle) * radialDistance;
            blob.targetY = centerY + Math.sin(blob.orbitAngle) * radialDistance;
          }

          blob.x += (blob.targetX - blob.x) * 0.08;
          blob.y += (blob.targetY - blob.y) * 0.08;

          const radiusBoost = 1 + Math.sin(blob.pulsePhase) * 0.1;
          const currentRadius = blob.radius * radiusBoost;

          const gradient = ctx.createRadialGradient(
            blob.x, blob.y, 0, blob.x, blob.y, currentRadius
          );
          gradient.addColorStop(0, blob.color + "FF");
          gradient.addColorStop(0.3, blob.color + "DD");
          gradient.addColorStop(0.7, blob.color + "66");
          gradient.addColorStop(1, blob.color + "00");

          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      });

      ctx.filter = "blur(40px)";
      ctx.drawImage(canvas, 0, 0);
      ctx.filter = "none";

      ctx.restore();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isListening, isSpeaking]);

  // Handle incoming agentic response — open panel if component detected
  const handleAgenticResponse = useCallback((data) => {
    setLastResponse(data);
    setTranscript(data.user_said || "");
    setResponseText(data.text || "");

    // Only update the component panel if this response has a visible component
    if (
      data.component &&
      data.component.required === true &&
      data.component.name &&
      data.component.content
    ) {
      setActiveComponent(data.component);
      setPanelOpen(true);
    }
    // If no component, leave the previous component visible (don't close the panel)
  }, []);

  // Setup WebSocket connection
  useEffect(() => {
    let ws = new WebSocket("ws://localhost:8000/ws");

    ws.onopen = () => {
      console.log("Connected to backend");
      setError("");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "init") {
        setAppState(data.status);
        setSessionId(data.session_id);
      } else if (data.type === "status") {
        setAppState(data.status);
      } else if (data.type === "response") {
        handleAgenticResponse(data);
      }
    };

    ws.onerror = () => {
      setError("Failed to connect to backend voice service.");
    };

    ws.onclose = () => {
      setAppState("stopped");
    };

    websocketRef.current = ws;

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, [handleAgenticResponse]);

  const toggleSystemStatus = () => {
    if (appState === "stopped") {
      // Fetch the voice name from localStorage (set by SelectVoice page)
      const voiceName = localStorage.getItem("voice_name") || "bf_lily";
      websocketRef.current?.send(
        JSON.stringify({ command: "start", voice: voiceName })
      );
    } else {
      websocketRef.current?.send(JSON.stringify({ command: "stop" }));
    }
  };

  const closePanel = () => {
    setPanelOpen(false);
  };

  return (
    <>
      <div
        className={`va-root ${panelOpen ? "va-root--split" : ""}`}
        id="voice-assistant-root"
      >
        {/* ─── LEFT: Voice Orb Section ─── */}
        <div className="va-voice-section">
          <div className="va-voice-inner">
            {/* Gradient Mesh Canvas */}
            <div className="va-orb-wrapper">
              <canvas
                ref={canvasRef}
                width={320}
                height={320}
                className="va-orb-canvas"
              />

              {/* Status indicator */}
              <div className="va-status-indicator">
                {appState === "listening" && (
                  <span className="va-status va-status--listening">
                    <span className="va-status-dot va-status-dot--listening" />
                    Listening...
                  </span>
                )}
                {appState === "speaking" && (
                  <span className="va-status va-status--speaking">
                    <span className="va-status-dot va-status-dot--speaking" />
                    Speaking...
                  </span>
                )}
                {appState === "processing" && (
                  <span className="va-status va-status--processing">
                    <span className="va-status-dot va-status-dot--processing" />
                    Processing...
                  </span>
                )}
                {appState === "idle" && (
                  <span className="va-status va-status--idle">
                    <span className="va-status-dot va-status-dot--idle" />
                    Idle
                  </span>
                )}
              </div>
            </div>

            {/* Start/Stop */}
            <div className="va-controls">
              <Button
                onClick={toggleSystemStatus}
                size="lg"
                variant={appState !== "stopped" ? "destructive" : "default"}
                className="gap-2"
                id="system-toggle-btn"
              >
                {appState !== "stopped" ? (
                  <MicOff className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
                {appState !== "stopped" ? "Stop System" : "Start System"}
              </Button>
            </div>

            {/* Transcript bar */}
            {transcript && (
              <div className="va-transcript-bar">
                <div className="va-transcript-label">You said</div>
                <div className="va-transcript-text">{transcript}</div>
              </div>
            )}

            {/* Response text */}
            {responseText && (
              <div className="va-response-bar">
                <div className="va-response-text">{responseText}</div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="va-error">
                <p className="va-error-label">Error:</p>
                <p className="va-error-text">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT: Component Panel ─── */}
        <div className={`va-component-section ${panelOpen ? "va-component-section--open" : ""}`}>
          {panelOpen && (
            <ComponentPanel
              component={activeComponent}
              onClose={closePanel}
            />
          )}
        </div>
      </div>

      <style>{`
        /* ─── Root Layout ──────────────────────────────────── */
        .va-root {
          display: flex;
          width: 100vw;
          height: 100vh;
          background: ${COLORS.background};
          overflow: hidden;
          transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* ─── Voice Section (Left) ───────────────────────── */
        .va-voice-section {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          z-index: 2;
        }

        .va-voice-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
          padding: 32px;
          max-width: 500px;
          width: 100%;
        }

        /* ─── Orb ────────────────────────────────────────── */
        .va-orb-wrapper {
          position: relative;
        }

        .va-orb-canvas {
          border-radius: 50%;
          filter: blur(0px);
        }

        .va-status-indicator {
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 8px;
          align-items: center;
          white-space: nowrap;
        }

        .va-status {
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 400;
          letter-spacing: 0.02em;
        }

        .va-status--listening { color: #60a5fa; }
        .va-status--speaking { color: #c084fc; }
        .va-status--processing { color: #facc15; }
        .va-status--idle { color: #6b7280; }

        .va-status-dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }

        .va-status-dot--listening {
          background: #60a5fa;
          animation: dotPulse 1.2s ease-in-out infinite;
        }
        .va-status-dot--speaking {
          background: #c084fc;
          animation: dotPulse 1.2s ease-in-out infinite;
        }
        .va-status-dot--processing {
          background: #facc15;
          animation: dotPulse 1.2s ease-in-out infinite;
        }
        .va-status-dot--idle {
          background: #6b7280;
        }

        @keyframes dotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.4); }
        }

        /* ─── Controls ──────────────────────────────────── */
        .va-controls {
          display: flex;
          gap: 12px;
        }

        /* ─── Transcript Bar ──────────────────────────────── */
        .va-transcript-bar {
          width: 100%;
          max-width: 380px;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          animation: fadeSlideUp 0.3s ease;
          backdrop-filter: blur(12px);
        }

        .va-transcript-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(139, 92, 246, 0.7);
          margin-bottom: 4px;
        }

        .va-transcript-text {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
          line-height: 1.4;
        }

        /* ─── Response Bar ─────────────────────────────────── */
        .va-response-bar {
          width: 100%;
          max-width: 380px;
          padding: 12px 16px;
          background: rgba(139, 92, 246, 0.06);
          border: 1px solid rgba(139, 92, 246, 0.12);
          border-radius: 12px;
          animation: fadeSlideUp 0.4s ease;
          backdrop-filter: blur(12px);
        }

        .va-response-text {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.5;
        }

        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* ─── Error ─────────────────────────────────────── */
        .va-error {
          max-width: 380px;
          width: 100%;
          padding: 12px 16px;
          background: rgba(220, 38, 38, 0.1);
          border: 1px solid rgba(220, 38, 38, 0.2);
          border-radius: 12px;
        }

        .va-error-label {
          font-size: 11px;
          color: #f87171;
          margin: 0 0 4px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .va-error-text {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          margin: 0;
        }

        /* ─── Component Section (Right) ────────────────── */
        .va-component-section {
          width: 0;
          overflow: hidden;
          transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
          border-left: 0px solid transparent;
          position: relative;
          z-index: 1;
        }

        .va-component-section--open {
          width: 50%;
          border-left: 1px solid rgba(139, 92, 246, 0.12);
        }

        /* ─── Divider glow when panel open ────────────── */
        .va-component-section--open::before {
          content: '';
          position: absolute;
          top: 0;
          left: -1px;
          bottom: 0;
          width: 2px;
          background: linear-gradient(
            180deg,
            transparent 0%,
            rgba(139, 92, 246, 0.3) 30%,
            rgba(219, 93, 182, 0.2) 70%,
            transparent 100%
          );
          pointer-events: none;
          z-index: 5;
        }
      `}</style>
    </>
  );
}

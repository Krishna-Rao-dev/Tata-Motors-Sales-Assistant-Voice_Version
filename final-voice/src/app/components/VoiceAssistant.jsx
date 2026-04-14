import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { Button } from "./ui/button";

// 🎨 COLOR CONFIGURATION - Easy to change!
const COLORS = {
  primary: "#8B5CF6", // Vibrant blue
  secondary: "#865bbf", // Cyan
  accent: "#db5db6", // Purple
  highlight: "#7826dc", // Pink
  background: "#000000", // Black background
};

export function VoiceAssistant() {
  const canvasRef = useRef(null);
  const [appState, setAppState] = useState("stopped"); // stopped, idle, listening, processing, speaking
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const websocketRef = useRef(null);
  
  const isListening = appState === "listening" || appState === "processing";
  const isSpeaking = appState === "speaking";

  const animationRef = useRef();
  const blobsRef = useRef([]);
  const currentCircleRadiusRef = useRef(120); // For smooth animation

  // Initialize gradient blobs
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    blobsRef.current = [
      // Central blob for base coverage - pulsing
      {
        x: centerX,
        y: centerY,
        radius: 150,
        color: COLORS.primary,
        vx: 0,
        vy: 0,
        targetX: centerX,
        targetY: centerY,
        pulsePhase: 0,
        pulseSpeed: 0.02,
        orbitRadius: 0,
        orbitAngle: 0,
        orbitSpeed: 0,
      },
      // Distributed blobs in cardinal directions
      {
        x: centerX,
        y: centerY,
        radius: 140,
        color: COLORS.secondary,
        vx: 0,
        vy: 0,
        targetX: centerX,
        targetY: centerY,
        pulsePhase: 0,
        pulseSpeed: 0.012,
        orbitRadius: 70,
        orbitAngle: 0,
        orbitSpeed: 0.015,
      },
      {
        x: centerX,
        y: centerY,
        radius: 130,
        color: COLORS.accent,
        vx: 0,
        vy: 0,
        targetX: centerX,
        targetY: centerY,
        pulsePhase: Math.PI / 4,
        pulseSpeed: 0.04,
        orbitRadius: 75,
        orbitAngle: Math.PI / 2,
        orbitSpeed: 0.02,
      },
      {
        x: centerX,
        y: centerY,
        radius: 135,
        color: COLORS.highlight,
        vx: 0,
        vy: 0,
        targetX: centerX,
        targetY: centerY,
        pulsePhase: Math.PI / 2,
        pulseSpeed: 0.055,
        orbitRadius: 65,
        orbitAngle: Math.PI,
        orbitSpeed: 0.03,
      },
      {
        x: centerX,
        y: centerY,
        radius: 125,
        color: COLORS.primary,
        vx: 0,
        vy: 0,
        targetX: centerX,
        targetY: centerY,
        pulsePhase: Math.PI,
        pulseSpeed: 0.042,
        orbitRadius: 80,
        orbitAngle: Math.PI * 1.5,
        orbitSpeed: 0.028,
      },
      {
        x: centerX,
        y: centerY,
        radius: 120,
        color: COLORS.secondary,
        vx: 0,
        vy: 0,
        targetX: centerX,
        targetY: centerY,
        pulsePhase: Math.PI * 1.25,
        pulseSpeed: 0.048,
        orbitRadius: 70,
        orbitAngle: Math.PI / 4,
        orbitSpeed: 0.022,
      },
      {
        x: centerX,
        y: centerY,
        radius: 130,
        color: COLORS.accent,
        vx: 0,
        vy: 0,
        targetX: centerX,
        targetY: centerY,
        pulsePhase: Math.PI * 1.5,
        pulseSpeed: 0.052,
        orbitRadius: 75,
        orbitAngle: Math.PI * 1.75,
        orbitSpeed: 0.026,
      },
      {
        x: centerX,
        y: centerY,
        radius: 115,
        color: COLORS.highlight,
        vx: 0,
        vy: 0,
        targetX: centerX,
        targetY: centerY,
        pulsePhase: Math.PI * 1.75,
        pulseSpeed: 0.058,
        orbitRadius: 68,
        orbitAngle: Math.PI * 0.75,
        orbitSpeed: 0.024,
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

    // Dynamic circle sizes for different states
    const idleRadius = 120;
    const listeningRadius = 130;
    const speakingRadius = 135;

    const animate = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Fill with background color
      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Determine target radius based on state
      let targetRadius = idleRadius;
      if (isSpeaking) {
        const time = Date.now() * 0.001;
        const pulse = Math.sin(time * 4) * 0.5 + 0.5;
        targetRadius = speakingRadius + pulse * 5;
      } else if (isListening) {
        targetRadius = listeningRadius;
      }

      // Smoothly animate to target radius
      currentCircleRadiusRef.current +=
        (targetRadius - currentCircleRadiusRef.current) * 0.1;

      // Save the context state
      ctx.save();

      // Create circular clipping path to contain all gradients
      ctx.beginPath();
      ctx.arc(centerX, centerY, currentCircleRadiusRef.current, 0, Math.PI * 2);
      ctx.clip();

      // Get audio data if speaking
      let audioIntensity = 0;
      if (isSpeaking) {
        audioIntensity = 0.5 + Math.sin(Date.now() * 0.01) * 0.5; // Simulate intensity
      }

      blobsRef.current.forEach((blob, index) => {
        // Update pulse phase
        blob.pulsePhase += blob.pulseSpeed;

        if (isSpeaking) {
          // Speaking: dramatic radial pulsing from center
          const time = Date.now() * 0.001;
          // Simulate audio intensity with wave patterns
          const simAudioIntensity =
            (Math.sin(time * 4 + index * 1.5) * 0.5 + 0.5) *
            (Math.cos(time * 6 + index * 2) * 0.3 + 0.7);

          // Central blob pulsing radius
          if (index === 0) {
            blob.targetX = centerX;
            blob.targetY = centerY;
          } else {
            // Fixed angle for each blob (no circular orbit)
            // Blobs push out radially from center based on audio
            const baseAngle = blob.orbitAngle; // Keep initial angle fixed

            // Dramatic radial pulsing: blobs pulse in and out from center
            const radialPulse =
              blob.orbitRadius * (0.3 + simAudioIntensity * 1.2);

            // Add quick vibration/jitter for more dynamic feel
            const jitter = Math.sin(time * 12 + index) * 15 * simAudioIntensity;

            blob.targetX =
              centerX + Math.cos(baseAngle) * (radialPulse + jitter);
            blob.targetY =
              centerY + Math.sin(baseAngle) * (radialPulse + jitter);
          }

          // Dramatic radius changes to simulate sound waves
          const radiusBoost =
            1 + simAudioIntensity * 0.5 + Math.sin(blob.pulsePhase) * 0.2;
          const currentRadius = blob.radius * radiusBoost;

          // Very responsive movement for vibration effect
          blob.x += (blob.targetX - blob.x) * 0.35;
          blob.y += (blob.targetY - blob.y) * 0.35;

          // Draw blob with more opaque gradients for complete coverage
          const gradient = ctx.createRadialGradient(
            blob.x,
            blob.y,
            0,
            blob.x,
            blob.y,
            currentRadius,
          );
          gradient.addColorStop(0, blob.color + "FF");
          gradient.addColorStop(0.3, blob.color + "CC");
          gradient.addColorStop(0.7, blob.color + "66");
          gradient.addColorStop(1, blob.color + "00");

          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (isListening) {
          // Central blob stays at center with pulsing radius
          if (index === 0) {
            blob.targetX = centerX;
            blob.targetY = centerY;
          } else {
            // Listening: gentle radial breathing from center
            blob.orbitAngle += blob.orbitSpeed;

            const radialDistance =
              blob.orbitRadius * (0.6 + Math.sin(blob.pulsePhase * 2) * 0.35);
            blob.targetX = centerX + Math.cos(blob.orbitAngle) * radialDistance;
            blob.targetY = centerY + Math.sin(blob.orbitAngle) * radialDistance;
          }

          blob.x += (blob.targetX - blob.x) * 0.15;
          blob.y += (blob.targetY - blob.y) * 0.15;

          // Pulsing radius
          const radiusBoost = 1 + Math.sin(blob.pulsePhase) * 0.15;
          const currentRadius = blob.radius * radiusBoost;

          const gradient = ctx.createRadialGradient(
            blob.x,
            blob.y,
            0,
            blob.x,
            blob.y,
            currentRadius,
          );
          gradient.addColorStop(0, blob.color + "FF");
          gradient.addColorStop(0.3, blob.color + "DD");
          gradient.addColorStop(0.7, blob.color + "77");
          gradient.addColorStop(1, blob.color + "00");

          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
          // Central blob stays at center with subtle pulse
          if (index === 0) {
            blob.targetX = centerX;
            blob.targetY = centerY;
          } else {
            // Idle: subtle radial breathing from center
            blob.orbitAngle += blob.orbitSpeed * 0.5;

            const radialDistance =
              blob.orbitRadius * (0.5 + Math.sin(blob.pulsePhase) * 0.3);
            blob.targetX = centerX + Math.cos(blob.orbitAngle) * radialDistance;
            blob.targetY = centerY + Math.sin(blob.orbitAngle) * radialDistance;
          }

          blob.x += (blob.targetX - blob.x) * 0.08;
          blob.y += (blob.targetY - blob.y) * 0.08;

          // Pulsing radius
          const radiusBoost = 1 + Math.sin(blob.pulsePhase) * 0.1;
          const currentRadius = blob.radius * radiusBoost;

          const gradient = ctx.createRadialGradient(
            blob.x,
            blob.y,
            0,
            blob.x,
            blob.y,
            currentRadius,
          );
          gradient.addColorStop(0, blob.color + "FF");
          gradient.addColorStop(0.3, blob.color + "DD");
          gradient.addColorStop(0.7, blob.color + "66");
          gradient.addColorStop(1, blob.color + "00");

          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      });

      // Apply blur for smooth gradient mesh effect
      ctx.filter = "blur(40px)";
      ctx.drawImage(canvas, 0, 0);
      ctx.filter = "none";

      // Restore context to remove clipping
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

  // Setup WebSocket connection
  useEffect(() => {
    let ws = new WebSocket("ws://localhost:8000/ws");
    
    ws.onopen = () => {
      console.log("Connected to backend");
      setError("");
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "status") {
        setAppState(data.status); // stopped, idle, listening, processing, speaking
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
  }, []);

  const toggleSystemStatus = () => {
    if (appState === "stopped") {
      websocketRef.current?.send(JSON.stringify({ command: "start" }));
    } else {
      websocketRef.current?.send(JSON.stringify({ command: "stop" }));
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8">
      {/* Gradient Mesh Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          className="rounded-full"
          style={{
            filter: "blur(0px)",
          }}
        />

        {/* Status indicator */}
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-2 items-center">
          {appState === "listening" && (
            <span className="text-sm text-blue-400 flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              Listening...
            </span>
          )}
          {appState === "speaking" && (
            <span className="text-sm text-purple-400 flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
              Speaking...
            </span>
          )}
          {appState === "processing" && (
            <span className="text-sm text-yellow-400 flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              Processing...
            </span>
          )}
          {appState === "idle" && (
            <span className="text-sm text-gray-400 flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-gray-400 rounded-full" />
              Idle
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        <Button
          onClick={toggleSystemStatus}
          size="lg"
          variant={appState !== "stopped" ? "destructive" : "default"}
          className="gap-2"
        >
          {appState !== "stopped" ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
          {appState !== "stopped" ? "Stop System" : "Start System"}
        </Button>
      </div>

      {/* Transcript Display */}
      {transcript && (
        <div className="max-w-md w-full p-4 bg-slate-800 rounded-lg">
          <p className="text-sm text-slate-400 mb-2">You said:</p>
          <p className="text-white">{transcript}</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="max-w-md w-full p-4 bg-red-800 rounded-lg">
          <p className="text-sm text-red-400 mb-2">Error:</p>
          <p className="text-white">{error}</p>
        </div>
      )}

      {/* Color Guide */}
      <div className="text-center text-sm text-slate-400 mt-8">
        <p className="mb-2">
          💡 To change colors, edit the COLORS object in VoiceAssistant.tsx
        </p>
        <div className="flex gap-2 justify-center">
          <div className="flex items-center gap-1">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: COLORS.primary }}
            />

            <span>Primary</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: COLORS.secondary }}
            />

            <span>Secondary</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: COLORS.accent }}
            />

            <span>Accent</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: COLORS.highlight }}
            />

            <span>Highlight</span>
          </div>
        </div>
      </div>
    </div>
  );
}

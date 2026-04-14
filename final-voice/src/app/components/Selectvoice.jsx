import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router";

// 🎨 COLOR CONFIGURATION - Strictly matching VoiceAssistant
const COLORS = {
  primary: "#8B5CF6", 
  secondary: "#865bbf", 
  accent: "#db5db6", 
  highlight: "#7826dc", 
  background: "#000000", 
};

// 🎙️ VOICES ARRAY - Easily manually editable
const VOICES = [
  { name: "Lalita", description: "Calm, Exciting" },
  { name: "Aditi", description: "Soft, Warm" },
  { name: "Rohan", description: "Deep, Authoritative" },
  { name: "Kavya", description: "Energetic, Fast" },
];

export default function Selectvoice() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const canvasRef = useRef(null);
  const animationRef = useRef();
  const blobsRef = useRef([]);
  const currentCircleRadiusRef = useRef(120); 
  const navigate = useNavigate();

  const currentVoice = VOICES[currentIndex];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % VOICES.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + VOICES.length) % VOICES.length);
  };

  const handleChooseVoice = () => {
    localStorage.setItem("voice_name", currentVoice.name);
    navigate("/main");
  };

  // Initialize gradient blobs (Strictly same as VoiceAssistant idle state)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    blobsRef.current = [
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

  // Animation Loop - Strictly mimicking the "idle" state
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const idleRadius = 120;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      currentCircleRadiusRef.current += (idleRadius - currentCircleRadiusRef.current) * 0.1;

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, currentCircleRadiusRef.current, 0, Math.PI * 2);
      ctx.clip();

      blobsRef.current.forEach((blob, index) => {
        blob.pulsePhase += blob.pulseSpeed;

        if (index === 0) {
          blob.targetX = centerX;
          blob.targetY = centerY;
        } else {
          blob.orbitAngle += blob.orbitSpeed * 0.5;
          const radialDistance = blob.orbitRadius * (0.5 + Math.sin(blob.pulsePhase) * 0.3);
          blob.targetX = centerX + Math.cos(blob.orbitAngle) * radialDistance;
          blob.targetY = centerY + Math.sin(blob.orbitAngle) * radialDistance;
        }

        blob.x += (blob.targetX - blob.x) * 0.08;
        blob.y += (blob.targetY - blob.y) * 0.08;

        const radiusBoost = 1 + Math.sin(blob.pulsePhase) * 0.1;
        const currentRadius = blob.radius * radiusBoost;

        const gradient = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, currentRadius);
        gradient.addColorStop(0, blob.color + "FF");
        gradient.addColorStop(0.3, blob.color + "DD");
        gradient.addColorStop(0.7, blob.color + "66");
        gradient.addColorStop(1, blob.color + "00");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      });

      // Applying the insider movement blur effect
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
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6 select-none overflow-hidden">
      {/* 🔮 THE VOICE BALL - Strictly matches idle state */}
      <div className="relative mb-16 transform transition-all duration-500">
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          className="rounded-full shadow-[0_0_100px_rgba(139,92,246,0.1)]"
        />
      </div>

      {/* 🗣️ VOICE SELECTION INTERFACE */}
      <div className="flex flex-col items-center gap-3 mb-16 w-full max-w-sm">
        <div className="flex items-center justify-between w-full px-4">
          <button 
            onClick={handlePrev} 
            className="p-2 text-white hover:text-purple-400 transition-all duration-300 transform active:scale-90"
            aria-label="Previous voice"
          >
            <ChevronLeft size={36} strokeWidth={1.5} />
          </button>
          
          <h2 className="text-4xl font-light tracking-[0.05em] text-white animate-in fade-in slide-in-from-bottom-2 duration-700">
            {currentVoice.name}
          </h2>

          <button 
            onClick={handleNext} 
            className="p-2 text-white hover:text-purple-400 transition-all duration-300 transform active:scale-90"
            aria-label="Next voice"
          >
            <ChevronRight size={36} strokeWidth={1.5} />
          </button>
        </div>
        
        <p className="text-slate-400 text-base font-light tracking-wide opacity-80 h-6">
          {currentVoice.description}
        </p>
      </div>

      {/* 🔘 CHOOSE VOICE BUTTON */}
      <button
        onClick={handleChooseVoice}
        className="px-14 py-5 bg-white text-black text-2xl font-semibold rounded-full hover:bg-slate-200 hover:scale-105 active:scale-95 transition-all duration-300 shadow-[0_10px_40px_rgba(255,255,255,0.15)] ring-offset-black hover:ring-2 hover:ring-white/20"
      >
        Choose voice
      </button>

      {/* Subtle Background Glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none -z-10" />
    </div>
  );
}

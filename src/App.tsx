import React, { useEffect, useRef, useState } from 'react';
import { Camera, Download, StopCircle, Printer, X } from 'lucide-react';

class Particle {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  targetSize: number;
  orbitAngle: number;
  orbitSpeed: number;
  orbitRadius: number;
  z: number;
  centerX: number;
  centerY: number;

  constructor(x: number, y: number, centerX: number, centerY: number) {
    this.baseX = x;
    this.baseY = y;
    this.centerX = centerX;
    this.centerY = centerY;
    this.x = x + (Math.random() - 0.5) * 400;
    this.y = y + (Math.random() - 0.5) * 400;
    this.vx = 0;
    this.vy = 0;
    this.color = '#444';
    this.size = Math.random() * 1.5 + 0.2;
    this.targetSize = this.size;
    this.orbitAngle = Math.random() * Math.PI * 2;
    this.orbitSpeed = (Math.random() * 0.04 + 0.01) * (Math.random() > 0.5 ? 1 : -1);
    this.orbitRadius = Math.random() * 800 + 50;
    this.z = (Math.random() - 0.5) * 200;
  }

  update(mouse: { x: number; y: number; radius: number }, isStreaming: boolean) {
    let dx = mouse.x - this.x;
    let dy = mouse.y - this.y;
    let distSq = dx * dx + dy * dy;
    let radiusSq = mouse.radius * mouse.radius;
    let inMouseRadius = distSq < radiusSq;
    let distance = inMouseRadius ? Math.sqrt(distSq) : 0;

    if (isStreaming) {
      // Camera mode physics
      if (inMouseRadius && distance > 0) {
        let forceDirectionX = dx / distance;
        let forceDirectionY = dy / distance;
        let force = (mouse.radius - distance) / mouse.radius;
        let directionX = forceDirectionX * force * 25;
        let directionY = forceDirectionY * force * 25;
        
        this.vx -= directionX;
        this.vy -= directionY;
      } else {
        this.vx += (this.baseX - this.x) * 0.3;
        this.vy += (this.baseY - this.y) * 0.3;
      }

      this.vx *= 0.75;
      this.vy *= 0.75;
      this.size += (this.targetSize - this.size) * 0.4;
      
    } else {
      // Black Hole / Orbit idle mode physics
      // Faster orbit closer to the center
      const speedMultiplier = Math.max(0.1, 300 / Math.max(this.orbitRadius, 10));
      this.orbitAngle += this.orbitSpeed * speedMultiplier;
      
      // Pull towards center
      this.orbitRadius -= 1.5 * speedMultiplier;

      // Reset if sucked into the black hole
      if (this.orbitRadius < 10) {
        this.orbitRadius = 1000 + Math.random() * 200;
        this.orbitAngle = Math.random() * Math.PI * 2;
      }
      
      // Calculate 3D accretion disk position with spiral arms
      const spiralOffset = this.orbitRadius * 0.005;
      let targetX = this.centerX + Math.cos(this.orbitAngle + spiralOffset) * this.orbitRadius;
      // Flatten Y for 3D perspective, add Z for thickness
      let targetY = this.centerY + Math.sin(this.orbitAngle + spiralOffset) * this.orbitRadius * 0.3 + this.z * (this.orbitRadius / 500);

      if (inMouseRadius && distance > 0) {
        let forceDirectionX = dx / distance;
        let forceDirectionY = dy / distance;
        let force = (mouse.radius - distance) / mouse.radius;
        let directionX = forceDirectionX * force * 15;
        let directionY = forceDirectionY * force * 15;
        
        this.vx -= directionX;
        this.vy -= directionY;
      } else {
        this.vx += (targetX - this.x) * 0.04;
        this.vy += (targetY - this.y) * 0.04;
      }

      this.vx *= 0.90;
      this.vy *= 0.90;
      
      // Black hole coloring
      if (this.orbitRadius < 80) {
        this.color = '#ffffff'; // Event horizon glow
        this.targetSize = 1.5;
      } else if (this.orbitRadius < 250) {
        const hue = 280 - (this.orbitRadius / 250) * 80; // Purple to Blue
        this.color = `hsla(${hue}, 100%, 60%, 0.8)`;
        this.targetSize = 1.2;
      } else {
        const hue = 200 - (this.orbitRadius / 1000) * 40; // Blue to Cyan
        this.color = `hsla(${hue}, 80%, 40%, 0.5)`;
        this.targetSize = 0.6;
      }
      
      this.size += (this.targetSize - this.size) * 0.1;
    }

    this.x += this.vx;
    this.y += this.vy;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.size < 0.2) return;
    ctx.fillStyle = this.color;
    // Use fillRect for massive performance boost. At this density, squares look identical to circles.
    ctx.fillRect(this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
  }
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000, radius: 200 }); // Increased radius for larger canvas
  const isStreamingRef = useRef(false);
  const dirHandleRef = useRef<any>(null);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsStreaming(true);
      }
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      setError(err.message || 'Could not access the camera. Please ensure permissions are granted.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
  };

  const takePicture = () => {
    if (canvasRef.current) {
      const url = canvasRef.current.toDataURL('image/png', 1.0);
      setCapturedImage(url);
    }
  };

  const handlePrint = async () => {
    if (capturedImage) {
      const dateObj = new Date();
      const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      const fileName = `particle-face-${Date.now()}.png`;
      
      try {
        // Use the File System Access API to actually create a folder and save the file
        if ('showDirectoryPicker' in window) {
          if (!dirHandleRef.current) {
            // Ask user to select a base directory (e.g., Downloads) the first time
            dirHandleRef.current = await (window as any).showDirectoryPicker({
              mode: 'readwrite',
              id: 'particle-face-saves',
              startIn: 'downloads'
            });
          }
          
          const dirHandle = dirHandleRef.current;
          // Create or get the folder named with the current date
          const dateFolderHandle = await dirHandle.getDirectoryHandle(dateStr, { create: true });
          // Create the image file inside that folder
          const fileHandle = await dateFolderHandle.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          
          // Convert base64 to Blob
          const response = await fetch(capturedImage);
          const blob = await response.blob();
          
          await writable.write(blob);
          await writable.close();
        } else {
          throw new Error("File System Access API not supported");
        }
      } catch (err) {
        console.warn("Could not save to specific folder, falling back to standard download:", err);
        // Fallback if browser doesn't support it or user cancels directory picker
        const a = document.createElement('a');
        a.href = capturedImage;
        a.download = `${dateStr}_${fileName}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }

    // Small timeout to ensure the download finishes before the print dialog blocks the browser
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleCancel = () => {
    setCapturedImage(null);
  };

  useEffect(() => {
    const handleAfterPrint = () => {
      setCapturedImage(null);
      setIsStreaming(false);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
    };

    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const offscreenCanvas = offscreenCanvasRef.current;
    const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

    if (!canvas || !ctx || !offscreenCtx) return;

    // 3:2 aspect ratio for 1800x1200
    // Very high quality density (240x160 = 38,400 particles)
    let processWidth = 240;
    let processHeight = 160;
    let displayWidth = 1800;
    let displayHeight = 1200;

    const initParticles = () => {
      canvas.width = displayWidth;
      canvas.height = displayHeight;

      const scaleX = displayWidth / processWidth;
      const scaleY = displayHeight / processHeight;
      const centerX = displayWidth / 2;
      const centerY = displayHeight / 2;

      particlesRef.current = [];
      for (let y = 0; y < processHeight; y++) {
        for (let x = 0; x < processWidth; x++) {
          particlesRef.current.push(new Particle(x * scaleX, y * scaleY, centerX, centerY));
        }
      }
    };

    initParticles();

    const render = () => {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, displayWidth, displayHeight);

      const isCamActive = isStreamingRef.current && videoRef.current && videoRef.current.readyState >= 2;

      if (isCamActive) {
        const video = videoRef.current!;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        
        // Calculate crop to fit 3:2 aspect ratio without distortion
        const targetRatio = displayWidth / displayHeight;
        const videoRatio = videoWidth / videoHeight;
        
        let sx = 0, sy = 0, sWidth = videoWidth, sHeight = videoHeight;
        
        if (videoRatio > targetRatio) {
          // Video is wider than target, crop sides
          sWidth = videoHeight * targetRatio;
          sx = (videoWidth - sWidth) / 2;
        } else {
          // Video is taller than target, crop top/bottom
          sHeight = videoWidth / targetRatio;
          sy = (videoHeight - sHeight) / 2;
        }
        
        if (offscreenCanvas.width !== processWidth) {
          offscreenCanvas.width = processWidth;
          offscreenCanvas.height = processHeight;
        }

        offscreenCtx.save();
        offscreenCtx.translate(processWidth, 0);
        offscreenCtx.scale(-1, 1);
        offscreenCtx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, processWidth, processHeight);
        offscreenCtx.restore();

        const imageData = offscreenCtx.getImageData(0, 0, processWidth, processHeight);
        const data = imageData.data;

        const pArray = particlesRef.current;
        const scaleX = displayWidth / processWidth;
        const scaleY = displayHeight / processHeight;

        for (let i = 0; i < pArray.length; i++) {
          const p = pArray[i];
          
          const px = Math.floor(p.baseX / scaleX);
          const py = Math.floor(p.baseY / scaleY);
          
          if (px >= 0 && px < processWidth && py >= 0 && py < processHeight) {
            const index = (py * processWidth + px) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];

            const brightness = (r + g + b) / 3;

            // Apply proper contrast and slight brightness boost for better photo quality
            const contrast = 1.15;
            const br = Math.min(255, Math.max(0, (r - 128) * contrast + 128 + 15));
            const bg = Math.min(255, Math.max(0, (g - 128) * contrast + 128 + 15));
            const bb = Math.min(255, Math.max(0, (b - 128) * contrast + 128 + 15));

            p.color = `rgb(${br},${bg},${bb})`;
            
            // ScaleX is 7.5 (1800/240). Radius of 3.75 means diameter 7.5 (touching).
            p.targetSize = (brightness / 255) * 3.2 + 0.8;
          }

          p.update(mouseRef.current, true);
          p.draw(ctx);
        }
      } else {
        const pArray = particlesRef.current;
        for (let i = 0; i < pArray.length; i++) {
          const p = pArray[i];
          p.update(mouseRef.current, false);
          p.draw(ctx);
        }
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    // Map CSS pixels to Canvas pixels
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    mouseRef.current.x = (e.clientX - rect.left) * scaleX;
    mouseRef.current.y = (e.clientY - rect.top) * scaleY;
  };

  const handleMouseLeave = () => {
    mouseRef.current.x = -1000;
    mouseRef.current.y = -1000;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 font-sans print:bg-white print:p-0 print:block">
      <style>
        {`
          @media print {
            @page { margin: 0; size: auto; }
            body { margin: 0; background: white; }
          }
        `}
      </style>
      <div className={`max-w-5xl w-full space-y-8 print:hidden ${capturedImage ? 'hidden' : 'block'}`}>
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-white">Particle Face</h1>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-center">
            {error}
          </div>
        )}

        <div className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl flex items-center justify-center w-full aspect-[3/2]">
          <video
            ref={videoRef}
            className="hidden"
            playsInline
            muted
          />
          
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="w-full h-full object-contain cursor-crosshair opacity-100"
          />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          {!isStreaming ? (
            <button
              onClick={startCamera}
              className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-zinc-200 transition-colors active:scale-95"
            >
              <Camera className="w-5 h-5" />
              Start Camera
            </button>
          ) : (
            <>
              <button
                onClick={stopCamera}
                className="flex items-center gap-2 px-6 py-3 bg-zinc-800 text-white rounded-xl font-medium hover:bg-zinc-700 transition-colors active:scale-95"
              >
                <StopCircle className="w-5 h-5" />
                Stop Camera
              </button>
              <button
                onClick={takePicture}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-400 transition-colors active:scale-95 shadow-lg shadow-emerald-500/20"
              >
                <Camera className="w-5 h-5" />
                Take Picture
              </button>
            </>
          )}
        </div>
      </div>

      {capturedImage && (
        <div className="max-w-5xl w-full space-y-6 print:m-0 print:w-full print:max-w-none">
          <div className="flex justify-between items-center print:hidden">
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-6 py-3 bg-zinc-800 text-white rounded-xl font-medium hover:bg-zinc-700 transition-colors active:scale-95"
            >
              <X className="w-5 h-5" />
              Cancel
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-400 transition-colors active:scale-95 shadow-lg shadow-emerald-500/20"
            >
              <Printer className="w-5 h-5" />
              Print
            </button>
          </div>
          <div className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl flex items-center justify-center w-full aspect-[3/2] print:border-none print:shadow-none print:rounded-none print:block print:w-full print:h-auto">
            <img src={capturedImage} alt="Captured particle face" className="w-full h-full object-contain print:block print:w-full print:h-auto print:max-h-screen" />
          </div>
        </div>
      )}
    </div>
  );
}

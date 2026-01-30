/**
 * SignaturePad - Reusable 3-mode signature component
 * Modes: canvas draw, type-to-sign (font selector), use saved signature
 * Exports base64 PNG
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pen, Type, Save, RotateCcw, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SignatureType = 'draw' | 'type' | 'saved';

interface SignaturePadProps {
  onSignatureChange: (data: string | null, type: SignatureType) => void;
  savedSignature?: string | null;
  signerName?: string;
  className?: string;
}

const SIGNATURE_FONTS = [
  { name: 'Dancing Script', css: "'Dancing Script', cursive" },
  { name: 'Great Vibes', css: "'Great Vibes', cursive" },
  { name: 'Sacramento', css: "'Sacramento', cursive" },
  { name: 'Permanent Marker', css: "'Permanent Marker', cursive" },
];

export function SignaturePad({
  onSignatureChange,
  savedSignature,
  signerName = '',
  className,
}: SignaturePadProps) {
  const [mode, setMode] = useState<SignatureType>('draw');
  const [typedName, setTypedName] = useState(signerName);
  const [selectedFont, setSelectedFont] = useState(0);
  const [hasDrawn, setHasDrawn] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    isDrawing.current = true;
    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (hasDrawn) {
      const canvas = canvasRef.current;
      if (canvas) {
        onSignatureChange(canvas.toDataURL('image/png'), 'draw');
      }
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onSignatureChange(null, 'draw');
  };

  // Generate typed signature as canvas image
  const generateTypedSignature = useCallback(() => {
    if (!typedName.trim()) {
      onSignatureChange(null, 'type');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.font = `48px ${SIGNATURE_FONTS[selectedFont].css}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(typedName, 20, 75);

    onSignatureChange(canvas.toDataURL('image/png'), 'type');
  }, [typedName, selectedFont, onSignatureChange]);

  useEffect(() => {
    if (mode === 'type') {
      generateTypedSignature();
    }
  }, [mode, typedName, selectedFont, generateTypedSignature]);

  const handleUseSaved = () => {
    if (savedSignature) {
      onSignatureChange(savedSignature, 'saved');
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Load Google Fonts for typed signatures */}
      <link
        href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Great+Vibes&family=Sacramento&family=Permanent+Marker&display=swap"
        rel="stylesheet"
      />

      <Tabs value={mode} onValueChange={(v) => setMode(v as SignatureType)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="draw" className="gap-1.5">
            <Pen className="w-3.5 h-3.5" />
            Draw
          </TabsTrigger>
          <TabsTrigger value="type" className="gap-1.5">
            <Type className="w-3.5 h-3.5" />
            Type
          </TabsTrigger>
          <TabsTrigger value="saved" disabled={!savedSignature} className="gap-1.5">
            <Save className="w-3.5 h-3.5" />
            Saved
          </TabsTrigger>
        </TabsList>

        <TabsContent value="draw" className="space-y-2">
          <div className="relative border rounded-lg bg-white overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full cursor-crosshair touch-none"
              style={{ height: 150 }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            <div className="absolute bottom-2 left-4 right-4 border-t border-gray-300" />
          </div>
          <div className="flex justify-between">
            <p className="text-xs text-muted-foreground">Draw your signature above</p>
            <Button variant="ghost" size="sm" onClick={clearCanvas} className="h-7 text-xs">
              <RotateCcw className="w-3 h-3 mr-1" />
              Clear
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="type" className="space-y-3">
          <Input
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Type your full name"
            className="text-lg"
          />
          <div className="grid grid-cols-2 gap-2">
            {SIGNATURE_FONTS.map((font, i) => (
              <button
                key={font.name}
                onClick={() => setSelectedFont(i)}
                className={cn(
                  'p-3 border rounded-lg text-left transition-colors bg-white text-black',
                  selectedFont === i ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <span style={{ fontFamily: font.css, fontSize: 24 }}>
                  {typedName || 'Your Name'}
                </span>
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="saved" className="space-y-2">
          {savedSignature ? (
            <div className="space-y-3">
              <div className="border rounded-lg p-4 bg-white">
                <img
                  src={savedSignature}
                  alt="Saved signature"
                  className="max-h-[100px] mx-auto"
                />
              </div>
              <Button onClick={handleUseSaved} className="w-full">
                <Check className="w-4 h-4 mr-2" />
                Use Saved Signature
              </Button>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No saved signature found
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

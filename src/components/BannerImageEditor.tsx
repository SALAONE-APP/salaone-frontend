import { useCallback, useEffect, useState } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import { Loader2, RotateCcw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

const OUTPUT_WIDTH = 1600;
const OUTPUT_HEIGHT = 900;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Nao foi possivel abrir a imagem.'));
    image.src = src;
  });
}

async function cropBanner(file: File, croppedAreaPixels: Area) {
  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(sourceUrl);
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Nao foi possivel preparar o recorte.');

    context.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      OUTPUT_WIDTH,
      OUTPUT_HEIGHT,
    );

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error('Nao foi possivel gerar a imagem.')),
        'image/webp',
        0.92,
      );
    });

    return new File([blob], `banner-${Date.now()}.webp`, { type: 'image/webp' });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

interface BannerImageEditorProps {
  file: File;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => Promise<void>;
}

export function BannerImageEditor({ file, saving, onCancel, onConfirm }: BannerImageEditorProps) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  function resetCrop() {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      await onConfirm(await cropBanner(file, croppedAreaPixels));
    } finally {
      setProcessing(false);
    }
  }

  const busy = processing || saving;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-5">
      <div className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-4 sm:p-5">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Ajustar imagem do banner</h3>
            <p className="text-sm text-muted-foreground">
              Arraste a imagem para posicionar. Use a roda do mouse, pinça ou controle para ampliar.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onCancel} disabled={busy}>
            <X size={18} />
          </Button>
        </div>

        <div className="relative min-h-0 flex-1 bg-black">
          <div className="relative aspect-video max-h-[65vh] w-full">
            {previewUrl && (
              <Cropper
                image={previewUrl}
                crop={crop}
                zoom={zoom}
                aspect={16 / 9}
                minZoom={1}
                maxZoom={4}
                zoomSpeed={0.2}
                showGrid
                objectFit="horizontal-cover"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
                style={{
                  containerStyle: { background: '#09090b' },
                  cropAreaStyle: {
                    border: '2px solid rgba(255,255,255,.9)',
                    boxShadow: '0 0 0 9999em rgba(0,0,0,.55)',
                  },
                }}
              />
            )}
          </div>
        </div>

        <div className="space-y-4 border-t border-border p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="w-12 text-sm text-muted-foreground">Zoom</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              disabled={busy}
              className="min-w-0 flex-1 accent-primary"
            />
            <span className="w-12 text-right text-xs text-muted-foreground">{zoom.toFixed(1)}x</span>
            <Button type="button" variant="outline" size="sm" onClick={resetCrop} disabled={busy}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Restaurar
            </Button>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={busy || !croppedAreaPixels}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {busy ? 'Enviando...' : 'Aplicar e enviar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

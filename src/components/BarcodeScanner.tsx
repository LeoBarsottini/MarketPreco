import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cleanBarcode, isValidGtin } from "@/lib/gtin";
import { CameraOff, Keyboard } from "lucide-react";

/**
 * Camera EAN/GTIN reader (ZXing) with manual entry. Falls back to manual entry
 * when the camera is unavailable or permission is denied.
 */
export function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [camError, setCamError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "camera") return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamError("Este navegador não permite acesso à câmera.");
        setMode("manual");
        return;
      }
      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.ITF,
        ]);
        const reader = new BrowserMultiFormatReader(hints);
        if (cancelled || !videoRef.current) return;
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current,
          (result) => {
            if (!result) return;
            const code = cleanBarcode(result.getText());
            if (isValidGtin(code)) {
              controls.stop();
              navigator.vibrate?.(60);
              onDetected(code);
            }
          },
        );
        stop = () => controls.stop();
        if (cancelled) stop();
      } catch (e) {
        const name = (e as { name?: string })?.name;
        setCamError(
          name === "NotAllowedError"
            ? "Permissão de câmera negada. Libere nas configurações do navegador ou digite o código."
            : "Não foi possível abrir a câmera. Digite o código abaixo.",
        );
        setMode("manual");
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [mode, onDetected]);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const code = cleanBarcode(manual);
    if (!isValidGtin(code)) {
      setManualError("Código inválido. Confira os 8, 12, 13 ou 14 dígitos.");
      return;
    }
    onDetected(code);
  }

  return (
    <div className="space-y-4">
      {mode === "camera" ? (
        <div className="relative overflow-hidden rounded-2xl bg-foreground">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-primary-foreground/80" />
          <p className="absolute inset-x-0 bottom-2 text-center text-xs text-primary-foreground/90">Aponte para o código de barras</p>
        </div>
      ) : (
        camError && (
          <div className="flex gap-2 rounded-xl bg-warning p-3 text-sm text-warning-foreground">
            <CameraOff className="h-4 w-4 shrink-0" /> {camError}
          </div>
        )
      )}
      <form onSubmit={submitManual} className="space-y-2">
        <label className="text-sm font-medium" htmlFor="manual-code">Digitar código</label>
        <div className="flex gap-2">
          <Input id="manual-code" inputMode="numeric" placeholder="7891234567895" value={manual} onChange={(e) => { setManual(e.target.value); setManualError(null); }} />
          <Button type="submit" variant="secondary"><Keyboard className="h-4 w-4" /> Usar</Button>
        </div>
        {manualError && <p className="text-sm text-destructive">{manualError}</p>}
      </form>
      {mode === "manual" && (
        <Button variant="ghost" size="sm" onClick={() => { setCamError(null); setMode("camera"); }}>Tentar câmera novamente</Button>
      )}
    </div>
  );
}

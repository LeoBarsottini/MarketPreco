import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cleanBarcode, isValidGtin } from "@/lib/gtin";
import { Camera, CameraOff, Keyboard } from "lucide-react";

type Mode = "idle" | "camera" | "manual";

/**
 * GTIN reader with an explicit camera permission gesture. Scanning stops
 * after the first valid code and releases the camera on navigation/unmount.
 */
export function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const callback = useRef(onDetected);
  callback.current = onDetected;
  const [mode, setMode] = useState<Mode>("idle");
  const [camError, setCamError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (mode !== "camera") return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    let delivered = false;
    setOpening(true);

    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamError("Este navegador não permite acesso à câmera.");
        setMode("manual");
        setOpening(false);
        return;
      }
      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelled || !videoRef.current) return;
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E, BarcodeFormat.ITF,
        ]);
        const reader = new BrowserMultiFormatReader(hints);
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current,
          (result) => {
            if (cancelled || delivered || !result) return;
            const code = cleanBarcode(result.getText());
            if (!isValidGtin(code)) return;
            delivered = true;
            stop?.();
            navigator.vibrate?.(60);
            callback.current(code);
          },
        );
        stop = () => controls.stop();
        if (cancelled || delivered) stop();
      } catch (e) {
        if (cancelled || delivered) return;
        setCamError((e as { name?: string })?.name === "NotAllowedError"
          ? "Permissão de câmera negada. Libere nas configurações do navegador ou digite o código."
          : "Não foi possível abrir a câmera. Digite o código abaixo.");
        setMode("manual");
      } finally {
        if (!cancelled) setOpening(false);
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [mode]);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const code = cleanBarcode(manual);
    if (!isValidGtin(code)) {
      setManualError("Código inválido. Confira os 8, 12, 13 ou 14 dígitos.");
      return;
    }
    callback.current(code);
  }

  return (
    <div className="space-y-4">
      {mode === "idle" && (
        <div className="rounded-2xl border border-dashed p-5 text-center">
          <Camera className="mx-auto mb-2 h-8 w-8 text-primary" aria-hidden="true" />
          <p className="font-semibold">Escanear um código de barras</p>
          <p className="my-3 text-sm text-muted-foreground">
            O acesso à câmera será solicitado somente quando você tocar em abrir câmera.
          </p>
          <Button type="button" onClick={() => { setCamError(null); setMode("camera"); }}>
            <Camera className="h-4 w-4" /> Abrir câmera
          </Button>
        </div>
      )}
      {mode === "camera" && (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-2xl bg-foreground">
            <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-primary-foreground/80" />
            <p className="absolute inset-x-0 bottom-2 text-center text-xs text-primary-foreground/90">
              {opening ? "Abrindo câmera…" : "Aponte para o código de barras"}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => setMode("manual")}>
            <CameraOff className="h-4 w-4" /> Fechar câmera
          </Button>
        </div>
      )}
      {mode === "manual" && camError && (
        <div role="alert" className="flex gap-2 rounded-xl bg-warning p-3 text-sm text-warning-foreground">
          <CameraOff className="h-4 w-4 shrink-0" /> {camError}
        </div>
      )}
      <form onSubmit={submitManual} className="space-y-2">
        <label className="text-sm font-medium" htmlFor="manual-code">Digitar código</label>
        <div className="flex gap-2">
          <Input id="manual-code" inputMode="numeric" autoComplete="off" maxLength={20}
            placeholder="7891234567895" value={manual}
            onChange={(e) => { setManual(e.target.value); setManualError(null); }} />
          <Button type="submit" variant="secondary"><Keyboard className="h-4 w-4" /> Usar</Button>
        </div>
        {manualError && <p role="alert" className="text-sm text-destructive">{manualError}</p>}
      </form>
      {mode === "manual" && (
        <Button type="button" variant="ghost" size="sm"
          onClick={() => { setCamError(null); setMode("camera"); }}>
          <Camera className="h-4 w-4" /> Tentar câmera novamente
        </Button>
      )}
    </div>
  );
}

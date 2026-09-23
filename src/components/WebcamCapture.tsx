import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, SwitchCamera, RefreshCw } from "lucide-react";
import { errorMessage } from "@/lib/errors";

type WebcamCaptureProps = {
  open: boolean;
  onClose: () => void;
  onCapture: (blob: Blob) => void;
  title?: string;
};

export default function WebcamCapture({ open, onClose, onCapture, title = "Take Photo" }: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }, [stream]);

  const startCamera = useCallback(async (deviceId?: string) => {
    try {
      setError(null);
      setCaptured(null);
      // Stop any existing stream first
      stream?.getTracks().forEach((t) => t.stop());

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }

      // Enumerate devices after permission granted
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter((d) => d.kind === "videoinput");
      setDevices(videoDevices);

      if (!deviceId && videoDevices.length > 0) {
        const activeTrack = newStream.getVideoTracks()[0];
        const activeDeviceId = activeTrack.getSettings().deviceId;
        setSelectedDeviceId(activeDeviceId || videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error("Camera error:", err);
      const name = err instanceof DOMException ? err.name : "";
      setError(
        name === "NotAllowedError"
          ? "Camera access denied. Please allow camera permissions in your browser."
          : name === "NotFoundError"
          ? "No camera found. Please connect a camera and try again."
          : `Camera error: ${errorMessage(err)}`
      );
    }
  }, [stream]);

  useEffect(() => {
    if (open) {
      startCamera();
    }
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    startCamera(deviceId);
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);
    setCaptured(canvas.toDataURL("image/jpeg", 0.92));
  };

  const handleRetake = () => {
    setCaptured(null);
  };

  const handleSave = () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(
      (blob) => {
        if (blob) {
          stopStream();
          onCapture(blob);
          onClose();
        }
      },
      "image/jpeg",
      0.92
    );
  };

  const handleClose = () => {
    stopStream();
    setCaptured(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Camera className="h-5 w-5" /> {title}
          </DialogTitle>
        </DialogHeader>

        {error ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-destructive text-center">{error}</p>
            <Button variant="outline" onClick={() => startCamera()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Retry
            </Button>
          </div>
        ) : (
          <>
            {devices.length > 1 && (
              <div className="flex items-center gap-2">
                <SwitchCamera className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedDeviceId} onValueChange={handleDeviceChange}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select camera" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((d) => (
                      <SelectItem key={d.deviceId} value={d.deviceId}>
                        {d.label || `Camera ${devices.indexOf(d) + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="relative overflow-hidden rounded-lg bg-muted aspect-[4/3]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover ${captured ? "hidden" : ""}`}
              />
              {captured && (
                <img src={captured} alt="Captured" className="h-full w-full object-cover" />
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />
          </>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {!error && !captured && (
            <Button onClick={handleCapture}>
              <Camera className="mr-2 h-4 w-4" /> Capture
            </Button>
          )}
          {captured && (
            <>
              <Button variant="outline" onClick={handleRetake}>
                <RefreshCw className="mr-2 h-4 w-4" /> Retake
              </Button>
              <Button onClick={handleSave}>Use Photo</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

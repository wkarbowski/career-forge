import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import Modal from './Modal';
import { useAppState } from '../contexts/AppStateContext';

interface CroppedAreaPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getCroppedImg(imageSrc: string, croppedAreaPixels: CroppedAreaPixels): Promise<Blob | null> {
  return new Promise((resolve) => {
    const image = new window.Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    };
  });
}

interface ImageCropperModalProps {
  imageSrc: string | null;
  onCancel: () => void;
  onCropComplete: (blob: Blob | null) => void;
  aspect?: number;
}

const ImageCropperModal = ({ imageSrc, onCancel, onCropComplete, aspect = 1 }: ImageCropperModalProps) => {
  const { settings } = useAppState();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CroppedAreaPixels | null>(null);

  const onCropChange = useCallback((newCrop: { x: number; y: number }) => setCrop(newCrop), []);
  const onZoomChange = useCallback((newZoom: number) => setZoom(newZoom), []);
  const onCropAreaChange = useCallback((_: unknown, croppedAreaPixels: CroppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels), []);

  const handleCrop = async () => {
    if (!croppedAreaPixels) return;
    const croppedBlob = await getCroppedImg(imageSrc!, croppedAreaPixels);
    onCropComplete(croppedBlob);
  };

  if (!imageSrc) return null;

  return (
    <Modal>
      <div
        style={{
          background: settings?.sidebarColor1 || '#312e81',
          color: '#fff',
          borderRadius: 12,
          padding: 24,
          maxWidth: 420,
          margin: '40px auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        }}
      >
        <h2 style={{ marginBottom: 16 }}>Adjust Profile Image</h2>
        <div style={{ position: 'relative', width: 320, height: 320, background: '#222', margin: '0 auto' }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropAreaChange}
            cropShape="round"
            showGrid={false}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <button onClick={onCancel} style={{ background: 'transparent', color: '#fff', border: '1px solid #fff', borderRadius: 6, padding: '8px 18px', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleCrop} style={{ background: settings?.accentColor || '#6366f1', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', cursor: 'pointer' }}>Crop & Use</button>
        </div>
      </div>
    </Modal>
  );
};

export default ImageCropperModal;

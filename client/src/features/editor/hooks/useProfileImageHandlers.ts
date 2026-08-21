import { useState } from "react";
import { documentApi } from "../../../services/api";

type SaveStatus = "saving" | "saved" | "error" | "";
type DocumentId = number | "template" | null;

interface UseProfileImageHandlersParams {
  isAuthenticated: boolean;
  currentDocumentId: DocumentId;
  setProfileImage: (value: string | null) => void;
  onSaveStatusChange: (status: SaveStatus) => void;
}

const STANDARD_SIZE = 320;

const readFileAsDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new window.FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export function useProfileImageHandlers({
  isAuthenticated,
  currentDocumentId,
  setProfileImage,
  onSaveStatusChange,
}: UseProfileImageHandlersParams) {
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImage, setCropperImage] = useState<string | null>(null);

  const markImageError = () => {
    onSaveStatusChange("error");
    setTimeout(() => onSaveStatusChange(""), 3000);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!isAuthenticated || !currentDocumentId) {
      console.warn("Image upload attempted without authenticated user or document selected.");
      return;
    }

    const dataUrl = await readFileAsDataURL(file);
    const img = new window.Image();
    img.src = dataUrl;
    img.onload = async () => {
      if (img.width > STANDARD_SIZE || img.height > STANDARD_SIZE) {
        setCropperImage(dataUrl);
        setCropperOpen(true);
        return;
      }

      try {
        const result = await documentApi.uploadProfileImage(String(currentDocumentId), file);
        setProfileImage(result && typeof result.url === "string" ? result.url : null);
      } catch (err) {
        markImageError();
        setProfileImage(null);
        console.error("Image upload failed:", err);
      }
    };
  };

  const handleImageRemove = async () => {
    if (!isAuthenticated || !currentDocumentId) {
      console.warn("Image remove attempted without authenticated user or document selected.");
      return;
    }
    try {
      await documentApi.removeProfileImage(String(currentDocumentId));
      setProfileImage(null);
    } catch (err) {
      markImageError();
      console.error("Image remove failed:", err);
    }
  };

  const handleCropComplete = async (croppedBlob: Blob | null) => {
    setCropperOpen(false);
    setCropperImage(null);
    if (!croppedBlob || !isAuthenticated || !currentDocumentId) return;
    try {
      const croppedFile = new File([croppedBlob], "profile.png", { type: "image/png" });
      const result = await documentApi.uploadProfileImage(String(currentDocumentId), croppedFile);
      setProfileImage(result && typeof result.url === "string" ? result.url : null);
    } catch (err) {
      markImageError();
      setProfileImage(null);
      console.error("Image upload failed:", err);
    }
  };

  return {
    cropperOpen,
    cropperImage,
    setCropperOpen,
    setCropperImage,
    handleImageUpload,
    handleImageRemove,
    handleCropComplete,
  };
}

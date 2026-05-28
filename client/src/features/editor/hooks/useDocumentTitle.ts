import { useEffect, useRef, useState } from "react";
import { documentApi } from "../../../services/api";

type DocumentId = number | "template" | null;

interface UseDocumentTitleParams {
  documentTitle: string;
  setDocumentTitle: (title: string) => void;
  isAuthenticated: boolean;
  currentDocumentId: DocumentId;
}

export function useDocumentTitle({
  documentTitle,
  setDocumentTitle,
  isAuthenticated,
  currentDocumentId,
}: UseDocumentTitleParams) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleEdit = () => {
    setEditingTitleValue(documentTitle);
    setIsEditingTitle(true);
  };

  const handleTitleSave = async () => {
    const newTitle = editingTitleValue.trim();
    if (newTitle && newTitle !== documentTitle) {
      setDocumentTitle(newTitle);
      if (isAuthenticated && currentDocumentId) {
        try {
          await documentApi.update(String(currentDocumentId), { title: newTitle });
        } catch (err) {
          console.error("Failed to update title:", err);
        }
      }
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === "Escape") {
      setIsEditingTitle(false);
    }
  };

  return {
    isEditingTitle,
    editingTitleValue,
    titleInputRef,
    setEditingTitleValue,
    setIsEditingTitle,
    handleTitleEdit,
    handleTitleSave,
    handleTitleKeyDown,
  };
}

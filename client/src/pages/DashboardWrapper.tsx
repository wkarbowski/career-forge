import { useNavigate } from "react-router-dom";
import DocumentDashboard from "../components/DocumentDashboard";

export default function DashboardWrapper() {
  const navigate = useNavigate();

  const handleEditDocument = (documentId: number) => {
    navigate(`/editor/${documentId}`);
  };

  const handlePrintDocument = (documentId: number) => {
    navigate(`/editor/${documentId}?print=1`);
  };

  const handleSavePdfDocument = (documentId: number) => {
    navigate(`/editor/${documentId}?pdf=1`);
  };

  return (
    <DocumentDashboard
      onEditDocument={handleEditDocument}
      onPrintDocument={handlePrintDocument}
      onSavePdfDocument={handleSavePdfDocument}
    />
  );
}

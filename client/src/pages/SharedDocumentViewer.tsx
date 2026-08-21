import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "../i18n";
import { publicApi } from "../services/api";

export default function SharedDocumentViewer() {
  const { shareToken } = useParams();
  const { t } = useTranslation();
  const [doc, setDoc] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!shareToken) return;

    publicApi
      .getSharedDocument(shareToken)
      .then((d: any) => {
        if (!cancelled) setDoc(d);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [shareToken]);

  if (error)
    return (
      <div className="shared-doc-error">
        <h2>{t("shared.notFound")}</h2>
      </div>
    );
  if (!doc)
    return (
      <div className="shared-doc-loading">
        <i className="fas fa-spinner fa-spin"></i>
      </div>
    );

  return (
    <div className="shared-document-viewer">
      <h1>{doc.title as string}</h1>
      <div
        className="shared-document-readonly"
        dangerouslySetInnerHTML={{ __html: "" }}
      ></div>
      <p className="shared-doc-notice">{t("shared.readOnly")}</p>
    </div>
  );
}

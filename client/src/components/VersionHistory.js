import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import { documentApi } from '../services/api';

const VersionHistory = ({ documentId, onRestore }) => {
  const { t } = useTranslation();
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [versionName, setVersionName] = useState('');
  const [creating, setCreating] = useState(false);
  const [previewId, setPreviewId] = useState(null);

  const loadVersions = async () => {
    if (!documentId) return;
    setLoading(true);
    try {
      const list = await documentApi.listVersions(documentId);
      setVersions(list);
    } catch (err) {
      console.error('Failed to load versions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
  }, [documentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    if (!versionName.trim() || !documentId) return;
    setCreating(true);
    try {
      await documentApi.createVersion(documentId, versionName.trim());
      setVersionName('');
      await loadVersions();
    } catch (err) {
      console.error('Failed to create version:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (versionId) => {
    if (!documentId) return;
    try {
      const doc = await documentApi.restoreVersion(documentId, versionId);
      if (onRestore) onRestore(doc);
    } catch (err) {
      console.error('Failed to restore version:', err);
    }
  };

  const handleDelete = async (versionId) => {
    if (!documentId) return;
    try {
      await documentApi.deleteVersion(documentId, versionId);
      await loadVersions();
    } catch (err) {
      console.error('Failed to delete version:', err);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="version-history">
      <h3><i className="fas fa-history"></i> {t('versions.title')}</h3>

      <div className="version-create">
        <input
          type="text"
          placeholder={t('versions.namePlaceholder')}
          value={versionName}
          onChange={(e) => setVersionName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          maxLength={255}
        />
        <button onClick={handleCreate} disabled={creating || !versionName.trim()}>
          <i className="fas fa-save"></i> {t('versions.save')}
        </button>
      </div>

      {loading ? (
        <div className="version-loading"><i className="fas fa-spinner fa-spin"></i></div>
      ) : versions.length === 0 ? (
        <p className="version-empty">{t('versions.empty')}</p>
      ) : (
        <ul className="version-list">
          {versions.map((v) => (
            <li key={v.id} className={`version-item ${previewId === v.id ? 'previewing' : ''}`}>
              <div className="version-info">
                <span className="version-name">{v.version_name}</span>
                <span className="version-date">{formatDate(v.created_at)}</span>
              </div>
              <div className="version-actions">
                <button onClick={() => handleRestore(v.id)} title={t('versions.restore')}>
                  <i className="fas fa-undo"></i>
                </button>
                <button onClick={() => handleDelete(v.id)} title={t('versions.delete')} className="danger">
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default VersionHistory;

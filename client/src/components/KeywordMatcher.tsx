import React, { useState } from 'react';
import { useTranslation } from '../i18n';

interface KeywordMatcherProps {
  resumeText: string;
}

interface KeywordResult {
  keywords: Array<{ word: string; count: number; found: boolean }>;
  score: number;
  found: number;
  total: number;
}

const KeywordMatcher = ({ resumeText }: KeywordMatcherProps) => {
  const { t } = useTranslation();
  const [jobDescription, setJobDescription] = useState('');
  const [results, setResults] = useState<KeywordResult | null>(null);

  const analyzeKeywords = () => {
    if (!jobDescription.trim() || !resumeText) return;

    // Extract meaningful words (3+ chars, no stop words)
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her',
      'was', 'one', 'our', 'out', 'has', 'have', 'had', 'will', 'with', 'this',
      'that', 'from', 'they', 'been', 'said', 'each', 'which', 'their', 'would',
      'about', 'could', 'other', 'into', 'than', 'them', 'very', 'also', 'just',
    ]);

    const extractWords = (text: string): string[] => {
      return text
        .toLowerCase()
        .replace(/<[^>]*>/g, '') // strip HTML
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !stopWords.has(w));
    };

    const jdWords = extractWords(jobDescription);
    const resumeWords = new Set(extractWords(resumeText));

    // Count JD keyword frequencies
    const jdFreq: Record<string, number> = {};
    jdWords.forEach(w => { jdFreq[w] = (jdFreq[w] || 0) + 1; });

    // Sort by frequency
    const keywords = Object.entries(jdFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([word, count]) => ({
        word,
        count,
        found: resumeWords.has(word),
      }));

    const found = keywords.filter(k => k.found).length;
    const total = keywords.length;
    const score = total > 0 ? Math.round((found / total) * 100) : 0;

    setResults({ keywords, score, found, total });
  };

  return (
    <div className="keyword-matcher">
      <h3><i className="fas fa-search"></i> {t('keywords.title')}</h3>
      <textarea
        className="keyword-matcher-input"
        placeholder={t('keywords.pastePlaceholder')}
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
        rows={6}
      />
      <button className="keyword-matcher-btn" onClick={analyzeKeywords} disabled={!jobDescription.trim()}>
        <i className="fas fa-chart-bar"></i> {t('keywords.analyze')}
      </button>

      {results && (
        <div className="keyword-results">
          <div className={`keyword-score ${results.score >= 70 ? 'good' : results.score >= 40 ? 'fair' : 'poor'}`}>
            <span className="score-number">{results.score}%</span>
            <span className="score-label">{t('keywords.matchScore')}</span>
            <span className="score-detail">{results.found}/{results.total} {t('keywords.keywordsFound')}</span>
          </div>
          <div className="keyword-chips">
            {results.keywords.map((kw) => (
              <span key={kw.word} className={`keyword-chip ${kw.found ? 'found' : 'missing'}`}>
                {kw.word}
                {kw.found ? <i className="fas fa-check"></i> : <i className="fas fa-times"></i>}
              </span>
            ))}
          </div>
          {results.score < 70 && (
            <p className="keyword-hint">{t('keywords.hint')}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default KeywordMatcher;

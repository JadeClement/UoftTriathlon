import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import './RAGChatWidget.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';

// Simple markdown: **bold** and newlines
function formatAnswer(text) {
  if (!text) return '';
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />');
}

const RAGChatWidget = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);

  // Hide on admin pages and on iOS native app
  const isAdmin = location.pathname.startsWith('/admin');
  const isIOSNative = Capacitor.getPlatform() === 'ios' && Capacitor.isNativePlatform();
  if (isAdmin || isIOSNative) return null;

  const handleAsk = async (e) => {
    e?.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setAnswer(null);
    setSources([]);
    try {
      const res = await fetch(`${API_BASE_URL}/rag/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('[RAG] API error:', res.status, data);
        if (res.status === 503 && data.error) {
          setAnswer("The Q&A service is not fully set up yet. Please email info@uoft-tri.club for help.");
        } else {
          setAnswer(data.answer || "Something went wrong. Please email info@uoft-tri.club instead.");
        }
      } else {
        setAnswer(data.answer || "I can't answer that, email us instead!");
      }
      setSources(data.sources || []);
    } catch (err) {
      console.error('[RAG] Fetch error:', err);
      setAnswer("Could not reach the server. Make sure the backend is running, or email info@uoft-tri.club.");
      setSources([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setQuestion('');
    setAnswer(null);
    setSources([]);
  };

  return (
    <div className="rag-chat-widget">
      {open ? (
        <div className="rag-chat-panel">
          <div className="rag-chat-header">
            <h4>Ask about the club</h4>
            <button type="button" className="rag-chat-close" onClick={handleClose} aria-label="Close">
              ×
            </button>
          </div>
          <p className="rag-chat-hint">Ask a question about the UofT Triathlon Club. If we cannot answer, email us at info@uoft-tri.club.</p>
          <form onSubmit={handleAsk} className="rag-chat-form">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. How do I join? Where are practices?"
              disabled={loading}
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Searching…' : 'Ask'}
            </button>
          </form>
          {answer && (
            <div className="rag-chat-answer">
              <div
                className="rag-chat-answer-text"
                dangerouslySetInnerHTML={{ __html: formatAnswer(answer) }}
              />
              {sources.length > 0 && (
                <p className="rag-chat-sources">
                  From: {sources.map((s) => s || '/').join(', ')}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="rag-chat-toggle"
          onClick={() => setOpen(true)}
          aria-label="Ask a question"
        >
          ?
        </button>
      )}
    </div>
  );
};

export default RAGChatWidget;

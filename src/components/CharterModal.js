import React, { useEffect, useRef, useState } from 'react';
import './CharterModal.css';

const CharterModal = ({ open, onAgree, charterText }) => {
  const contentRef = useRef(null);
  const [canAgree, setCanAgree] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCanAgree(false);
    const el = contentRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
      if (atBottom) setCanAgree(true);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [open]);

  if (!open) return null;

  const headings = new Set([
    'Introduction',
    'Requirements',
    'General Conduct',
    'Swim Specific Conduct',
    'Bike Specific Conduct',
    'Run Specific Conduct',
    'Accommodations',
    'Safety and Responsibility',
    'Inclusivity and Respect',
    'Accountability and Discipline',
    'Agreement'
  ]);

  const lines = (charterText || '').split('\n');

  // Build sections with bullet items
  const sections = [];
  let current = null;
  lines.forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    if (headings.has(line)) {
      current = { title: line, items: [] };
      sections.push(current);
      return;
    }
    if (!current) return; // skip any text before first heading
    // Treat lines ending with ':' as subheadings within bullets
    const isSubheading = line.endsWith(':');
    current.items.push({ text: line.replace(/\s+$/,' '), isSub: isSubheading });
  });

  return (
    <div className="charter-overlay" role="dialog" aria-modal="true">
      <div className="charter-modal">
        <h2>University of Toronto Triathlon Club Charter</h2>
        <div className="charter-content" ref={contentRef}>
          {sections.map((section, sIdx) => (
            <React.Fragment key={sIdx}>
              <h3 className="charter-title">{section.title}</h3>
              <ul className="charter-list">
                {section.items.map((it, iIdx) => (
                  <li key={iIdx} className={it.isSub ? 'charter-item sub' : 'charter-item'}>
                    {it.isSub ? <strong>{it.text}</strong> : it.text}
                  </li>
                ))}
              </ul>
            </React.Fragment>
          ))}
        </div>
        <div className="charter-actions">
          <button className="btn btn-primary" disabled={!canAgree} onClick={onAgree}>
            I have read and agree
          </button>
          {!canAgree && <small>Scroll to the bottom to enable</small>}
        </div>
      </div>
    </div>
  );
};

export default CharterModal;



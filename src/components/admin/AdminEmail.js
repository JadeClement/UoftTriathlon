import React from 'react';
import { useAdminContext } from '../../context/AdminContext';

const AdminEmail = () => {
  const {
    emailForm,
    setEmailForm,
    template,
    setTemplate,
    emailType,
    setEmailType,
    emailAttachments,
    setEmailAttachments,
    insertBold,
    insertItalic,
    insertNumberedList,
    insertUrl,
    handleTextareaKeyDown,
    handleSendEmail,
    emailStatus,
    bulkEmailStatus,
    sendingEmail,
    sendingBulkEmail,
  } = useAdminContext();

  return (
    <div className="admin-main-content" style={{ padding: '2rem' }}>
      <div className="email-section">
        <h2>Send Email</h2>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: '400px' }}>
            <form>
              <div className="form-group" style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="emailType"
                    value="individual"
                    checked={emailType === 'individual'}
                    onChange={(e) => setEmailType(e.target.value)}
                  />
                  Individual
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="emailType"
                    value="everyone"
                    checked={emailType === 'everyone'}
                    onChange={(e) => setEmailType(e.target.value)}
                  />
                  Everyone (Members, Exec, Admin)
                </label>
              </div>

              {emailType === 'individual' && (
                <>
                  <div className="form-group">
                    <label>To</label>
                    <input
                      type="email"
                      value={emailForm.to}
                      onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                      placeholder="recipient@example.com"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Subject</label>
                    <input
                      type="text"
                      value={emailForm.subject}
                      onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                      placeholder="Email subject"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Message</label>
                    <textarea
                      rows="8"
                      value={emailForm.message}
                      onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                      placeholder="Type your message here..."
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Attachments (optional)</label>
                    <div
                      style={{
                        border: '2px dashed #cbd5e1',
                        borderRadius: '8px',
                        padding: '20px',
                        textAlign: 'center',
                        backgroundColor: '#f8fafc',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.backgroundColor = '#eff6ff';
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                        const files = Array.from(e.dataTransfer.files);
                        setEmailAttachments([...emailAttachments, ...files]);
                      }}
                      onClick={() => document.getElementById('email-file-input').click()}
                    >
                      <input
                        id="email-file-input"
                        type="file"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files);
                          setEmailAttachments([...emailAttachments, ...files]);
                          e.target.value = '';
                        }}
                        style={{ display: 'none' }}
                      />
                      <div style={{ color: '#64748b', marginBottom: '8px' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto 8px', display: 'block' }}>
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="17 8 12 3 7 8"></polyline>
                          <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <p style={{ margin: '4px 0', fontSize: '14px', fontWeight: '500' }}>
                          Click to upload or drag and drop
                        </p>
                        <p style={{ margin: '0', fontSize: '12px', color: '#94a3b8' }}>
                          PDF, DOC, DOCX, images, or other files (max 10MB per file)
                        </p>
                      </div>
                    </div>
                    {emailAttachments.length > 0 && (
                      <div
                        style={{
                          marginTop: '16px',
                          padding: '12px',
                          backgroundColor: '#f1f5f9',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#475569' }}>
                          Attached Files ({emailAttachments.length})
                        </div>
                        {emailAttachments.map((file, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              padding: '8px 12px',
                              marginBottom: '6px',
                              backgroundColor: 'white',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: '18px' }}>📎</span>
                              <span
                                style={{
                                  fontSize: '14px',
                                  color: '#1e293b',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {file.name}
                              </span>
                              <span style={{ color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                ({(file.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newFiles = [...emailAttachments];
                                newFiles.splice(idx, 1);
                                setEmailAttachments(newFiles);
                              }}
                              style={{
                                background: '#fee2e2',
                                border: '1px solid #fecaca',
                                color: '#dc2626',
                                cursor: 'pointer',
                                fontSize: '14px',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontWeight: '500',
                                transition: 'all 0.2s ease',
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = '#fecaca';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = '#fee2e2';
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {emailType === 'everyone' && (
                <div className="card" style={{ padding: '16px', border: '1px solid #eee', borderRadius: 6, marginBottom: 16 }}>
                  <h3 style={{ marginTop: 0 }}>Email Template</h3>
                  <div className="form-group">
                    <label>Banner Title</label>
                    <input
                      type="text"
                      value={template.bannerTitle}
                      onChange={(e) => setTemplate({ ...template, bannerTitle: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                      placeholder={`UofT Tri Club – ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`}
                    />
                  </div>
                  <div className="form-group">
                    <label>Title</label>
                    <input
                      type="text"
                      value={template.title}
                      onChange={(e) => setTemplate({ ...template, title: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                      placeholder="Email subject/title"
                    />
                  </div>
                  <div className="form-group">
                    <label>Email Body</label>
                    <div style={{ border: '1px solid #ddd', borderRadius: '6px', overflow: 'hidden' }}>
                      <div
                        style={{
                          background: '#f8f9fa',
                          padding: '8px 12px',
                          borderBottom: '1px solid #ddd',
                          display: 'flex',
                          gap: '8px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <button
                          type="button"
                          onClick={insertBold}
                          style={{
                            padding: '6px 12px',
                            border: '1px solid #ccc',
                            background: 'white',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                          }}
                          title="Bold"
                        >
                          B
                        </button>
                        <button
                          type="button"
                          onClick={insertItalic}
                          style={{
                            padding: '6px 12px',
                            border: '1px solid #ccc',
                            background: 'white',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontStyle: 'italic',
                          }}
                          title="Italic"
                        >
                          I
                        </button>
                        <button
                          type="button"
                          onClick={insertNumberedList}
                          style={{
                            padding: '6px 12px',
                            border: '1px solid #ccc',
                            background: 'white',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                          }}
                          title="Numbered List"
                        >
                          1.
                        </button>
                        <button
                          type="button"
                          onClick={insertUrl}
                          style={{
                            padding: '6px 12px',
                            border: '1px solid #ccc',
                            background: 'white',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                          }}
                          title="Insert Link"
                        >
                          🔗
                        </button>
                      </div>
                      <textarea
                        id="email-body-textarea"
                        rows="8"
                        value={template.body}
                        onChange={(e) => setTemplate({ ...template, body: e.target.value })}
                        onKeyDown={handleTextareaKeyDown}
                        placeholder="Type your email content here... Use Enter for new lines. Use the buttons above for formatting."
                        style={{
                          width: '100%',
                          border: 'none',
                          padding: '12px',
                          fontSize: '14px',
                          lineHeight: '1.5',
                          resize: 'vertical',
                          outline: 'none',
                          fontFamily: 'inherit',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      💡 Tip: Use **bold**, *italic*, numbered lists (1. 2. 3.), and [links](url) for formatting. Press Enter after numbered items to auto-continue the list!
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: '20px' }}>
                    <label>Attachments (optional)</label>
                    <div
                      style={{
                        border: '2px dashed #cbd5e1',
                        borderRadius: '8px',
                        padding: '20px',
                        textAlign: 'center',
                        backgroundColor: '#f8fafc',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.backgroundColor = '#eff6ff';
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                        const files = Array.from(e.dataTransfer.files);
                        setEmailAttachments([...emailAttachments, ...files]);
                      }}
                      onClick={() => document.getElementById('email-file-input-everyone').click()}
                    >
                      <input
                        id="email-file-input-everyone"
                        type="file"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files);
                          setEmailAttachments([...emailAttachments, ...files]);
                          e.target.value = '';
                        }}
                        style={{ display: 'none' }}
                      />
                      <div style={{ color: '#64748b', marginBottom: '8px' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto 8px', display: 'block' }}>
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="17 8 12 3 7 8"></polyline>
                          <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <p style={{ margin: '4px 0', fontSize: '14px', fontWeight: '500' }}>
                          Click to upload or drag and drop
                        </p>
                        <p style={{ margin: '0', fontSize: '12px', color: '#94a3b8' }}>
                          PDF, DOC, DOCX, images, or other files (max 10MB per file)
                        </p>
                      </div>
                    </div>
                    {emailAttachments.length > 0 && (
                      <div
                        style={{
                          marginTop: '16px',
                          padding: '12px',
                          backgroundColor: '#f1f5f9',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#475569' }}>
                          Attached Files ({emailAttachments.length})
                        </div>
                        {emailAttachments.map((file, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              padding: '8px 12px',
                              marginBottom: '6px',
                              backgroundColor: 'white',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: '18px' }}>📎</span>
                              <span
                                style={{
                                  fontSize: '14px',
                                  color: '#1e293b',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {file.name}
                              </span>
                              <span style={{ color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                ({(file.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newFiles = [...emailAttachments];
                                newFiles.splice(idx, 1);
                                setEmailAttachments(newFiles);
                              }}
                              style={{
                                background: '#fee2e2',
                                border: '1px solid #fecaca',
                                color: '#dc2626',
                                cursor: 'pointer',
                                fontSize: '14px',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontWeight: '500',
                                transition: 'all 0.2s ease',
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = '#fecaca';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = '#fee2e2';
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(emailStatus || bulkEmailStatus) && (
                <div className={`notice ${(emailStatus || bulkEmailStatus).type}`} style={{ marginBottom: '1rem' }}>
                  {(emailStatus || bulkEmailStatus).text}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={sendingEmail || sendingBulkEmail}
                  onClick={handleSendEmail}
                  style={{
                    backgroundColor: emailType === 'everyone' ? '#dc2626' : '#3b82f6',
                    width: '100%',
                  }}
                >
                  {sendingEmail ? 'Sending...' : sendingBulkEmail ? 'Sending to All...' : emailType === 'everyone' ? 'Send to Everyone' : 'Send Email'}
                </button>
              </div>
            </form>
          </div>

          {emailType === 'everyone' && (
            <div style={{ flex: 1, minWidth: '400px' }}>
              <div className="card" style={{ padding: '16px', border: '1px solid #eee', borderRadius: 6, position: 'sticky', top: '20px' }}>
                <h3 style={{ marginTop: 0 }}>Preview</h3>
                <div
                  style={{
                    maxWidth: '600px',
                    margin: '0 auto',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  }}
                >
                  <div
                    style={{
                      background: '#dc2626',
                      color: '#ffffff',
                      padding: '32px 24px',
                      textAlign: 'center',
                    }}
                  >
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px' }}>
                      {template.bannerTitle || `University of Toronto Triathlon Club – ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`}
                    </h1>
                  </div>

                  <div style={{ padding: '32px 24px' }}>
                    {template.body && (
                      <div
                        style={{
                          background: '#f8fafc',
                          padding: '24px',
                          borderRadius: '12px',
                        }}
                      >
                        <div
                          style={{
                            margin: 0,
                            color: '#475569',
                            fontSize: '16px',
                            lineHeight: 1.6,
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {(() => {
                            let formattedText = template.body;
                            formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                            formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
                            formattedText = formattedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #3b82f6; text-decoration: none;">$1</a>');
                            return <div dangerouslySetInnerHTML={{ __html: formattedText }} />;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      background: '#f1f5f9',
                      padding: '24px',
                      textAlign: 'center',
                      borderTop: '1px solid #e2e8f0',
                    }}
                  >
                    <p style={{ margin: '0 0 12px 0', color: '#64748b', fontSize: '14px' }}>
                      UofT Triathlon Club | <a href="https://uoft-tri.club" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>uoft-tri.club</a>
                    </p>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '14px', fontStyle: 'italic' }}>
                      The UofT Tri Club Exec
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminEmail;

import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../context/AuthContext';
import { getFieldsForSport } from '../config/sportFields';
import ConfirmModal from './ConfirmModal';

const Results = () => {
  const { currentUser, isMember, updateUser } = useAuth();

  // Only show this page in the native iOS app
  const isIOSNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

  // Results section state (moved from Profile)
  const [userRecords, setUserRecords] = useState([]);
  const [testEvents, setTestEvents] = useState([]);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [deleteRecordConfirm, setDeleteRecordConfirm] = useState({ isOpen: false, recordId: null });
  const [expandedRecordIds, setExpandedRecordIds] = useState(new Set());
  const [recordForm, setRecordForm] = useState({
    test_event_id: '',
    result: '',
    description: '',
    result_fields: {}
  });
  const [resultsPublic, setResultsPublic] = useState(false);
  const [error, setError] = useState('');

  // Load user's results_public setting
  useEffect(() => {
    const resultsPublicValue =
      (currentUser?.results_public || currentUser?.resultsPublic || false);
    setResultsPublic(resultsPublicValue);
  }, [currentUser]);

  // Load user records
  useEffect(() => {
    const loadUserRecords = async () => {
      if (!currentUser?.id) return;

      try {
        const token = localStorage.getItem('triathlonToken');
        const response = await fetch(
          `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/records?user_id=${currentUser.id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (response.ok) {
          const data = await response.json();
          const parsedRecords = (data.records || []).map((record) => {
            if (record.result_fields) {
              try {
                if (typeof record.result_fields === 'string') {
                  record.result_fields = JSON.parse(record.result_fields);
                }
              } catch (e) {
                record.result_fields = {};
              }
            }
            return record;
          });
          setUserRecords(parsedRecords);
        }
      } catch (err) {
        console.error('Error loading user records:', err);
      }
    };

    loadUserRecords();
  }, [currentUser]);

  // Load test events for dropdown
  useEffect(() => {
    const loadTestEvents = async () => {
      if (!showRecordModal) return;

      try {
        const token = localStorage.getItem('triathlonToken');
        const response = await fetch(
          `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/test-events`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (response.ok) {
          const data = await response.json();
          setTestEvents(data.testEvents || []);
        }
      } catch (err) {
        console.error('Error loading test events:', err);
      }
    };

    loadTestEvents();
  }, [showRecordModal]);

  const createRecord = async () => {
    if (!recordForm.test_event_id) {
      setError('Please select a test event');
      return;
    }

    try {
      const token = localStorage.getItem('triathlonToken');
      const selectedTestEvent = testEvents.find((te) => te.id === parseInt(recordForm.test_event_id, 10));

      const response = await fetch(
        `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/records`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            test_event_id: parseInt(recordForm.test_event_id, 10),
            title: selectedTestEvent?.title || '',
            result: recordForm.result,
            notes: recordForm.description,
            result_fields: recordForm.result_fields || {},
          }),
        }
      );

      if (response.ok) {
        // Reload records
        const recordsResponse = await fetch(
          `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/records?user_id=${currentUser.id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (recordsResponse.ok) {
          const data = await recordsResponse.json();
          const parsedRecords = (data.records || []).map((record) => {
            if (record.result_fields) {
              try {
                if (typeof record.result_fields === 'string') {
                  record.result_fields = JSON.parse(record.result_fields);
                }
              } catch (e) {
                record.result_fields = {};
              }
            }
            return record;
          });
          setUserRecords(parsedRecords);
        }
        setShowRecordModal(false);
        setEditingRecordId(null);
        setDeleteRecordConfirm({ isOpen: false, recordId: null });
        setRecordForm({ test_event_id: '', result: '', description: '', result_fields: {} });
        setError('');
      } else {
        const errorData = await response.json();
        if (errorData.error === 'duplicate_record') {
          setError(
            errorData.message ||
              'Whoops! You already have a result for this test event. Please edit that one instead.'
          );
        } else {
          setError(errorData.error || 'Failed to create record');
        }
      }
    } catch (err) {
      console.error('Error creating record:', err);
      setError(err.message || 'Error creating record');
    }
  };

  const updateRecord = async () => {
    if (!editingRecordId) return;

    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(
        `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/records/${editingRecordId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            result: recordForm.result,
            notes: recordForm.description,
            result_fields: recordForm.result_fields || {},
          }),
        }
      );

      if (response.ok) {
        const recordsResponse = await fetch(
          `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/records?user_id=${currentUser.id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (recordsResponse.ok) {
          const data = await recordsResponse.json();
          const parsedRecords = (data.records || []).map((record) => {
            if (record.result_fields) {
              try {
                if (typeof record.result_fields === 'string') {
                  record.result_fields = JSON.parse(record.result_fields);
                }
              } catch (e) {
                record.result_fields = {};
              }
            }
            return record;
          });
          setUserRecords(parsedRecords);
        }
        setShowRecordModal(false);
        setEditingRecordId(null);
        setDeleteRecordConfirm({ isOpen: false, recordId: null });
        setRecordForm({ test_event_id: '', result: '', description: '', result_fields: {} });
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update record');
      }
    } catch (err) {
      console.error('Error updating record:', err);
      setError('Error updating record');
    }
  };

  const handleEditRecord = (record) => {
    setEditingRecordId(record.id);
    let parsedResultFields = {};
    if (record.result_fields) {
      try {
        parsedResultFields =
          typeof record.result_fields === 'string' ? JSON.parse(record.result_fields) : record.result_fields;
      } catch (e) {
        parsedResultFields = {};
      }
    }
    setRecordForm({
      test_event_id: record.test_event_id.toString(),
      result: record.result || '',
      description: record.notes || record.description || '',
      result_fields: parsedResultFields,
    });
    setShowRecordModal(true);
    setError('');
  };

  const deleteRecord = () => {
    if (!editingRecordId) return;
    setDeleteRecordConfirm({ isOpen: true, recordId: editingRecordId });
  };

  const confirmDeleteRecord = async () => {
    const { recordId } = deleteRecordConfirm;
    setDeleteRecordConfirm({ isOpen: false, recordId: null });
    if (!recordId) return;

    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(
        `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/records/${recordId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const recordsResponse = await fetch(
          `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/records?user_id=${currentUser.id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (recordsResponse.ok) {
          const data = await recordsResponse.json();
          const parsedRecords = (data.records || []).map((record) => {
            if (record.result_fields) {
              try {
                if (typeof record.result_fields === 'string') {
                  record.result_fields = JSON.parse(record.result_fields);
                }
              } catch (e) {
                record.result_fields = {};
              }
            }
            return record;
          });
          setUserRecords(parsedRecords);
        }
        setShowRecordModal(false);
        setEditingRecordId(null);
        setDeleteRecordConfirm({ isOpen: false, recordId: null });
        setRecordForm({ test_event_id: '', result: '', description: '', result_fields: {} });
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete record');
      }
    } catch (err) {
      console.error('Error deleting record:', err);
      setError('Error deleting record');
    }
  };

  return (
    <div className="profile-container">
      <div className="container">
        {!currentUser ? (
          <div>
            <h2>Your results</h2>
            <p>You need to be logged in to view your test results.</p>
          </div>
        ) : !isMember(currentUser) ? (
          <div>
            <h2>Your results</h2>
            <p>Results are only available for full members.</p>
          </div>
        ) : !isIOSNative ? (
          <div>
            <h2>Your results</h2>
            <p>This page is only available in the iOS app.</p>
          </div>
        ) : (
          <>
        <div
          style={{
            marginTop: '2rem',
            background: 'white',
            padding: '1.5rem',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <h2 style={{ margin: 0, color: '#374151' }}>Results</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={resultsPublic}
                    onChange={async (e) => {
                      const newValue = e.target.checked;
                      setResultsPublic(newValue);
                      try {
                        const token = localStorage.getItem('triathlonToken');
                        const response = await fetch(
                          `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api'}/users/profile`,
                          {
                            method: 'PUT',
                            headers: {
                              Authorization: `Bearer ${token}`,
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              name: currentUser.name,
                              email: currentUser.email,
                              phone_number: currentUser.phone_number || currentUser.phoneNumber,
                              bio: currentUser.bio,
                              results_public: newValue,
                            }),
                          }
                        );
                        if (response.ok) {
                          const updatedUser = {
                            ...currentUser,
                            results_public: newValue,
                            resultsPublic: newValue,
                          };
                          updateUser(updatedUser);
                        } else {
                          setResultsPublic(!newValue);
                          setError('Failed to update privacy setting');
                        }
                      } catch (err) {
                        console.error('Error updating privacy setting:', err);
                        setResultsPublic(!newValue);
                        setError('Error updating privacy setting');
                      }
                    }}
                  />
                  <span className="toggle-slider" />
                </label>
                <span className="toggle-label" style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {resultsPublic ? 'Public' : 'Private'}
                </span>
              </div>
              <button
                className="new-post-btn"
                onClick={() => {
                  setShowRecordModal(true);
                  setRecordForm({ test_event_id: '', result: '', description: '', result_fields: {} });
                  setError('');
                }}
              >
                +<span className="btn-text"> New</span>
              </button>
            </div>
          </div>

          {userRecords.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>
                      Title
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>
                      Sport
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>
                      Date
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>
                      Workout
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>
                      Result
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>
                      Notes
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {userRecords.map((record) => {
                    let resultFields = {};
                    if (record.result_fields) {
                      if (typeof record.result_fields === 'string') {
                        try {
                          resultFields = JSON.parse(record.result_fields);
                        } catch (e) {
                          resultFields = {};
                        }
                      } else {
                        resultFields = record.result_fields;
                      }
                    }
                    const isExpanded = expandedRecordIds.has(record.id);
                    const sport = record.test_event_sport || record.sport;
                    const fields = sport ? getFieldsForSport(sport) : [];
                    const hasSportSpecificFields = fields.length > 0;

                    return (
                      <React.Fragment key={record.id}>
                        <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '0.75rem', color: '#6b7280' }}>
                            {record.test_event_title || record.title}
                          </td>
                          <td style={{ padding: '0.75rem', color: '#6b7280' }}>
                            <span
                              className={`sport-badge ${record.test_event_sport || record.sport}`}
                            >
                              {record.test_event_sport || record.sport}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem', color: '#6b7280' }}>
                            {record.test_event_date
                              ? new Date(record.test_event_date).toLocaleDateString()
                              : '-'}
                          </td>
                          <td style={{ padding: '0.75rem', color: '#6b7280' }}>
                            {record.test_event_workout || '-'}
                          </td>
                          <td style={{ padding: '0.75rem', color: '#6b7280' }}>
                            {record.result || '-'}
                          </td>
                          <td style={{ padding: '0.75rem', color: '#6b7280' }}>
                            {record.notes || record.description || '-'}
                          </td>
                          <td style={{ padding: '0.75rem', color: '#6b7280' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                onClick={() => handleEditRecord(record)}
                                style={{
                                  background: '#10b981',
                                  color: 'white',
                                  border: 'none',
                                  padding: '0.375rem 0.75rem',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem',
                                  fontWeight: 500,
                                }}
                              >
                                ✏️ Edit
                              </button>
                              {hasSportSpecificFields && (
                                <button
                                  onClick={() => {
                                    const newExpanded = new Set(expandedRecordIds);
                                    if (isExpanded) {
                                      newExpanded.delete(record.id);
                                    } else {
                                      newExpanded.add(record.id);
                                    }
                                    setExpandedRecordIds(newExpanded);
                                  }}
                                  style={{
                                    background: isExpanded ? '#6b7280' : '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.375rem 0.75rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    fontWeight: 500,
                                  }}
                                >
                                  {isExpanded ? '▼ Collapse' : '▶ Expand'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && hasSportSpecificFields && (
                          <tr style={{ background: '#f8fafc' }}>
                            <td colSpan="7" style={{ padding: '1rem' }}>
                              <div
                                style={{
                                  padding: '1rem',
                                  background: 'white',
                                  borderRadius: '8px',
                                  border: '1px solid #e5e7eb',
                                }}
                              >
                                <h4
                                  style={{
                                    margin: '0 0 0.75rem 0',
                                    color: '#374151',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                  }}
                                >
                                  {sport.charAt(0).toUpperCase() + sport.slice(1)}
                                  -Specific Details:
                                </h4>
                                {fields.length > 0 ? (
                                  <div
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns:
                                        'repeat(auto-fit, minmax(200px, 1fr))',
                                      gap: '1rem',
                                    }}
                                  >
                                    {fields.map((field) => {
                                      const value = resultFields[field.key];
                                      if (
                                        value === null ||
                                        value === undefined ||
                                        value === ''
                                      )
                                        return null;
                                      return (
                                        <div
                                          key={field.key}
                                          style={{
                                            padding: '0.5rem',
                                            background: '#f8fafc',
                                            borderRadius: '4px',
                                          }}
                                        >
                                          <div
                                            style={{
                                              fontSize: '0.75rem',
                                              color: '#6b7280',
                                              marginBottom: '0.25rem',
                                            }}
                                          >
                                            {field.label}:
                                          </div>
                                          <div
                                            style={{
                                              fontSize: '0.875rem',
                                              fontWeight: 500,
                                              color: '#111827',
                                            }}
                                          >
                                            {Array.isArray(value)
                                              ? value.join(', ')
                                              : value}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p
                                    style={{
                                      color: '#6b7280',
                                      fontSize: '0.875rem',
                                      margin: 0,
                                      fontStyle: 'italic',
                                    }}
                                  >
                                    No sport-specific details recorded yet. Click "Edit" to
                                    add them.
                                  </p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p
              style={{
                color: '#6b7280',
                textAlign: 'center',
                padding: '2rem',
              }}
            >
              No results yet. Click "+ New" to add your first result!
            </p>
          )}
        </div>

        {/* Record Modal */}
        {showRecordModal && (
          <div
            className="modal-overlay"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
          >
            <div
              className="modal"
              style={{
                background: 'white',
                padding: '2rem',
                borderRadius: '12px',
                maxWidth: '500px',
                width: '90%',
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
            >
              <h2 style={{ marginTop: 0 }}>
                {editingRecordId ? 'Edit Result' : 'New Result'}
              </h2>
              {error && (
                <div
                  style={{
                    color: '#dc2626',
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    background: '#fee2e2',
                    borderRadius: '4px',
                  }}
                >
                  {error}
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editingRecordId) {
                    updateRecord();
                  } else {
                    createRecord();
                  }
                }}
              >
                <div className="form-group">
                  <label className="form-label">Test Event:</label>
                  <select
                    value={recordForm.test_event_id}
                    onChange={(e) => {
                      setRecordForm({ ...recordForm, test_event_id: e.target.value });
                      setError('');
                    }}
                    className="form-input"
                    required
                    disabled={!!editingRecordId}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      opacity: editingRecordId ? 0.6 : 1,
                    }}
                  >
                    <option value="">Select a test event...</option>
                    {testEvents.map((te) => (
                      <option key={te.id} value={te.id}>
                        {te.title} - {te.sport} (
                        {new Date(te.date).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                  {editingRecordId && (
                    <small
                      style={{
                        color: '#6b7280',
                        display: 'block',
                        marginTop: '0.25rem',
                      }}
                    >
                      Test event cannot be changed when editing
                    </small>
                  )}
                </div>

                {/* Sport-specific fields */}
                {(() => {
                  const selectedTestEvent = testEvents.find(
                    (te) => te.id === parseInt(recordForm.test_event_id, 10)
                  );
                  const sport = selectedTestEvent?.sport;
                  const sportFields = sport ? getFieldsForSport(sport) : [];

                  if (sportFields.length > 0) {
                    return (
                      <div
                        className="form-group"
                        style={{
                          marginTop: '1rem',
                          padding: '1rem',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb',
                        }}
                      >
                        <label
                          className="form-label"
                          style={{
                            fontWeight: 600,
                            marginBottom: '0.75rem',
                            color: '#374151',
                          }}
                        >
                          {sport.charAt(0).toUpperCase() + sport.slice(1)}
                          -Specific Details:
                        </label>
                        {sportFields.map((field) => (
                          <div key={field.key} style={{ marginBottom: '1rem' }}>
                            <label
                              style={{
                                display: 'block',
                                marginBottom: '0.25rem',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: '#374151',
                              }}
                            >
                              {field.label}:
                            </label>
                            {field.type === 'array' ? (
                              <input
                                type="text"
                                value={
                                  Array.isArray(
                                    recordForm.result_fields?.[field.key]
                                  )
                                    ? recordForm.result_fields[field.key].join(
                                        ', '
                                      )
                                    : recordForm.result_fields?.[field.key] ||
                                      ''
                                }
                                onChange={(e) => {
                                  const value = e.target.value;
                                  const arrayValue = value
                                    ? value
                                        .split(',')
                                        .map((v) => v.trim())
                                        .filter((v) => v)
                                    : [];
                                  setRecordForm({
                                    ...recordForm,
                                    result_fields: {
                                      ...recordForm.result_fields,
                                      [field.key]:
                                        arrayValue.length > 0 ? arrayValue : null,
                                    },
                                  });
                                  setError('');
                                }}
                                placeholder={field.placeholder}
                                className="form-input"
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  border: '1px solid #ccc',
                                  borderRadius: '4px',
                                }}
                              />
                            ) : field.type === 'number' ? (
                              <input
                                type="number"
                                value={recordForm.result_fields?.[field.key] || ''}
                                onChange={(e) => {
                                  const value =
                                    e.target.value === ''
                                      ? null
                                      : parseFloat(e.target.value);
                                  setRecordForm({
                                    ...recordForm,
                                    result_fields: {
                                      ...recordForm.result_fields,
                                      [field.key]: value,
                                    },
                                  });
                                  setError('');
                                }}
                                placeholder={field.placeholder}
                                className="form-input"
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  border: '1px solid #ccc',
                                  borderRadius: '4px',
                                }}
                              />
                            ) : (
                              <input
                                type="text"
                                value={recordForm.result_fields?.[field.key] || ''}
                                onChange={(e) => {
                                  setRecordForm({
                                    ...recordForm,
                                    result_fields: {
                                      ...recordForm.result_fields,
                                      [field.key]: e.target.value || null,
                                    },
                                  });
                                  setError('');
                                }}
                                placeholder={field.placeholder}
                                className="form-input"
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  border: '1px solid #ccc',
                                  borderRadius: '4px',
                                }}
                              />
                            )}
                            {field.helpText && (
                              <small
                                style={{
                                  color: '#6b7280',
                                  display: 'block',
                                  marginTop: '0.25rem',
                                  fontSize: '0.75rem',
                                }}
                              >
                                {field.helpText}
                              </small>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="form-group">
                  <label className="form-label">Result:</label>
                  <textarea
                    value={recordForm.result}
                    onChange={(e) => {
                      setRecordForm({ ...recordForm, result: e.target.value });
                      setError('');
                    }}
                    className="form-input"
                    placeholder="e.g., 1:20, 1:18, 1:19, 1:17, 1:16"
                    rows="3"
                  />
                  <small
                    style={{
                      color: '#6b7280',
                      display: 'block',
                      marginTop: '0.25rem',
                    }}
                  >
                    Text description of times/results
                  </small>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes (optional):</label>
                  <textarea
                    value={recordForm.description}
                    onChange={(e) => {
                      setRecordForm({
                        ...recordForm,
                        description: e.target.value,
                      });
                      setError('');
                    }}
                    className="form-input"
                    placeholder="Additional notes..."
                    rows="3"
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '1.5rem',
                  }}
                >
                  <div>
                    {editingRecordId && (
                      <button
                        type="button"
                        onClick={deleteRecord}
                        style={{
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          padding: '0.5rem 1rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                        }}
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setShowRecordModal(false);
                        setEditingRecordId(null);
                        setDeleteRecordConfirm({ isOpen: false, recordId: null });
                        setRecordForm({
                          test_event_id: '',
                          result: '',
                          description: '',
                          result_fields: {},
                        });
                        setError('');
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {editingRecordId ? 'Update Result' : 'Create Result'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={deleteRecordConfirm.isOpen}
          onConfirm={confirmDeleteRecord}
          onCancel={() => setDeleteRecordConfirm({ isOpen: false, recordId: null })}
          title="Delete Result"
          message="Are you sure you want to delete this result? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          confirmDanger={true}
        />
          </>
        )}
      </div>
    </div>
  );
};

export default Results;


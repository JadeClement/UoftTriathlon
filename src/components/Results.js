import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { showSuccess, showError } from './SimpleNotification';
import ConfirmModal from './ConfirmModal';
import './Results.css';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';

const Results = () => {
  const { currentUser, isMember } = useAuth();

  const [intervalResults, setIntervalResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [workouts, setWorkouts] = useState([]);
  const [intervals, setIntervals] = useState([]);
  const [addForm, setAddForm] = useState({
    workoutId: '',
    intervalId: '',
    time: ''
  });
  const [workoutsLoading, setWorkoutsLoading] = useState(false);
  const [intervalsLoading, setIntervalsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editModalRow, setEditModalRow] = useState(null);
  const [editModalTime, setEditModalTime] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, row: null });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!currentUser?.id) return;
      setLoading(true);
      try {
        const token = localStorage.getItem('triathlonToken');
        const res = await fetch(`${API_BASE}/forum/interval-results/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setIntervalResults(data.intervalResults || []);
        }
      } catch (err) {
        console.error('Error loading interval results:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser]);

  useEffect(() => {
    if (!showAddForm || !currentUser?.id) return;
    const loadWorkouts = async () => {
      setWorkoutsLoading(true);
      try {
        const token = localStorage.getItem('triathlonToken');
        const res = await fetch(`${API_BASE}/forum/workouts-with-intervals`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setWorkouts(data.workouts || []);
        }
      } catch (err) {
        console.error('Error loading workouts:', err);
      } finally {
        setWorkoutsLoading(false);
      }
    };
    loadWorkouts();
  }, [showAddForm, currentUser?.id]);

  const [existingResultsForWorkout, setExistingResultsForWorkout] = useState([]);

  useEffect(() => {
    if (!addForm.workoutId) {
      setIntervals([]);
      setExistingResultsForWorkout([]);
      setAddForm((f) => ({ ...f, intervalId: '', time: '' }));
      return;
    }
    const loadIntervals = async () => {
      setIntervalsLoading(true);
      try {
        const token = localStorage.getItem('triathlonToken');
        const [intervalsRes, resultsRes] = await Promise.all([
          fetch(`${API_BASE}/forum/workouts/${addForm.workoutId}/intervals`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/forum/workouts/${addForm.workoutId}/interval-results`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (intervalsRes.ok) {
          const data = await intervalsRes.json();
          setIntervals(data.intervals || []);
        }
        if (resultsRes.ok) {
          const data = await resultsRes.json();
          const mine = (data.intervalResults || []).filter((r) => r.user_id === currentUser?.id);
          setExistingResultsForWorkout(mine);
        }
      } catch (err) {
        console.error('Error loading intervals:', err);
      } finally {
        setIntervalsLoading(false);
      }
    };
    loadIntervals();
  }, [addForm.workoutId, currentUser?.id]);

  const doneIntervalIds = React.useMemo(
    () => new Set(existingResultsForWorkout.map((r) => r.interval_id)),
    [existingResultsForWorkout]
  );
  const availableIntervals = React.useMemo(
    () => intervals.filter((inv) => !doneIntervalIds.has(inv.id)),
    [intervals, doneIntervalIds]
  );

  const handleSaveAddResult = async () => {
    if (!addForm.workoutId || !addForm.intervalId || !addForm.time?.trim()) {
      showError('Please select a workout, interval, and enter your time');
      return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem('triathlonToken');
      const res = await fetch(
        `${API_BASE}/forum/workouts/${addForm.workoutId}/interval-results`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            results: [{ interval_id: parseInt(addForm.intervalId, 10), time: addForm.time.trim() }],
          }),
        }
      );
      if (res.ok) {
        showSuccess('Interval result saved!');
        setAddForm({ workoutId: '', intervalId: '', time: '' });
        setShowAddForm(false);
        setIntervals([]);
        const refresh = await fetch(`${API_BASE}/forum/interval-results/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (refresh.ok) {
          const data = await refresh.json();
          setIntervalResults(data.intervalResults || []);
        }
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to save');
      }
    } catch (err) {
      showError('Failed to save interval result');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (r) => {
    setEditModalRow(r);
    setEditModalTime(r.time || '');
  };

  const closeEditModal = () => {
    setEditModalRow(null);
    setEditModalTime('');
  };

  useEffect(() => {
    if (!editModalRow) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeEditModal();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editModalRow]);

  const handleSaveEdit = async () => {
    if (!editModalRow?.post_id || !editModalRow?.interval_id) return;
    if (!editModalTime?.trim()) {
      showError('Please enter a time');
      return;
    }
    setSavingEdit(true);
    try {
      const token = localStorage.getItem('triathlonToken');
      const res = await fetch(
        `${API_BASE}/forum/workouts/${editModalRow.post_id}/interval-results`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            results: [{ interval_id: editModalRow.interval_id, time: editModalTime.trim() }],
          }),
        }
      );
      if (res.ok) {
        showSuccess('Interval result updated!');
        setIntervalResults((prev) =>
          prev.map((p) =>
            p.post_id === editModalRow.post_id && p.interval_id === editModalRow.interval_id
              ? { ...p, time: editModalTime.trim() }
              : p
          )
        );
        closeEditModal();
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to save');
      }
    } catch (err) {
      showError('Failed to update interval result');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteResult = () => {
    if (editModalRow) setDeleteConfirm({ isOpen: true, row: editModalRow });
  };

  const handleConfirmDelete = async () => {
    if (deleting) return;
    const row = deleteConfirm.row;
    if (!row?.post_id || !row?.interval_id) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem('triathlonToken');
      const res = await fetch(
        `${API_BASE}/forum/workouts/${row.post_id}/interval-results/${row.interval_id}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        showSuccess('Interval result deleted');
        setIntervalResults((prev) =>
          prev.filter((p) => !(p.post_id === row.post_id && p.interval_id === row.interval_id))
        );
        setDeleteConfirm({ isOpen: false, row: null });
        closeEditModal();
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to delete');
      }
    } catch (err) {
      showError('Failed to delete interval result');
    } finally {
      setDeleting(false);
    }
  };

  // Flatten to table rows: workout date | interval title | interval time | interval description
  const tableRows = React.useMemo(() => {
    return [...intervalResults]
      .sort((a, b) => {
        const da = a.workout_date || '';
        const db = b.workout_date || '';
        if (da !== db) return db.localeCompare(da);
        const ta = a.workout_time || '';
        const tb = b.workout_time || '';
        if (ta !== tb) return tb.localeCompare(ta);
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
  }, [intervalResults]);

  return (
    <div className="profile-container">
      <div className="container">
        {!currentUser ? (
          <div>
            <h2>Your interval results</h2>
            <p>You need to be logged in to view your interval results.</p>
          </div>
        ) : !isMember(currentUser) ? (
          <div>
            <h2>Your interval results</h2>
            <p>Results are only available for full members.</p>
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
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <h2 style={{ margin: 0, color: '#374151' }}>Interval Results</h2>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (showAddForm) {
                      setAddForm({ workoutId: '', intervalId: '', time: '' });
                      setIntervals([]);
                    }
                    setShowAddForm(!showAddForm);
                  }}
                  style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                >
                  {showAddForm ? 'Cancel' : '+ Add Interval Result'}
                </button>
              </div>

              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                Add interval results below or from the workout detail page after completing a workout.
              </p>

              {showAddForm && (
                <div
                  style={{
                    marginBottom: '1.5rem',
                    padding: '1rem',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#374151' }}>
                    Add Interval Result
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '400px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
                        Workout
                      </label>
                      <select
                        value={addForm.workoutId}
                        onChange={(e) => setAddForm({ ...addForm, workoutId: e.target.value, intervalId: '', time: '' })}
                        disabled={workoutsLoading}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '16px' }}
                      >
                        <option value="">
                          {workoutsLoading ? 'Loading...' : workouts.length === 0 ? 'No workouts with intervals' : 'Select a workout...'}
                        </option>
                        {workouts.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.title}
                            {w.workout_date ? ` (${new Date(w.workout_date).toLocaleDateString()})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
                        Interval
                      </label>
                      <select
                        value={
                          availableIntervals.some((i) => String(i.id) === String(addForm.intervalId))
                            ? addForm.intervalId
                            : ''
                        }
                        onChange={(e) => setAddForm({ ...addForm, intervalId: e.target.value })}
                        disabled={!addForm.workoutId || intervalsLoading || availableIntervals.length === 0}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '16px' }}
                      >
                        <option value="">
                          {availableIntervals.length === 0 && intervals.length > 0
                            ? "You've already added a result for every interval"
                            : 'Select an interval...'}
                        </option>
                        {availableIntervals.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.title || 'Interval'} {inv.description ? `(${inv.description})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
                        Time
                      </label>
                      <input
                        type="text"
                        value={addForm.time}
                        onChange={(e) => setAddForm({ ...addForm, time: e.target.value })}
                        placeholder="e.g., 2:15, 4:32"
                        disabled={!addForm.intervalId}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '16px' }}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSaveAddResult}
                      disabled={saving || !addForm.workoutId || !addForm.intervalId || !addForm.time?.trim()}
                      style={{ alignSelf: 'flex-start', fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}

              {loading ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Loading...</p>
              ) : tableRows.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Workout Date</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Sport</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Interval Title</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Time</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Interval Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((r) => (
                        <tr
                          key={r.id || `${r.post_id}-${r.interval_id}`}
                          style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                          onClick={() => openEditModal(r)}
                        >
                          <td style={{ padding: '0.75rem', color: '#475569' }}>
                            {r.workout_date ? new Date(r.workout_date).toLocaleDateString() : '-'}
                          </td>
                          <td style={{ padding: '0.75rem', color: '#475569' }}>
                            {r.workout_type ? String(r.workout_type).replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '-'}
                          </td>
                          <td style={{ padding: '0.75rem', color: '#475569' }}>{r.interval_title || '-'}</td>
                          <td style={{ padding: '0.75rem', color: '#475569' }}>{r.time || '-'}</td>
                          <td style={{ padding: '0.75rem', color: '#475569' }}>{r.interval_description || '-'}</td>
                        </tr>
                      ))}
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
                  No interval results yet. Complete a workout with intervals and add your times from
                  the workout detail page.
                </p>
              )}

              {editModalRow && (
                <div
                  className="results-modal-overlay"
                  onClick={closeEditModal}
                >
                  <div className="results-modal" onClick={(e) => e.stopPropagation()}>
                    <h2>Edit Interval Result</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                          Workout Date
                        </label>
                        <div style={{ fontSize: '0.9375rem', color: '#374151' }}>
                          {editModalRow.workout_date ? new Date(editModalRow.workout_date).toLocaleDateString() : '-'}
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                          Sport
                        </label>
                        <div style={{ fontSize: '0.9375rem', color: '#374151' }}>
                          {editModalRow.workout_type ? String(editModalRow.workout_type).replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '-'}
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                          Interval Title
                        </label>
                        <div style={{ fontSize: '0.9375rem', color: '#374151' }}>
                          {editModalRow.interval_title || '-'}
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                          Time
                        </label>
                        <input
                          type="text"
                          value={editModalTime}
                          onChange={(e) => setEditModalTime(e.target.value)}
                          placeholder="e.g., 2:15, 4:32"
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '16px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                          Interval Description
                        </label>
                        <div style={{ fontSize: '0.9375rem', color: '#374151' }}>
                          {editModalRow.interval_description || '-'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={closeEditModal}
                          style={{ flex: 1 }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={handleSaveEdit}
                          disabled={savingEdit || !editModalTime?.trim()}
                          style={{ flex: 1 }}
                        >
                          {savingEdit ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={handleDeleteResult}
                        style={{ width: '100%', backgroundColor: '#dc2626', color: 'white', borderColor: '#dc2626' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeleteConfirm({ isOpen: false, row: null })}
                title="Delete Interval Result"
                message="Are you sure you want to delete this interval result? This cannot be undone."
                confirmText={deleting ? 'Deleting...' : 'Delete'}
                cancelText="Cancel"
                confirmDanger
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Results;

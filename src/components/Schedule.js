import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../utils/apiConfig';
import { showError, showSuccess } from './SimpleNotification';
import './Schedule.css';

const SEASONS = ['Spring', 'Summer', 'Fall/Winter'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WORKOUT_TYPES = [
  { value: 'swim', label: 'Swim' },
  { value: 'bike', label: 'Bike / Ride / Spin' },
  { value: 'run', label: 'Run' },
  { value: 'brick', label: 'Brick' },
  { value: 'long', label: 'Long / Group' },
  { value: 'recovery', label: 'Recovery / Other' },
];

const emptyDays = () =>
  DAYS.reduce((acc, day) => {
    acc[day] = [];
    return acc;
  }, {});

const cloneSeason = (season) => ({
  title: season?.title || '',
  dates: season?.dates || '',
  days: DAYS.reduce((acc, day) => {
    acc[day] = (season?.days?.[day] || []).map((w) => ({ ...w }));
    return acc;
  }, emptyDays()),
});

const Schedule = () => {
  const { currentUser, isAdmin } = useAuth();
  const canEdit = !!(currentUser && isAdmin(currentUser));
  const [activeSeason, setActiveSeason] = useState('Spring');
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [draftSeason, setDraftSeason] = useState(null);
  const [saving, setSaving] = useState(false);
  const seasonTabRefs = useRef({});
  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/site/schedule`);
        if (!res.ok) throw new Error('Failed to load schedule');
        const data = await res.json();
        setSchedule(data.schedule);
      } catch (err) {
        console.error(err);
        showError('Could not load the workout schedule.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [API_BASE]);

  const focusSeasonTab = (season) => {
    seasonTabRefs.current[season]?.focus();
  };

  const handleSeasonKeyDown = (event, season) => {
    const index = SEASONS.indexOf(season);
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const next = SEASONS[(index + 1) % SEASONS.length];
      setActiveSeason(next);
      focusSeasonTab(next);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const prev = SEASONS[(index - 1 + SEASONS.length) % SEASONS.length];
      setActiveSeason(prev);
      focusSeasonTab(prev);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveSeason(SEASONS[0]);
      focusSeasonTab(SEASONS[0]);
    } else if (event.key === 'End') {
      event.preventDefault();
      const last = SEASONS[SEASONS.length - 1];
      setActiveSeason(last);
      focusSeasonTab(last);
    }
  };

  const openEditModal = () => {
    const seasonData = schedule?.seasons?.[activeSeason];
    if (!seasonData) return;
    setDraftSeason(cloneSeason(seasonData));
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    if (saving) return;
    setShowEditModal(false);
    setDraftSeason(null);
  };

  const updateDraftField = (field, value) => {
    setDraftSeason((prev) => ({ ...prev, [field]: value }));
  };

  const updateWorkout = (day, index, field, value) => {
    setDraftSeason((prev) => {
      const nextDays = { ...prev.days };
      const list = [...(nextDays[day] || [])];
      list[index] = { ...list[index], [field]: value };
      nextDays[day] = list;
      return { ...prev, days: nextDays };
    });
  };

  const addWorkout = (day) => {
    setDraftSeason((prev) => {
      const nextDays = { ...prev.days };
      nextDays[day] = [
        ...(nextDays[day] || []),
        { id: `new-${Date.now()}`, label: '', type: 'bike', note: '' },
      ];
      return { ...prev, days: nextDays };
    });
  };

  const removeWorkout = (day, index) => {
    setDraftSeason((prev) => {
      const nextDays = { ...prev.days };
      nextDays[day] = (nextDays[day] || []).filter((_, i) => i !== index);
      return { ...prev, days: nextDays };
    });
  };

  const saveSchedule = async () => {
    if (!draftSeason || !schedule) return;
    setSaving(true);
    try {
      const nextSchedule = {
        seasons: {
          ...schedule.seasons,
          [activeSeason]: cloneSeason(draftSeason),
        },
      };
      const token = localStorage.getItem('triathlonToken');
      const res = await fetch(`${API_BASE}/site/schedule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ schedule: nextSchedule }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save schedule');
      }
      setSchedule(data.schedule || nextSchedule);
      setShowEditModal(false);
      setDraftSeason(null);
      showSuccess('Schedule saved.');
    } catch (err) {
      showError(err.message || 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const season = schedule?.seasons?.[activeSeason];
  const panelId = `season-panel-${activeSeason.replace('/', '-')}`;
  const tabId = `season-tab-${activeSeason.replace('/', '-')}`;

  return (
    <div className="schedule-container">
      <div className="container">
        <h1 className="section-title">Workout Schedule</h1>

        <div className="season-tabs" role="tablist" aria-label="Season">
          {SEASONS.map((seasonName) => (
            <button
              key={seasonName}
              ref={(el) => {
                seasonTabRefs.current[seasonName] = el;
              }}
              type="button"
              role="tab"
              id={`season-tab-${seasonName.replace('/', '-')}`}
              aria-selected={activeSeason === seasonName}
              aria-controls={`season-panel-${seasonName.replace('/', '-')}`}
              tabIndex={activeSeason === seasonName ? 0 : -1}
              className={`season-tab ${activeSeason === seasonName ? 'active' : ''}`}
              onClick={() => setActiveSeason(seasonName)}
              onKeyDown={(event) => handleSeasonKeyDown(event, seasonName)}
            >
              {seasonName}
            </button>
          ))}
        </div>

        <div className="demo-workouts">
          {loading && <p className="schedule-loading">Loading schedule…</p>}

          {!loading && season && (
            <div className="season-schedule" role="tabpanel" id={panelId} aria-labelledby={tabId}>
              <div className="season-schedule-header">
                <div className="season-schedule-heading">
                  <h2>{season.title}</h2>
                  {season.dates ? <p className="season-dates">{season.dates}</p> : null}
                </div>
                {canEdit && (
                  <button
                    type="button"
                    className="schedule-edit-btn"
                    onClick={openEditModal}
                    aria-label={`Edit ${activeSeason} schedule`}
                    title="Edit schedule"
                  >
                    ✏️
                  </button>
                )}
              </div>

              <div className="schedule-grid">
                {DAYS.map((day) => (
                  <div className="schedule-day" key={day}>
                    <h3>{day}</h3>
                    {(season.days?.[day] || []).map((workout) => (
                      <React.Fragment key={workout.id}>
                        <div className={`workout-item ${workout.type || 'bike'}`}>{workout.label}</div>
                        {workout.note ? <div className="workout-note">{workout.note}</div> : null}
                      </React.Fragment>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="welcome-section">
          <div className="workout-overview">
            <div className="workout-type">
              <h2>🏊 Swims 🏊</h2>
              <p>
                <strong>Where:</strong> Varsity Pool, UofT Athletic Centre, 55 Harbord St, Toronto, ON
                M5S 2W6
              </p>
              <p>
                <strong>Note:</strong> Please show up on time.
              </p>
            </div>

            <div className="workout-type">
              <h2>🚴 Spins 🚴</h2>
              <p>
                <strong>Where:</strong> Field House – Court 4 (West side), UofT Athletic Centre, 55
                Harbord St, Toronto, ON M5S 2W6
              </p>
              <p>
                <strong>Note:</strong> Sign up for Spins on the Forum.
              </p>
            </div>

            <div className="workout-type">
              <h2>🚴 🏃 Bricks (Spin & Run) 🚴🏃</h2>
              <p>
                <strong>Where:</strong> Field House – Court 4 (West side), UofT Athletics Centre, 55
                Harbord St, Toronto, ON M5S 2W6
              </p>
              <p>
                <strong>Note:</strong> Sign up for Bricks on the Forum.
              </p>
            </div>

            <div className="workout-type">
              <h2>🏃 Runs 🏃</h2>
              <div className="run-details">
                <div className="run-type">
                  <h3>Tuesday Track</h3>
                  <p>
                    <strong>Where:</strong> Central Tech Track, 725 Bathurst St, Toronto, ON M5S 2R5
                  </p>
                  <p>
                    <strong>Note:</strong> Track location may change due to snow or Ice – change of
                    location will be communicated via email and our social media
                  </p>
                </div>
                <div className="run-type">
                  <h3>Thursday Tempo</h3>
                  <p>
                    <strong>Where:</strong> Meet in the lobby of the Athletic Centre.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showEditModal && draftSeason && (
        <div className="schedule-modal-overlay" onClick={closeEditModal}>
          <div
            className="schedule-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-edit-title"
          >
            <div className="schedule-modal-header">
              <h3 id="schedule-edit-title">Edit {activeSeason} Schedule</h3>
              <button type="button" className="schedule-modal-close" onClick={closeEditModal} aria-label="Close">
                ×
              </button>
            </div>

            <div className="schedule-modal-body">
              <div className="schedule-modal-meta">
                <label>
                  Title
                  <input
                    type="text"
                    value={draftSeason.title}
                    onChange={(e) => updateDraftField('title', e.target.value)}
                    maxLength={80}
                  />
                </label>
                <label>
                  Date range
                  <input
                    type="text"
                    value={draftSeason.dates}
                    onChange={(e) => updateDraftField('dates', e.target.value)}
                    maxLength={80}
                    placeholder="e.g. April 29 - June 25"
                  />
                </label>
              </div>

              {DAYS.map((day) => (
                <div className="schedule-edit-day" key={day}>
                  <div className="schedule-edit-day-header">
                    <h4>{day}</h4>
                    <button type="button" className="btn-schedule-add" onClick={() => addWorkout(day)}>
                      + Add workout
                    </button>
                  </div>

                  {(draftSeason.days[day] || []).length === 0 && (
                    <p className="schedule-edit-empty">No workouts</p>
                  )}

                  {(draftSeason.days[day] || []).map((workout, index) => (
                    <div className="schedule-edit-row" key={workout.id || `${day}-${index}`}>
                      <input
                        type="text"
                        value={workout.label}
                        onChange={(e) => updateWorkout(day, index, 'label', e.target.value)}
                        placeholder="Workout label (e.g. Swim 8:30-10:30am)"
                        maxLength={120}
                      />
                      <select
                        value={workout.type || 'bike'}
                        onChange={(e) => updateWorkout(day, index, 'type', e.target.value)}
                        aria-label="Workout type"
                      >
                        {WORKOUT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={workout.note || ''}
                        onChange={(e) => updateWorkout(day, index, 'note', e.target.value)}
                        placeholder="Optional note"
                        maxLength={200}
                      />
                      <button
                        type="button"
                        className="btn-schedule-delete"
                        onClick={() => removeWorkout(day, index)}
                        aria-label={`Delete workout on ${day}`}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="schedule-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closeEditModal} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={saveSchedule} disabled={saving}>
                {saving ? 'Saving…' : 'Save schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;

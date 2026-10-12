import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../utils/apiConfig';
import { showError, showSuccess } from './SimpleNotification';
import './Schedule.css';

const SEASONS = ['Spring', 'Summer', 'Fall/Winter'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_INDEX = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};
// Club defaults when a season has no parseable date range.
const DEFAULT_SEASON_RANGES = {
  Spring: { start: { month: 3, day: 29 }, end: { month: 5, day: 25 } },
  Summer: { start: { month: 5, day: 25 }, end: { month: 7, day: 20 } },
  'Fall/Winter': { start: { month: 8, day: 1 }, end: { month: 3, day: 29 } },
};

const parseMonthDay = (value) => {
  const match = String(value || '').match(/([A-Za-z]+)\s+(\d{1,2})/);
  if (!match) return null;
  const month = MONTH_INDEX[match[1].toLowerCase()];
  const day = Number(match[2]);
  if (month == null || !Number.isInteger(day) || day < 1 || day > 31) return null;
  return { month, day };
};

const parseSeasonRange = (dates) => {
  const parts = String(dates || '').split(/\s*[-–—]\s*/);
  if (parts.length !== 2) return null;
  const start = parseMonthDay(parts[0]);
  const end = parseMonthDay(parts[1]);
  if (!start || !end) return null;
  return { start, end };
};

const rangeWrapsYear = (range) =>
  range.start.month > range.end.month ||
  (range.start.month === range.end.month && range.start.day > range.end.day);

const getRangeBounds = (now, range) => {
  const year = now.getFullYear();
  let start = new Date(year, range.start.month, range.start.day);
  let end = new Date(year, range.end.month, range.end.day, 23, 59, 59, 999);
  if (rangeWrapsYear(range)) {
    if (now >= start) {
      end = new Date(year + 1, range.end.month, range.end.day, 23, 59, 59, 999);
    } else {
      start = new Date(year - 1, range.start.month, range.start.day);
    }
  }
  return { start, end };
};

const rangeContains = (now, range) => {
  const { start, end } = getRangeBounds(now, range);
  return now >= start && now <= end;
};

const getCurrentSeason = (schedule, now = new Date()) => {
  const ranges = SEASONS.map((name) => ({
    name,
    range: parseSeasonRange(schedule?.seasons?.[name]?.dates) || DEFAULT_SEASON_RANGES[name],
  }));

  const matching = ranges.filter((season) => rangeContains(now, season.range));
  if (matching.length === 1) return matching[0].name;
  if (matching.length > 1) {
    matching.sort((a, b) => getRangeBounds(now, b.range).start - getRangeBounds(now, a.range).start);
    return matching[0].name;
  }

  const upcoming = ranges
    .map((season) => {
      const year = now.getFullYear();
      let start = new Date(year, season.range.start.month, season.range.start.day);
      if (start < now) start = new Date(year + 1, season.range.start.month, season.range.start.day);
      return { name: season.name, start };
    })
    .sort((a, b) => a.start - b.start);

  return upcoming[0]?.name || 'Fall/Winter';
};

const WORKOUT_TYPES = [
  { value: 'swim', label: 'Swim' },
  { value: 'bike', label: 'Bike / Ride / Spin' },
  { value: 'run', label: 'Run' },
  { value: 'brick', label: 'Brick' },
  { value: 'long', label: 'Long / Group' },
  { value: 'recovery', label: 'Recovery / Other' },
];

const DEFAULT_PRACTICE_INFO = {
  sections: [
    {
      id: 'swims',
      title: '🏊 Swims 🏊',
      where: 'Varsity Pool, UofT Athletic Centre, 55 Harbord St, Toronto, ON M5S 2W6',
      note: 'Please show up on time.',
    },
    {
      id: 'spins',
      title: '🚴 Spins 🚴',
      where: 'Field House – Court 4 (West side), UofT Athletic Centre, 55 Harbord St, Toronto, ON M5S 2W6',
      note: 'Sign up for Spins on the Forum.',
    },
    {
      id: 'bricks',
      title: '🚴 🏃 Bricks (Spin & Run) 🚴🏃',
      where: 'Field House – Court 4 (West side), UofT Athletics Centre, 55 Harbord St, Toronto, ON M5S 2W6',
      note: 'Sign up for Bricks on the Forum.',
    },
    {
      id: 'runs',
      title: '🏃 Runs 🏃',
      items: [
        {
          id: 'tuesday-track',
          title: 'Tuesday Track',
          where: 'Central Tech Track, 725 Bathurst St, Toronto, ON M5S 2R5',
          note: 'Track location may change due to snow or Ice – change of location will be communicated via email and our social media',
        },
        {
          id: 'thursday-tempo',
          title: 'Thursday Tempo',
          where: 'Meet in the lobby of the Athletic Centre.',
          note: '',
        },
      ],
    },
  ],
};

const clonePracticeInfo = (info) => {
  const sections = Array.isArray(info?.sections) ? info.sections : DEFAULT_PRACTICE_INFO.sections;
  return {
    sections: sections.map((section) => ({
      id: section.id,
      title: section.title || '',
      where: section.where || '',
      note: section.note || '',
      ...(Array.isArray(section.items)
        ? {
            items: section.items.map((item) => ({
              id: item.id,
              title: item.title || '',
              where: item.where || '',
              note: item.note || '',
            })),
          }
        : {}),
    })),
  };
};

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
  const [activeSeason, setActiveSeason] = useState(() => getCurrentSeason());
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [draftSeason, setDraftSeason] = useState(null);
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [draftPractice, setDraftPractice] = useState(null);
  const [saving, setSaving] = useState(false);
  const seasonTabRefs = useRef({});
  const userPickedSeason = useRef(false);
  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/site/schedule`);
        if (!res.ok) throw new Error('Failed to load schedule');
        const data = await res.json();
        setSchedule(data.schedule);
        if (!userPickedSeason.current) {
          setActiveSeason(getCurrentSeason(data.schedule));
        }
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

  const selectSeason = (season) => {
    userPickedSeason.current = true;
    setActiveSeason(season);
    focusSeasonTab(season);
  };

  const handleSeasonKeyDown = (event, season) => {
    const index = SEASONS.indexOf(season);
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      selectSeason(SEASONS[(index + 1) % SEASONS.length]);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      selectSeason(SEASONS[(index - 1 + SEASONS.length) % SEASONS.length]);
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectSeason(SEASONS[0]);
    } else if (event.key === 'End') {
      event.preventDefault();
      selectSeason(SEASONS[SEASONS.length - 1]);
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

  const openPracticeModal = () => {
    setDraftPractice(clonePracticeInfo(schedule?.practiceInfo));
    setShowPracticeModal(true);
  };

  const closePracticeModal = () => {
    if (saving) return;
    setShowPracticeModal(false);
    setDraftPractice(null);
  };

  const updatePracticeSection = (sectionId, field, value) => {
    setDraftPractice((prev) => ({
      sections: (prev?.sections || []).map((section) =>
        section.id === sectionId ? { ...section, [field]: value } : section
      ),
    }));
  };

  const updateRunLocation = (index, field, value) => {
    setDraftPractice((prev) => ({
      sections: (prev?.sections || []).map((section) => {
        if (section.id !== 'runs') return section;
        const items = (section.items || []).map((item, itemIndex) =>
          itemIndex === index ? { ...item, [field]: value } : item
        );
        return { ...section, items };
      }),
    }));
  };

  const addRunLocation = () => {
    setDraftPractice((prev) => ({
      sections: (prev?.sections || []).map((section) => {
        if (section.id !== 'runs') return section;
        return {
          ...section,
          items: [
            ...(section.items || []),
            { id: `run-${Date.now()}`, title: '', where: '', note: '' },
          ],
        };
      }),
    }));
  };

  const removeRunLocation = (index) => {
    setDraftPractice((prev) => ({
      sections: (prev?.sections || []).map((section) => {
        if (section.id !== 'runs') return section;
        return {
          ...section,
          items: (section.items || []).filter((_, itemIndex) => itemIndex !== index),
        };
      }),
    }));
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

  const savePracticeInfo = async () => {
    if (!draftPractice || !schedule) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('triathlonToken');
      const res = await fetch(`${API_BASE}/site/schedule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ schedule: { practiceInfo: draftPractice } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save practice locations');
      }
      setSchedule(data.schedule || { ...schedule, practiceInfo: draftPractice });
      setShowPracticeModal(false);
      setDraftPractice(null);
      showSuccess('Practice locations saved.');
    } catch (err) {
      showError(err.message || 'Failed to save practice locations');
    } finally {
      setSaving(false);
    }
  };

  const season = schedule?.seasons?.[activeSeason];
  const practiceInfo = schedule?.practiceInfo?.sections?.length
    ? schedule.practiceInfo
    : DEFAULT_PRACTICE_INFO;
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
              onClick={() => {
                userPickedSeason.current = true;
                setActiveSeason(seasonName);
              }}
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
          {canEdit && schedule && (
            <div className="practice-info-toolbar">
              <button
                type="button"
                className="schedule-edit-btn"
                onClick={openPracticeModal}
                aria-label="Edit practice locations"
                title="Edit practice locations"
              >
                ✏️
              </button>
            </div>
          )}
          <div className="workout-overview">
            {practiceInfo.sections.map((section) =>
              section.id === 'runs' ? (
                <div className="workout-type" key={section.id}>
                  <h2>{section.title}</h2>
                  {(section.items || []).length > 0 && (
                    <div className="run-details">
                      {section.items.map((item) => (
                        <div className="run-type" key={item.id}>
                          {item.title ? <h3>{item.title}</h3> : null}
                          {item.where ? (
                            <p>
                              <strong>Where:</strong> {item.where}
                            </p>
                          ) : null}
                          {item.note ? (
                            <p>
                              <strong>Note:</strong> {item.note}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="workout-type" key={section.id}>
                  <h2>{section.title}</h2>
                  {section.where ? (
                    <p>
                      <strong>Where:</strong> {section.where}
                    </p>
                  ) : null}
                  {section.note ? (
                    <p>
                      <strong>Note:</strong> {section.note}
                    </p>
                  ) : null}
                </div>
              )
            )}
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

      {showPracticeModal && draftPractice && (
        <div className="schedule-modal-overlay" onClick={closePracticeModal}>
          <div
            className="schedule-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="practice-edit-title"
          >
            <div className="schedule-modal-header">
              <h3 id="practice-edit-title">Edit practice locations</h3>
              <button type="button" className="schedule-modal-close" onClick={closePracticeModal} aria-label="Close">
                ×
              </button>
            </div>

            <div className="schedule-modal-body">
              {draftPractice.sections.map((section) => (
                <div className="schedule-edit-day" key={section.id}>
                  <div className="schedule-edit-day-header">
                    <h4>{section.id === 'runs' ? 'Runs' : section.title || section.id}</h4>
                    {section.id === 'runs' && (
                      <button type="button" className="btn-schedule-add" onClick={addRunLocation}>
                        + Add run location
                      </button>
                    )}
                  </div>

                  <div className="practice-edit-fields">
                    <label>
                      Heading
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => updatePracticeSection(section.id, 'title', e.target.value)}
                        maxLength={80}
                      />
                    </label>

                    {section.id !== 'runs' && (
                      <>
                        <label>
                          Where
                          <textarea
                            value={section.where}
                            onChange={(e) => updatePracticeSection(section.id, 'where', e.target.value)}
                            maxLength={400}
                            rows={3}
                          />
                        </label>
                        <label>
                          Note
                          <textarea
                            value={section.note}
                            onChange={(e) => updatePracticeSection(section.id, 'note', e.target.value)}
                            maxLength={600}
                            rows={3}
                          />
                        </label>
                      </>
                    )}
                  </div>

                  {section.id === 'runs' && (
                    <div className="practice-run-list">
                      {(section.items || []).length === 0 && (
                        <p className="schedule-edit-empty">No run locations</p>
                      )}
                      {(section.items || []).map((item, index) => (
                        <div className="practice-run-edit" key={item.id || index}>
                          <div className="schedule-edit-day-header">
                            <h4>{item.title || `Run ${index + 1}`}</h4>
                            <button
                              type="button"
                              className="btn-schedule-delete"
                              onClick={() => removeRunLocation(index)}
                              aria-label={`Delete ${item.title || `run location ${index + 1}`}`}
                            >
                              Delete
                            </button>
                          </div>
                          <div className="practice-edit-fields">
                            <label>
                              Name
                              <input
                                type="text"
                                value={item.title}
                                onChange={(e) => updateRunLocation(index, 'title', e.target.value)}
                                maxLength={80}
                                placeholder="e.g. Tuesday Track"
                              />
                            </label>
                            <label>
                              Where
                              <textarea
                                value={item.where}
                                onChange={(e) => updateRunLocation(index, 'where', e.target.value)}
                                maxLength={400}
                                rows={2}
                              />
                            </label>
                            <label>
                              Note
                              <textarea
                                value={item.note}
                                onChange={(e) => updateRunLocation(index, 'note', e.target.value)}
                                maxLength={600}
                                rows={2}
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="schedule-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closePracticeModal} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={savePracticeInfo} disabled={saving}>
                {saving ? 'Saving…' : 'Save locations'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;

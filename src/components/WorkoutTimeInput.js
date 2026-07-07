import React, { useState, useEffect } from 'react';
import { time24To12Parts, time12To24 } from '../utils/dateUtils';

const empty = { h: '', m: '', p: '' };

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

/**
 * Workout time picker using 12-hour clock + AM/PM (avoids 06:30 vs 18:30 mistakes).
 * Value/onChange use 24h "HH:MM" for the API.
 */
const WorkoutTimeInput = ({
  id,
  value,
  onChange,
  disabled = false,
  className = ''
}) => {
  const [local, setLocal] = useState(empty);

  useEffect(() => {
    if (!value || String(value).trim() === '') {
      setLocal((prev) => {
        const hasPartial = prev.h !== '' || prev.m !== '' || prev.p !== '';
        if (hasPartial) return prev;
        return empty;
      });
      return;
    }
    const parsed = time24To12Parts(String(value));
    if (!parsed) {
      setLocal(empty);
      return;
    }
    setLocal({
      h: String(parsed.hour12),
      m: String(parsed.minute).padStart(2, '0'),
      p: parsed.period
    });
  }, [value]);

  const update = (patch) => {
    const next = { ...local, ...patch };

    if (next.h === '' && next.m === '' && next.p === '') {
      setLocal(empty);
      onChange('');
      return;
    }

    setLocal(next);

    if (next.h === '' || next.m === '' || next.p === '') {
      return;
    }

    const hi = parseInt(next.h, 10);
    const mi = parseInt(next.m, 10);
    if (Number.isNaN(hi) || Number.isNaN(mi) || mi < 0 || mi > 59) {
      return;
    }

    onChange(time12To24(hi, mi, next.p));
  };

  const selectClass = `form-input ${className}`.trim();

  return (
    <div
      className="workout-time-input"
      style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}
    >
      <select
        id={id}
        className={selectClass}
        style={{ minWidth: '4.25rem' }}
        disabled={disabled}
        value={local.h}
        onChange={(e) => update({ h: e.target.value })}
        aria-label="Hour (1–12)"
      >
        <option value="">Hour</option>
        {HOURS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        style={{ minWidth: '4.25rem' }}
        disabled={disabled}
        value={local.m}
        onChange={(e) => update({ m: e.target.value })}
        aria-label="Minute"
      >
        <option value="">Min</option>
        {MINUTES.map((mm) => (
          <option key={mm} value={mm}>
            {mm}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        style={{ minWidth: '5.5rem' }}
        disabled={disabled}
        value={local.p}
        onChange={(e) => update({ p: e.target.value })}
        aria-label="AM or PM"
      >
        <option value="">AM / PM</option>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};

export default WorkoutTimeInput;

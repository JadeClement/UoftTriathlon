const express = require('express');
const { pool } = require('../database-pg');
const { authenticateToken, requireAdmin, requireRole } = require('../middleware/auth');

const router = express.Router();

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WORKOUT_TYPES = ['swim', 'bike', 'run', 'brick', 'long', 'recovery'];

const emptyDays = () =>
  DAYS.reduce((acc, day) => {
    acc[day] = [];
    return acc;
  }, {});

const DEFAULT_SCHEDULE = {
  seasons: {
    Spring: {
      title: 'Weekly Spring Schedule',
      dates: 'April 29 - June 25',
      days: {
        Monday: [{ id: 'sp-mon-1', label: 'Outdoor Ride 6:15-7:30am', type: 'bike' }],
        Tuesday: [
          { id: 'sp-tue-1', label: 'Swim 8:30-10:30am', type: 'swim' },
          { id: 'sp-tue-2', label: 'Track Run 6:15pm', type: 'run' },
        ],
        Wednesday: [{ id: 'sp-wed-1', label: 'Outdoor Ride 6:15-7:30pm', type: 'bike' }],
        Thursday: [
          { id: 'sp-thu-1', label: 'Swim 8:30-10:30am', type: 'swim' },
          { id: 'sp-thu-2', label: 'Tempo Run 6:15pm', type: 'run' },
        ],
        Friday: [],
        Saturday: [{ id: 'sp-sat-1', label: 'Group Ride?', type: 'long' }],
        Sunday: [{ id: 'sp-sun-1', label: 'Swim 10:00-12:00pm', type: 'swim' }],
      },
    },
    Summer: {
      title: 'Weekly Summer Schedule',
      dates: 'June 25 - August 20',
      days: {
        Monday: [
          {
            id: 'su-mon-1',
            label: 'Outdoor Ride 6:30-7:30am',
            type: 'bike',
            note: 'Check forum for exact times and location.',
          },
        ],
        Tuesday: [
          { id: 'su-tue-1', label: 'Swim 7:00-9:00am', type: 'swim' },
          { id: 'su-tue-2', label: 'Track Run 6:15pm', type: 'run' },
        ],
        Wednesday: [
          {
            id: 'su-wed-1',
            label: 'Outdoor Ride 6:15-7:30pm',
            type: 'bike',
            note: 'Check forum for exact times and location.',
          },
        ],
        Thursday: [
          { id: 'su-thu-1', label: 'Swim 7:00-9:00am', type: 'swim' },
          { id: 'su-thu-2', label: 'Tempo Run 6:15pm', type: 'run' },
        ],
        Friday: [],
        Saturday: [{ id: 'su-sat-1', label: 'Group Ride?', type: 'recovery' }],
        Sunday: [{ id: 'su-sun-1', label: 'Swim 10:00-12:00pm', type: 'swim' }],
      },
    },
    'Fall/Winter': {
      title: 'Weekly Winter Schedule',
      dates: 'September 1 - April 29',
      days: {
        Monday: [{ id: 'fw-mon-1', label: 'Spin 7-8am', type: 'bike' }],
        Tuesday: [
          { id: 'fw-tue-1', label: 'Swim 8:30-10:30am', type: 'swim' },
          { id: 'fw-tue-2', label: 'Track 6:15pm', type: 'run' },
        ],
        Wednesday: [{ id: 'fw-wed-1', label: 'Spin 7-8am', type: 'bike' }],
        Thursday: [
          { id: 'fw-thu-1', label: 'Swim 8:30-10:30am', type: 'swim' },
          { id: 'fw-thu-2', label: 'Tempo Run 6:15pm', type: 'run' },
        ],
        Friday: [{ id: 'fw-fri-1', label: 'Brick 6:30-8pm', type: 'brick' }],
        Saturday: [],
        Sunday: [{ id: 'fw-sun-1', label: 'Swim 10:00-12:00pm', type: 'recovery' }],
      },
    },
  },
};

const normalizeWorkout = (workout, index = 0) => {
  if (!workout || typeof workout !== 'object') return null;
  const label = String(workout.label || '').trim();
  if (!label) return null;
  const type = WORKOUT_TYPES.includes(workout.type) ? workout.type : 'bike';
  const note = String(workout.note || '').trim();
  return {
    id: String(workout.id || `w-${Date.now()}-${index}`),
    label: label.slice(0, 120),
    type,
    ...(note ? { note: note.slice(0, 200) } : {}),
  };
};

const normalizeSeason = (seasonKey, rawSeason, fallbackSeason) => {
  const base = fallbackSeason || {
    title: `Weekly ${seasonKey} Schedule`,
    dates: '',
    days: emptyDays(),
  };
  const source = rawSeason && typeof rawSeason === 'object' ? rawSeason : {};
  const days = emptyDays();
  DAYS.forEach((day) => {
    const list = Array.isArray(source.days?.[day])
      ? source.days[day]
      : Array.isArray(base.days?.[day])
        ? base.days[day]
        : [];
    days[day] = list.map((item, idx) => normalizeWorkout(item, idx)).filter(Boolean);
  });
  return {
    title: String(source.title || base.title || `Weekly ${seasonKey} Schedule`).trim().slice(0, 80),
    dates: String(source.dates ?? base.dates ?? '').trim().slice(0, 80),
    days,
  };
};

const normalizeSchedule = (raw) => {
  const seasons = {};
  Object.keys(DEFAULT_SCHEDULE.seasons).forEach((key) => {
    seasons[key] = normalizeSeason(key, raw?.seasons?.[key], DEFAULT_SCHEDULE.seasons[key]);
  });
  return { seasons };
};

const loadSchedule = async () => {
  const result = await pool.query('SELECT value FROM site_settings WHERE key = $1', ['schedule_json']);
  const raw = result.rows[0]?.value || '';
  if (!raw) return normalizeSchedule(DEFAULT_SCHEDULE);
  try {
    return normalizeSchedule(JSON.parse(raw));
  } catch (_err) {
    return normalizeSchedule(DEFAULT_SCHEDULE);
  }
};

const DEFAULT_MEMBERSHIP_FEES = [
  { id: 'full-tri', name: 'Full Tri', amount: 256 },
  { id: 'half-tri', name: 'Half Tri', amount: 136 },
  { id: 'full-du', name: 'Full Du', amount: 213 },
  { id: 'half-du', name: 'Half Du', amount: 122 },
  { id: 'full-run', name: 'Full Run', amount: 182 },
  { id: 'half-run', name: 'Half Run', amount: 101 },
];

const clampText = (value, max) => String(value ?? '').trim().slice(0, max);

const normalizeFees = (feesInput, fallbackFees = []) => {
  // Empty arrays must stay empty — do not copy default club fees onto every step.
  const source = Array.isArray(feesInput) ? feesInput : fallbackFees;
  return source
    .map((fee, index) => {
      const amount = Number(fee?.amount);
      const name = clampText(fee?.name, 80);
      if (!name || !Number.isFinite(amount) || amount < 0) return null;
      return {
        id: clampText(fee?.id, 40) || `fee-${index + 1}`,
        name,
        amount: Math.round(amount * 100) / 100,
      };
    })
    .filter(Boolean)
    .slice(0, 20);
};

const DEFAULT_JOIN_US = {
  goal: {
    title: 'Our Goal',
    body: 'To promote triathlon to the University of Toronto community through swim, bike, and run workouts which are both fun and challenging.',
  },
  whoCanJoin: {
    title: 'Who Can Join?',
    intro:
      'The University of Toronto Triathlon Club is open to students, alumni, faculty, and community members of the U of T Athletic Centre who are 18 years and older (exceptions are made for current U of T students who are 17.) We welcome athletes of all abilities from experienced triathletes to those new to the sport. The club operates year round, offering professionally coached swim and run workouts and member-led bike/spin workouts.',
    athleteTypesTitle: 'Athlete Types',
    athleteTypesIntro:
      'The U of T Tri Club is suitable for a range of current and aspiring triathletes (18yrs+) which include:',
    categories: [
      {
        title: '🏃‍♂️ Recreational Athletes',
        body: 'Those who are new to endurance sports and are primarily interested in triathlon training to get back in shape.',
      },
      {
        title: '🏊‍♂️ Short Course Athletes',
        body: 'Those who have some experience in endurance sports and are primarily interested in competing in Sprint and Olympic distance triathlons/duathlons or 5k/10k running races.',
      },
      {
        title: '🚴‍♂️ Long Course Athletes',
        body: 'Those who have some experience in endurance sports and are primarily interested in competing in Long Course to Ironman distance triathlons or half-marathon/marathon running races.',
      },
    ],
    beginnerNote: {
      title: '⚠️ Beginners Please Note',
      body: 'You must be able to swim 300m continuous before you attend the swim workouts. If you are new to swimming, the AC offers various swim classes to get you started.',
    },
  },
  howToJoin: {
    title: 'Joining: Step-by-step Instructions',
    steps: [
      {
        title: 'Try Us Out',
        body: 'Attend any one of our workouts to meet us and try it out! For indoor spin workouts, email [info@uoft-tri.club](mailto:info@uoft-tri.club) to make sure there is a bike reserved for you.',
      },
      {
        title: 'Join the U of T Athletics Centre (AC)',
        body: 'You must be an AC-member to join the Tri Club (provides access to training facilities, including pool). U of T students are automatically AC-members during the Fall and Winter terms. Otherwise, AC-membership can be purchased at the AC Main Office.',
      },
      {
        title: 'Join the Tri Club',
        body: 'To register for the Tri Club go to [recreation.utoronto.ca](https://recreation.utoronto.ca) or register in person at the AC Main Office.',
        showPackages: true,
        packagesHeading: 'There are 3 packages available:',
        packages: [
          'Triathlon (Swim, Run + Spin Workouts)',
          'Duathlon (Run + Spin Workouts)',
          'Run only',
        ],
        feesHeading: 'Fees:',
        feesNote: '*Half = Fall or Winter only | Full = Both Fall and Winter',
        fees: DEFAULT_MEMBERSHIP_FEES,
        registrationHeading: 'Current 2025/26 Registration Links:',
        registrationBody:
          '[Register here](https://recreation.utoronto.ca). "Club Sports: Triathlon Club" You must have a AC membership to join the Triathlon Club.',
      },
      {
        title: 'Create an Account and Get Approved',
        body: 'Create an account on this website, then go to your [Profile](/profile) page and upload your membership payment receipt (image or PDF). An exec will review it and approve you as a member—no need to email it. After you\'re approved, log out and log back in so you can access the forum and sign up for spin and brick workouts.',
      },
      {
        title: 'Come to the workouts!',
        body: 'For all other inquiries or questions please email [info@uoft-tri.club](mailto:info@uoft-tri.club)',
      },
    ],
  },
};

const normalizeJoinUsContent = (raw) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  const fallback = DEFAULT_JOIN_US;

  const categoriesSource = Array.isArray(source.whoCanJoin?.categories)
    ? source.whoCanJoin.categories
    : fallback.whoCanJoin.categories;
  const categories = categoriesSource
    .map((cat) => ({
      title: clampText(cat?.title, 120),
      body: clampText(cat?.body, 2000),
    }))
    .filter((cat) => cat.title || cat.body)
    .slice(0, 10);

  const stepsSource = Array.isArray(source.howToJoin?.steps)
    ? source.howToJoin.steps
    : fallback.howToJoin.steps;
  const steps = stepsSource
    .map((step, stepIndex) => {
      const packages = Array.isArray(step?.packages)
        ? step.packages.map((p) => clampText(p, 200)).filter(Boolean).slice(0, 10)
        : [];
      const fallbackStep = fallback.howToJoin.steps[stepIndex] || {};
      // Only inherit default fees from the matching default step (Join the Tri Club).
      // Missing or empty fees on other steps must stay empty.
      const fallbackFees = Array.isArray(fallbackStep.fees) ? fallbackStep.fees : [];
      const hasOwnFees = Array.isArray(step?.fees) && step.fees.length > 0;
      return {
        title: clampText(step?.title, 120),
        body: clampText(step?.body, 4000),
        showPackages: !!step?.showPackages,
        packagesHeading: clampText(step?.packagesHeading, 120),
        packages,
        feesHeading: clampText(step?.feesHeading, 80),
        feesNote: clampText(step?.feesNote, 200),
        fees: normalizeFees(hasOwnFees ? step.fees : undefined, fallbackFees),
        registrationHeading: clampText(step?.registrationHeading, 120),
        registrationBody: clampText(step?.registrationBody, 1000),
      };
    })
    .filter((step) => step.title || step.body)
    .slice(0, 12);

  return {
    goal: {
      title: clampText(source.goal?.title ?? fallback.goal.title, 80) || fallback.goal.title,
      body: clampText(source.goal?.body ?? fallback.goal.body, 2000),
    },
    whoCanJoin: {
      title:
        clampText(source.whoCanJoin?.title ?? fallback.whoCanJoin.title, 80) ||
        fallback.whoCanJoin.title,
      intro: clampText(source.whoCanJoin?.intro ?? fallback.whoCanJoin.intro, 4000),
      athleteTypesTitle: clampText(
        source.whoCanJoin?.athleteTypesTitle ?? fallback.whoCanJoin.athleteTypesTitle,
        80
      ),
      athleteTypesIntro: clampText(
        source.whoCanJoin?.athleteTypesIntro ?? fallback.whoCanJoin.athleteTypesIntro,
        2000
      ),
      categories: categories.length ? categories : fallback.whoCanJoin.categories,
      beginnerNote: {
        title: clampText(
          source.whoCanJoin?.beginnerNote?.title ?? fallback.whoCanJoin.beginnerNote.title,
          120
        ),
        body: clampText(
          source.whoCanJoin?.beginnerNote?.body ?? fallback.whoCanJoin.beginnerNote.body,
          2000
        ),
      },
    },
    howToJoin: {
      title:
        clampText(source.howToJoin?.title ?? fallback.howToJoin.title, 120) ||
        fallback.howToJoin.title,
      steps: steps.length ? steps : fallback.howToJoin.steps,
    },
  };
};

const loadJoinUsContent = async () => {
  const result = await pool.query('SELECT value FROM site_settings WHERE key = $1', ['join_us_json']);
  const raw = result.rows[0]?.value || '';
  if (!raw) return normalizeJoinUsContent(DEFAULT_JOIN_US);
  try {
    return normalizeJoinUsContent(JSON.parse(raw));
  } catch (_err) {
    return normalizeJoinUsContent(DEFAULT_JOIN_US);
  }
};

const parsePopupSettings = (rawValue) => {
  let popup = { enabled: false, message: '', popupId: null };
  if (!rawValue) return popup;
  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && typeof parsed === 'object') {
      popup = {
        enabled: !!parsed.enabled && !!parsed.message,
        message: parsed.message || '',
        popupId: parsed.popupId || null,
      };
    }
  } catch (_err) {
    // ignore parse errors, fall back to defaults
  }
  return popup;
};

const loadPopupSettings = async () => {
  const result = await pool.query('SELECT value FROM site_settings WHERE key = $1', ['popup_json']);
  return parsePopupSettings(result.rows[0]?.value || '');
};

// Public: get banner (supports single or multiple banners)
router.get('/banner', async (req, res) => {
  try {
    const result = await pool.query('SELECT value FROM site_settings WHERE key = $1', ['banner_json']);
    const raw = result.rows[0]?.value || '';

    let parsed;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch (_e) {
      parsed = null;
    }

    // Normalize to unified shape: { enabled: boolean, items: [{ message }], rotationIntervalMs }
    let banner = { enabled: false, items: [], rotationIntervalMs: 6000 };
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const enabled = !!parsed.enabled;
      const rotationIntervalMs = Number(parsed.rotationIntervalMs) > 0 ? Number(parsed.rotationIntervalMs) : 6000;

      if (Array.isArray(parsed.items)) {
        const items = parsed.items
          .map((it) => (typeof it === 'string' ? { message: it } : { message: String(it?.message || '') }))
          .filter((it) => it.message);
        banner = { enabled: enabled, items, rotationIntervalMs };
      } else if (typeof parsed.message === 'string') {
        const items = parsed.message ? [{ message: parsed.message }] : [];
        banner = { enabled: enabled, items, rotationIntervalMs };
      }
    }

    const popup = await loadPopupSettings();

    res.json({ banner, popup });
  } catch (error) {
    console.error('Get banner error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: update banner (supports multiple items)
router.put('/banner', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const enabled = !!body.enabled;
    const rotationIntervalMs = Number(body.rotationIntervalMs) > 0 ? Number(body.rotationIntervalMs) : 6000;

    let itemsInput = body.items;
    if (!Array.isArray(itemsInput) && typeof body.message === 'string') {
      itemsInput = [{ message: body.message }];
    }

    let items = Array.isArray(itemsInput)
      ? itemsInput.map((it) => (typeof it === 'string' ? { message: it } : { message: String(it?.message || '') }))
      : [];

    const getDisplayLength = (text) => {
      if (!text) return 0;
      const withoutUrls = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
      return withoutUrls.length;
    };

    const processedItems = items
      .map((it) => {
        const message = (it.message || '').toString().trim();
        return message ? { message } : null;
      })
      .filter((it) => it && it.message);

    const hasTooLongItem = processedItems.some((it) => getDisplayLength(it.message) > 50);
    if (hasTooLongItem) {
      return res.status(400).json({ error: 'Your message is too long. Banner messages must be 50 characters or less.' });
    }

    items = processedItems.slice(0, 10);

    const banner = { enabled: enabled, items, rotationIntervalMs };
    const value = JSON.stringify(banner);

    await pool.query(
      `
      INSERT INTO site_settings(key, value) VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `,
      ['banner_json', value]
    );

    const popupEnabled = !!body.popupEnabled;
    const popupMessage = (body.popupMessage || '').toString().trim();
    const previousPopup = await loadPopupSettings();

    let popupPayload = { enabled: false, message: '', popupId: null };
    if (popupEnabled && popupMessage) {
      let popupId = previousPopup.popupId;
      if (!popupId || previousPopup.message !== popupMessage) {
        popupId = `popup-${Date.now()}`;
      }
      popupPayload = {
        enabled: true,
        message: popupMessage,
        popupId,
      };
    }

    await pool.query(
      `
      INSERT INTO site_settings(key, value) VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `,
      ['popup_json', JSON.stringify(popupPayload)]
    );

    res.json({ message: 'Banner updated', banner, popup: popupPayload });
  } catch (error) {
    console.error('Update banner error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: weekly workout schedule by season
router.get('/schedule', async (_req, res) => {
  try {
    const schedule = await loadSchedule();
    res.json({ schedule });
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin/exec: replace full weekly schedule
router.put('/schedule', authenticateToken, requireRole('exec'), async (req, res) => {
  try {
    const schedule = normalizeSchedule(req.body?.schedule || req.body || {});
    await pool.query(
      `
      INSERT INTO site_settings(key, value) VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `,
      ['schedule_json', JSON.stringify(schedule)]
    );
    res.json({ message: 'Schedule updated', schedule });
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: Join Us page copy
router.get('/join-us', async (_req, res) => {
  try {
    const content = await loadJoinUsContent();
    res.json({ content });
  } catch (error) {
    console.error('Get join-us content error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin/exec: update Join Us page copy
router.put('/join-us', authenticateToken, requireRole('exec'), async (req, res) => {
  try {
    const content = normalizeJoinUsContent(req.body?.content || req.body || {});
    await pool.query(
      `
      INSERT INTO site_settings(key, value) VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `,
      ['join_us_json', JSON.stringify(content)]
    );
    res.json({ message: 'Join Us content updated', content });
  } catch (error) {
    console.error('Update join-us content error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Authenticated: get popup status for current user
router.get('/popup/status', authenticateToken, async (req, res) => {
  try {
    const popup = await loadPopupSettings();

    if (!popup.enabled || !popup.message || !popup.popupId) {
      return res.json({ popup: { enabled: false, shouldShow: false } });
    }

    const result = await pool.query(
      'SELECT 1 FROM user_popup_views WHERE user_id = $1 AND popup_id = $2',
      [req.user.id, popup.popupId]
    );

    res.json({
      popup: {
        ...popup,
        shouldShow: result.rowCount === 0,
      },
    });
  } catch (error) {
    console.error('Get popup status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Authenticated: mark popup as seen for the current user
router.post('/popup/seen', authenticateToken, async (req, res) => {
  try {
    const popupId = req.body?.popupId;
    if (!popupId) {
      return res.status(400).json({ error: 'popupId is required' });
    }

    await pool.query(
      `
      INSERT INTO user_popup_views (user_id, popup_id, seen_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, popup_id) DO UPDATE SET seen_at = EXCLUDED.seen_at
    `,
      [req.user.id, popupId]
    );

    res.json({ message: 'Popup marked as seen' });
  } catch (error) {
    console.error('Mark popup seen error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

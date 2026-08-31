import React, { useState, useEffect, useRef, useCallback } from 'react';
import { formatFeeAmount } from '../config/membershipFees';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../utils/apiConfig';
import { showError, showSuccess } from './SimpleNotification';
import './JoinUs.css';

const JOIN_EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const JOIN_EMAIL_GLOBAL_RE = new RegExp(JOIN_EMAIL_RE.source, 'g');

const escapeJoinHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const normalizeJoinUrl = (rawUrl) => {
  let url = String(rawUrl || '').trim();
  if (!url) return null;
  if (new RegExp(`^${JOIN_EMAIL_RE.source}$`).test(url)) {
    url = `mailto:${url}`;
  } else if (/^www\./i.test(url)) {
    url = `https://${url}`;
  }
  const isMail = /^mailto:/i.test(url);
  const isHttp = /^https?:\/\//i.test(url);
  const isInternal = url.startsWith('/');
  if (!isMail && !isHttp && !isInternal) return null;
  return { url, isHttp };
};

/** Convert plain text + [label](url) markdown into safe HTML. */
function formatJoinText(text) {
  if (!text) return '';

  const parts = [];
  const stash = (html) => {
    parts.push(html);
    return `%%JOINLINK${parts.length - 1}%%`;
  };

  // Pull markdown links out first so later email auto-linking cannot rewrite hrefs.
  let html = String(text).replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, rawUrl) => {
    const normalized = normalizeJoinUrl(rawUrl);
    if (!normalized) return label;
    const attrs = normalized.isHttp ? ' target="_blank" rel="noopener noreferrer"' : '';
    return stash(`<a href="${escapeJoinHtml(normalized.url)}"${attrs}>${escapeJoinHtml(label)}</a>`);
  });

  html = escapeJoinHtml(html);

  html = html.replace(JOIN_EMAIL_GLOBAL_RE, (email) =>
    stash(`<a href="mailto:${escapeJoinHtml(email)}">${escapeJoinHtml(email)}</a>`)
  );

  html = html.replace(/\n/g, '<br/>');
  return html.replace(/%%JOINLINK(\d+)%%/g, (_m, index) => parts[Number(index)] || '');
}

const RichText = ({ text, className }) => (
  <p className={className} dangerouslySetInnerHTML={{ __html: formatJoinText(text) }} />
);

const JoinUs = () => {
  const { currentUser, isAdmin } = useAuth();
  const canEdit = !!(currentUser && isAdmin(currentUser));
  const [isSticky, setIsSticky] = useState(false);
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editSection, setEditSection] = useState(null); // 'goal' | 'whoCanJoin' | 'howToJoin'
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const navRef = useRef(null);
  const containerRef = useRef(null);
  const navInitialTopRef = useRef(null);
  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/site/join-us`);
        if (!res.ok) throw new Error('Failed to load Join Us content');
        const data = await res.json();
        setContent(data.content);
      } catch (err) {
        console.error(err);
        showError('Could not load Join Us content.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [API_BASE]);

  const getHeaderOffset = useCallback(() => {
    const navbar = document.querySelector('.navbar');
    const navbarHeight = navbar ? navbar.getBoundingClientRect().height : 0;
    const sectionNav = navRef.current;
    const sectionNavHeight = sectionNav ? sectionNav.getBoundingClientRect().height : 0;
    const GAP = 12;
    return { navbarHeight, sectionNavHeight, total: navbarHeight + sectionNavHeight + GAP };
  }, []);

  const applyOffsetVars = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { navbarHeight, total } = getHeaderOffset();
    el.style.setProperty('--joinus-navbar-height', `${navbarHeight}px`);
    el.style.setProperty('--joinus-scroll-offset', `${total}px`);
  }, [getHeaderOffset]);

  useEffect(() => {
    applyOffsetVars();
    window.addEventListener('resize', applyOffsetVars);
    window.addEventListener('orientationchange', applyOffsetVars);
    return () => {
      window.removeEventListener('resize', applyOffsetVars);
      window.removeEventListener('orientationchange', applyOffsetVars);
    };
  }, [applyOffsetVars]);

  const handleNavClick = useCallback(
    (e, targetId) => {
      e.preventDefault();
      const box = document.getElementById(targetId);
      if (!box) return;
      applyOffsetVars();

      const GAP = 12;

      const getHeaderBottom = () => {
        const navbar = document.querySelector('.navbar');
        let bottom = navbar ? navbar.getBoundingClientRect().bottom : 0;
        const sectionNav = navRef.current;
        if (sectionNav) {
          const r = sectionNav.getBoundingClientRect();
          if (r.top <= bottom + 1 && r.bottom > bottom) bottom = r.bottom;
        }
        return bottom;
      };

      const getHeadingTop = () => {
        const heading = box.querySelector('h1, h2, h3') || box;
        return heading.getBoundingClientRect().top;
      };

      const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      const estimate = getHeadingTop() + scrollY - (getHeaderBottom() + GAP);
      window.scrollTo({ top: Math.max(estimate, 0), behavior: 'smooth' });

      let tries = 0;
      const correct = () => {
        const delta = getHeadingTop() - (getHeaderBottom() + GAP);
        if (Math.abs(delta) > 2 && tries < 20) {
          window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
          tries += 1;
          setTimeout(correct, 60);
        }
      };
      setTimeout(correct, 380);
    },
    [applyOffsetVars]
  );

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    if (navInitialTopRef.current === null) {
      navInitialTopRef.current = nav.offsetTop;
    }

    const handleScroll = () => {
      if (!nav) return;
      const { navbarHeight } = getHeaderOffset();
      const scrollY = window.pageYOffset || document.documentElement.scrollTop || window.scrollY;
      setIsSticky(scrollY >= navInitialTopRef.current - navbarHeight);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('touchmove', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });

    let rafId = null;
    const rafHandleScroll = () => {
      handleScroll();
      rafId = requestAnimationFrame(rafHandleScroll);
    };
    rafId = requestAnimationFrame(rafHandleScroll);
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchmove', handleScroll);
      document.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [getHeaderOffset]);

  const openEditor = (section) => {
    if (!content?.[section]) return;
    const cloned = JSON.parse(JSON.stringify(content[section]));
    if (section === 'howToJoin') {
      cloned.steps = (cloned.steps || []).map((step) => ({
        ...step,
        fees: Array.isArray(step.fees) ? step.fees : [],
      }));
    }
    setDraft(cloned);
    setEditSection(section);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditSection(null);
    setDraft(null);
  };

  const saveEditor = async () => {
    if (!content || !editSection || !draft) return;
    setSaving(true);
    try {
      const nextContent = { ...content, [editSection]: draft };
      const token = localStorage.getItem('triathlonToken');
      const res = await fetch(`${API_BASE}/site/join-us`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: nextContent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setContent(data.content || nextContent);
      setEditSection(null);
      setDraft(null);
      showSuccess('Join Us section saved.');
    } catch (err) {
      showError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const renderEditButton = (section, label) =>
    canEdit ? (
      <button
        type="button"
        className="joinus-edit-btn"
        onClick={() => openEditor(section)}
        aria-label={`Edit ${label}`}
        title={`Edit ${label}`}
      >
        ✏️
      </button>
    ) : null;

  const goal = content?.goal;
  const who = content?.whoCanJoin;
  const how = content?.howToJoin;

  return (
    <div className="join-us-container" ref={containerRef}>
      <div className="container">
        <h1 className="section-title">Join Us!</h1>

        <div ref={navRef} className={`section-navigation ${isSticky ? 'sticky' : ''}`}>
          <a href="#goal" className="nav-link" onClick={(e) => handleNavClick(e, 'goal')}>
            Goal
          </a>
          <a href="#who-can-join" className="nav-link" onClick={(e) => handleNavClick(e, 'who-can-join')}>
            Who Can Join
          </a>
          <a href="#how-to-join" className="nav-link" onClick={(e) => handleNavClick(e, 'how-to-join')}>
            How to Join
          </a>
          <a href="#team-charter" className="nav-link" onClick={(e) => handleNavClick(e, 'team-charter')}>
            Team Charter
          </a>
        </div>

        {loading && <p className="joinus-loading">Loading…</p>}

        {!loading && goal && (
          <div id="goal" className="goal-section">
            <div className="joinus-section-header">
              <h2 className="goal-title">{goal.title}</h2>
              {renderEditButton('goal', 'Our Goal')}
            </div>
            <RichText className="goal-text" text={goal.body} />
          </div>
        )}

        {!loading && who && (
          <div id="who-can-join" className="who-can-join-section">
            <div className="joinus-section-header">
              <h2 className="section-subtitle">{who.title}</h2>
              {renderEditButton('whoCanJoin', 'Who Can Join')}
            </div>
            <div className="membership-info">
              <RichText text={who.intro} />
            </div>

            <div className="athlete-types">
              <h3>{who.athleteTypesTitle}</h3>
              <RichText text={who.athleteTypesIntro} />

              {(who.categories || []).map((cat, idx) => (
                <div className="athlete-category" key={`${cat.title}-${idx}`}>
                  <h4>{cat.title}</h4>
                  <RichText text={cat.body} />
                </div>
              ))}

              {who.beginnerNote?.title || who.beginnerNote?.body ? (
                <div className="beginner-note">
                  <h4>{who.beginnerNote.title}</h4>
                  <RichText text={who.beginnerNote.body} />
                </div>
              ) : null}
            </div>
          </div>
        )}

        {!loading && how && (
          <div id="how-to-join" className="joining-instructions-section">
            <div className="joinus-section-header">
              <h2 className="section-subtitle">{how.title}</h2>
              {renderEditButton('howToJoin', 'Joining instructions')}
            </div>

            <div className="step-container">
              {(how.steps || []).map((step, index) => (
                <div className="step" key={`${step.title}-${index}`}>
                  <div className="step-number">{index + 1}</div>
                  <div className="step-content">
                    <h3>{step.title}</h3>
                    <RichText text={step.body} />

                    {(step.packagesHeading ||
                      (step.packages || []).length > 0 ||
                      step.showPackages ||
                      step.feesHeading ||
                      step.feesNote ||
                      step.registrationHeading ||
                      step.registrationBody) && (
                      <div className="packages-info">
                        {step.packagesHeading ? <h4>{step.packagesHeading}</h4> : null}
                        {(step.packages || []).length > 0 && (
                          <ul>
                            {step.packages.map((pkg, i) => (
                              <li key={`${pkg}-${i}`}>
                                <strong>{pkg}</strong>
                              </li>
                            ))}
                          </ul>
                        )}

                        {(step.feesHeading || step.feesNote || (step.fees || []).length > 0) && (
                          <div className="fees-section">
                            {step.feesHeading ? <h4>{step.feesHeading}</h4> : null}
                            {step.feesNote ? (
                              <p>
                                <em>{step.feesNote}</em>
                              </p>
                            ) : null}
                            {(step.fees || []).length > 0 && (
                              <div className="fee-grid">
                                {step.fees.map((fee) => (
                                  <div className="fee-item" key={fee.id}>
                                    <span className="fee-name">{fee.name}:</span>
                                    <span className="fee-amount">{formatFeeAmount(fee.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {(step.registrationHeading || step.registrationBody) && (
                          <div className="registration-info">
                            {step.registrationHeading ? <h4>{step.registrationHeading}</h4> : null}
                            <RichText text={step.registrationBody} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div id="team-charter" className="charter-section">
          <h2 className="section-subtitle">Team Charter</h2>
          <div className="charter-notice">
            <p>
              <strong>⚠️ Important:</strong> All members must agree to this charter before signing up.
            </p>
          </div>

          <div className="charter-content">
            <h3>The University of Toronto Triathlon Club Charter</h3>

            <h4>Introduction</h4>
            <p>
              The University of Toronto Triathlon Club (&quot;UofT Tri Club&quot;) is a triathlon club which is
              open to all individuals which are members of the Athletic Center - please note you have to be
              18 years old, unless you are a 17 year old student (see the Athletic Centers guidelines for
              more information).
            </p>

            <p>
              The UofT Tri Club is run by an executive team, which consists of different members who
              volunteer their time. While the executive team will change, they are best reached by email at{' '}
              <a href="mailto:info@uoft-tri.club">info@uoft-tri.club</a>, additionally you can reach out
              through social media. Please give them time to answer.
            </p>

            <p>
              The Executive Team consists of the following positions: President, Treasurer, Secretary,
              Webmaster, Social coordinator and Social Media Manager; positions can be filled by one or more
              individuals.
            </p>

            <p>
              Positions and titles can be updated to meet current needs. Some workouts have coaches, more
              details under sections 4-6, their contact details are on the UofT Tri Club website. This
              Charter is a living document, changes can be made when deemed appropriate.
            </p>

            <h4>Requirements</h4>
            <p>
              We are open to all beginners, however for safety and cohesion in the pool we do require
              members who have joined for the full triathlon option to be able to swim 300 meter continuous
              (turns should not take more than 3 seconds) Front Crawl in under 10 minutes and 30 seconds.
            </p>

            <h4>General Conduct</h4>
            <p>
              At all times members must act with integrity, honesty, fairness, and respect in accordance
              with the University of Toronto Faculty of Kinesiology &amp; Physical Education Student &amp;
              Member Code of Conduct, the Code of Student Conduct (if the member is also an enrolled
              student), and the Policy for Safety in Athletic Facilities.
            </p>

            <p>
              While triathlon is not a contact sport, we understand that inadvertent contact sometimes
              occurs, try your best to be aware of your surroundings and communicate with others.
            </p>

            <h4>Swim Specific Conduct</h4>
            <ul>
              <li>
                Respect and listen to the pool staff, they are there not only for the training but also to
                ensure our safety while we swim.
              </li>
              <li>
                Lanes are populated by members on the basis of swim skill, speed, and fitness level -
                typically increasing in intensity with every subsequent lane. If you are unsure about
                placement please ask the coach so that they may assist in finding an appropriate lane.
              </li>
              <li>
                Members are expected to be able to circle swim within their lanes, unless it is safe to swim
                side by side.
              </li>
              <li>
                When circle swimming, members need to push off the walls at safe distances, usually 10 to 5
                seconds unless otherwise specified by the coaches.
              </li>
              <li>
                Be on time for the swim workouts, this allows people to start the workout together, avoiding
                individuals swimming different parts of the workout in the same lane.
              </li>
              <li>
                The coaches will track your punctuality, if you are consistently late, late being defined as
                more than 10 minutes, you can face a suspension of not being allowed to swim (exceptions are
                described in section Cii).
              </li>
              <li>
                We understand that life can get in the way, and that the swim times might not work in your
                favor, if you know you will consistently come X minutes late (for whatever reason) then let
                the coaches know, additionally it is likely you will swim with similar people so let them
                know as well.
              </li>
              <li>
                If you are late, first let a coach know you are here, then go to your usual lane and WAIT
                until all swimmers are stopped or there is a break in the set, let the other swimmers know
                what you will be doing and then seed yourself accordingly; disregarding this can lead to
                collisions which poses a safety risk.
              </li>
              <li>
                Follow the workouts: the workouts are specifically written for the given training session, if
                you can&apos;t do parts of the workouts or want to modify sections let the coaches and other
                lane members know.
              </li>
              <li>
                If at any point the coaches feel you do not meet the requirement or are a safety issue, it is
                up to their discretion to ask you not to come to training, with the backing of the UofT Tri
                Club executive team, if relevant a refund can be given.
              </li>
              <li>
                The coaches appreciate feedback but ensure this is done in a respectful and constructive
                manner.
              </li>
              <li>Members can leave once they are done, or if they hit a time constraint.</li>
              <li>
                Make sure to pick up all your items and if you are the last individual leaving your lane,
                make sure that all printed paper workouts are cleared to avoid clogged gutters.
              </li>
              <li>
                If relevant and able we ask that members help with putting in or taking out lane ropes that
                way it can be done more efficiently, if you are unsure what to do, ask the pool staff for
                guidance.
              </li>
            </ul>

            <h4>Bike Specific Conduct</h4>
            <h5>Indoor Spins:</h5>
            <ul>
              <li>Indoor Spins are lead by members who follow a specific workout.</li>
              <li>
                Sign up: There are limited bikes, you must sign up through the forum in order to reserve a
                bike.
              </li>
              <li>
                Show up: if you don&apos;t show up, without canceling 12 hours before, for more than 2 times
                within a semester, you will be suspended from spins for a week.
              </li>
              <li>
                Be on time: after 10 minutes your bike is &quot;given away&quot; if another member is on the
                waitlist they can then take your spot; coming more than 10 minutes late is viewed as a No
                Show.
              </li>
              <li>
                Follow the workout: this is meant to be a group activity, please follow the workout and
                listen to the leader.
              </li>
              <li>
                If you have questions, please ask, the leaders would love to answer your questions, also any
                feedback or playlist suggestions are always welcome!
              </li>
            </ul>

            <h5>Outdoor Rides:</h5>
            <ul>
              <li>
                In the summer we shift to outdoor rides; the bike leaders will lead specific loops or paths.
              </li>
              <li>You need to have your own bike to participate but all speeds are welcome.</li>
              <li>
                If you use a tri bike instead of a road bike, please be conscientious of how this will impact
                your ability to break/shift and do not ride too close to other riders.
              </li>
              <li>
                Sign up: you still need to sign up that way the bike leads know to look out for you, where
                you should meet will be specified on the forum.
              </li>
              <li>Be on time: if you are late, the bike leader can choose to leave without you.</li>
              <li>
                You must bring a helmet! While water, nutrition and lights are encouraged you will not be
                allowed to ride with the group if you do not have a helmet.
              </li>
            </ul>

            <h5>Brick Workouts:</h5>
            <ul>
              <li>All the rules under section 5a apply.</li>
              <li>If you have an injury and can&apos;t run let the leader know in advance.</li>
              <li>When running run around the track in the posted directions.</li>
              <li>Be cautious of non-triathlon club members using the track.</li>
            </ul>

            <h4>Run Specific Conduct</h4>
            <h5>Track Runs:</h5>
            <ul>
              <li>Track runs are coached.</li>
              <li>
                Listen to the coach and follow the workout; modifications are always possible, just let the
                coach know.
              </li>
              <li>Be on time: this allows us all to work together.</li>
              <li>
                All speeds are welcome, usually more than one group forms to ensure everyone gets the right
                amount of rest.
              </li>
            </ul>

            <h5>Group Tempo Runs:</h5>
            <ul>
              <li>These runs occur as a social run once a week.</li>
              <li>Specific routes are picked out, but may be changed due to weather conditions.</li>
              <li>
                Be on time: the group meets at 6:15 pm, unless otherwise specified, if you are late they
                might leave without you.
              </li>
              <li>
                If relevant more than one pace group will be created to ensure everyone can participate.
              </li>
            </ul>

            <h4>Accommodations</h4>
            <p>
              Accommodations must be requested through the Athletic Center, the club will follow suit and
              meet all accommodations granted.
            </p>

            <h4>Safety and Responsibility</h4>
            <ul>
              <li>Safety is always our number one priority.</li>
              <li>
                If you do not feel well, let a coach, leader or another member know it is always ok to stop
                and rest.
              </li>
              <li>Ensure to follow traffic laws when biking and running outside.</li>
              <li>Use properly functioning equipment.</li>
              <li>Be aware of injuries and let your body rest and recover appropriately.</li>
              <li>
                If there are safety procedure (ie a fire drill) during indoor trainings, members are expected
                to stop their workout and follow the announced safety procedures.
              </li>
              <li>
                We take any type of head collisions very seriously, if you hit your head STOP, let someone
                know, and monitor for any symptoms of a concussion. A good resource can be found on the UofT
                website.
              </li>
            </ul>

            <h4>Inclusivity and Respect</h4>
            <ul>
              <li>Promote an inclusive environment free from discrimination, harassment, or bullying.</li>
              <li>
                Respect individual differences including race, gender, sexual orientation, ability, religion,
                and age.
              </li>
              <li>Be welcoming and supportive of new and less experienced members.</li>
            </ul>

            <h4>Accountability and Discipline</h4>
            <ul>
              <li>
                Members who breach this Charter may be subject to disciplinary action, which could include
                warnings, suspension, or expulsion from the club.
              </li>
              <li>
                The UofT Tri Club executive team reserves the right to investigate and address all complaints
                or concerns confidentially and fairly.
              </li>
              <li>
                The UofT Tri Club executive team reserves the right to suspend or expel any member from the
                club based off of complaints or investigations.
              </li>
              <li>
                If issues come up you can report them to the executive team or file a report with the Athletic
                Center, all reporting will be treated on a need to know basis and nothing will be shared
                without permission.
              </li>
            </ul>

            <h4>Agreement</h4>
            <p>
              By joining the UofT Tri Club, members agree to abide by this Charter and uphold its values
              throughout their participation.
            </p>
          </div>
        </div>
      </div>

      {editSection === 'goal' && draft && (
        <JoinUsEditModal title="Edit Our Goal" onClose={closeEditor} onSave={saveEditor} saving={saving}>
          <label>
            Title
            <input
              type="text"
              value={draft.title || ''}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              maxLength={80}
            />
          </label>
          <label>
            Body
            <textarea
              rows={5}
              value={draft.body || ''}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              maxLength={2000}
            />
          </label>
          <p className="joinus-edit-hint">Links: use [text](https://...) or [email](mailto:...)</p>
        </JoinUsEditModal>
      )}

      {editSection === 'whoCanJoin' && draft && (
        <JoinUsEditModal title="Edit Who Can Join" onClose={closeEditor} onSave={saveEditor} saving={saving}>
          <label>
            Section title
            <input
              type="text"
              value={draft.title || ''}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              maxLength={80}
            />
          </label>
          <label>
            Intro
            <textarea
              rows={4}
              value={draft.intro || ''}
              onChange={(e) => setDraft({ ...draft, intro: e.target.value })}
              maxLength={4000}
            />
          </label>
          <label>
            Athlete types heading
            <input
              type="text"
              value={draft.athleteTypesTitle || ''}
              onChange={(e) => setDraft({ ...draft, athleteTypesTitle: e.target.value })}
              maxLength={80}
            />
          </label>
          <label>
            Athlete types intro
            <textarea
              rows={2}
              value={draft.athleteTypesIntro || ''}
              onChange={(e) => setDraft({ ...draft, athleteTypesIntro: e.target.value })}
              maxLength={2000}
            />
          </label>

          <div className="joinus-edit-list-header">
            <h4>Athlete categories</h4>
            <button
              type="button"
              className="btn-joinus-add"
              onClick={() =>
                setDraft({
                  ...draft,
                  categories: [...(draft.categories || []), { title: '', body: '' }],
                })
              }
            >
              + Add category
            </button>
          </div>
          {(draft.categories || []).map((cat, idx) => (
            <div className="joinus-edit-card" key={`cat-${idx}`}>
              <input
                type="text"
                value={cat.title || ''}
                placeholder="Category title"
                onChange={(e) => {
                  const categories = [...draft.categories];
                  categories[idx] = { ...categories[idx], title: e.target.value };
                  setDraft({ ...draft, categories });
                }}
              />
              <textarea
                rows={3}
                value={cat.body || ''}
                placeholder="Category description"
                onChange={(e) => {
                  const categories = [...draft.categories];
                  categories[idx] = { ...categories[idx], body: e.target.value };
                  setDraft({ ...draft, categories });
                }}
              />
              <button
                type="button"
                className="btn-joinus-delete"
                onClick={() =>
                  setDraft({
                    ...draft,
                    categories: draft.categories.filter((_, i) => i !== idx),
                  })
                }
              >
                Delete category
              </button>
            </div>
          ))}

          <h4>Beginner note</h4>
          <label>
            Title
            <input
              type="text"
              value={draft.beginnerNote?.title || ''}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  beginnerNote: { ...(draft.beginnerNote || {}), title: e.target.value },
                })
              }
            />
          </label>
          <label>
            Body
            <textarea
              rows={3}
              value={draft.beginnerNote?.body || ''}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  beginnerNote: { ...(draft.beginnerNote || {}), body: e.target.value },
                })
              }
            />
          </label>
        </JoinUsEditModal>
      )}

      {editSection === 'howToJoin' && draft && (
        <JoinUsEditModal
          title="Edit Joining Instructions"
          onClose={closeEditor}
          onSave={saveEditor}
          saving={saving}
        >
          <label>
            Section title
            <input
              type="text"
              value={draft.title || ''}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              maxLength={120}
            />
          </label>

          <div className="joinus-edit-list-header">
            <h4>Steps</h4>
            <button
              type="button"
              className="btn-joinus-add"
              onClick={() =>
                setDraft({
                  ...draft,
                  steps: [...(draft.steps || []), { title: '', body: '', fees: [] }],
                })
              }
            >
              + Add step
            </button>
          </div>

          {(draft.steps || []).map((step, idx) => (
            <div className="joinus-edit-card" key={`step-${idx}`}>
              <div className="joinus-edit-step-title">Step {idx + 1}</div>
              <input
                type="text"
                value={step.title || ''}
                placeholder="Step title"
                onChange={(e) => {
                  const steps = [...draft.steps];
                  steps[idx] = { ...steps[idx], title: e.target.value };
                  setDraft({ ...draft, steps });
                }}
              />
              <textarea
                rows={3}
                value={step.body || ''}
                placeholder="Step body — links: [text](https://...) or [email](mailto:...)"
                onChange={(e) => {
                  const steps = [...draft.steps];
                  steps[idx] = { ...steps[idx], body: e.target.value };
                  setDraft({ ...draft, steps });
                }}
              />

              <input
                type="text"
                value={step.packagesHeading || ''}
                placeholder="Packages heading (optional)"
                onChange={(e) => {
                  const steps = [...draft.steps];
                  steps[idx] = { ...steps[idx], packagesHeading: e.target.value };
                  setDraft({ ...draft, steps });
                }}
              />
              <textarea
                rows={3}
                value={(step.packages || []).join('\n')}
                placeholder="Packages — one per line (e.g. Triathlon, Duathlon, Run only)"
                onChange={(e) => {
                  const steps = [...draft.steps];
                  steps[idx] = {
                    ...steps[idx],
                    packages: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean),
                  };
                  setDraft({ ...draft, steps });
                }}
              />

              <input
                type="text"
                value={step.feesHeading || ''}
                placeholder="Fees heading (optional)"
                onChange={(e) => {
                  const steps = [...draft.steps];
                  steps[idx] = { ...steps[idx], feesHeading: e.target.value };
                  setDraft({ ...draft, steps });
                }}
              />
              <input
                type="text"
                value={step.feesNote || ''}
                placeholder="Fees note (optional)"
                onChange={(e) => {
                  const steps = [...draft.steps];
                  steps[idx] = { ...steps[idx], feesNote: e.target.value };
                  setDraft({ ...draft, steps });
                }}
              />

              <div className="joinus-edit-list-header">
                <h4>Fee amounts (CAD before HST)</h4>
                <button
                  type="button"
                  className="btn-joinus-add"
                  onClick={() => {
                    const steps = [...draft.steps];
                    const fees = [...(steps[idx].fees || [])];
                    fees.push({
                      id: `fee-${Date.now()}`,
                      name: '',
                      amount: 0,
                    });
                    steps[idx] = { ...steps[idx], fees };
                    setDraft({ ...draft, steps });
                  }}
                >
                  + Add fee
                </button>
              </div>
              {(step.fees || []).map((fee, feeIdx) => (
                <div className="joinus-fee-row" key={fee.id || `fee-${feeIdx}`}>
                  <input
                    type="text"
                    value={fee.name || ''}
                    placeholder="Label (e.g. Full Tri)"
                    onChange={(e) => {
                      const steps = [...draft.steps];
                      const fees = [...(steps[idx].fees || [])];
                      fees[feeIdx] = { ...fees[feeIdx], name: e.target.value };
                      steps[idx] = { ...steps[idx], fees };
                      setDraft({ ...draft, steps });
                    }}
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={fee.amount ?? ''}
                    placeholder="Amount"
                    onChange={(e) => {
                      const steps = [...draft.steps];
                      const fees = [...(steps[idx].fees || [])];
                      fees[feeIdx] = {
                        ...fees[feeIdx],
                        amount: e.target.value === '' ? '' : Number(e.target.value),
                      };
                      steps[idx] = { ...steps[idx], fees };
                      setDraft({ ...draft, steps });
                    }}
                  />
                  <button
                    type="button"
                    className="btn-joinus-delete"
                    onClick={() => {
                      const steps = [...draft.steps];
                      const fees = [...(steps[idx].fees || [])];
                      steps[idx] = {
                        ...steps[idx],
                        fees: fees.filter((_, i) => i !== feeIdx),
                      };
                      setDraft({ ...draft, steps });
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}

              <input
                type="text"
                value={step.registrationHeading || ''}
                placeholder="Registration heading (optional)"
                onChange={(e) => {
                  const steps = [...draft.steps];
                  steps[idx] = { ...steps[idx], registrationHeading: e.target.value };
                  setDraft({ ...draft, steps });
                }}
              />
              <textarea
                rows={2}
                value={step.registrationBody || ''}
                placeholder="Registration body (optional)"
                onChange={(e) => {
                  const steps = [...draft.steps];
                  steps[idx] = { ...steps[idx], registrationBody: e.target.value };
                  setDraft({ ...draft, steps });
                }}
              />

              <button
                type="button"
                className="btn-joinus-delete"
                onClick={() =>
                  setDraft({
                    ...draft,
                    steps: draft.steps.filter((_, i) => i !== idx),
                  })
                }
              >
                Delete step
              </button>
            </div>
          ))}
        </JoinUsEditModal>
      )}
    </div>
  );
};

const JoinUsEditModal = ({ title, onClose, onSave, saving, children }) => (
  <div className="joinus-modal-overlay" onClick={onClose}>
    <div
      className="joinus-modal"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="joinus-edit-title"
    >
      <div className="joinus-modal-header">
        <h3 id="joinus-edit-title">{title}</h3>
        <button type="button" className="joinus-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="joinus-modal-body">{children}</div>
      <div className="joinus-modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  </div>
);

export default JoinUs;

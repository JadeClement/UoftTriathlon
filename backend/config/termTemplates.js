/**
 * Membership term templates — the signup options the club sells.
 *
 * Each academic cycle (starting each September) gets six terms:
 *   fall/winter, fall, winter, spring, spring/summer, summer
 *
 * The stored `year` column matches existing conventions:
 *   - fall/winter and fall use the starting academic year (Sep year)
 *   - winter, spring, spring/summer, summer use the calendar year they fall in
 *
 * Date ranges may overlap between options (e.g. spring/summer and summer).
 * Uniqueness is only on (term, year).
 */

/** @returns {number} Academic year that started the most recent September */
function getAcademicStartYear(date = new Date()) {
  const month = date.getMonth(); // 0 = Jan … 8 = Sep
  const calendarYear = date.getFullYear();
  return month >= 8 ? calendarYear : calendarYear - 1;
}

/** Build all signup terms for one academic cycle beginning in September of `Y`. */
function buildTermsForAcademicYear(academicStartYear) {
  const Y = academicStartYear;
  const Y1 = Y + 1;

  return [
    { term: 'fall/winter', year: Y, start_date: `${Y}-09-01`, end_date: `${Y1}-04-30` },
    { term: 'fall', year: Y, start_date: `${Y}-09-01`, end_date: `${Y}-12-31` },
    { term: 'winter', year: Y1, start_date: `${Y1}-01-01`, end_date: `${Y1}-04-30` },
    { term: 'spring', year: Y1, start_date: `${Y1}-05-01`, end_date: `${Y1}-06-30` },
    { term: 'spring/summer', year: Y1, start_date: `${Y1}-05-01`, end_date: `${Y1}-08-31` },
    { term: 'summer', year: Y1, start_date: `${Y1}-06-01`, end_date: `${Y1}-08-31` },
  ];
}

/**
 * @param {number[]} academicStartYears - e.g. [2025, 2026]
 * @returns {{ term: string, year: number, start_date: string, end_date: string }[]}
 */
function getTermsForAcademicYears(academicStartYears) {
  const seen = new Set();
  const rows = [];

  for (const y of academicStartYears) {
    for (const row of buildTermsForAcademicYear(y)) {
      const key = `${row.term}:${row.year}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }

  return rows;
}

/** Current academic year plus the next one (for early renewals). */
function getAcademicYearsToSeed(date = new Date()) {
  const start = getAcademicStartYear(date);
  return [start, start + 1];
}

const SIGNUP_TERM_SEASONS = ['fall/winter', 'fall', 'winter', 'spring', 'spring/summer', 'summer'];

module.exports = {
  getAcademicStartYear,
  buildTermsForAcademicYear,
  getTermsForAcademicYears,
  getAcademicYearsToSeed,
  SIGNUP_TERM_SEASONS,
};

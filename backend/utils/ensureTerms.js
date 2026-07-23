const {
  getAcademicYearsToSeed,
  getTermsForAcademicYears,
} = require('../config/termTemplates');
const logger = require('./logger');

/**
 * Idempotently create membership terms for the current and next academic cycle.
 * Safe to run on every server startup — never updates existing rows.
 */
async function ensureMembershipTerms(pool) {
  const academicYears = getAcademicYearsToSeed();
  const rows = getTermsForAcademicYears(academicYears);

  let created = 0;
  for (const row of rows) {
    const result = await pool.query(
      `INSERT INTO terms (term, year, start_date, end_date)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (term, year) DO NOTHING
       RETURNING id`,
      [row.term, row.year, row.start_date, row.end_date]
    );
    if (result.rowCount > 0) created += 1;
  }

  if (created > 0) {
    console.log(`✅ Auto-created ${created} membership term(s) for academic years ${academicYears.join(', ')}`);
  } else {
    logger.debug(`✅ Membership terms up to date (${rows.length} template rows checked)`);
  }

  return { created, checked: rows.length, academicYears };
}

module.exports = { ensureMembershipTerms };

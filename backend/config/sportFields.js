/**
 * Sport-specific field definitions for test results
 * Each sport has an array of field definitions that will be shown in the form
 */

const sportFields = {
  swim: [
    {
      key: 'average_hr',
      label: 'Average HR',
      type: 'number',
      placeholder: 'e.g., 150',
      helpText: 'Average heart rate in beats per minute'
    },
    {
      key: 'average_swolf',
      label: 'Average Swolf',
      type: 'number',
      placeholder: 'e.g., 35',
      helpText: 'Average Swolf score (time + strokes per length)'
    },
    {
      key: 'average_spm',
      label: 'Average Strokes per Minute (SPM / Cadence)',
      type: 'number',
      placeholder: 'e.g., 60',
      helpText: 'Average strokes per minute (also called cadence)'
    },
    {
      key: 'average_spl',
      label: 'Average Strokes per Length (SPL)',
      type: 'number',
      placeholder: 'e.g., 18',
      helpText: 'Average number of strokes per pool length'
    }
  ],
  bike: [
    {
      key: 'avg_watts',
      label: 'Average Watts',
      type: 'number',
      placeholder: 'e.g., 250',
      helpText: 'Average power output in watts'
    },
    {
      key: 'avg_rpm',
      label: 'Average RPM',
      type: 'number',
      placeholder: 'e.g., 90',
      helpText: 'Average cadence in revolutions per minute'
    },
    {
      key: 'distance',
      label: 'Distance',
      type: 'text',
      placeholder: 'e.g., 20km',
      helpText: 'Total distance'
    },
    {
      key: 'total_time',
      label: 'Total Time',
      type: 'text',
      placeholder: 'e.g., 45:00',
      helpText: 'Total time for the workout'
    }
  ],
  run: [
    {
      key: 'pace',
      label: 'Pace',
      type: 'text',
      placeholder: 'e.g., 6:30/mile or 4:00/km',
      helpText: 'Average pace per mile or kilometer'
    },
    {
      key: 'splits',
      label: 'Splits',
      type: 'array',
      placeholder: 'e.g., 6:25, 6:30, 6:35',
      helpText: 'Comma-separated split times'
    },
    {
      key: 'total_time',
      label: 'Total Time',
      type: 'text',
      placeholder: 'e.g., 20:15',
      helpText: 'Total time for the workout'
    },
    {
      key: 'distance',
      label: 'Distance',
      type: 'text',
      placeholder: 'e.g., 5K',
      helpText: 'Total distance'
    }
  ]
};

/**
 * Get field definitions for a specific sport
 * @param {string} sport - The sport name ('swim', 'bike', 'run')
 * @returns {Array} Array of field definitions
 */
function getFieldsForSport(sport) {
  return sportFields[sport] || [];
}

/**
 * Get all available sports
 * @returns {Array} Array of sport names
 */
function getAvailableSports() {
  return Object.keys(sportFields);
}

module.exports = {
  sportFields,
  getFieldsForSport,
  getAvailableSports
};


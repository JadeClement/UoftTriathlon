import React from 'react';
import { useAdminContext } from '../../context/AdminContext';

const AdminAttendance = () => {
  const {
    attendanceWorkouts,
    attendanceLoading,
    attendanceFilters,
    attendancePagination,
    handleAttendanceFilterChange,
    handleAttendancePageChange,
    loadAttendanceDetails,
    formatSignupTimeForDisplay,
  } = useAdminContext();

  return (
    <div className="admin-main-content" style={{ padding: '2rem' }}>
      <div className="attendance-section">
        <h2>Attendance Dashboard</h2>

        <div className="attendance-filters">
          <div className="filter-group">
            <label>Workout Type:</label>
            <select
              value={attendanceFilters.type}
              onChange={(e) => handleAttendanceFilterChange('type', e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="swim">Swim</option>
              <option value="bike">Bike</option>
              <option value="run">Run</option>
              <option value="brick">Brick</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Status:</label>
            <select
              value={attendanceFilters.status}
              onChange={(e) => handleAttendanceFilterChange('status', e.target.value)}
            >
              <option value="all">All</option>
              <option value="submitted">Submitted</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {attendanceLoading ? (
          <div className="loading">Loading attendance data...</div>
        ) : (
          <div className="attendance-table-container">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>Workout</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Attendance</th>
                  <th>Submitted By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {attendanceWorkouts.map((workout) => (
                  <tr key={workout.id} className="attendance-row">
                    <td className="workout-title">{workout.title}</td>
                    <td>
                      <span className={`workout-type-badge ${workout.workout_type?.toLowerCase()}`}>
                        {workout.workout_type}
                      </span>
                    </td>
                    <td>
                      {workout.workout_date && (
                        <div className="workout-date">
                          {new Date(workout.workout_date).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${workout.attendance_status}`}>
                        {workout.attendance_status === 'submitted' ? '✓ Submitted' : '⏳ Pending'}
                      </span>
                    </td>
                    <td>
                      {workout.attendance_status === 'submitted' ? (
                        <div className="attendance-stats">
                          <span className="attended-count">{workout.attended_count || 0} attended</span>
                          {workout.cancelled_count > 0 && (
                            <span className="cancelled-count">• {workout.cancelled_count} cancelled</span>
                          )}
                          {workout.late_count > 0 && (
                            <span className="late-count">• {workout.late_count} late</span>
                          )}
                        </div>
                      ) : (
                        <span className="no-attendance">No attendance recorded</span>
                      )}
                    </td>
                    <td>
                      {workout.submitted_by ? (
                        <div className="submitted-by">
                          <span>{workout.submitted_by}</span>
                          {workout.last_attendance_submitted && (
                            <div className="submitted-time">
                              {formatSignupTimeForDisplay(workout.last_attendance_submitted)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="not-submitted">-</span>
                      )}
                    </td>
                    <td>
                      <button className="view-details-btn" onClick={() => loadAttendanceDetails(workout.id)}>
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {attendancePagination.pages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => handleAttendancePageChange(attendancePagination.page - 1)}
                  disabled={attendancePagination.page <= 1}
                >
                  Previous
                </button>
                <span>
                  Page {attendancePagination.page} of {attendancePagination.pages}
                </span>
                <button
                  onClick={() => handleAttendancePageChange(attendancePagination.page + 1)}
                  disabled={attendancePagination.page >= attendancePagination.pages}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAttendance;

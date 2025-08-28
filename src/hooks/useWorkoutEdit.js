import { useState } from 'react';

export const useWorkoutEdit = (API_BASE_URL) => {
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    workoutType: '',
    workoutDate: '',
    workoutTime: '',
    content: '',
    capacity: ''
  });
  const [saving, setSaving] = useState(false);

  const startEdit = (workout) => {
    setEditingWorkout(workout.id);
    setEditForm({
      title: workout.title || '',
      workoutType: workout.workout_type || '',
      workoutDate: workout.workout_date ? workout.workout_date.split('T')[0] : '',
      workoutTime: workout.workout_time || '',
      content: workout.content || '',
      capacity: workout.capacity || ''
    });
  };

  const cancelEdit = () => {
    setEditingWorkout(null);
    setEditForm({
      title: '',
      workoutType: '',
      workoutDate: '',
      workoutTime: '',
      content: '',
      capacity: ''
    });
  };

  const updateField = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const saveWorkout = async (workoutId, onSuccess) => {
    setSaving(true);
    
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const requestBody = {
        title: editForm.title,
        workoutType: editForm.workoutType,
        workoutDate: editForm.workoutDate,
        workoutTime: editForm.workoutTime,
        content: editForm.content,
        capacity: editForm.capacity
      };
      
      console.log('🔍 Sending workout update with data:', requestBody);
      
      const response = await fetch(`${API_BASE_URL}/forum/posts/${workoutId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        setEditingWorkout(null);
        setSaving(false);
        
        // Call the success callback to refresh data
        if (onSuccess) {
          await onSuccess();
        }
        
        return { success: true };
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update workout');
      }
    } catch (error) {
      console.error('Error updating workout:', error);
      setSaving(false);
      return { success: false, error: error.message };
    }
  };

  return {
    editingWorkout,
    editForm,
    saving,
    startEdit,
    cancelEdit,
    updateField,
    saveWorkout
  };
};

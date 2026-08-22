export const WORKOUT_TYPES = [
  { value: 'spin', label: 'Spin' },
  { value: 'outdoor-ride', label: 'Outdoor Ride' },
  { value: 'run', label: 'Run' },
  { value: 'swim', label: 'Swim' },
  { value: 'brick', label: 'Brick (Bike + Run)' },
  { value: 'other', label: 'Other' },
];

export function getWorkoutTypeOptions(currentValue) {
  const options = [...WORKOUT_TYPES];
  if (currentValue && !options.some((option) => option.value === currentValue)) {
    const label = String(currentValue)
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    options.unshift({ value: currentValue, label });
  }
  return options;
}

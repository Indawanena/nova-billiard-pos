type CalculateAddedTimePlanInput = {
  currentPlannedDuration: number;
  elapsedMinutes: number;
  addedMinutes: number;
};

export type AddedTimePlan = {
  plannedDuration: number;
  addedMinutes: number;
  wasOpenSession: boolean;
};

export function calculateAddedTimePlan({
  currentPlannedDuration,
  elapsedMinutes,
  addedMinutes,
}: CalculateAddedTimePlanInput): AddedTimePlan {
  const normalizedAddedMinutes = Math.max(0, Math.floor(addedMinutes));
  const normalizedPlannedDuration = Math.max(0, Math.floor(currentPlannedDuration || 0));
  const normalizedElapsedMinutes = Math.max(0, Math.floor(elapsedMinutes || 0));

  if (normalizedPlannedDuration > 0) {
    return {
      plannedDuration: normalizedPlannedDuration + normalizedAddedMinutes,
      addedMinutes: normalizedAddedMinutes,
      wasOpenSession: false,
    };
  }

  return {
    plannedDuration: normalizedElapsedMinutes + normalizedAddedMinutes,
    addedMinutes: normalizedAddedMinutes,
    wasOpenSession: true,
  };
}

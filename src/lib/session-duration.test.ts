import { calculateAddedTimePlan } from './session-duration';

describe('calculateAddedTimePlan', () => {
  it('adds minutes to an existing planned session', () => {
    expect(calculateAddedTimePlan({
      currentPlannedDuration: 60,
      elapsedMinutes: 25,
      addedMinutes: 60,
    })).toEqual({
      plannedDuration: 120,
      addedMinutes: 60,
      wasOpenSession: false,
    });
  });

  it('turns an open session into a planned session with remaining added time', () => {
    expect(calculateAddedTimePlan({
      currentPlannedDuration: 0,
      elapsedMinutes: 25,
      addedMinutes: 60,
    })).toEqual({
      plannedDuration: 85,
      addedMinutes: 60,
      wasOpenSession: true,
    });
  });
});

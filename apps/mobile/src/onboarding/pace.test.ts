import { paceDescription } from './pace';

describe('paceDescription', () => {
  it('describes losing as a share of body weight per week', () => {
    expect(paceDescription('lose', 'conservative').params.pct).toBe(0.5);
    expect(paceDescription('lose', 'standard').params.pct).toBe(0.75);
    expect(paceDescription('lose', 'aggressive').params.pct).toBe(1);
  });

  it('describes gaining as a daily surplus', () => {
    expect(paceDescription('gain', 'conservative')).toEqual({ key: 'onboarding.pace.gain.desc', params: { pct: 5 } });
    expect(paceDescription('gain', 'standard').params.pct).toBe(10);
    expect(paceDescription('gain', 'aggressive').params.pct).toBe(15);
  });
});

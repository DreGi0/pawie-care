import { paymentDeadline, responseDeadline } from './deadlines.js';

// The initial values of §15, in minutes.
const RESPONSE_WINDOWS = { over72h: 24 * 60, from24hTo72h: 6 * 60, under24h: 60 };
const NOW = new Date('2026-11-02T10:00:00-06:00');
const hoursFromNow = (hours: number) => new Date(NOW.getTime() + hours * 60 * 60 * 1000);

describe('responseDeadline (RN-RES-06)', () => {
  it.each([
    [100, 24, 'more than 72 h to go: 24 h'],
    [72.01, 24, 'just over 72 h: 24 h'],
    [72, 6, 'exactly 72 h: the middle window'],
    [48, 6, 'between 24 h and 72 h: 6 h'],
    [24, 6, 'exactly 24 h: the middle window'],
    [23.99, 1, 'less than 24 h: 1 h'],
  ])('with %s h to go, ends %s h after the request (%s)', (lead, window) => {
    expect(responseDeadline(NOW, hoursFromNow(lead), RESPONSE_WINDOWS)).toEqual(
      hoursFromNow(window),
    );
  });

  it('never ends after the first slot starts', () => {
    expect(responseDeadline(NOW, hoursFromNow(0.5), RESPONSE_WINDOWS)).toEqual(hoursFromNow(0.5));
  });
});

describe('paymentDeadline (RN-RES-07)', () => {
  it('gives the owner the payment window', () => {
    expect(paymentDeadline(NOW, hoursFromNow(48), 120)).toEqual(hoursFromNow(2));
  });

  it('never ends after the first slot starts', () => {
    expect(paymentDeadline(NOW, hoursFromNow(1.5), 120)).toEqual(hoursFromNow(1.5));
  });
});

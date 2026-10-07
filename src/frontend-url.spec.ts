import { frontendUrl } from './frontend-url';
describe('Official frontend domain', () => {
  const original = process.env.FRONTEND_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = original;
  });
  it.each([
    'https://www.luxeevents.fun/path',
    'https://luxeevents.fun',
    'https://www.nakathata.lk',
    'javascript:alert(1)',
    'invalid',
  ])('uses canonical for %s', (value) => {
    process.env.FRONTEND_URL = value;
    expect(frontendUrl()).toBe('https://nakathata.lk');
  });
  it('defaults to the official domain', () => {
    delete process.env.FRONTEND_URL;
    expect(frontendUrl()).toBe('https://nakathata.lk');
  });
  it('preserves local development origins but strips paths', () => {
    process.env.FRONTEND_URL = 'http://localhost:3000/path';
    expect(frontendUrl()).toBe('http://localhost:3000');
  });
});

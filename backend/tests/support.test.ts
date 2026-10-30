import { expect, it } from 'vitest';
import { validate, version } from 'uuid';
import { SystemSupport } from '../src/adapters/driven/support/system-support';

it('generates unique UUIDv7 identifiers and persistable UTC timestamps', () => {
    const support = new SystemSupport();
    const ids = Array.from({ length: 1000 }, () => support.id());
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(id => validate(id) && version(id) === 7)).toBe(true);
    const before = Date.now();
    const at = support.now();
    expect(at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    expect(Date.parse(at)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(at)).toBeLessThanOrEqual(Date.now());
});

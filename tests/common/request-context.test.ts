import { requestContextMiddleware } from '../../src/middleware/request-context.js';

describe('requestContextMiddleware', () => {
  it('uses provided x-request-id header', () => {
    const req = {
      headers: {
        'x-request-id': 'req-123',
      },
    } as any;

    const headers: Record<string, string> = {};
    const res = {
      locals: {},
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
    } as any;

    const next = jest.fn();
    requestContextMiddleware(req, res, next);

    expect(req.requestId).toBe('req-123');
    expect(res.locals.requestId).toBe('req-123');
    expect(headers['X-Request-Id']).toBe('req-123');
    expect(next).toHaveBeenCalled();
  });

  it('generates request id when missing', () => {
    const req = { headers: {} } as any;
    const headers: Record<string, string> = {};
    const res = {
      locals: {},
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
    } as any;

    const next = jest.fn();
    requestContextMiddleware(req, res, next);

    expect(typeof req.requestId).toBe('string');
    expect(req.requestId.length).toBeGreaterThan(0);
    expect(res.locals.requestId).toBe(req.requestId);
    expect(headers['X-Request-Id']).toBe(req.requestId);
    expect(next).toHaveBeenCalled();
  });
});

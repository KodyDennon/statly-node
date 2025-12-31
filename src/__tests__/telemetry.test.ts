import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Statly } from '../index';
import { SpanStatus } from '../span';

describe('Telemetry', () => {
    beforeEach(async () => {
        await Statly.close();
    });

    it('should capture manual spans', async () => {
        Statly.init({ dsn: 'https://key@statly.live/org', debug: true });
        const client = Statly.getClient();
        if (!client) throw new Error('Client not initialized');

        // Use a more reliable way to mock the internal sendEvent
        const sendSpy = vi.spyOn(client as any, 'sendEvent').mockImplementation(() => 'test-id');

        const result = await Statly.trace('test-span', async (span) => {
            span.setTag('foo', 'bar');
            return 42;
        });

        expect(result).toBe(42);
        expect(sendSpy).toHaveBeenCalled();
        
        const event = sendSpy.mock.calls[0][0] as any;
        expect(event.level).toBe('span');
        expect(event.span.name).toBe('test-span');
        expect(event.span.tags.foo).toBe('bar');
    });

    it('should handle errors in traces', async () => {
        Statly.init({ dsn: 'https://key@statly.live/org' });
        const client = Statly.getClient();
        if (!client) throw new Error('Client not initialized');

        const sendSpy = vi.spyOn(client as any, 'sendEvent').mockImplementation(() => 'test-id');

        try {
            await Statly.trace('failing-span', () => {
                throw new Error('trace error');
            });
        } catch (e) {
            // expected
        }

        expect(sendSpy).toHaveBeenCalled();
        const event = sendSpy.mock.calls[0][0] as any;
        expect(event.span.status).toBe(SpanStatus.ERROR);
        expect(event.span.tags.error).toBe('true');
    });
});

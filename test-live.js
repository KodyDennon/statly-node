/**
 * Live Integration Test
 * Tests the SDK against the running dev server
 */

import { Statly } from '@statly/observe';

// Use environment variable or provide your test DSN
const DSN = process.env.STATLY_DSN || 'https://sk_live_test1234@localhost:3000/test-org';

console.log('🔴 LIVE SDK Test - Connecting to dev server\n');
console.log('Using DSN:', DSN);
console.log('Note: Ensure dev server is running at localhost:3000\n');

// Initialize SDK
Statly.init({
    dsn: DSN,
    environment: 'test',
    release: '1.0.0-live-test',
    debug: true,
});

console.log('Sending test event...\n');

// Send a test error
const eventId = Statly.captureException(new Error('SDK Live Integration Test'), {
    tags: {
        test: 'live-integration',
        source: 'sdk-test-script',
    },
    extra: {
        testTimestamp: new Date().toISOString(),
        purpose: 'Validating prefix-based DSN authentication',
    },
});

console.log('Event ID:', eventId);

// Give it a moment to queue
setTimeout(async () => {
    console.log('\nFlushing events to server...');
    await Statly.flush();
    await Statly.close();

    console.log('\n✅ Test complete!');
    console.log('Check the Observe dashboard to verify the event was received.');
}, 1000);

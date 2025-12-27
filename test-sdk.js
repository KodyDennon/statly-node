/**
 * SDK Test Application
 * Tests the Observe SDK with prefix-based DSN
 */

import { Statly } from '@statly/observe';

// Test DSN with prefix format (16 characters: sk_live_ + 8 hex chars)
const TEST_DSN = 'https://sk_live_test1234@localhost:3000/test-org';

console.log('🧪 Testing Statly Observe SDK\n');

// Test 1: Initialize SDK
console.log('Test 1: SDK Initialization');
try {
    Statly.init({
        dsn: TEST_DSN,
        environment: 'test',
        release: '1.0.0-test',
        debug: true,
    });
    console.log('✅ SDK initialized successfully\n');
} catch (error) {
    console.error('❌ SDK initialization failed:', error);
    process.exit(1);
}

// Test 2: Capture Exception
console.log('Test 2: Capture Exception');
try {
    const eventId = Statly.captureException(new Error('Test error from SDK test'), {
        extra: {
            testId: 'test-2',
            timestamp: new Date().toISOString(),
        },
    });
    console.log('✅ Exception captured, eventId:', eventId, '\n');
} catch (error) {
    console.error('❌ Exception capture failed:', error);
}

// Test 3: Capture Message
console.log('Test 3: Capture Message');
try {
    const eventId = Statly.captureMessage('Test message from SDK test', 'info');
    console.log('✅ Message captured, eventId:', eventId, '\n');
} catch (error) {
    console.error('❌ Message capture failed:', error);
}

// Test 4: Set User Context
console.log('Test 4: Set User Context');
try {
    Statly.setUser({
        id: 'test-user-123',
        email: 'test@example.com',
        username: 'testuser',
    });
    console.log('✅ User context set\n');
} catch (error) {
    console.error('❌ User context failed:', error);
}

// Test 5: Add Tags
console.log('Test 5: Add Tags');
try {
    Statly.setTags({
        environment: 'test',
        version: '1.0.0',
    });
    console.log('✅ Tags set\n');
} catch (error) {
    console.error('❌ Tags failed:', error);
}

// Test 6: Add Breadcrumb
console.log('Test 6: Add Breadcrumb');
try {
    Statly.addBreadcrumb({
        category: 'test',
        message: 'Test breadcrumb',
        level: 'info',
    });
    console.log('✅ Breadcrumb added\n');
} catch (error) {
    console.error('❌ Breadcrumb failed:', error);
}

// Test 7: Capture with all context
console.log('Test 7: Capture with full context');
try {
    const eventId = Statly.captureException(new Error('Test with full context'), {
        tags: { contextTest: 'true' },
        extra: { contextData: 'Additional context' },
    });
    console.log('✅ Full context exception captured, eventId:', eventId, '\n');
} catch (error) {
    console.error('❌ Full context capture failed:', error);
}

// Test 8: Flush events
console.log('Test 8: Flush Events');
Statly.flush()
    .then(() => {
        console.log('✅ Events flushed\n');

        // Test 9: Close SDK
        console.log('Test 9: Close SDK');
        return Statly.close();
    })
    .then(() => {
        console.log('✅ SDK closed successfully\n');
        console.log('✅ All SDK tests completed successfully!');
    })
    .catch((error) => {
        console.error('❌ Flush/close failed:', error);
        process.exit(1);
    });

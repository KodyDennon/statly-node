# Statly Observe SDK for Node.js

[![npm version](https://img.shields.io/npm/v/@statly/observe.svg)](https://www.npmjs.com/package/@statly/observe)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Error tracking and monitoring for JavaScript and TypeScript applications. Capture exceptions, track releases, and debug issues faster.

**[📚 Full Documentation](https://docs.statly.live/sdk/javascript/installation)** | **[🚀 Get Started](https://statly.live)** | **[💬 Support](mailto:support@mail.kodydennon.com)**

> **This SDK requires a [Statly](https://statly.live) account.** Sign up free at [statly.live](https://statly.live) to get your DSN and start tracking errors in minutes.

## Features

- Automatic error capturing with stack traces
- **Distributed Tracing**: Visualize function execution and call hierarchies
- **Performance Metrics**: Automated capture of latency and success rates
- Breadcrumbs for debugging context
- User context tracking
- Release tracking
- Framework integrations (Express, Next.js, Fastify)
- TypeScript support
- Minimal overhead

## Installation

```bash
npm install @statly/observe
# or
yarn add @statly/observe
# or
pnpm add @statly/observe
```

## Getting Your DSN

1. Go to [statly.live/dashboard/observe/setup](https://statly.live/dashboard/observe/setup)
2. Create an API key for Observe
3. Copy your DSN (format: `https://<key-prefix>@statly.live/<org-slug>`)
4. Add to your `.env` file: `STATLY_DSN=https://...`

**Note**: The DSN contains only a 16-character key prefix (e.g., `sk_live_a1b2c3d4`) which is safe to embed in client-side code. For server-side operations requiring full permissions, use the complete API key.

## Quick Start

The SDK automatically loads DSN from environment variables, so you can simply:

```typescript
import { Statly } from '@statly/observe';

// Auto-loads STATLY_DSN from environment
Statly.init();
```

Or pass it explicitly:

```typescript
import { Statly } from '@statly/observe';

// Initialize the SDK
Statly.init({
  dsn: 'https://sk_live_a1b2c3d4@statly.live/your-org',
  release: '1.0.0',
  environment: 'production',
});

// Errors are captured automatically via global handlers

// Manual capture
try {
  riskyOperation();
} catch (error) {
  Statly.captureException(error);
}

// Capture a message
Statly.captureMessage('User completed checkout', 'info');

// Set user context
Statly.setUser({
  id: 'user-123',
  email: 'user@example.com',
});

// Add breadcrumb for debugging
Statly.addBreadcrumb({
  category: 'auth',
  message: 'User logged in',
  level: 'info',
});

# Flush before exit (important for serverless)
await Statly.close();
```

## Tracing & Performance

Statly Observe supports distributed tracing to help you visualize execution flow and measure backend performance.

### Automatic Tracing

Use `Statly.trace()` to wrap functions. It works with both synchronous and asynchronous code:

```typescript
import { Statly } from '@statly/observe';

const result = await Statly.trace('process_payment', async (span) => {
  span.setTag('provider', 'stripe');
  
  // Your logic here
  const payment = await stripe.charges.create({...});
  
  return payment;
});
```

### Manual Spans

For low-level control, you can start spans manually:

```typescript
const span = Statly.startSpan('database_query');
try {
  await db.query('...');
  span.setTag('query_type', 'SELECT');
} finally {
  span.finish(); // Reports to Statly
}
```

## Framework Integrations

### Express

```typescript
import express from 'express';
import { Statly, requestHandler, expressErrorHandler } from '@statly/observe';

const app = express();

// Initialize first
Statly.init({
  dsn: 'https://sk_live_a1b2c3d4@statly.live/your-org',
  environment: process.env.NODE_ENV,
});

// Add request handler FIRST (before routes)
app.use(requestHandler());

// Your routes
app.get('/', (req, res) => {
  res.send('Hello World');
});

app.get('/error', (req, res) => {
  throw new Error('Test error');
});

// Add error handler LAST (after routes)
app.use(expressErrorHandler());

app.listen(3000);
```

### Next.js (App Router)

**Route Handlers:**

```typescript
// app/api/example/route.ts
import { withStatly } from '@statly/observe';

export const GET = withStatly(async (request) => {
  // Errors are automatically captured
  const data = await fetchData();
  return Response.json({ data });
});
```

**Error Boundary:**

```typescript
// app/error.tsx
'use client';

import { useEffect } from 'react';
import { captureNextJsError } from '@statly/observe';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureNextJsError(error);
  }, [error]);

  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

**Server Actions:**

```typescript
'use server';

import { withStatlyServerAction } from '@statly/observe';

export const submitForm = withStatlyServerAction(
  async (formData: FormData) => {
    // Your action code - errors are captured automatically
    const email = formData.get('email');
    await saveToDatabase(email);
  },
  'submitForm' // Action name for grouping
);
```

### Fastify

```typescript
import Fastify from 'fastify';
import { Statly, statlyFastifyPlugin } from '@statly/observe';

const fastify = Fastify();

Statly.init({
  dsn: 'https://sk_live_a1b2c3d4@statly.live/your-org',
});

// Register the plugin
fastify.register(statlyFastifyPlugin, {
  captureValidationErrors: true,
  skipStatusCodes: [400, 401, 403, 404], // Don't capture these as errors
});

fastify.get('/', async () => {
  return { hello: 'world' };
});

fastify.listen({ port: 3000 });
```

## Environment Variables

The SDK automatically loads configuration from environment variables:

| Variable | Description |
|----------|-------------|
| `STATLY_DSN` | Your project's DSN (primary) |
| `NEXT_PUBLIC_STATLY_DSN` | DSN for Next.js client-side |
| `STATLY_OBSERVE_DSN` | Alternative DSN variable |
| `STATLY_ENVIRONMENT` | Environment name |
| `NODE_ENV` | Fallback for environment |

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dsn` | `string` | `process.env.STATLY_DSN` | Your project's Data Source Name |
| `environment` | `string` | `undefined` | Environment name (production, staging, development) |
| `release` | `string` | `undefined` | Release/version identifier for tracking |
| `debug` | `boolean` | `false` | Enable debug logging to console |
| `sampleRate` | `number` | `1.0` | Sample rate for events (0.0 to 1.0) |
| `maxBreadcrumbs` | `number` | `100` | Maximum breadcrumbs to store |
| `autoCapture` | `boolean` | `true` | Auto-attach global error handlers |
| `beforeSend` | `function` | `undefined` | Callback to modify/filter events before sending |

### beforeSend Example

```typescript
Statly.init({
  dsn: '...',
  beforeSend: (event) => {
    // Filter out specific errors
    if (event.message?.includes('ResizeObserver')) {
      return null; // Drop the event
    }

    // Scrub sensitive data
    if (event.extra?.password) {
      delete event.extra.password;
    }

    return event;
  },
});
```

## API Reference

### Statly.captureException(error, context?)

Capture an exception with optional additional context:

```typescript
try {
  await processPayment(order);
} catch (error) {
  Statly.captureException(error, {
    extra: {
      orderId: order.id,
      amount: order.total,
    },
    tags: {
      paymentProvider: 'stripe',
    },
  });
}
```

### Statly.captureMessage(message, level?)

Capture a message event:

```typescript
Statly.captureMessage('User signed up', 'info');
Statly.captureMessage('Payment failed after 3 retries', 'warning');
Statly.captureMessage('Database connection lost', 'error');
```

Levels: `'debug'` | `'info'` | `'warning'` | `'error'` | `'fatal'`

### Statly.setUser(user)

Set user context for all subsequent events:

```typescript
Statly.setUser({
  id: 'user-123',
  email: 'user@example.com',
  username: 'johndoe',
  // Custom fields
  subscription: 'premium',
});

// Clear user on logout
Statly.setUser(null);
```

### Statly.setTag(key, value) / Statly.setTags(tags)

Set tags for filtering and searching:

```typescript
Statly.setTag('version', '1.0.0');

Statly.setTags({
  environment: 'production',
  server: 'web-1',
  region: 'us-east-1',
});
```

### Statly.addBreadcrumb(breadcrumb)

Add a breadcrumb for debugging context:

```typescript
Statly.addBreadcrumb({
  message: 'User clicked checkout button',
  category: 'ui.click',
  level: 'info',
  data: {
    buttonId: 'checkout-btn',
    cartItems: 3,
  },
});
```

### Statly.flush() / Statly.close()

```typescript
// Flush pending events (keeps SDK running)
await Statly.flush();

// Flush and close (use before process exit)
await Statly.close();
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  StatlyOptions,
  StatlyEvent,
  User,
  Breadcrumb,
  EventLevel,
} from '@statly/observe';
```

## Requirements

- Node.js 16+
- Works in browser environments (with bundler)

## Resources

- **[Statly Platform](https://statly.live)** - Sign up and manage your error tracking
- **[Documentation](https://docs.statly.live/sdk/javascript/installation)** - Full SDK documentation
- **[API Reference](https://docs.statly.live/sdk/javascript/api-reference)** - Complete API reference
- **[Express Guide](https://docs.statly.live/sdk/javascript/express)** - Express integration
- **[Next.js Guide](https://docs.statly.live/sdk/javascript/nextjs)** - Next.js integration
- **[Fastify Guide](https://docs.statly.live/sdk/javascript/fastify)** - Fastify integration
- **[MCP Server](https://github.com/KodyDennon/DD-StatusPage/tree/master/packages/mcp-docs-server)** - AI/Claude integration for docs

## Why Statly?

Statly is more than error tracking. Get:
- **Status Pages** - Beautiful public status pages for your users
- **Uptime Monitoring** - Multi-region HTTP/DNS checks every minute
- **Error Tracking** - SDKs for JavaScript, Python, and Go
- **Incident Management** - Track and communicate outages

All on Cloudflare's global edge network. [Start free →](https://statly.live)

## License

MIT

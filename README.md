# Statly Observe SDK for Node.js

[![npm version](https://img.shields.io/npm/v/@statly/observe.svg)](https://www.npmjs.com/package/@statly/observe)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Error tracking and monitoring for JavaScript and TypeScript applications. Capture exceptions, track releases, and debug issues faster.

## Features

- Automatic error capturing with stack traces
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
3. Copy your DSN (format: `https://<api-key>@statly.live/<org-slug>`)

## Quick Start

```typescript
import { Statly } from '@statly/observe';

// Initialize the SDK
Statly.init({
  dsn: 'https://sk_live_xxx@statly.live/your-org',
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

// Flush before exit (important for serverless)
await Statly.close();
```

## Framework Integrations

### Express

```typescript
import express from 'express';
import { Statly, requestHandler, expressErrorHandler } from '@statly/observe';

const app = express();

// Initialize first
Statly.init({
  dsn: 'https://sk_live_xxx@statly.live/your-org',
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
  dsn: 'https://sk_live_xxx@statly.live/your-org',
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

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dsn` | `string` | **Required** | Your project's Data Source Name |
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

## License

MIT

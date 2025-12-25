# Statly Observe SDK for Node.js

Error tracking and monitoring for JavaScript and TypeScript applications.

## Installation

```bash
npm install @statly/observe
# or
yarn add @statly/observe
# or
pnpm add @statly/observe
```

## Quick Start

```typescript
import { Statly } from '@statly/observe';

// Initialize the SDK (get your DSN from statly.live/dashboard/observe/setup)
Statly.init({
  dsn: 'https://sk_live_xxx@statly.live/your-org',
  release: '1.0.0',
  environment: 'production',
});

// Errors are captured automatically

// Manual capture
try {
  riskyOperation();
} catch (error) {
  Statly.captureException(error);
}

// Capture a message
Statly.captureMessage('Something happened', 'warning');

// Set user context
Statly.setUser({
  id: 'user-123',
  email: 'user@example.com',
});

// Add breadcrumb
Statly.addBreadcrumb({
  category: 'auth',
  message: 'User logged in',
});

// Flush before exit
await Statly.close();
```

## Express Integration

```typescript
import express from 'express';
import { Statly, requestHandler, expressErrorHandler } from '@statly/observe';

const app = express();

// Initialize Statly
Statly.init({ dsn: '...' });

// Add request handler first
app.use(requestHandler());

// Your routes
app.get('/', (req, res) => {
  res.send('Hello World');
});

// Add error handler last
app.use(expressErrorHandler());

app.listen(3000);
```

## Next.js Integration

### App Router (Route Handlers)

```typescript
// app/api/example/route.ts
import { withStatly } from '@statly/observe';

export const GET = withStatly(async (request) => {
  // Your handler code
  return Response.json({ data: 'ok' });
});
```

### Error Boundary

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

  return <button onClick={reset}>Try again</button>;
}
```

### Server Actions

```typescript
'use server';

import { withStatlyServerAction } from '@statly/observe';

export const submitForm = withStatlyServerAction(
  async (formData: FormData) => {
    // Your action code
  },
  'submitForm'
);
```

## Fastify Integration

```typescript
import Fastify from 'fastify';
import { Statly, statlyFastifyPlugin } from '@statly/observe';

const fastify = Fastify();

// Initialize Statly
Statly.init({ dsn: '...' });

// Register the plugin
fastify.register(statlyFastifyPlugin, {
  captureValidationErrors: true,
  skipStatusCodes: [400, 401, 403, 404],
});

fastify.get('/', async () => {
  return { hello: 'world' };
});

fastify.listen({ port: 3000 });
```

## Configuration

### Statly.init() Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dsn` | `string` | Required | Data Source Name for your project |
| `environment` | `string` | `undefined` | Environment name |
| `release` | `string` | `undefined` | Release version |
| `debug` | `boolean` | `false` | Enable debug logging |
| `sampleRate` | `number` | `1.0` | Sample rate (0.0 to 1.0) |
| `maxBreadcrumbs` | `number` | `100` | Max breadcrumbs to store |
| `beforeSend` | `function` | `undefined` | Callback to modify/filter events |

## API Reference

### Statly.captureException(error, context?)

Capture an exception:

```typescript
try {
  throw new Error('Something went wrong');
} catch (error) {
  Statly.captureException(error, {
    extra: { userId: '123' }
  });
}
```

### Statly.captureMessage(message, level?)

Capture a message:

```typescript
Statly.captureMessage('User signed up', 'info');
```

### Statly.setUser(user)

Set user context:

```typescript
Statly.setUser({
  id: 'user-123',
  email: 'user@example.com',
  username: 'johndoe',
});

// Clear user
Statly.setUser(null);
```

### Statly.setTag(key, value) / Statly.setTags(tags)

Set tags:

```typescript
Statly.setTag('version', '1.0.0');
Statly.setTags({
  environment: 'production',
  server: 'web-1',
});
```

### Statly.addBreadcrumb(breadcrumb)

Add a breadcrumb:

```typescript
Statly.addBreadcrumb({
  message: 'User clicked button',
  category: 'ui',
  level: 'info',
  data: { buttonId: 'submit' },
});
```

### Statly.flush() / Statly.close()

Flush pending events:

```typescript
// Flush and continue
await Statly.flush();

// Flush and close (use before exit)
await Statly.close();
```

## TypeScript

Full TypeScript support is included. Types are exported:

```typescript
import type {
  StatlyOptions,
  User,
  Breadcrumb,
  EventLevel,
} from '@statly/observe';
```

## License

MIT

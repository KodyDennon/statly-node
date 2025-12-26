#!/usr/bin/env node
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function print(msg: string) {
  console.log(msg);
}

function printHeader() {
  print('');
  print(`${COLORS.cyan}${COLORS.bright}  _____ _        _   _       `);
  print(`${COLORS.cyan} / ____| |      | | | |      `);
  print(`${COLORS.cyan}| (___ | |_ __ _| |_| |_   _ `);
  print(`${COLORS.cyan} \\___ \\| __/ _\` | __| | | | |`);
  print(`${COLORS.cyan} ____) | || (_| | |_| | |_| |`);
  print(`${COLORS.cyan}|_____/ \\__\\__,_|\\__|_|\\__, |`);
  print(`${COLORS.cyan}                        __/ |`);
  print(`${COLORS.cyan}                       |___/ ${COLORS.reset}`);
  print('');
  print(`${COLORS.bright}Statly Observe SDK Setup${COLORS.reset}`);
  print(`${COLORS.dim}Error tracking for JavaScript applications${COLORS.reset}`);
  print('');
}

function printStep(num: number, msg: string) {
  print(`${COLORS.green}[${num}]${COLORS.reset} ${msg}`);
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${COLORS.yellow}?${COLORS.reset} ${question} `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function detectFramework(): string | null {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['next']) return 'nextjs';
      if (deps['express']) return 'express';
      if (deps['fastify']) return 'fastify';
    } catch {
      // Ignore parse errors
    }
  }
  return null;
}

function generateCode(dsn: string, framework: string | null): string {
  if (framework === 'express') {
    return `// Add to your main server file (e.g., app.js or index.js)
import express from 'express';
import { Statly, requestHandler, expressErrorHandler } from '@statly/observe';

const app = express();

// Initialize Statly FIRST
Statly.init({
  dsn: '${dsn}',
  environment: process.env.NODE_ENV || 'development',
  release: process.env.npm_package_version,
});

// Add request handler before routes
app.use(requestHandler());

// Your routes here...

// Add error handler LAST (after all routes)
app.use(expressErrorHandler());

app.listen(3000);
`;
  }

  if (framework === 'nextjs') {
    return `// Create instrumentation.ts in your project root
// instrumentation.ts
import { Statly } from '@statly/observe';

export function register() {
  Statly.init({
    dsn: '${dsn}',
    environment: process.env.NODE_ENV || 'development',
  });
}

// For API routes, wrap handlers:
// app/api/example/route.ts
import { withStatly } from '@statly/observe';

export const GET = withStatly(async (request) => {
  return Response.json({ ok: true });
});

// For error boundaries:
// app/error.tsx
'use client';
import { useEffect } from 'react';
import { captureNextJsError } from '@statly/observe';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { captureNextJsError(error); }, [error]);
  return <button onClick={reset}>Try again</button>;
}
`;
  }

  if (framework === 'fastify') {
    return `// Add to your Fastify server file
import Fastify from 'fastify';
import { Statly, statlyFastifyPlugin } from '@statly/observe';

const fastify = Fastify();

// Initialize Statly
Statly.init({
  dsn: '${dsn}',
  environment: process.env.NODE_ENV || 'development',
});

// Register the plugin
await fastify.register(statlyFastifyPlugin, {
  captureValidationErrors: true,
  skipStatusCodes: [400, 401, 403, 404],
});

fastify.get('/', async () => {
  return { hello: 'world' };
});

await fastify.listen({ port: 3000 });
`;
  }

  // Generic setup
  return `// Add to your application entry point
import { Statly } from '@statly/observe';

// Initialize the SDK
Statly.init({
  dsn: '${dsn}',
  environment: process.env.NODE_ENV || 'development',
  release: '1.0.0', // Your app version
});

// Errors are captured automatically

// Manual capture example
try {
  riskyOperation();
} catch (error) {
  Statly.captureException(error);
}

// Set user context (after login)
Statly.setUser({
  id: 'user-123',
  email: 'user@example.com',
});

// Flush before exit (important for serverless)
await Statly.close();
`;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'init') {
    printHeader();

    print(`${COLORS.dim}Get your DSN from: https://statly.live/dashboard/observe/setup${COLORS.reset}`);
    print('');

    const dsn = await prompt('Enter your DSN:');

    if (!dsn) {
      print(`${COLORS.yellow}No DSN provided. Get one at https://statly.live${COLORS.reset}`);
      process.exit(1);
    }

    // Validate DSN format
    if (!dsn.match(/^https:\/\/[^@]+@statly\.live\/.+$/)) {
      print(`${COLORS.yellow}Warning: DSN format looks incorrect.${COLORS.reset}`);
      print(`${COLORS.dim}Expected format: https://<api-key>@statly.live/<org-slug>${COLORS.reset}`);
    }

    print('');
    printStep(1, 'Detecting your framework...');

    const framework = detectFramework();
    if (framework) {
      print(`   ${COLORS.green}✓${COLORS.reset} Detected: ${COLORS.bright}${framework}${COLORS.reset}`);
    } else {
      print(`   ${COLORS.dim}No framework detected, using generic setup${COLORS.reset}`);
    }

    print('');
    printStep(2, 'Generated setup code:');
    print('');
    print(`${COLORS.dim}${'─'.repeat(50)}${COLORS.reset}`);
    print(generateCode(dsn, framework));
    print(`${COLORS.dim}${'─'.repeat(50)}${COLORS.reset}`);
    print('');

    printStep(3, 'Next steps:');
    print(`   ${COLORS.dim}1.${COLORS.reset} Copy the code above into your application`);
    print(`   ${COLORS.dim}2.${COLORS.reset} Set your environment variables`);
    print(`   ${COLORS.dim}3.${COLORS.reset} Trigger a test error to verify`);
    print('');
    print(`${COLORS.green}✓${COLORS.reset} Setup complete! View errors at ${COLORS.cyan}https://statly.live/dashboard/observe${COLORS.reset}`);
    print('');
    print(`${COLORS.dim}Documentation: https://docs.statly.live/sdk/javascript/installation${COLORS.reset}`);
    print('');
  } else {
    print(`${COLORS.bright}Statly Observe CLI${COLORS.reset}`);
    print('');
    print('Usage:');
    print(`  npx @statly/observe init    ${COLORS.dim}Setup Statly in your project${COLORS.reset}`);
    print('');
    print('Get started at https://statly.live');
  }
}

main().catch(console.error);

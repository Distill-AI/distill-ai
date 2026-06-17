import { Link } from 'react-router-dom';

const stack = [
  { label: 'NestJS v10', desc: 'Express-based API with TypeORM, Swagger, Pino logging' },
  { label: 'PostgreSQL', desc: 'Primary database via TypeORM with migration support' },
  { label: 'Redis + Bull', desc: 'Distributed job queue with DLQ and exponential backoff' },
  { label: 'Scheduler', desc: 'Timing-wheel and min-heap based deferred job enqueue' },
  { label: 'SSE', desc: 'Server-Sent Events bridge for real-time client updates' },
  { label: 'React + Vite', desc: 'Frontend with Tailwind CSS, React Query, and React Router' },
];

export function Home() {
  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">NestJS Fullstack Starter</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          A production-ready starter with NestJS, PostgreSQL, Redis, Bull queues, and React. Clone
          it, rename the modules, and ship your product — the plumbing is already done.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href="/api/docs"
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border bg-white p-5 shadow-sm hover:border-indigo-400 hover:shadow transition-all"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 mb-1">API</p>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Swagger Docs →</h2>
          <p className="text-sm text-gray-500">Browse and test all API endpoints at /api/docs.</p>
        </a>

        <Link
          to="/benchmark"
          className="rounded-lg border bg-white p-5 shadow-sm hover:border-indigo-400 hover:shadow transition-all"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 mb-1">
            Example
          </p>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Benchmark →</h2>
          <p className="text-sm text-gray-500">
            Compare min-heap vs timing-wheel insert and drain performance.
          </p>
        </Link>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">
          What's included
        </h2>
        <ul className="space-y-3">
          {stack.map(({ label, desc }) => (
            <li key={label} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              <span>
                <span className="font-medium text-gray-900 text-sm">{label}</span>
                <span className="text-gray-500 text-sm"> — {desc}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Getting started</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
          <li>
            Copy <code className="font-mono bg-gray-100 rounded px-1">.env.example</code> to{' '}
            <code className="font-mono bg-gray-100 rounded px-1">.env</code> and fill in your
            credentials
          </li>
          <li>
            Run <code className="font-mono bg-gray-100 rounded px-1">docker compose up -d</code> to
            start Postgres and Redis
          </li>
          <li>
            Run <code className="font-mono bg-gray-100 rounded px-1">pnpm migration:run</code> to
            apply schema
          </li>
          <li>
            Run <code className="font-mono bg-gray-100 rounded px-1">pnpm dev</code> to start the
            API and worker
          </li>
          <li>
            Delete or repurpose the reference modules (
            <code className="font-mono bg-gray-100 rounded px-1">jobs</code>,{' '}
            <code className="font-mono bg-gray-100 rounded px-1">scheduler</code>,{' '}
            <code className="font-mono bg-gray-100 rounded px-1">dlq</code>) as you build
          </li>
        </ol>
      </div>
    </div>
  );
}

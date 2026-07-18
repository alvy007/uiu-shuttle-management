import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';

export default function ConnectionTestPage() {
  return (
    <Suspense fallback={<ConnectionTestLoading />}>
      <ConnectionTestContent />
    </Suspense>
  );
}

async function ConnectionTestContent() {
  const supabase = await createClient();

  const { data: routes, error } = await supabase
    .from('routes')
    .select('id, short_name, origin, destination, is_active')
    .order('id', {
      ascending: true,
    });

  const connectionSuccessful = !error;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
          <div className="mb-8">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-blue-400">
              UIU Shuttle Management
            </p>

            <h1 className="text-3xl font-black sm:text-4xl">
              Supabase Connection Test
            </h1>

            <p className="mt-3 max-w-2xl text-slate-400">
              This page verifies that the Admin Panel can securely connect to
              the existing shuttle management database.
            </p>
          </div>

          <div
            className={`mb-8 rounded-2xl border p-5 ${
              connectionSuccessful
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : 'border-red-500/40 bg-red-500/10'
            }`}
          >
            <p
              className={`text-lg font-extrabold ${
                connectionSuccessful ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {connectionSuccessful
                ? 'Supabase connection successful'
                : 'Supabase connection failed'}
            </p>

            <p className="mt-2 text-sm text-slate-300">
              {connectionSuccessful
                ? `${routes?.length ?? 0} route(s) loaded from the database.`
                : error?.message || 'Unknown database error.'}
            </p>
          </div>

          {connectionSuccessful ? (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-extrabold">Available Routes</h2>

                <span className="rounded-full bg-blue-500/15 px-4 py-2 text-sm font-bold text-blue-300">
                  {routes?.length ?? 0} routes
                </span>
              </div>

              {(routes?.length ?? 0) > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {(routes ?? []).map(route => (
                    <article
                      key={route.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <span className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-black uppercase">
                          {route.id}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            route.is_active
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {route.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <h3 className="text-lg font-extrabold">
                        {route.short_name || 'Unnamed Route'}
                      </h3>

                      <div className="mt-4 space-y-2 text-sm text-slate-400">
                        <p>
                          <span className="font-bold text-emerald-400">
                            From:
                          </span>{' '}
                          {route.origin || 'Unknown origin'}
                        </p>

                        <p>
                          <span className="font-bold text-red-400">To:</span>{' '}
                          {route.destination || 'Unknown destination'}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center">
                  <p className="font-bold text-slate-300">
                    Connection successful, but no routes were found.
                  </p>
                </div>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function ConnectionTestLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />

        <p className="text-lg font-extrabold">Connecting to Supabase</p>

        <p className="mt-2 text-sm text-slate-400">
          Loading shuttle management database...
        </p>
      </div>
    </main>
  );
}

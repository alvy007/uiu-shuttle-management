import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminDashboardLoading />}>
      <AdminDashboardContent />
    </Suspense>
  );
}

async function AdminDashboardContent() {
  const supabase = await createClient();

  // =======================================================
  // 1. CHECK AUTHENTICATED USER
  // =======================================================

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/auth/login');
  }

  // =======================================================
  // 2. CHECK ADMIN PROFILE
  // =======================================================

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(
      profileError.message || 'Could not load the current user profile.',
    );
  }

  if (!profile || !profile.is_active || profile.role !== 'admin') {
    redirect('/protected');
  }

  // =======================================================
  // 3. LOAD ADMIN DASHBOARD STATISTICS
  // =======================================================

  const [
    routesResult,
    busesResult,
    activeBusesResult,
    driversResult,
    assignmentsResult,
  ] = await Promise.all([
    supabase.from('routes').select('*', {
      count: 'exact',
      head: true,
    }),

    supabase.from('buses').select('*', {
      count: 'exact',
      head: true,
    }),

    supabase
      .from('buses')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('is_active', true),

    supabase
      .from('profiles')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('role', 'driver'),

    supabase
      .from('driver_assignments')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('is_active', true),
  ]);

  const dashboardError =
    routesResult.error ||
    busesResult.error ||
    activeBusesResult.error ||
    driversResult.error ||
    assignmentsResult.error;

  if (dashboardError) {
    throw new Error(
      dashboardError.message || 'Could not load dashboard statistics.',
    );
  }

  const statistics = [
    {
      title: 'Routes',
      value: routesResult.count ?? 0,
      description: 'Configured shuttle routes',
      accent: 'text-blue-400',
      background: 'bg-blue-500/10',
      border: 'border-blue-500/30',
    },
    {
      title: 'Total Buses',
      value: busesResult.count ?? 0,
      description: 'Registered university buses',
      accent: 'text-violet-400',
      background: 'bg-violet-500/10',
      border: 'border-violet-500/30',
    },
    {
      title: 'Active Buses',
      value: activeBusesResult.count ?? 0,
      description: 'Buses currently enabled',
      accent: 'text-emerald-400',
      background: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
    },
    {
      title: 'Drivers',
      value: driversResult.count ?? 0,
      description: 'Registered driver profiles',
      accent: 'text-amber-400',
      background: 'bg-amber-500/10',
      border: 'border-amber-500/30',
    },
    {
      title: 'Assignments',
      value: assignmentsResult.count ?? 0,
      description: 'Active driver assignments',
      accent: 'text-cyan-400',
      background: 'bg-cyan-500/10',
      border: 'border-cyan-500/30',
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        {/* =================================================
            HEADER
        ================================================= */}

        <header className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-blue-400">
                UIU Shuttle Management
              </p>

              <h1 className="text-3xl font-black sm:text-4xl">
                Admin Dashboard
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                Manage shuttle routes, buses, drivers and operational
                assignments from one secure dashboard.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-950 px-5 py-4">
              <p className="text-xs font-black uppercase tracking-widest text-emerald-400">
                Signed in as Admin
              </p>

              <p className="mt-2 font-extrabold text-white">
                {profile.full_name || 'Administrator'}
              </p>

              <p className="mt-1 text-sm text-slate-400">
                {profile.email || user.email}
              </p>
            </div>
          </div>
        </header>

        {/* =================================================
            STATISTICS
        ================================================= */}

        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-xl font-black">System Overview</h2>

            <p className="mt-1 text-sm text-slate-400">
              Current information loaded from the Supabase database.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {statistics.map(item => (
              <article
                key={item.title}
                className={`rounded-2xl border ${item.border} ${item.background} p-5`}
              >
                <p className="text-sm font-bold text-slate-300">{item.title}</p>

                <p className={`mt-3 text-4xl font-black ${item.accent}`}>
                  {item.value}
                </p>

                <p className="mt-3 text-xs leading-5 text-slate-400">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* =================================================
            ADMIN MANAGEMENT MODULES
        ================================================= */}

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-black">Management Modules</h2>

            <p className="mt-2 text-sm text-slate-400">
              These modules will be connected one by one in the next steps.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ManagementCard
              number="01"
              title="Route Management"
              description="Create, update, activate and deactivate university shuttle routes."
            />

            <ManagementCard
              number="02"
              title="Bus Management"
              description="Register new buses and assign each bus to a shuttle route."
            />

            <ManagementCard
              number="03"
              title="Driver Management"
              description="Create driver profiles and control driver account status."
            />

            <ManagementCard
              number="04"
              title="Driver Assignments"
              description="Assign an active driver to a specific bus and route."
            />
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-slate-800 pt-6 sm:flex-row">
            <Link
              href="/connection-test"
              className="rounded-xl bg-blue-600 px-5 py-3 text-center text-sm font-extrabold transition hover:bg-blue-500"
            >
              Check Database Connection
            </Link>

            <Link
              href="/protected"
              className="rounded-xl border border-slate-700 bg-slate-950 px-5 py-3 text-center text-sm font-extrabold text-slate-300 transition hover:border-slate-600 hover:text-white"
            >
              Open Account Page
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function ManagementCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950 p-5 transition hover:border-blue-500/60">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-sm font-black">
        {number}
      </div>

      <h3 className="text-lg font-extrabold">{title}</h3>

      <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>

      <div className="mt-5 rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
        Coming Next
      </div>
    </article>
  );
}

function AdminDashboardLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />

        <p className="text-lg font-extrabold">Loading Admin Dashboard</p>

        <p className="mt-2 text-sm text-slate-400">
          Verifying administrator access and loading system information...
        </p>
      </div>
    </main>
  );
}

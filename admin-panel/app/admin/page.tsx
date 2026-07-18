import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

type DashboardStatistic = {
  title: string;
  value: number;
  description: string;
  code: string;
  iconBackground: string;
  iconText: string;
  valueText: string;
};

type ManagementModule = {
  number: string;
  title: string;
  description: string;
  href: string | null;
  status: 'available' | 'upcoming';
};

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
  // 1. VERIFY AUTHENTICATED USER
  // =======================================================

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/auth/login');
  }

  // =======================================================
  // 2. VERIFY ADMIN PROFILE
  // =======================================================

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(
      profileError.message || 'Could not load the administrator profile.',
    );
  }

  if (!profile || !profile.is_active || profile.role !== 'admin') {
    redirect('/protected');
  }

  // =======================================================
  // 3. LOAD DASHBOARD STATISTICS
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

  const statistics: DashboardStatistic[] = [
    {
      title: 'Total Routes',
      value: routesResult.count ?? 0,
      description: 'Configured university shuttle routes',
      code: 'RT',
      iconBackground: 'bg-orange-50',
      iconText: 'text-[#F37021]',
      valueText: 'text-[#F37021]',
    },
    {
      title: 'Registered Buses',
      value: busesResult.count ?? 0,
      description: 'All buses stored in the system',
      code: 'BS',
      iconBackground: 'bg-blue-50',
      iconText: 'text-blue-600',
      valueText: 'text-blue-600',
    },
    {
      title: 'Active Buses',
      value: activeBusesResult.count ?? 0,
      description: 'Buses currently enabled for service',
      code: 'AB',
      iconBackground: 'bg-emerald-50',
      iconText: 'text-emerald-600',
      valueText: 'text-emerald-600',
    },
    {
      title: 'Driver Profiles',
      value: driversResult.count ?? 0,
      description: 'Registered shuttle driver accounts',
      code: 'DR',
      iconBackground: 'bg-violet-50',
      iconText: 'text-violet-600',
      valueText: 'text-violet-600',
    },
    {
      title: 'Active Assignments',
      value: assignmentsResult.count ?? 0,
      description: 'Current driver, bus and route links',
      code: 'AS',
      iconBackground: 'bg-amber-50',
      iconText: 'text-amber-600',
      valueText: 'text-amber-600',
    },
  ];

  const managementModules: ManagementModule[] = [
    {
      number: '01',
      title: 'Route Management',
      description:
        'Review configured shuttle routes and see route-wise assigned buses.',
      href: '/admin/routes',
      status: 'available',
    },
    {
      number: '02',
      title: 'Bus Management',
      description:
        'Register buses, update bus information and assign buses to routes.',
      href: null,
      status: 'upcoming',
    },
    {
      number: '03',
      title: 'Driver Management',
      description:
        'Create driver profiles and control driver account availability.',
      href: null,
      status: 'upcoming',
    },
    {
      number: '04',
      title: 'Driver Assignments',
      description:
        'Connect an active driver with a specific shuttle bus and route.',
      href: null,
      status: 'upcoming',
    },
  ];

  return (
    <main className="uiu-admin-page px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl">
        {/* =================================================
            PAGE HEADER
        ================================================= */}

        <header className="mb-7 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="h-2 bg-[#F37021]" />

          <div className="flex flex-col gap-6 px-6 py-7 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-orange-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-[#C95212]">
                  Administration
                </span>

                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-emerald-700">
                  System Online
                </span>
              </div>

              <h1 className="text-3xl font-black tracking-tight text-[#171717] sm:text-4xl">
                Admin Dashboard
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500 sm:text-base">
                Manage UIU shuttle routes, buses, drivers and operational
                assignments from one secure management system.
              </p>
            </div>

            <div className="min-w-[250px] rounded-2xl border border-orange-100 bg-orange-50 p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F37021] text-sm font-black text-white shadow-md">
                  AD
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C95212]">
                    Signed in as Admin
                  </p>

                  <p className="mt-1 truncate font-black text-[#171717]">
                    {profile.full_name || 'Administrator'}
                  </p>

                  <p className="mt-1 truncate text-xs font-medium text-gray-500">
                    {profile.email || user.email}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* =================================================
            SYSTEM STATISTICS
        ================================================= */}

        <section className="mb-8">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F37021]">
                System Overview
              </p>

              <h2 className="mt-2 text-2xl font-black text-[#171717]">
                Current Operations
              </h2>
            </div>

            <p className="text-sm text-gray-500">
              Live information loaded from Supabase
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {statistics.map(item => (
              <article
                key={item.title}
                className="uiu-card p-5 transition duration-200 hover:-translate-y-1 hover:border-orange-200 hover:shadow-md"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl text-xs font-black ${item.iconBackground} ${item.iconText}`}
                >
                  {item.code}
                </div>

                <p className={`mt-5 text-4xl font-black ${item.valueText}`}>
                  {item.value}
                </p>

                <h3 className="mt-2 text-sm font-black text-[#171717]">
                  {item.title}
                </h3>

                <p className="mt-2 text-xs leading-5 text-gray-500">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* =================================================
            MANAGEMENT MODULES
        ================================================= */}

        <section className="uiu-card overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F37021]">
                Management Center
              </p>

              <h2 className="mt-2 text-2xl font-black text-[#171717]">
                Administration Modules
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Complete each operational module step by step.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs font-black uppercase tracking-wider text-gray-500">
              1 Module Available
            </div>
          </div>

          <div className="grid gap-5 p-6 sm:p-8 md:grid-cols-2 xl:grid-cols-4">
            {managementModules.map(module => (
              <ManagementModuleCard key={module.number} module={module} />
            ))}
          </div>
        </section>

        {/* =================================================
            SYSTEM QUICK ACTIONS
        ================================================= */}

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <article className="uiu-card p-6 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F37021]">
                  Quick Access
                </p>

                <h2 className="mt-2 text-xl font-black text-[#171717]">
                  System Utilities
                </h2>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  Check database connectivity or review the current
                  authenticated account.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/connection-test"
                  className="uiu-primary-button whitespace-nowrap"
                >
                  Database Test
                </Link>

                <Link
                  href="/protected"
                  className="uiu-secondary-button whitespace-nowrap"
                >
                  Account Page
                </Link>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-[#F37021]/20 bg-[#171717] p-6 text-white shadow-sm sm:p-7">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F37021] text-xs font-black">
                UIU
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-widest text-[#F37021]">
                  Shuttle Management
                </p>

                <p className="mt-1 text-sm font-black text-white">
                  Quest for Excellence
                </p>
              </div>
            </div>

            <p className="text-sm leading-6 text-white/55">
              Building a safe, transparent and intelligent transportation system
              for the university community.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}

function ManagementModuleCard({ module }: { module: ManagementModule }) {
  const content = (
    <article
      className={`flex h-full flex-col rounded-2xl border p-5 transition duration-200 ${
        module.status === 'available'
          ? 'border-orange-200 bg-orange-50/60 hover:-translate-y-1 hover:border-[#F37021] hover:shadow-md'
          : 'border-gray-200 bg-gray-50 opacity-75'
      }`}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl text-xs font-black ${
            module.status === 'available'
              ? 'bg-[#F37021] text-white'
              : 'bg-gray-200 text-gray-500'
          }`}
        >
          {module.number}
        </div>

        <span
          className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${
            module.status === 'available'
              ? 'bg-white text-[#C95212] shadow-sm'
              : 'bg-gray-200 text-gray-500'
          }`}
        >
          {module.status === 'available' ? 'Available' : 'Coming Soon'}
        </span>
      </div>

      <h3 className="text-lg font-black text-[#171717]">{module.title}</h3>

      <p className="mt-3 flex-1 text-sm leading-6 text-gray-500">
        {module.description}
      </p>

      <div
        className={`mt-6 rounded-xl px-4 py-3 text-center text-xs font-black uppercase tracking-wider ${
          module.status === 'available'
            ? 'bg-white text-[#F37021] shadow-sm'
            : 'bg-gray-200 text-gray-500'
        }`}
      >
        {module.status === 'available'
          ? 'Open Module →'
          : 'Development Pending'}
      </div>
    </article>
  );

  if (module.href) {
    return <Link href={module.href}>{content}</Link>;
  }

  return content;
}

function AdminDashboardLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F7F8] px-6">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-lg">
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-orange-100 border-t-[#F37021]" />

        <p className="text-lg font-black text-[#171717]">
          Loading Admin Dashboard
        </p>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          Verifying administrator access and loading system information...
        </p>
      </div>
    </main>
  );
}

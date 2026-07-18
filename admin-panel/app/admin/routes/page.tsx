import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

type RouteId = string | number;

type RouteRecord = {
  id: RouteId;
  route_name: string;
  short_name: string;
  origin: string;
  destination: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type BusRecord = {
  id: RouteId;
  display_name: string;
  registration_number: string | null;
  route_id: RouteId | null;
  is_active: boolean;
};

export default function RouteManagementPage() {
  return (
    <Suspense fallback={<RouteManagementLoading />}>
      <RouteManagementContent />
    </Suspense>
  );
}

async function RouteManagementContent() {
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
      profileError.message || 'Could not load administrator profile.',
    );
  }

  if (!profile || !profile.is_active || profile.role !== 'admin') {
    redirect('/protected');
  }

  // =======================================================
  // 3. LOAD ROUTES AND BUSES
  // =======================================================

  const [routesResult, busesResult] = await Promise.all([
    supabase
      .from('routes')
      .select(
        `
          id,
          route_name,
          short_name,
          origin,
          destination,
          description,
          is_active,
          created_at,
          updated_at
        `,
      )
      .order('id', {
        ascending: true,
      }),

    supabase
      .from('buses')
      .select(
        `
          id,
          display_name,
          registration_number,
          route_id,
          is_active
        `,
      )
      .order('id', {
        ascending: true,
      }),
  ]);

  if (routesResult.error) {
    throw new Error(
      routesResult.error.message || 'Could not load shuttle routes.',
    );
  }

  if (busesResult.error) {
    throw new Error(
      busesResult.error.message || 'Could not load shuttle buses.',
    );
  }

  const routes = (routesResult.data ?? []) as RouteRecord[];
  const buses = (busesResult.data ?? []) as BusRecord[];

  const totalRoutes = routes.length;
  const activeRoutes = routes.filter(route => route.is_active).length;
  const inactiveRoutes = totalRoutes - activeRoutes;

  const assignedBusCount = buses.filter(bus => bus.route_id !== null).length;

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
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Link
                  href="/admin"
                  className="inline-flex min-h-[38px] items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-xs font-black text-gray-600 transition hover:border-[#F37021] hover:bg-orange-50 hover:text-[#C95212]"
                >
                  ← Dashboard
                </Link>

                <span className="rounded-full bg-orange-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#C95212]">
                  Route Management
                </span>

                <span className="rounded-full bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  Database Connected
                </span>
              </div>

              <h1 className="text-3xl font-black tracking-tight text-[#171717] sm:text-4xl">
                Shuttle Routes
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500 sm:text-base">
                Review UIU shuttle routes, route availability and currently
                assigned university buses from one management page.
              </p>
            </div>

            <div className="min-w-[250px] rounded-2xl border border-orange-100 bg-orange-50 p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F37021] text-sm font-black text-white shadow-md">
                  RM
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C95212]">
                    Administrator
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
            ROUTE STATISTICS
        ================================================= */}

        <section className="mb-8">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F37021]">
              Route Overview
            </p>

            <h2 className="mt-2 text-2xl font-black text-[#171717]">
              Current Route Status
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatisticCard
              code="RT"
              title="Total Routes"
              value={totalRoutes}
              description="All configured shuttle routes"
              iconClassName="bg-orange-50 text-[#F37021]"
              valueClassName="text-[#F37021]"
            />

            <StatisticCard
              code="AR"
              title="Active Routes"
              value={activeRoutes}
              description="Routes available for operation"
              iconClassName="bg-emerald-50 text-emerald-600"
              valueClassName="text-emerald-600"
            />

            <StatisticCard
              code="IR"
              title="Inactive Routes"
              value={inactiveRoutes}
              description="Temporarily unavailable routes"
              iconClassName="bg-amber-50 text-amber-600"
              valueClassName="text-amber-600"
            />

            <StatisticCard
              code="BS"
              title="Assigned Buses"
              value={assignedBusCount}
              description="Buses connected with routes"
              iconClassName="bg-blue-50 text-blue-600"
              valueClassName="text-blue-600"
            />
          </div>
        </section>

        {/* =================================================
            ROUTE LIST
        ================================================= */}

        <section className="uiu-card overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F37021]">
                Configured Network
              </p>

              <h2 className="mt-2 text-2xl font-black text-[#171717]">
                University Shuttle Routes
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Route creation and editing controls will be added in the next
                functional step.
              </p>
            </div>

            <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-xs font-black uppercase tracking-wider text-[#C95212]">
              {totalRoutes} Route{totalRoutes === 1 ? '' : 's'} Found
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {routes.length > 0 ? (
              <div className="grid gap-5 xl:grid-cols-2">
                {routes.map((route, index) => {
                  const assignedBuses = buses.filter(
                    bus => bus.route_id === route.id,
                  );

                  const activeBusCount = assignedBuses.filter(
                    bus => bus.is_active,
                  ).length;

                  return (
                    <RouteCard
                      key={route.id}
                      route={route}
                      routeNumber={index + 1}
                      assignedBuses={assignedBuses}
                      activeBusCount={activeBusCount}
                    />
                  );
                })}
              </div>
            ) : (
              <EmptyRouteState />
            )}
          </div>
        </section>

        {/* =================================================
            INFORMATION SECTION
        ================================================= */}

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <article className="uiu-card p-6 sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F37021]">
              Next Functional Step
            </p>

            <h2 className="mt-2 text-xl font-black text-[#171717]">
              Route Creation and Editing
            </h2>

            <p className="mt-3 text-sm leading-6 text-gray-500">
              The next module will allow administrators to create new routes,
              edit route information and activate or deactivate routes without
              directly opening the Supabase dashboard.
            </p>

            <div className="mt-5 inline-flex rounded-xl bg-orange-50 px-4 py-3 text-xs font-black uppercase tracking-wider text-[#C95212]">
              Route CRUD Coming Next
            </div>
          </article>

          <article className="rounded-2xl border border-[#F37021]/20 bg-[#171717] p-6 text-white shadow-sm sm:p-7">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F37021] text-xs font-black">
                UIU
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-widest text-[#F37021]">
                  Route Network
                </p>

                <p className="mt-1 text-sm font-black text-white">
                  Safe and Connected
                </p>
              </div>
            </div>

            <p className="text-sm leading-6 text-white/55">
              Each operational bus will be connected to a verified route,
              assigned driver and live tracking session.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}

function RouteCard({
  route,
  routeNumber,
  assignedBuses,
  activeBusCount,
}: {
  route: RouteRecord;
  routeNumber: number;
  assignedBuses: BusRecord[];
  activeBusCount: number;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white transition duration-200 hover:-translate-y-1 hover:border-orange-200 hover:shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/70 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F37021] text-xs font-black text-white shadow-sm">
            {String(routeNumber).padStart(2, '0')}
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
              Route ID
            </p>

            <p className="mt-1 text-sm font-black text-[#171717]">
              {String(route.id)}
            </p>
          </div>
        </div>

        <span
          className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-wider ${
            route.is_active
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-700'
          }`}
        >
          {route.is_active ? 'Active Route' : 'Inactive Route'}
        </span>
      </div>

      <div className="p-5 sm:p-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#F37021]">
            {route.short_name || `Route ${routeNumber}`}
          </p>

          <h3 className="mt-2 text-xl font-black leading-tight text-[#171717]">
            {route.route_name}
          </h3>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <RoutePoint
            label="Origin"
            value={route.origin}
            colorClassName="bg-emerald-500"
          />

          <div className="ml-[5px] my-2 h-8 w-0.5 bg-gray-300" />

          <RoutePoint
            label="Destination"
            value={route.destination}
            colorClassName="bg-[#F37021]"
          />
        </div>

        {route.description ? (
          <div className="mt-5 rounded-xl border border-orange-100 bg-orange-50/60 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#C95212]">
              Route Description
            </p>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              {route.description}
            </p>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <RouteMetric
            label="Assigned Buses"
            value={assignedBuses.length}
            valueClassName="text-blue-600"
          />

          <RouteMetric
            label="Active Buses"
            value={activeBusCount}
            valueClassName="text-emerald-600"
          />
        </div>

        <div className="mt-5">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">
            Buses on this route
          </p>

          {assignedBuses.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {assignedBuses.map(bus => (
                <div
                  key={bus.id}
                  className={`rounded-xl border px-3 py-2 ${
                    bus.is_active
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <p
                    className={`text-xs font-black ${
                      bus.is_active ? 'text-emerald-700' : 'text-gray-500'
                    }`}
                  >
                    {bus.display_name}
                  </p>

                  {bus.registration_number ? (
                    <p className="mt-1 text-[10px] font-medium text-gray-400">
                      {bus.registration_number}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center">
              <p className="text-sm font-bold text-gray-400">
                No bus assigned to this route yet.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-gray-100 pt-5">
          <p className="text-xs font-medium text-gray-400">
            Route management controls coming next
          </p>

          <span className="rounded-lg bg-gray-100 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-500">
            View Only
          </span>
        </div>
      </div>
    </article>
  );
}

function RoutePoint({
  label,
  value,
  colorClassName,
}: {
  label: string;
  value: string;
  colorClassName: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${colorClassName}`}
      />

      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">
          {label}
        </p>

        <p className="mt-1 text-sm font-black leading-6 text-[#171717]">
          {value}
        </p>
      </div>
    </div>
  );
}

function RouteMetric({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: number;
  valueClassName: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">
        {label}
      </p>

      <p className={`mt-2 text-2xl font-black ${valueClassName}`}>{value}</p>
    </div>
  );
}

function StatisticCard({
  code,
  title,
  value,
  description,
  iconClassName,
  valueClassName,
}: {
  code: string;
  title: string;
  value: number;
  description: string;
  iconClassName: string;
  valueClassName: string;
}) {
  return (
    <article className="uiu-card p-5 transition duration-200 hover:-translate-y-1 hover:border-orange-200 hover:shadow-md">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl text-xs font-black ${iconClassName}`}
      >
        {code}
      </div>

      <p className={`mt-5 text-4xl font-black ${valueClassName}`}>{value}</p>

      <h3 className="mt-2 text-sm font-black text-[#171717]">{title}</h3>

      <p className="mt-2 text-xs leading-5 text-gray-500">{description}</p>
    </article>
  );
}

function EmptyRouteState() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-14 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-sm font-black text-[#F37021]">
        RT
      </div>

      <h3 className="mt-5 text-xl font-black text-[#171717]">
        No routes found
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
        No university shuttle route is currently available in the database.
      </p>
    </div>
  );
}

function RouteManagementLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F7F8] px-6">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-lg">
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-orange-100 border-t-[#F37021]" />

        <p className="text-lg font-black text-[#171717]">
          Loading Route Management
        </p>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          Loading routes and assigned university buses...
        </p>
      </div>
    </main>
  );
}

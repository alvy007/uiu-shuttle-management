import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import RouteCreateForm from '@/components/admin/routes/RouteCreateForm';
import { createClient } from '@/lib/supabase/server';

export default function NewRoutePage() {
  return (
    <Suspense fallback={<NewRoutePageLoading />}>
      <NewRoutePageContent />
    </Suspense>
  );
}

async function NewRoutePageContent() {
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
  // 2. VERIFY ACTIVE ADMIN
  // =======================================================

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== 'admin' ||
    !profile.is_active
  ) {
    redirect('/protected');
  }

  return (
    <main className="uiu-admin-page px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-5xl">
        {/* =================================================
            PAGE HEADER
        ================================================= */}

        <header className="mb-7 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="h-2 bg-[#F37021]" />

          <div className="flex flex-col gap-6 px-6 py-7 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Link
                  href="/admin/routes"
                  className="inline-flex min-h-[38px] items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-xs font-black text-gray-600 transition hover:border-[#F37021] hover:bg-orange-50 hover:text-[#C95212]"
                >
                  ← Route Management
                </Link>

                <span className="rounded-full bg-orange-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#C95212]">
                  New Route
                </span>

                <span className="rounded-full bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  Admin Only
                </span>
              </div>

              <h1 className="text-3xl font-black tracking-tight text-[#171717] sm:text-4xl">
                Create Shuttle Route
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500 sm:text-base">
                Add a new operational route to the UIU shuttle management
                system. The route will become available to other modules after
                successful creation.
              </p>
            </div>

            <div className="min-w-[245px] rounded-2xl border border-orange-100 bg-orange-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C95212]">
                Creating as
              </p>

              <p className="mt-2 truncate font-black text-[#171717]">
                {profile.full_name || 'Administrator'}
              </p>

              <p className="mt-1 truncate text-xs font-medium text-gray-500">
                {profile.email || user.email}
              </p>
            </div>
          </div>
        </header>

        {/* =================================================
            ROUTE FORM
        ================================================= */}

        <RouteCreateForm />

        {/* =================================================
            GUIDANCE
        ================================================= */}

        <section className="mt-6 rounded-2xl border border-[#F37021]/20 bg-[#171717] p-6 text-white shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F37021] text-xs font-black">
              UIU
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#F37021]">
                Route Creation Guidance
              </p>

              <p className="mt-2 text-sm leading-6 text-white/60">
                Use clear and recognizable route names. Origin and destination
                should match the actual university shuttle operation so students
                and drivers can identify the route correctly.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function NewRoutePageLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F7F8] px-6">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-lg">
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-orange-100 border-t-[#F37021]" />

        <p className="text-lg font-black text-[#171717]">Loading Route Form</p>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          Verifying administrator access...
        </p>
      </div>
    </main>
  );
}

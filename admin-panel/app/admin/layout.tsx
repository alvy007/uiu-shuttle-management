import type { ReactNode } from 'react';
import { Suspense } from 'react';

import AdminSidebar from '@/components/admin/AdminSidebar';

export default function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-[#F6F7F8] text-[#171717]">
      <Suspense fallback={<AdminSidebarLoading />}>
        <AdminSidebar />
      </Suspense>

      <div className="min-h-screen lg:pl-72">{children}</div>
    </div>
  );
}

function AdminSidebarLoading() {
  return (
    <>
      {/* ===================================================
          DESKTOP SIDEBAR FALLBACK
      =================================================== */}

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-black/20 bg-[#171717] text-white lg:flex">
        <div className="border-b border-white/10 px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F37021] text-sm font-black text-white">
              UIU
            </div>

            <div className="min-w-0">
              <p className="truncate text-base font-black text-white">
                Shuttle Management
              </p>

              <p className="mt-1 text-xs font-semibold text-white/50">
                United International University
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 py-5">
          <SidebarLoadingSection />

          <SidebarLoadingSection />

          <SidebarLoadingSection />
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />

              <p className="text-xs font-black uppercase tracking-wider text-emerald-400">
                Loading System
              </p>
            </div>

            <div className="h-3 w-full animate-pulse rounded-full bg-white/10" />

            <div className="mt-2 h-3 w-4/5 animate-pulse rounded-full bg-white/10" />
          </div>
        </div>
      </aside>

      {/* ===================================================
          MOBILE HEADER FALLBACK
      =================================================== */}

      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F37021] text-xs font-black text-white">
              UIU
            </div>

            <div>
              <p className="text-sm font-black text-[#171717]">
                Shuttle Management
              </p>

              <p className="text-[11px] font-semibold text-gray-500">
                Loading navigation...
              </p>
            </div>
          </div>

          <div className="h-7 w-16 animate-pulse rounded-full bg-gray-100" />
        </div>

        <div className="flex gap-2 overflow-hidden border-t border-gray-100 px-4 py-3">
          <div className="h-8 w-20 animate-pulse rounded-xl bg-orange-100" />

          <div className="h-8 w-20 animate-pulse rounded-xl bg-gray-100" />

          <div className="h-8 w-24 animate-pulse rounded-xl bg-gray-100" />
        </div>
      </div>
    </>
  );
}

function SidebarLoadingSection() {
  return (
    <section className="mb-7">
      <div className="mb-4 ml-3 h-2.5 w-24 animate-pulse rounded-full bg-white/10" />

      <div className="space-y-2">
        <SidebarLoadingItem />

        <SidebarLoadingItem />

        <SidebarLoadingItem />
      </div>
    </section>
  );
}

function SidebarLoadingItem() {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-3">
      <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-white/10" />

      <div className="flex-1">
        <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />

        <div className="mt-2 h-2.5 w-32 animate-pulse rounded-full bg-white/[0.06]" />
      </div>
    </div>
  );
}

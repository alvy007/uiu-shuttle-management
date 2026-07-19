'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavigationItem = {
  label: string;
  description: string;
  href: string;
  code: string;
};

type UpcomingItem = {
  label: string;
  code: string;
};

const navigationItems: NavigationItem[] = [
  {
    label: 'Overview',
    description: 'System summary',
    href: '/admin',
    code: '01',
  },
  {
    label: 'Routes',
    description: 'Shuttle route management',
    href: '/admin/routes',
    code: '02',
  },
];

const secondaryItems: NavigationItem[] = [
  {
    label: 'Database Test',
    description: 'Check Supabase connection',
    href: '/connection-test',
    code: 'DB',
  },
  {
    label: 'Account',
    description: 'Authenticated account',
    href: '/protected',
    code: 'AC',
  },
];

const upcomingItems: UpcomingItem[] = [
  {
    label: 'Buses',
    code: '03',
  },
  {
    label: 'Drivers',
    code: '04',
  },
  {
    label: 'Assignments',
    code: '05',
  },
  {
    label: 'Live Fleet',
    code: '06',
  },
  {
    label: 'Trips',
    code: '07',
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  function isNavigationItemActive(href: string) {
    if (href === '/admin') {
      return pathname === '/admin';
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      {/* ===================================================
          DESKTOP SIDEBAR
      =================================================== */}

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-black/20 bg-[#171717] text-white lg:flex">
        <div className="border-b border-white/10 px-6 py-6">
          <Link href="/admin" className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F37021] text-sm font-black text-white shadow-lg shadow-orange-950/30">
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
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <NavigationSection title="Management">
            {navigationItems.map(item => {
              const active = isNavigationItemActive(item.href);

              return (
                <NavigationLink key={item.href} item={item} active={active} />
              );
            })}
          </NavigationSection>

          <NavigationSection title="Upcoming Modules">
            {upcomingItems.map(item => (
              <div
                key={item.label}
                className="mb-2 flex cursor-not-allowed items-center gap-3 rounded-xl border border-transparent px-3 py-3 opacity-45"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[11px] font-black text-white/70">
                  {item.code}
                </div>

                <div>
                  <p className="text-sm font-bold text-white/70">
                    {item.label}
                  </p>

                  <p className="mt-0.5 text-[11px] font-medium text-white/35">
                    Coming in next steps
                  </p>
                </div>
              </div>
            ))}
          </NavigationSection>

          <NavigationSection title="System">
            {secondaryItems.map(item => {
              const active = isNavigationItemActive(item.href);

              return (
                <NavigationLink key={item.href} item={item} active={active} />
              );
            })}
          </NavigationSection>
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />

              <p className="text-xs font-black uppercase tracking-wider text-emerald-400">
                System Online
              </p>
            </div>

            <p className="text-xs leading-5 text-white/45">
              Quest for Excellence through safe, reliable and intelligent
              university transportation.
            </p>
          </div>
        </div>
      </aside>

      {/* ===================================================
          MOBILE HEADER AND NAVIGATION
      =================================================== */}

      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F37021] text-xs font-black text-white">
              UIU
            </div>

            <div>
              <p className="text-sm font-black text-[#171717]">
                Shuttle Management
              </p>

              <p className="text-[11px] font-semibold text-gray-500">
                Admin Panel
              </p>
            </div>
          </Link>

          <div className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">
            Online
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto border-t border-gray-100 px-4 py-3">
          {navigationItems.map(item => {
            const active = isNavigationItemActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-black transition ${
                  active
                    ? 'bg-[#F37021] text-white'
                    : 'border border-gray-200 bg-white text-gray-600'
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          {secondaryItems.map(item => {
            const active = isNavigationItemActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-black transition ${
                  active
                    ? 'bg-[#F37021] text-white'
                    : 'border border-gray-200 bg-white text-gray-600'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}

function NavigationSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <p className="mb-3 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
        {title}
      </p>

      <div>{children}</div>
    </section>
  );
}

function NavigationLink({
  item,
  active,
}: {
  item: NavigationItem;
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={`mb-2 flex items-center gap-3 rounded-xl border px-3 py-3 transition ${
        active
          ? 'border-[#F37021]/40 bg-[#F37021] text-white shadow-lg shadow-orange-950/20'
          : 'border-transparent text-white/70 hover:border-white/10 hover:bg-white/[0.06] hover:text-white'
      }`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${
          active ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70'
        }`}
      >
        {item.code}
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-black">{item.label}</p>

        <p
          className={`mt-0.5 truncate text-[11px] font-medium ${
            active ? 'text-white/75' : 'text-white/35'
          }`}
        >
          {item.description}
        </p>
      </div>
    </Link>
  );
}

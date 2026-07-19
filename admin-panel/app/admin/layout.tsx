import type { ReactNode } from 'react';

import AdminSidebar from '@/components/admin/AdminSidebar';

export default function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-[#F6F7F8] text-[#171717]">
      <AdminSidebar />

      <div className="min-h-screen lg:pl-72">{children}</div>
    </div>
  );
}

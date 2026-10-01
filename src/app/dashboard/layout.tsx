import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="md:pl-64">
        <Topbar />
        <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-10 sm:px-6 md:pb-20 lg:px-10 lg:pt-14">{children}</main>
      </div>
    </div>
  );
}

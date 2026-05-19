import { createFileRoute, Link } from "@tanstack/react-router";
import { Scale, GitCompare, FileBarChart, BookOpen, PieChart, Activity } from "lucide-react";
import { PageHeader } from "@/components/DashboardLayout";

export const Route = createFileRoute("/_app/dagang/laporan/")({
  head: () => ({ meta: [{ title: "Laporan Dagang · BUMDes" }] }),
  component: LaporanDagangIndex,
});

function LaporanDagangIndex() {
  return (
    <>
      <PageHeader
        title="Laporan Perdagangan"
        subtitle="Laporan keuangan khusus aktivitas Unit Perdagangan."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card
          to="/dagang/laporan/neraca"
          title="Neraca Dagang"
          desc="Posisi keuangan unit Perdagangan."
          icon={<Scale className="h-5 w-5" />}
        />
        <Card
          to="/dagang/laporan/laba-rugi"
          title="Laba Rugi Dagang"
          desc="Penjualan, HPP, dan beban operasional unit dagang."
          icon={<FileBarChart className="h-5 w-5" />}
        />
        <Card
          to="/dagang/laporan/rekonsiliasi-rk"
          title="Rekonsiliasi RK"
          desc="Cek kesesuaian Rekening Koran Dagang dengan Pusat."
          icon={<GitCompare className="h-5 w-5" />}
        />
        <Card
          to="/dagang/laporan/buku-besar"
          title="Buku Besar Dagang"
          desc="Mutasi akun lengkap khusus entity Dagang dengan saldo berjalan."
          icon={<BookOpen className="h-5 w-5" />}
        />
        <Card
          to="/dagang/laporan/bagi-hasil"
          title="Bagi Hasil Dagang"
          desc="Distribusi laba unit Dagang mengacu Master Bagi Hasil Pusat."
          icon={<PieChart className="h-5 w-5" />}
        />
        <Card
          to="/dagang/laporan/arus-kas-ekuitas"
          title="Arus Kas & Ekuitas"
          desc="Arus kas, perubahan ekuitas, dan perubahan modal unit Dagang."
          icon={<Activity className="h-5 w-5" />}
        />
      </div>
    </>
  );
}

function Card({
  to,
  title,
  desc,
  icon,
}: {
  to: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to as "/dagang/laporan/neraca"}
      className="glass-card group rounded-2xl p-5 transition hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(34,211,238,0.15)]"
    >
      <div className="mb-3 inline-grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[var(--neon-cyan)] to-[var(--neon-green)] text-[oklch(0.15_0.03_250)]">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </Link>
  );
}

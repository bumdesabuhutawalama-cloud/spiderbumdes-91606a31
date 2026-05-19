import { createFileRoute, Link } from "@tanstack/react-router";
import { Scale, GitCompare, FileBarChart, BookOpen, PieChart, Activity } from "lucide-react";
import { PageHeader } from "@/components/DashboardLayout";

export const Route = createFileRoute("/_app/usp/laporan/")({
  head: () => ({ meta: [{ title: "Laporan USP · BUMDes" }] }),
  component: LaporanUspIndex,
});

function LaporanUspIndex() {
  return (
    <>
      <PageHeader
        title="Laporan USP"
        subtitle="Laporan keuangan khusus aktivitas Unit Simpan Pinjam."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card
          to="/usp/laporan/neraca"
          title="Neraca USP"
          desc="Posisi keuangan unit Simpan Pinjam."
          icon={<Scale className="h-5 w-5" />}
        />
        <Card
          to="/usp/laporan/laba-rugi"
          title="Laba Rugi USP"
          desc="Pendapatan bunga, denda, dan beban operasional USP."
          icon={<FileBarChart className="h-5 w-5" />}
        />
        <Card
          to="/usp/laporan/rekonsiliasi-rk"
          title="Rekonsiliasi RK"
          desc="Cek kesesuaian Rekening Koran USP dengan Pusat."
          icon={<GitCompare className="h-5 w-5" />}
        />
        <Card
          to="/usp/laporan/buku-besar"
          title="Buku Besar USP"
          desc="Mutasi akun lengkap khusus entity USP dengan saldo berjalan."
          icon={<BookOpen className="h-5 w-5" />}
        />
        <Card
          to="/usp/laporan/bagi-hasil"
          title="Bagi Hasil USP"
          desc="Distribusi laba unit USP mengacu Master Bagi Hasil Pusat."
          icon={<PieChart className="h-5 w-5" />}
        />
        <Card
          to="/usp/laporan/arus-kas-ekuitas"
          title="Arus Kas & Ekuitas"
          desc="Arus kas, perubahan ekuitas, dan perubahan modal unit USP."
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
      to={to as "/usp/laporan/neraca"}
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

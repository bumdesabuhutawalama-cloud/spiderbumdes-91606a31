import { createFileRoute, Link } from "@tanstack/react-router";
import { Scale, FileSpreadsheet, TrendingUp, PieChart, GitCompare, BookOpen, Activity } from "lucide-react";
import { PageHeader } from "@/components/DashboardLayout";

export const Route = createFileRoute("/_app/laporan-pusat")({
  head: () => ({ meta: [{ title: "Laporan Pusat · BUMDes" }] }),
  component: LaporanPusatHub,
});

type Item = {
  to:
    | "/laporan/neraca-pusat"
    | "/laporan/neraca-konsolidasi"
    | "/laporan/laba-rugi"
    | "/laporan/bagi-hasil"
    | "/laporan/rekonsiliasi-rk"
    | "/laporan/buku-besar-pusat"
    | "/laporan/buku-besar-konsolidasi"
    | "/laporan/arus-kas-ekuitas";
  title: string;
  desc: string;
  icon: React.ReactNode;
  accent: string;
};

const items: Item[] = [
  { to: "/laporan/neraca-pusat", title: "Neraca Pusat", desc: "Posisi keuangan kantor pusat BUMDes.", icon: <Scale className="h-7 w-7" />, accent: "from-amber-300 to-yellow-500" },
  { to: "/laporan/neraca-konsolidasi", title: "Neraca Konsolidasi", desc: "Gabungan posisi keuangan seluruh unit usaha.", icon: <FileSpreadsheet className="h-7 w-7" />, accent: "from-yellow-300 to-amber-500" },
  { to: "/laporan/laba-rugi", title: "Laba Rugi", desc: "Pendapatan, beban, dan laba periode berjalan.", icon: <TrendingUp className="h-7 w-7" />, accent: "from-amber-400 to-orange-400" },
  { to: "/laporan/arus-kas-ekuitas", title: "Arus Kas & Ekuitas", desc: "Arus kas, perubahan ekuitas, dan perubahan modal.", icon: <Activity className="h-7 w-7" />, accent: "from-orange-300 to-amber-500" },
  { to: "/laporan/bagi-hasil", title: "Bagi Hasil", desc: "Distribusi laba antar unit dan pemangku kepentingan.", icon: <PieChart className="h-7 w-7" />, accent: "from-yellow-400 to-amber-600" },
  { to: "/laporan/rekonsiliasi-rk", title: "Rekonsiliasi RK", desc: "Cek kesesuaian Rekening Koran antar entitas.", icon: <GitCompare className="h-7 w-7" />, accent: "from-amber-300 to-orange-500" },
  { to: "/laporan/buku-besar-pusat", title: "Buku Besar Pusat", desc: "Mutasi akun lengkap entity Pusat dengan saldo berjalan.", icon: <BookOpen className="h-7 w-7" />, accent: "from-yellow-500 to-amber-300" },
  { to: "/laporan/buku-besar-konsolidasi", title: "Buku Besar Konsolidasi", desc: "Mutasi akun gabungan seluruh entitas konsolidasi.", icon: <BookOpen className="h-7 w-7" />, accent: "from-amber-500 to-yellow-300" },
];

function LaporanPusatHub() {
  return (
    <>
      <PageHeader
        title="Laporan Pusat"
        subtitle="Pilih jenis laporan yang ingin ditampilkan."
      />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {items.map((it) => (
          <Link
            key={it.to}
            to={it.to}
            preload="intent"
            className="glass-card group relative overflow-hidden rounded-2xl p-4 sm:p-5 text-left transition hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(251,191,36,0.25)]"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${it.accent} opacity-[0.08] group-hover:opacity-[0.18] transition-opacity`} />
            <div className={`relative mb-3 inline-grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-xl bg-gradient-to-br ${it.accent} text-[oklch(0.2_0.05_60)] shadow-[0_0_20px_rgba(251,191,36,0.35)]`}>
              {it.icon}
            </div>
            <h3 className="relative text-sm sm:text-base font-semibold">{it.title}</h3>
            <p className="relative mt-1 text-xs sm:text-sm text-muted-foreground">{it.desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
}

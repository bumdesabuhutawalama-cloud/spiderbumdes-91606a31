import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, TrendingUp, Wallet, Package, ArrowLeftRight, PieChart } from "lucide-react";
import { PageHeader } from "@/components/DashboardLayout";

export const Route = createFileRoute("/_app/pusat/kegiatan")({
  head: () => ({ meta: [{ title: "Catat Kegiatan Pusat · BUMDes" }] }),
  component: CatatKegiatanPusatPage,
});

type CardItem = {
  to:
    | "/usp/kegiatan/penyertaan-modal"
    | "/usp/kegiatan/belanja-aset"
    | "/usp/kegiatan/penerimaan-kas"
    | "/usp/kegiatan/pengeluaran"
    | "/usp/transfer"
    | "/laporan/bagi-hasil";
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
};

const items: CardItem[] = [
  { to: "/usp/kegiatan/penyertaan-modal", icon: <TrendingUp className="h-6 w-6" />, title: "Penyertaan Modal", description: "Pencatatan penambahan modal dari Desa atau Investor untuk Pusat.", accent: "from-[var(--neon-cyan)] to-[var(--neon-green)]" },
  { to: "/usp/kegiatan/belanja-aset", icon: <Package className="h-6 w-6" />, title: "Belanja Aset / Modal", description: "Pembelian aset tetap atau belanja modal Unit Pusat.", accent: "from-[var(--neon-green)] to-amber-300" },
  { to: "/usp/kegiatan/penerimaan-kas", icon: <Wallet className="h-6 w-6" />, title: "Penerimaan Kas Pusat", description: "Catat pemasukan kas operasional Pusat (sewa, jasa, dsb).", accent: "from-fuchsia-400 to-[var(--neon-cyan)]" },
  { to: "/usp/kegiatan/pengeluaran", icon: <ClipboardList className="h-6 w-6" />, title: "Pengeluaran Operasional", description: "Catat biaya administrasi & operasional Pusat.", accent: "from-amber-400 to-rose-400" },
  { to: "/usp/transfer", icon: <ArrowLeftRight className="h-6 w-6" />, title: "Transfer Antar Entitas", description: "Transfer dana / penyertaan ke unit usaha (USP, Dagang, dsb) via mekanisme RK.", accent: "from-sky-400 to-violet-400" },
  { to: "/laporan/bagi-hasil", icon: <PieChart className="h-6 w-6" />, title: "Bagi Hasil", description: "Tetapkan dan bayar distribusi laba antar unit & pemangku kepentingan Pusat.", accent: "from-yellow-400 to-amber-600" },
];

function CatatKegiatanPusatPage() {
  return (
    <>
      <PageHeader
        title="Catat Kegiatan Pusat"
        subtitle="Pencatatan transaksi operasional Unit Pusat. Pilih akun kas/bank milik Pusat agar transaksi tidak tercampur dengan unit usaha."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => (
          <Link
            key={it.to}
            to={it.to}
            preload="intent"
            className="glass-card group relative rounded-2xl p-5 text-left transition hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(34,211,238,0.15)]"
          >
            <div className={`mb-3 inline-grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${it.accent} text-[oklch(0.15_0.03_250)]`}>
              {it.icon}
            </div>
            <h3 className="text-base font-semibold">{it.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{it.description}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-[var(--neon-cyan)]/20 bg-[var(--neon-cyan)]/5 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Catatan penting</p>
        <p>
          Transaksi yang dicatat di sini hanya mempengaruhi akun milik Pusat. Untuk memindahkan dana
          atau modal ke unit usaha, gunakan menu <strong>Transfer Antar Entitas</strong> agar
          tercatat sebagai RK antar unit dan tidak mencampur jurnal unit lain.
        </p>
      </div>
    </>
  );
}

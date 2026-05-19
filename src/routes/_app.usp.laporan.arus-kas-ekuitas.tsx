import { createFileRoute } from "@tanstack/react-router";
import { FinancialFlowReports } from "@/components/FinancialFlowReports";

export const Route = createFileRoute("/_app/usp/laporan/arus-kas-ekuitas")({
  head: () => ({ meta: [{ title: "Arus Kas & Ekuitas USP · BUMDes" }] }),
  component: () => (
    <FinancialFlowReports
      title="Arus Kas, Perubahan Ekuitas & Modal — USP"
      subtitle="Khusus aktivitas Unit Simpan Pinjam · dihitung otomatis dari jurnal."
      fixedUnitCode="USP"
      heading={{
        line1: "Laporan Keuangan Unit Usaha BUM Desa",
        line2: "UNIT SIMPAN PINJAM",
        line3: "ARUS KAS / EKUITAS / MODAL",
      }}
    />
  ),
});

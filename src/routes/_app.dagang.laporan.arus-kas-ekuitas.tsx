import { createFileRoute } from "@tanstack/react-router";
import { FinancialFlowReports } from "@/components/FinancialFlowReports";

export const Route = createFileRoute("/_app/dagang/laporan/arus-kas-ekuitas")({
  head: () => ({ meta: [{ title: "Arus Kas & Ekuitas Dagang · BUMDes" }] }),
  component: () => (
    <FinancialFlowReports
      title="Arus Kas, Perubahan Ekuitas & Modal — Dagang"
      subtitle="Khusus aktivitas Unit Perdagangan · dihitung otomatis dari jurnal."
      fixedUnitCode="DAGANG"
      heading={{
        line1: "Laporan Keuangan Unit Usaha BUM Desa",
        line2: "UNIT PERDAGANGAN",
        line3: "ARUS KAS / EKUITAS / MODAL",
      }}
    />
  ),
});

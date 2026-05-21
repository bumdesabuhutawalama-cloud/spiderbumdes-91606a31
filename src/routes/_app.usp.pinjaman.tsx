import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ListChecks, X, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { formatRp } from "@/lib/account-balances";


export const Route = createFileRoute("/_app/usp/pinjaman")({
  head: () => ({ meta: [{ title: "Data Pinjaman USP · BUMDes" }] }),
  component: PinjamanPage,
});

type Loan = {
  id: string;
  borrower_name: string;
  principal_amount: number;
  outstanding_principal: number;
  monthly_installment: number;
  interest_rate: number;
  tenure_months: number;
  start_date: string;
  status: string;
};

type Installment = {
  id: string;
  loan_id: string;
  installment_no: number;
  due_date: string;
  principal_due: number;
  interest_due: number;
  total_due: number;
  is_paid: boolean;
  paid_date: string | null;
  paid_amount: number;
};

function PinjamanPage() {
  const [selected, setSelected] = useState<Loan | null>(null);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: loans, isLoading } = useQuery({
    queryKey: ["loans", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as Loan[];
    },
  });

  const filteredLoans = useMemo(() => {
    return (loans ?? []).filter((l) => {
      if (fromDate && l.start_date < fromDate) return false;
      if (toDate && l.start_date > toDate) return false;
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      return true;
    });
  }, [loans, fromDate, toDate, statusFilter]);

  const summaryTotals = useMemo(() => {
    return filteredLoans.reduce(
      (acc, l) => {
        acc.principal += Number(l.principal_amount);
        acc.outstanding += Number(l.outstanding_principal);
        return acc;
      },
      { principal: 0, outstanding: 0 },
    );
  }, [filteredLoans]);

  const setQuickRange = (mode: "thisMonth" | "thisYear" | "lastYear" | "clear") => {
    const now = new Date();
    if (mode === "clear") {
      setFromDate("");
      setToDate("");
      return;
    }
    if (mode === "thisMonth") {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const last = new Date(y, now.getMonth() + 1, 0).getDate();
      setFromDate(`${y}-${m}-01`);
      setToDate(`${y}-${m}-${String(last).padStart(2, "0")}`);
      return;
    }
    if (mode === "thisYear") {
      const y = now.getFullYear();
      setFromDate(`${y}-01-01`);
      setToDate(`${y}-12-31`);
      return;
    }
    if (mode === "lastYear") {
      const y = now.getFullYear() - 1;
      setFromDate(`${y}-01-01`);
      setToDate(`${y}-12-31`);
    }
  };

  const { data: nextDueMap } = useQuery({
    queryKey: ["loans", "next_due_map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_installments")
        .select("loan_id, due_date")
        .eq("is_paid", false)
        .order("due_date");
      if (error) throw error;
      const m = new Map<string, string>();
      for (const r of data ?? []) {
        if (!m.has(r.loan_id)) m.set(r.loan_id, r.due_date);
      }
      return m;
    },
  });

  return (
    <>
      <PageHeader title="Data Pinjaman" subtitle="Daftar pinjaman aktif & lunas, jadwal angsuran, riwayat pembayaran." />
      

      <div className="glass-card rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
          <ListChecks className="h-4 w-4 text-[var(--neon-cyan)]" />
          Registry Pinjaman
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : !loans?.length ? (
          <p className="text-sm text-muted-foreground">Belum ada pinjaman.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="text-left py-2">Peminjam</th>
                  <th className="text-right">Pokok</th>
                  <th className="text-right">Outstanding</th>
                  <th className="text-right">Angsuran/bln</th>
                  <th className="text-center">Status</th>
                  <th className="text-left">Jatuh Tempo Berikut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => (
                  <tr
                    key={l.id}
                    className="border-t border-white/5 hover:bg-white/5 cursor-pointer"
                    onClick={() => setSelected(l)}
                  >
                    <td className="py-2">{l.borrower_name}</td>
                    <td className="text-right font-mono">{formatRp(Number(l.principal_amount))}</td>
                    <td className="text-right font-mono">{formatRp(Number(l.outstanding_principal))}</td>
                    <td className="text-right font-mono">{formatRp(Number(l.monthly_installment))}</td>
                    <td className="text-center">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${l.status === "active" ? "bg-[var(--neon-cyan)]/15 text-[var(--neon-cyan)]" : "bg-secondary/60 text-muted-foreground"}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="text-muted-foreground">{nextDueMap?.get(l.id) ?? "—"}</td>
                    <td className="text-right"><ChevronRight className="h-4 w-4 inline text-muted-foreground" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <LoanDetail loan={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function LoanDetail({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const { data: installments } = useQuery({
    queryKey: ["loan_installments", loan.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_installments")
        .select("*")
        .eq("loan_id", loan.id)
        .order("installment_no");
      if (error) throw error;
      return data as Installment[];
    },
  });

  const summary = useMemo(() => {
    const inst = installments ?? [];
    const paid = inst.filter((i) => i.is_paid);
    return {
      paidCount: paid.length,
      total: inst.length,
      paidAmount: paid.reduce((s, i) => s + Number(i.paid_amount || i.total_due), 0),
    };
  }, [installments]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in" onClick={onClose}>
      <div className="glass-card relative w-full sm:max-w-3xl max-h-[96vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10 p-4 sm:p-5" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg bg-secondary/60 hover:bg-secondary"><X className="h-4 w-4" /></button>
        <h2 className="text-base sm:text-lg font-semibold">{loan.borrower_name}</h2>
        <p className="text-xs text-muted-foreground">Dimulai {loan.start_date} · Tenor {loan.tenure_months} bln · Bunga {loan.interest_rate}% / tahun</p>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <Mini label="Pokok" value={formatRp(Number(loan.principal_amount))} />
          <Mini label="Outstanding" value={formatRp(Number(loan.outstanding_principal))} />
          <Mini label="Angsuran/bln" value={formatRp(Number(loan.monthly_installment))} />
          <Mini label="Lunas" value={`${summary.paidCount}/${summary.total}`} />
        </div>

        <h3 className="mt-4 text-sm font-semibold">Jadwal Angsuran</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase text-muted-foreground">
              <tr><th className="text-left py-1.5">No</th><th className="text-left">Jatuh Tempo</th><th className="text-right">Pokok</th><th className="text-right">Bunga</th><th className="text-right">Total</th><th className="text-center">Status</th><th className="text-left">Tgl Bayar</th></tr>
            </thead>
            <tbody>
              {(installments ?? []).map((i) => (
                <tr key={i.id} className="border-t border-white/5">
                  <td className="py-1.5">{i.installment_no}</td>
                  <td>{i.due_date}</td>
                  <td className="text-right font-mono">{formatRp(Number(i.principal_due))}</td>
                  <td className="text-right font-mono">{formatRp(Number(i.interest_due))}</td>
                  <td className="text-right font-mono">{formatRp(Number(i.total_due))}</td>
                  <td className="text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] uppercase ${i.is_paid ? "bg-emerald-500/15 text-emerald-300" : "bg-secondary/60 text-muted-foreground"}`}>
                      {i.is_paid ? "lunas" : "belum"}
                    </span>
                  </td>
                  <td className="text-muted-foreground">{i.paid_date ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-background/40 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono">{value}</div>
    </div>
  );
}

import type { ReactNode } from "react";
import { Calendar, Link2, Printer, Share2 } from "lucide-react";

type Props = {
  children: ReactNode;
  shareMsg: string | null;
  summaryOpen: boolean;
  onCopyLink: () => void;
  onPrint: () => void;
  onToggleSummary: () => void;
  onReminder: () => void;
};

export function DiagnosisReportShell({
  children,
  shareMsg,
  summaryOpen,
  onCopyLink,
  onPrint,
  onToggleSummary,
  onReminder,
}: Props) {
  return (
    <div className="diagnosis-funnel diagnosis-report-root">
      <div className="report-toolbar-sticky no-print" role="toolbar" aria-label="Ações do relatório">
        <button type="button" className="toolbar-btn" onClick={onCopyLink}>
          <Link2 size={16} aria-hidden />
          Copiar link
        </button>
        <button type="button" className="toolbar-btn" onClick={onPrint}>
          <Printer size={16} aria-hidden />
          PDF / Imprimir
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={onToggleSummary}
          aria-expanded={summaryOpen}
        >
          <Share2 size={16} aria-hidden />
          Resumo
        </button>
        <button type="button" className="toolbar-btn" onClick={onReminder}>
          <Calendar size={16} aria-hidden />
          Lembrete 30d
        </button>
        {shareMsg ? (
          <span className="toolbar-msg" role="status">
            {shareMsg}
          </span>
        ) : null}
      </div>
      <div className="container">{children}</div>
    </div>
  );
}

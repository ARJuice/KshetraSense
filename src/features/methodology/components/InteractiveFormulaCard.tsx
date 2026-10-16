import React, { useState } from 'react';
import { BookOpen, Check, Copy, Info } from 'lucide-react';
import { MathView } from '../../../components/ui/MathView';

export interface FormulaVariable {
  symbol: string;
  meaning: string;
  unit?: string;
}

export interface InteractiveFormulaCardProps {
  name: string;
  latex: string;
  description: string;
  variables: FormulaVariable[];
  sourceRef?: string;
  className?: string;
}

export const InteractiveFormulaCard: React.FC<InteractiveFormulaCardProps> = ({
  name,
  latex,
  description,
  variables,
  sourceRef,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);
  const [showVariables, setShowVariables] = useState(true);

  const handleCopy = () => {
    navigator.clipboard.writeText(latex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all duration-200 hover:border-emerald-300 hover:shadow-md ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 font-semibold shadow-xs">
            <BookOpen size={13} />
          </div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">{name}</h4>
        </div>
        <div className="flex items-center gap-1.5">
          {sourceRef && (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200/60">
              {sourceRef}
            </span>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 active:scale-95"
            title="Copy LaTeX formula"
          >
            {copied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
            <span>{copied ? 'Copied' : 'LaTeX'}</span>
          </button>
        </div>
      </div>

      {/* Formula Display Area with KaTeX */}
      <div className="my-3 flex items-center justify-center rounded-xl bg-slate-900 py-4 px-4 text-emerald-300 shadow-inner overflow-x-auto min-h-[64px]">
        <MathView math={latex} block className="text-emerald-300 text-sm md:text-base font-semibold" />
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed text-slate-600">{description}</p>

      {/* Variables Toggle & Table */}
      {variables.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowVariables((prev) => !prev)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-emerald-700 transition-colors"
            >
              <Info size={12} className="text-slate-400" />
              <span>{showVariables ? 'Hide Parameters' : 'Show Parameters & Units'} ({variables.length})</span>
            </button>
          </div>

          {showVariables && (
            <div className="mt-2.5 overflow-x-auto rounded-lg border border-slate-100 transition-all">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-semibold">
                    <th className="py-1.5 px-3">Symbol</th>
                    <th className="py-1.5 px-3">Parameter Definition</th>
                    <th className="py-1.5 px-3 font-mono">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {variables.map((v, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-1.5 px-3 font-medium text-emerald-800">
                        <MathView math={v.symbol} />
                      </td>
                      <td className="py-1.5 px-3 text-slate-600">{v.meaning}</td>
                      <td className="py-1.5 px-3 font-mono text-slate-400">{v.unit || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

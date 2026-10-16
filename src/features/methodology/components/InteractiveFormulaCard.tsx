import React, { useState } from 'react';
import { BookOpen, Check, Copy, Info } from 'lucide-react';

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
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-emerald-300 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <BookOpen size={13} />
          </div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">{name}</h4>
        </div>
        <div className="flex items-center gap-1.5">
          {sourceRef && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              {sourceRef}
            </span>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            title="Copy LaTeX formula"
          >
            {copied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
            <span>{copied ? 'Copied' : 'LaTeX'}</span>
          </button>
        </div>
      </div>

      {/* Formula Display Area */}
      <div className="my-3 flex items-center justify-center rounded-lg bg-slate-900 py-4 px-3 text-slate-100 shadow-inner">
        <code className="formula-block text-center text-sm md:text-base font-semibold text-emerald-300">
          {latex}
        </code>
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed text-slate-600">{description}</p>

      {/* Variables Toggle & Table */}
      {variables.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowVariables((prev) => !prev)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-emerald-700"
            >
              <Info size={12} className="text-slate-400" />
              <span>{showVariables ? 'Hide Parameters' : 'Show Parameters & Units'} ({variables.length})</span>
            </button>
          </div>

          {showVariables && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-medium">
                    <th className="py-1 px-2 font-mono">Symbol</th>
                    <th className="py-1 px-2">Physical Agronomic Definition</th>
                    <th className="py-1 px-2 font-mono">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {variables.map((v, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-1 px-2 font-mono font-bold text-emerald-800">{v.symbol}</td>
                      <td className="py-1 px-2">{v.meaning}</td>
                      <td className="py-1 px-2 font-mono text-slate-500">{v.unit || 'dimensionless'}</td>
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

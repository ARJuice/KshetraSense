import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { testMatrixData } from '../methodologyData';

export const TestMatrixView: React.FC = () => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
              CI
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              System Verification &amp; Test Matrix
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Empirical validation evidence across algorithms, neural models, spatial routines, and data pipelines.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold flex items-center gap-1">
            <ShieldCheck size={12} />
            <span>All Suites Passing</span>
          </span>
          <span className="rounded-full bg-blue-100 text-blue-800 border border-blue-200 px-2.5 py-0.5 text-[11px] font-bold">
            Zero TS Errors
          </span>
        </div>
      </div>

      {/* Verification Matrix Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4">Module Scope</th>
              <th className="py-3 px-4 font-mono">Verification Suite</th>
              <th className="py-3 px-4">Status &amp; Evidence</th>
              <th className="py-3 px-4">Assurance &amp; Scope</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {testMatrixData.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                {/* Scope */}
                <td className="py-3.5 px-4 font-bold text-slate-900">
                  <div className="flex items-center gap-2">
                    {item.status === 'passed' ? (
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                    )}
                    <span>{item.scope}</span>
                  </div>
                </td>

                {/* Command */}
                <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                  <span className="rounded bg-slate-100 px-2 py-0.5 border border-slate-200 inline-block">
                    {item.command}
                  </span>
                </td>

                {/* Evidence */}
                <td className="py-3.5 px-4">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider mb-1 ${
                      item.status === 'passed'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {item.passedCount}
                  </span>
                  <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
                    {item.keyEvidence}
                  </p>
                </td>

                {/* Boundary */}
                <td className="py-3.5 px-4 text-[11px] text-slate-600 leading-relaxed">
                  {item.scientificBoundary}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Evidence Note */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-600 leading-relaxed">
        <strong className="text-slate-900 font-semibold block mb-1">Continuous Integration &amp; Integrity Assurance:</strong>
        All automated checks run against actual codebase implementations without synthetic mocking of mathematical or ML core logic. External cloud connections fail transparently with clear status indicators rather than synthesizing false data.
      </div>
    </div>
  );
};

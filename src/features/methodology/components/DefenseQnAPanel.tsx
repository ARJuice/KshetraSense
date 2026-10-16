import React, { useState } from 'react';
import {
  ChevronDown,
  HelpCircle,
  Search,
  Sparkles,
} from 'lucide-react';
import { defenseQAList } from '../methodologyData';

export const DefenseQnAPanel: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({
    'q1-idw-interpolation': true,
    'q3-modular-architecture': true,
  });

  const categories = ['All', 'Spatial ML', 'Time Series', 'Computer Vision', 'Agronomy', 'System Architecture'];

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredQuestions = defenseQAList.filter((item) => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.briefAnswer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.deepScientificDefense.some((d) => d.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      {/* Title & Lede */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
              FAQ
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              System Architecture &amp; Key Design Decisions
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Clear technical rationale and design principles for project presentation, architectural review, and agronomic evaluation.
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-800 self-start sm:self-auto flex items-center gap-1.5">
          <Sparkles size={13} />
          <span>Core Design Decisions</span>
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search topics (Interpolation, Architecture...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Questions Accordion List */}
      <div className="space-y-3">
        {filteredQuestions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
            No design topics matched your filter or search query.
          </div>
        ) : (
          filteredQuestions.map((item) => {
            const isExpanded = !!expandedIds[item.id];
            return (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white transition-all overflow-hidden shadow-xs hover:border-slate-300"
              >
                {/* Accordion Header */}
                <button
                  onClick={() => toggleExpand(item.id)}
                  className="w-full flex items-start justify-between gap-4 p-4 text-left transition-colors hover:bg-slate-50/70"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-700">
                      0{item.questionNumber}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                          {item.category}
                        </span>
                      </div>
                      <h4 className="mt-1 text-sm font-bold text-slate-900">{item.question}</h4>
                    </div>
                  </div>
                  <div className="text-slate-400 hover:text-slate-600 shrink-0 mt-1">
                    <ChevronDown
                      size={16}
                      className={`transition-transform duration-250 ease-out ${
                        isExpanded ? 'rotate-180 text-emerald-600' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Accordion Expanded Content with Smooth Grid-Row Transition */}
                <div
                  className={`grid transition-all duration-300 ease-in-out ${
                    isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="border-t border-slate-100 bg-slate-50/40 p-5 space-y-4">
                      {/* Executive Summary Answer */}
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3.5 text-xs text-emerald-950">
                        <strong className="block text-emerald-900 font-bold mb-1">Key Summary:</strong>
                        <p className="leading-relaxed">{item.briefAnswer}</p>
                      </div>

                      {/* Scientific Defense Points */}
                      <div className="space-y-2">
                        <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                          Technical Rationale &amp; Architectural Context
                        </h5>
                        <ul className="space-y-2 text-xs text-slate-700 list-disc list-inside">
                          {item.deepScientificDefense.map((point, pIdx) => (
                            <li key={pIdx} className="leading-relaxed">
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Operational Scope */}
                      <div className="rounded-lg border border-slate-200 bg-white p-3 flex items-start gap-2 text-xs text-slate-700">
                        <HelpCircle size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-bold text-slate-900">Operational Scope: </strong>
                          <span>{item.keyRiskOrLimitation}</span>
                        </div>
                      </div>

                      {/* Primary Citations */}
                      {item.primaryCitations && item.primaryCitations.length > 0 && (
                        <div className="border-t border-slate-200/60 pt-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Key References:
                          </span>
                          <div className="flex flex-wrap gap-2 text-[10px] text-slate-600 font-mono">
                            {item.primaryCitations.map((cite, cIdx) => (
                              <span key={cIdx} className="rounded bg-white border border-slate-200 px-2 py-0.5">
                                {cite}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

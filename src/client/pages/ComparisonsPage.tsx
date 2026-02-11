import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { api } from '../lib/api';
import type { CompanyRanking, CompanyGroup } from '@shared/types';

const col = createColumnHelper<CompanyRanking>();

function RatingBar({ dist }: { dist: CompanyRanking['ratingDistribution'] }) {
  const bars = [5, 4, 3, 2, 1] as const;
  return (
    <div className="relative group flex flex-col gap-0.5 w-28">
      {bars.map((star) => (
        <div key={star} className="flex items-center gap-1">
          <span className="text-[10px] text-gray-400 w-3 text-right">{star}</span>
          <div className="flex-1 bg-gray-100 rounded-sm h-2">
            <div
              className="bg-amber-400 rounded-sm h-2"
              style={{ width: `${dist[star].percent}%` }}
            />
          </div>
        </div>
      ))}
      <div className="hidden group-hover:block absolute left-full top-0 ml-2 z-10 bg-gray-800/90 text-white text-[11px] leading-[1.7] px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
        {bars.map((s) => (
          <div key={s}>{s}★: {dist[s].count} ({dist[s].percent}%)</div>
        ))}
      </div>
    </div>
  );
}

function TrendDisplay({ value }: { value: number }) {
  if (Math.abs(value) < 0.1) {
    return <span className="text-gray-400 text-sm">— stable</span>;
  }
  if (value > 0) {
    return <span className="text-green-600 text-sm">+{value.toFixed(2)}</span>;
  }
  return <span className="text-red-600 text-sm">{value.toFixed(2)}</span>;
}

const columns = [
  col.display({
    id: 'rowNumber',
    header: '#',
    size: 50,
    cell: ({ row }) => {
      const n = row.index + 1;
      return (
        <span className={`font-medium ${n <= 3 ? 'text-amber-600' : 'text-gray-500'}`}>
          {n}
        </span>
      );
    },
  }),
  col.accessor('name', {
    header: 'Company',
    size: 200,
    cell: ({ getValue, row }) => (
      <div>
        <div className="font-medium text-gray-900">{getValue()}</div>
        <div className="flex gap-1 mt-0.5">
          {row.original.services.map((s) => (
            <span key={s} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
              {s}
            </span>
          ))}
        </div>
      </div>
    ),
  }),
  col.accessor('calculatedAvg', {
    header: 'Avg Rating',
    size: 100,
    cell: ({ getValue }) => (
      <span className="font-semibold text-gray-900">{getValue().toFixed(2)}</span>
    ),
  }),
  col.accessor('reviewCount', {
    header: 'Reviews',
    size: 80,
    cell: ({ getValue }) => (
      <span className="text-gray-700">{getValue().toLocaleString()}</span>
    ),
  }),
  col.display({
    id: 'distribution',
    header: 'Distribution',
    size: 150,
    cell: ({ row }) => <RatingBar dist={row.original.ratingDistribution} />,
  }),
  col.accessor('recentTrend', {
    header: 'Trend (3mo)',
    size: 100,
    cell: ({ getValue }) => <TrendDisplay value={getValue()} />,
  }),
  col.accessor('reviewVelocity', {
    header: 'Velocity (3mo)',
    size: 110,
    cell: ({ getValue }) => (
      <span className="text-gray-700 text-sm">{getValue()}/mo</span>
    ),
  }),
  col.accessor('responseRate', {
    header: 'Response',
    size: 90,
    cell: ({ getValue }) => (
      <span className="text-gray-700 text-sm">{getValue().toFixed(0)}%</span>
    ),
  }),
  col.accessor('url', {
    header: '',
    size: 60,
    enableSorting: false,
    cell: ({ getValue }) => {
      const url = getValue();
      return url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:underline"
        >
          Maps
        </a>
      ) : null;
    },
  }),
];

export default function ComparisonsPage() {
  const [filter, setFilter] = useState('all');
  const [groupId, setGroupId] = useState<number | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  const queryParams = groupId ? `group=${groupId}` : `filter=${filter}`;

  const { data, isLoading } = useQuery({
    queryKey: ['comparisons', queryParams],
    queryFn: () =>
      api.get<{ rankings: CompanyRanking[]; filter: string }>(
        `/api/comparisons?${queryParams}`
      ),
  });

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.get<CompanyGroup[]>('/api/groups'),
  });

  const rankings = useMemo(() => data?.rankings ?? [], [data]);

  const table = useReactTable({
    data: rankings,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const body: Record<string, unknown> = {};
      if (groupId) body.groupId = groupId;
      else body.filter = filter;

      const res = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rankd-comparison-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  }, [filter, groupId]);

  function handleFilterChange(value: string) {
    if (value.startsWith('group:')) {
      setGroupId(parseInt(value.slice(6), 10));
      setFilter('all');
    } else {
      setGroupId(null);
      setFilter(value);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Comparison</h2>
        <div className="flex items-center gap-3">
          <select
            value={groupId ? `group:${groupId}` : filter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
          >
            <optgroup label="Service Filters">
              <option value="all">All Companies</option>
              <option value="removals">Removals</option>
              <option value="self-storage">Self-Storage</option>
              <option value="mobile-storage">Mobile Storage</option>
              <option value="removals-and-storage">Removals + Storage</option>
            </optgroup>
            {groups && groups.length > 0 && (
              <optgroup label="Groups">
                {groups.map((g) => (
                  <option key={g.id} value={`group:${g.id}`}>
                    {g.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <button
            onClick={handleExport}
            disabled={exporting || rankings.length === 0}
            className="bg-gray-800 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : rankings.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500 text-sm">
          No companies found. Import review data to get started.
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => {
                    const isName = header.column.id === 'name';
                    return (
                      <th
                        key={header.id}
                        className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer select-none ${isName ? 'text-left' : 'text-center'}`}
                        onClick={header.column.getToggleSortingHandler()}
                        style={{ width: header.getSize() }}
                      >
                        <div className={`flex items-center gap-1 ${isName ? '' : 'justify-center'}`}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? ''}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200">
              {table.getRowModel().rows.map((row, visualIndex) => (
                <tr
                  key={row.id}
                  className={row.original.isOurCompany ? 'bg-blue-50' : ''}
                >
                  {row.getVisibleCells().map((cell) => {
                    const isName = cell.column.id === 'name';
                    return (
                      <td key={cell.id} className={`px-4 py-3 ${isName ? '' : 'text-center'}`}>
                        {cell.column.id === 'rowNumber'
                          ? <span className={`font-medium ${visualIndex < 3 ? 'text-amber-600' : 'text-gray-500'}`}>{visualIndex + 1}</span>
                          : flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
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
import type { CompanyRanking, ComparisonSnapshot } from '@shared/types';

const col = createColumnHelper<CompanyRanking>();

const snapshotColumns = [
  col.accessor('rank', {
    header: '#',
    size: 50,
    cell: ({ getValue }) => <span className="text-gray-500 font-medium">{getValue()}</span>,
  }),
  col.accessor('name', {
    header: 'Company',
    size: 200,
    cell: ({ getValue, row }) => (
      <span className={row.original.isOurCompany ? 'font-semibold text-blue-700' : 'text-gray-900'}>
        {getValue()}
      </span>
    ),
  }),
  col.accessor('calculatedAvg', {
    header: 'Avg Rating',
    size: 100,
    cell: ({ getValue }) => <span className="font-semibold">{getValue().toFixed(2)}</span>,
  }),
  col.accessor('reviewCount', {
    header: 'Reviews',
    size: 80,
    cell: ({ getValue }) => getValue().toLocaleString(),
  }),
  col.accessor('recentTrend', {
    header: 'Trend',
    size: 80,
    cell: ({ getValue }) => {
      const v = getValue();
      if (Math.abs(v) < 0.1) return <span className="text-gray-400">—</span>;
      return v > 0
        ? <span className="text-green-600">+{v.toFixed(2)}</span>
        : <span className="text-red-600">{v.toFixed(2)}</span>;
    },
  }),
  col.accessor('reviewVelocity', {
    header: 'Velocity',
    size: 80,
    cell: ({ getValue }) => <span className="text-sm">{getValue()}/mo</span>,
  }),
  col.accessor('responseRate', {
    header: 'Response',
    size: 80,
    cell: ({ getValue }) => <span className="text-sm">{getValue().toFixed(0)}%</span>,
  }),
];

function SnapshotView({ id }: { id: number }) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['snapshot', id],
    queryFn: () =>
      api.get<ComparisonSnapshot>(`/api/comparisons/snapshots/${id}`),
  });

  const table = useReactTable({
    data: data?.rankings ?? [],
    columns: snapshotColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (isLoading) return <p className="text-gray-500">Loading snapshot...</p>;
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">{data.comparisonName}</h3>
        <span className="text-sm text-gray-500">
          {new Date(data.createdAt).toLocaleDateString()}
        </span>
      </div>
      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={row.original.isOurCompany ? 'bg-blue-50' : ''}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SnapshotsPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: snapshots, isLoading } = useQuery({
    queryKey: ['snapshots'],
    queryFn: () =>
      api.get<{ id: number; comparisonName: string; createdAt: string }[]>(
        '/api/comparisons/snapshots'
      ),
  });

  if (isLoading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">History</h2>

      {!snapshots || snapshots.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500 text-sm">
          No snapshots yet. Snapshots are created after weekly data refreshes.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                Snapshots
              </div>
              <ul className="divide-y divide-gray-200">
                {snapshots.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => setSelectedId(s.id)}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 ${
                        selectedId === s.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      <div className="font-medium">{s.comparisonName}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="lg:col-span-3">
            {selectedId ? (
              <SnapshotView id={selectedId} />
            ) : (
              <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500 text-sm">
                Select a snapshot to view.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

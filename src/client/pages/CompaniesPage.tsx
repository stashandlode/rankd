import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useSession } from '../hooks/useAuth';
import type { Company } from '@shared/types';

const SERVICE_OPTIONS = ['Removals', 'Self-Storage', 'Mobile Storage'];

export default function CompaniesPage() {
  const { data: user } = useSession();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editServices, setEditServices] = useState<string[]>([]);

  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => api.get<Company[]>('/api/companies'),
  });

  const { data: ourCompany } = useQuery({
    queryKey: ['our-company'],
    queryFn: () => api.get<{ placeId: string | null }>('/api/settings/our-company'),
  });

  const updateCompany = useMutation({
    mutationFn: ({ placeId, ...data }: { placeId: string; name: string; url: string; services: string[] }) =>
      api.put(`/api/companies/${placeId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setEditing(null);
    },
  });

  const setOurCompany = useMutation({
    mutationFn: (placeId: string) => api.put('/api/settings/our-company', { placeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['our-company'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });

  function startEdit(c: Company) {
    setEditing(c.placeId);
    setEditName(c.name);
    setEditUrl(c.url || '');
    setEditServices(c.services);
  }

  function saveEdit(placeId: string) {
    updateCompany.mutate({ placeId, name: editName, url: editUrl, services: editServices });
  }

  function toggleService(svc: string) {
    setEditServices((prev) =>
      prev.includes(svc) ? prev.filter((s) => s !== svc) : [...prev, svc]
    );
  }

  if (isLoading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Companies</h2>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Services</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Our Company</th>
              {user?.role === 'admin' && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {companies?.map((c) => (
              <tr
                key={c.placeId}
                className={ourCompany?.placeId === c.placeId ? 'bg-blue-50' : ''}
              >
                {editing === c.placeId ? (
                  <>
                    <td className="px-6 py-4">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                      />
                      <input
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        placeholder="URL"
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-full mt-1"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {SERVICE_OPTIONS.map((svc) => (
                          <label key={svc} className="flex items-center gap-1 text-sm">
                            <input
                              type="checkbox"
                              checked={editServices.includes(svc)}
                              onChange={() => toggleService(svc)}
                            />
                            {svc}
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4" />
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => saveEdit(c.placeId)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{c.name}</div>
                      {c.url && (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline"
                        >
                          View on Maps
                        </a>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {c.services.map((s) => (
                          <span
                            key={s}
                            className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded"
                          >
                            {s}
                          </span>
                        ))}
                        {c.services.length === 0 && (
                          <span className="text-xs text-gray-400">No services set</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {ourCompany?.placeId === c.placeId ? (
                        <span className="text-xs font-medium text-blue-600">Ours</span>
                      ) : user?.role === 'admin' ? (
                        <button
                          onClick={() => setOurCompany.mutate(c.placeId)}
                          className="text-xs text-gray-400 hover:text-blue-600"
                        >
                          Set as ours
                        </button>
                      ) : null}
                    </td>
                    {user?.role === 'admin' && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => startEdit(c)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                      </td>
                    )}
                  </>
                )}
              </tr>
            ))}
            {companies?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500 text-sm">
                  No companies yet. Import review data to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

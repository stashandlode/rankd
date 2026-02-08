import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';

interface ImportResult {
  company: { placeId: string; name: string };
  reviewsImported: number;
  reviewsSkipped: number;
}

export default function ImportPage() {
  const [results, setResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const importMutation = useMutation({
    mutationFn: (data: unknown) => api.post<ImportResult>('/api/reviews/import', data),
    onSuccess: (result) => {
      setResults((prev) => [...prev, result]);
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    setError(null);

    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        importMutation.mutate(json);
      } catch {
        setError(`Failed to parse ${file.name}`);
      }
    }

    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Import Reviews</h2>
        <p className="text-sm text-gray-500 mt-1">
          Upload JSON files from the browser console extraction script.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Select JSON file(s)</span>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </label>

        {importMutation.isPending && (
          <p className="mt-4 text-sm text-gray-500">Importing...</p>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-600">{error}</p>
        )}
      </div>

      {results.length > 0 && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Imported</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Skipped</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {results.map((r, i) => (
                <tr key={i}>
                  <td className="px-6 py-4 text-sm text-gray-900">{r.company.name}</td>
                  <td className="px-6 py-4 text-sm text-right text-green-600">{r.reviewsImported}</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-500">{r.reviewsSkipped}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

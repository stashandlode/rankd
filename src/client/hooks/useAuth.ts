import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { SessionUser } from '@shared/types';

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: () => api.get<SessionUser>('/api/auth/session'),
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: { username: string; password: string }) =>
      api.post<SessionUser>('/api/auth/login', credentials),
    onSuccess: (user) => {
      queryClient.setQueryData(['session'], user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post('/api/auth/logout'),
    onSuccess: () => {
      queryClient.setQueryData(['session'], null);
      queryClient.clear();
    },
  });
}

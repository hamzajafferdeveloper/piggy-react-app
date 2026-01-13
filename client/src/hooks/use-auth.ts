import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { type UpsertUser } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

async function fetchUser(): Promise<User | null> {

  const response = await fetch("/api/user");
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading, error } = useQuery<User | null, Error>({
    queryKey: ["/api/user"],
    queryFn: fetchUser,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: Pick<UpsertUser, "email" | "password">) => {

      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: UpsertUser) => {
      const res = await apiRequest("POST", "/api/register", data);

      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
    },
  });

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  };
}


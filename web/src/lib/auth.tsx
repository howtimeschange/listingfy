import { useMemo, type ReactNode } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { api, ApiError } from "@/lib/api-client"
import { AuthContext, type AuthContextValue, type AuthUser } from "@/lib/auth-context"

interface AuthResponse {
  user: AuthUser | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery<AuthResponse>({
    queryKey: ["auth", "me"],
    queryFn: () => api.get("/auth/me"),
    retry: false,
  })

  const user = data?.user ?? null
  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    logout: async () => {
      try {
        await api.post("/auth/logout")
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) throw error
      } finally {
        await queryClient.cancelQueries()
        queryClient.setQueryData<AuthResponse>(["auth", "me"], { user: null })
        queryClient.removeQueries({
          predicate: (query) => query.queryKey[0] !== "auth",
        })
      }
    },
    hasPermission: (permission: string) => Boolean(user?.permissions.includes(permission)),
  }), [isLoading, queryClient, user])

  if (error instanceof ApiError && error.status === 401) {
    return (
      <AuthContext.Provider value={{ ...value, user: null, isLoading: false }}>
        {children}
      </AuthContext.Provider>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

import { createContext, useContext } from "react"

export interface AuthUser {
  id: number
  username: string
  display_name: string
  email: string | null
  status: string
  roles: string[]
  permissions: string[]
}

export interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  logout: () => Promise<void>
  hasPermission: (permission: string) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth must be used inside AuthProvider")
  return value
}

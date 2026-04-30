import { Navigate, useLocation } from "react-router"
import { useAuth } from "@/lib/auth-context"
import { AppLayout } from "./app-layout"

export function ProtectedLayout() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        正在进入系统...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <AppLayout />
}

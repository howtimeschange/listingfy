import { Outlet } from "react-router"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useAuth } from "@/lib/auth-context"
import { AppSidebar } from "./app-sidebar"
import { AppHeader } from "./app-header"

export function AppLayout() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <SidebarProvider className="h-svh max-h-svh overflow-hidden bg-transparent">
      <AppSidebar />
      <SidebarInset className="min-h-0 bg-transparent">
        <AppHeader />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

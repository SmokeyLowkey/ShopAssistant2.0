"use client"

import { ReactNode } from "react"
import { AppSidebar } from "./app-sidebar"
import { AppHeader } from "./app-header"

interface AppLayoutProps {
  children: ReactNode
  activeRoute?: string
  searchPlaceholder?: string
  onSearch?: (value: string) => void
  searchValue?: string
}

export function AppLayout({
  children,
  activeRoute,
  searchPlaceholder,
  onSearch,
  searchValue
}: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-slate-900">
      <AppSidebar activeRoute={activeRoute} />
      
      <div className="flex-1 flex flex-col min-h-0 ">
        <AppHeader 
          searchPlaceholder={searchPlaceholder}
          onSearch={onSearch}
          searchValue={searchValue}
        />
        
        <main className="flex-1 p-2 bg-slate-900 min-h-0 overflow-auto flex flex-col">
          {children}
        </main>
      </div>
    </div>
  )
}
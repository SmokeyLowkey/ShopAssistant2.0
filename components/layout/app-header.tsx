"use client"

import { Bell, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { UserProfileMenu } from "@/components/user-profile-menu"

interface AppHeaderProps {
  searchPlaceholder?: string
  onSearch?: (value: string) => void
  searchValue?: string
}

export function AppHeader({ 
  searchPlaceholder = "Search parts, vehicles, suppliers...",
  onSearch,
  searchValue = ""
}: AppHeaderProps) {
  return (
    <header className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder={searchPlaceholder}
              className="pl-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
              value={searchValue}
              onChange={(e) => onSearch && onSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="relative text-slate-300 hover:bg-slate-700">
            <Bell className="w-5 h-5" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-600 rounded-full"></div>
          </Button>

          <UserProfileMenu />
        </div>
      </div>
    </header>
  )
}
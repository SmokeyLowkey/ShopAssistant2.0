"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Truck,
  BarChart3,
  Search,
  Users,
  Package,
  Wrench,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  HelpCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface SidebarItem {
  icon: any
  label: string
  href: string
  active?: boolean
}

interface AppSidebarProps {
  activeRoute?: string
}

export function AppSidebar({ activeRoute = "/" }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarCollapsed')
      return saved === 'true'
    }
    return false
  })

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(collapsed))
  }, [collapsed])

  const sidebarItems: SidebarItem[] = [
    { icon: BarChart3, label: "Dashboard", href: "/", active: activeRoute === "/" },
    { icon: Truck, label: "Vehicles", href: "/vehicles", active: activeRoute === "/vehicles" },
    { icon: Search, label: "Parts Search", href: "/parts", active: activeRoute === "/parts" },
    { icon: Users, label: "Suppliers", href: "/suppliers", active: activeRoute === "/suppliers" },
    { icon: Package, label: "Orders", href: "/orders", active: activeRoute === "/orders" },
    { icon: Wrench, label: "Maintenance", href: "/maintenance", active: activeRoute === "/maintenance" },
    { icon: HelpCircle, label: "Support", href: "/support", active: activeRoute === "/support" },
    { icon: FileText, label: "Reports", href: "/reports", active: activeRoute === "/reports" },
    { icon: Settings, label: "Settings", href: "/settings", active: activeRoute === "/settings" },
  ]

  return (
    <div
      className={`${collapsed ? "w-16" : "w-64"} bg-slate-800 border-r border-slate-700 transition-all duration-300 flex flex-col`}
    >
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
            <Truck className="w-5 h-5 text-white" />
          </div>
          {!collapsed && <span className="font-bold text-lg text-white">PartsIQ</span>}
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {sidebarItems.map((item, index) => (
            <li key={index}>
              <Link href={item.href}>
                <Button
                  variant={item.active ? "default" : "ghost"}
                  className={`w-full ${collapsed ? "justify-center px-0" : "justify-start"} gap-3 ${
                    item.active
                      ? "bg-orange-600 text-white hover:bg-orange-700"
                      : "text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {!collapsed && <span>{item.label}</span>}
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-700">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-center text-slate-300 hover:bg-slate-700 hover:text-white"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  )
}
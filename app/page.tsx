"use client"

import { useState } from "react"
import Link from "next/link"
import { OrphanedEmailsAlert } from "@/components/ui/orphaned-emails-alert"
import {
  Bell,
  Search,
  Truck,
  Settings,
  BarChart3,
  Package,
  Users,
  Wrench,
  FileText,
  AlertTriangle,
  Calendar,
  DollarSign,
  Plus,
  TrendingUp,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line } from "recharts"
import { AppLayout } from "@/components/layout/app-layout"

const recentActivity = [
  { text: "Hydraulic filter identified for CAT 320D", time: "2 hours ago" },
  { text: "Quote received from Miller Parts Co.", time: "4 hours ago" },
  { text: "Order #1234 shipped via FedEx", time: "Yesterday" },
  { text: "Service alert: John Deere 850K due for maintenance", time: "Yesterday" },
  { text: "New supplier Johnson Heavy Parts added", time: "2 days ago" },
]

const weeklyTrends = [
  { name: "Mon", value: 12 },
  { name: "Tue", value: 8 },
  { name: "Wed", value: 15 },
  { name: "Thu", value: 6 },
  { name: "Fri", value: 10 },
  { name: "Sat", value: 4 },
  { name: "Sun", value: 7 },
]

const savingsData = [
  { month: "Jan", savings: 5200 },
  { month: "Feb", savings: 6800 },
  { month: "Mar", savings: 7200 },
  { month: "Apr", savings: 8450 },
]

export default function ConstructionDashboard() {
  const [searchTerm, setSearchTerm] = useState("")

  return (
    <AppLayout activeRoute="/" searchValue={searchTerm} onSearch={(value) => setSearchTerm(value)}>
      {/* Orphaned Emails Alert */}
      <OrphanedEmailsAlert />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
        {/* Fleet Overview Card */}
        <Card className="xl:col-span-2 bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b border-slate-700">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-white">
              <Settings className="w-4 h-4" />
              Fleet Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-400">Total Vehicles</span>
                </div>
                <div className="text-2xl font-bold text-white">23</div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-400">Active Alerts</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-white">5</span>
                  <Badge className="bg-orange-600 text-white">
                    Alert
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-400">Upcoming Services</span>
                </div>
                <div className="text-2xl font-bold text-white">8</div>
              </div>

              <div className="space-y-2">
                <div className="text-sm text-slate-400">Fleet Health</div>
                <div className="flex items-center gap-2">
                  <Progress value={85} className="flex-1 bg-slate-700" />
                  <span className="text-sm font-medium text-green-600">85%</span>
                </div>
              </div>
            </div>

            <Button variant="outline" className="w-full text-orange-600 hover:bg-slate-700 hover:text-white">
              View All Vehicles
            </Button>
          </CardContent>
        </Card>

        {/* Parts Requests Status */}
        <Card className="xl:col-span-2 bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b border-slate-700">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-white">
              <Package className="w-4 h-4" />
              Parts Requests
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Pending Quotes</span>
                <Badge className="bg-yellow-600 text-white">
                  3
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Parts on Order</span>
                <Badge className="bg-blue-600 text-white">
                  7
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Recently Delivered</span>
                <Badge className="bg-green-600 text-white">
                  12
                </Badge>
              </div>
            </div>

            <div className="h-24 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyTrends}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis hide />
                  <Bar dataKey="value" fill="#f97316" radius={2} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <Button variant="outline" className="w-full text-orange-600 hover:bg-slate-700 hover:text-white">
              Manage Requests
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Cost Savings Tracker */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b border-slate-700">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-white">
              <DollarSign className="w-4 h-4" />
              Cost Savings This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2 mb-4">
              <div className="text-3xl font-bold text-green-600">$8,450</div>
              <div className="text-sm text-slate-400">vs Manual Sourcing</div>
              <div className="flex items-center gap-1 text-green-600">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">+23%</span>
              </div>
            </div>

            <div className="h-20 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={savingsData}>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis hide />
                  <Line
                    type="monotone"
                    dataKey="savings"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={{ fill: "#f97316", strokeWidth: 2, r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <Button variant="outline" className="w-full text-orange-600 hover:bg-slate-700 hover:text-white">
              View Savings Report
            </Button>
          </CardContent>
        </Card>

        {/* Quick Actions Panel */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="border-b border-slate-700">
            <CardTitle className="text-sm font-medium text-white">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-3">
              <Button className="h-16 flex flex-col gap-1 bg-orange-600 hover:bg-orange-700 text-white">
                <Search className="w-5 h-5" />
                <span className="text-xs">Find Parts</span>
              </Button>

              <Button
                variant="secondary"
                className="h-16 flex flex-col gap-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <Plus className="w-5 h-5" />
                <span className="text-xs">Add Vehicle</span>
              </Button>

              <Button variant="secondary" className="h-16 flex flex-col gap-1 bg-blue-600 hover:bg-blue-700 text-white">
                <Wrench className="w-5 h-5" />
                <span className="text-xs">Service Request</span>
              </Button>

              <Button variant="outline" className="h-16 flex flex-col gap-1 text-orange-600 hover:bg-slate-700 hover:text-white">
                <Users className="w-5 h-5" />
                <span className="text-xs">View Suppliers</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Feed */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b border-slate-700">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-white">
            <Clock className="w-4 h-4" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start gap-3 pb-3 border-b border-slate-700 last:border-0">
                <div className="w-2 h-2 bg-orange-600 rounded-full mt-2 flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{activity.text}</p>
                  <p className="text-xs text-slate-400 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>

          <Button variant="outline" className="w-full mt-4 text-orange-600 hover:bg-slate-700 hover:text-white">
            See All Activity
          </Button>
        </CardContent>
      </Card>
    </AppLayout>
  )
}

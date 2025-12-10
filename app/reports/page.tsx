"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Search,
  Truck,
  Settings,
  BarChart3,
  Package,
  Users,
  Wrench,
  FileText,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  CheckCircle,
  Filter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts"
import { AppLayout } from "@/components/layout/app-layout"

const reportStats = [
  {
    label: "Total Cost Savings",
    value: "$127,450",
    change: "+23%",
    trend: "up",
    icon: DollarSign,
    color: "text-green-600",
  },
  {
    label: "Fleet Utilization",
    value: "87%",
    change: "+5%",
    trend: "up",
    icon: Truck,
    color: "text-blue-600",
  },
  {
    label: "Avg Response Time",
    value: "2.4 hrs",
    change: "-12%",
    trend: "down",
    icon: Clock,
    color: "text-green-600",
  },
  {
    label: "Parts Availability",
    value: "94%",
    change: "+2%",
    trend: "up",
    icon: Package,
    color: "text-blue-600",
  },
]

const monthlySavings = [
  { month: "Jul", savings: 8200, orders: 45 },
  { month: "Aug", savings: 9800, orders: 52 },
  { month: "Sep", savings: 11200, orders: 48 },
  { month: "Oct", savings: 10500, orders: 56 },
  { month: "Nov", savings: 12800, orders: 61 },
  { month: "Dec", savings: 14200, orders: 58 },
  { month: "Jan", savings: 15600, orders: 67 },
]

const fleetUtilization = [
  { month: "Jul", utilization: 82 },
  { month: "Aug", utilization: 85 },
  { month: "Sep", utilization: 79 },
  { month: "Oct", utilization: 88 },
  { month: "Nov", utilization: 91 },
  { month: "Dec", utilization: 86 },
  { month: "Jan", utilization: 87 },
]

const supplierPerformance = [
  { name: "Miller Parts Co.", value: 35, color: "#3b82f6" },
  { name: "Johnson Heavy", value: 25, color: "#10b981" },
  { name: "Komatsu Direct", value: 20, color: "#f59e0b" },
  { name: "Volvo Construction", value: 15, color: "#ef4444" },
  { name: "Others", value: 5, color: "#6b7280" },
]

const maintenanceData = [
  { month: "Jul", scheduled: 12, emergency: 8, preventive: 15 },
  { month: "Aug", scheduled: 15, emergency: 6, preventive: 18 },
  { month: "Sep", scheduled: 11, emergency: 9, preventive: 14 },
  { month: "Oct", scheduled: 18, emergency: 5, preventive: 22 },
  { month: "Nov", scheduled: 16, emergency: 7, preventive: 19 },
  { month: "Dec", scheduled: 14, emergency: 4, preventive: 21 },
  { month: "Jan", scheduled: 19, emergency: 6, preventive: 24 },
]

const recentReports = [
  {
    title: "Monthly Fleet Performance",
    type: "Fleet Report",
    date: "2024-01-25",
    status: "Generated",
    size: "2.4 MB",
  },
  {
    title: "Supplier Cost Analysis",
    type: "Financial Report",
    date: "2024-01-22",
    status: "Generated",
    size: "1.8 MB",
  },
  {
    title: "Parts Inventory Summary",
    type: "Inventory Report",
    date: "2024-01-20",
    status: "Generated",
    size: "3.1 MB",
  },
  {
    title: "Maintenance Schedule",
    type: "Maintenance Report",
    date: "2024-01-18",
    status: "Generating",
    size: "1.2 MB",
  },
]

export default function ReportsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [dateRange, setDateRange] = useState("last-6-months")
  const [reportType, setReportType] = useState("all")

  return (
    <AppLayout 
      activeRoute="/reports" 
      searchValue={searchTerm} 
      onSearch={(value) => setSearchTerm(value)}
      searchPlaceholder="Search reports..."
    >
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Reports & Analytics</h1>
          <p className="text-slate-400">Track performance, costs, and operational insights</p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-48 bg-slate-700 border-slate-600 text-white">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent className="bg-slate-700 border-slate-600 text-white">
              <SelectItem value="last-30-days">Last 30 Days</SelectItem>
              <SelectItem value="last-3-months">Last 3 Months</SelectItem>
              <SelectItem value="last-6-months">Last 6 Months</SelectItem>
              <SelectItem value="last-year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="text-orange-600 hover:bg-slate-700 hover:text-white">
            <Download className="w-4 h-4 mr-2" />
            Export All
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {reportStats.map((stat, index) => (
          <Card key={index} className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {stat.trend === "up" ? (
                      <TrendingUp className="w-3 h-3 text-green-600" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-green-600" />
                    )}
                    <span className="text-sm text-green-600 font-medium">{stat.change}</span>
                  </div>
                </div>
                <stat.icon className={`w-8 h-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Cost Savings Trend */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="border-b border-slate-700">
            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-white">
              <DollarSign className="w-5 h-5" />
              Cost Savings Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlySavings}>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis hide />
                  <Area
                    type="monotone"
                    dataKey="savings"
                    stroke="#f97316"
                    fill="#f97316"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700">
              <div>
                <p className="text-sm text-slate-400">Total Savings</p>
                <p className="text-lg font-bold text-green-600">$127,450</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Avg Monthly</p>
                <p className="text-lg font-bold text-white">$18,207</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fleet Utilization */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="border-b border-slate-700">
            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-white">
              <Truck className="w-5 h-5" />
              Fleet Utilization
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={fleetUtilization}>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis hide />
                  <Line
                    type="monotone"
                    dataKey="utilization"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700">
              <div>
                <p className="text-sm text-slate-400">Current Rate</p>
                <p className="text-lg font-bold text-blue-600">87%</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Target</p>
                <p className="text-lg font-bold text-white">85%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Supplier Distribution */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="border-b border-slate-700">
            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-white">
              <Users className="w-5 h-5" />
              Supplier Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={supplierPerformance}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {supplierPerformance.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-4">
              {supplierPerformance.slice(0, 3).map((supplier, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: supplier.color }}></div>
                    <span className="text-sm text-slate-300">{supplier.name}</span>
                  </div>
                  <span className="text-sm font-medium text-white">{supplier.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Maintenance Overview */}
        <Card className="lg:col-span-2 bg-slate-800 border-slate-700">
          <CardHeader className="border-b border-slate-700">
            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-white">
              <Wrench className="w-5 h-5" />
              Maintenance Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={maintenanceData}>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis hide />
                  <Bar dataKey="scheduled" fill="#3b82f6" radius={2} />
                  <Bar dataKey="emergency" fill="#ef4444" radius={2} />
                  <Bar dataKey="preventive" fill="#10b981" radius={2} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-slate-300">Scheduled</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-sm text-slate-300">Emergency</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-slate-300">Preventive</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Reports */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-700">
          <CardTitle className="text-lg font-semibold text-white">Recent Reports</CardTitle>
          <div className="flex gap-2">
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="w-48 bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Report Type" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600 text-white">
                <SelectItem value="all">All Reports</SelectItem>
                <SelectItem value="fleet">Fleet Reports</SelectItem>
                <SelectItem value="financial">Financial Reports</SelectItem>
                <SelectItem value="inventory">Inventory Reports</SelectItem>
                <SelectItem value="maintenance">Maintenance Reports</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="text-orange-600 hover:bg-slate-700 hover:text-white">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-4">
            {recentReports.map((report, index) => (
              <div key={index} className="flex items-center justify-between p-4 border border-slate-700 rounded-lg bg-slate-700/50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-orange-600/20 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">{report.title}</h4>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <span>{report.type}</span>
                      <span>•</span>
                      <span>{report.date}</span>
                      <span>•</span>
                      <span>{report.size}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {report.status === "Generated" ? (
                    <Badge className="bg-green-600 text-white">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Generated
                    </Badge>
                  ) : (
                    <Badge className="bg-yellow-600 text-white">
                      <Clock className="w-3 h-3 mr-1" />
                      Generating
                    </Badge>
                  )}
                  <Button variant="outline" size="sm" className="text-orange-600 hover:bg-slate-700 hover:text-white">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  )
}

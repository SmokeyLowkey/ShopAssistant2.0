"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Mail, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getOrphanedEmails } from "@/lib/api/emails"

export function OrphanedEmailsAlert() {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOrphanedEmails = async () => {
      try {
        setLoading(true)
        const response = await getOrphanedEmails()
        setCount(response.data.length)
      } catch (error) {
        console.error("Error fetching orphaned emails count:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchOrphanedEmails()

    // Set up a polling interval to check for new orphaned emails
    const interval = setInterval(fetchOrphanedEmails, 5 * 60 * 1000) // Check every 5 minutes

    return () => clearInterval(interval)
  }, [])

  if (loading || count === 0) {
    return null
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <div>
            <span className="font-medium text-amber-800">
              {count} orphaned email{count !== 1 ? 's' : ''} need{count === 1 ? 's' : ''} attention
            </span>
            <p className="text-sm text-amber-600">
              These emails are associated with suppliers but not with any quote request
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100">
          <Link href="/emails/orphaned">
            <Mail className="h-4 w-4 mr-1" />
            View Emails
          </Link>
        </Button>
      </div>
    </div>
  )
}
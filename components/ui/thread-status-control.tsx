"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle } from "lucide-react";
import { EmailThreadStatus } from "@prisma/client";
import { toast } from "@/components/ui/use-toast";

interface ThreadStatusControlProps {
  threadId: string;
  status: EmailThreadStatus;
  onStatusChange?: (newStatus: EmailThreadStatus) => void;
}

export function ThreadStatusControl({ 
  threadId, 
  status, 
  onStatusChange 
}: ThreadStatusControlProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  
  const getStatusBadgeVariant = (status: EmailThreadStatus) => {
    switch (status) {
      case "COMPLETED":
        return "default";
      case "CONVERTED_TO_ORDER":
        return "outline";
      case "WAITING_RESPONSE":
        return "secondary";
      case "FOLLOW_UP_NEEDED":
        return "destructive";
      default:
        return "secondary";
    }
  };
  
  const getStatusLabel = (status: EmailThreadStatus) => {
    switch (status) {
      case "CONVERTED_TO_ORDER":
        return "Active (Order)";
      case "COMPLETED":
        return "Completed";
      case "WAITING_RESPONSE":
        return "Waiting Response";
      case "FOLLOW_UP_NEEDED":
        return "Follow-up Needed";
      default:
        return status.replace(/_/g, " ");
    }
  };
  
  const markAsCompleted = async () => {
    try {
      setIsUpdating(true);
      
      const response = await fetch(`/api/email-threads/${threadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update status");
      }
      
      toast({
        title: "Thread marked as completed",
        description: "The communication thread has been marked as completed.",
      });
      
      if (onStatusChange) {
        onStatusChange("COMPLETED");
      }
    } catch (error) {
      console.error("Error updating thread status:", error);
      toast({
        title: "Error updating status",
        description: "Failed to mark thread as completed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  return (
    <div className="flex items-center gap-2">
      <Badge variant={getStatusBadgeVariant(status)}>
        {getStatusLabel(status)}
      </Badge>
      
      {(status === "CONVERTED_TO_ORDER" || status === "WAITING_RESPONSE") && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={markAsCompleted}
          disabled={isUpdating}
          className="text-slate-300 border-slate-600 hover:bg-slate-700"
        >
          {isUpdating ? (
            <>
              <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              Updating...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark as Completed
            </>
          )}
        </Button>
      )}
    </div>
  );
}
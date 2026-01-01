import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { addDays, isPast } from "date-fns";

interface OrderFollowUpButtonProps {
  order: any;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Order Follow-Up Button Component
 *
 * Conditionally renders a follow-up button based on order state:
 * - Shows for PROCESSING or IN_TRANSIT orders
 * - Shows if no tracking after 2+ days
 * - Shows if delivery is overdue
 *
 * Visibility logic from plan:
 * showButton = (order.status === 'PROCESSING' || 'IN_TRANSIT') &&
 *              (noTrackingAfterTwoDays || deliveryOverdue)
 */
export function OrderFollowUpButton({
  order,
  onClick,
  disabled = false,
}: OrderFollowUpButtonProps) {
  // Don't show button for completed or cancelled orders
  if (order.status === "DELIVERED" || order.status === "CANCELLED") {
    return null;
  }

  // Calculate days since order was placed
  const orderDate = new Date(order.orderDate);
  const daysSinceOrder = Math.floor(
    (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Check if tracking is missing after 2 days
  const noTrackingAfterTwoDays =
    !order.trackingNumber && daysSinceOrder >= 2;

  // Check if expected delivery is overdue
  const deliveryOverdue =
    order.expectedDelivery && isPast(new Date(order.expectedDelivery));

  // Determine if button should be shown
  const shouldShowButton =
    (order.status === "PROCESSING" || order.status === "IN_TRANSIT") &&
    (noTrackingAfterTwoDays || deliveryOverdue);

  if (!shouldShowButton) {
    return null;
  }

  // Determine button text and variant based on reason
  let buttonText = "Send Follow-up";
  let variant: "default" | "outline" | "destructive" = "outline";

  if (deliveryOverdue) {
    buttonText = "Follow Up - Delivery Delayed";
    variant = "destructive";
  } else if (noTrackingAfterTwoDays) {
    buttonText = "Follow Up - Missing Tracking";
    variant = "outline";
  }

  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant={variant}
      size="sm"
    >
      <Mail className="mr-2 h-4 w-4" />
      {buttonText}
    </Button>
  );
}

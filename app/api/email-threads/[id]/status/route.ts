import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EmailThreadStatus } from "@prisma/client";
import { z } from "zod";

const statusUpdateSchema = z.object({
  status: z.enum([
    "DRAFT",
    "SENT",
    "WAITING_RESPONSE",
    "RESPONSE_RECEIVED",
    "FOLLOW_UP_NEEDED",
    "COMPLETED",
    "CONVERTED_TO_ORDER",
    "CANCELLED"
  ])
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const threadId = params.id;
    
    // Get the email thread to verify it exists and belongs to the user's organization
    const emailThread = await prisma.emailThread.findUnique({
      where: {
        id: threadId,
      },
      include: {
        organization: true,
      }
    });
    
    if (!emailThread) {
      return NextResponse.json({ error: "Email thread not found" }, { status: 404 });
    }
    
    // Verify the user belongs to the organization that owns this email thread
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string },
    });
    
    if (!user || emailThread.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    
    // Parse and validate request body
    const body = await req.json();
    const validationResult = statusUpdateSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.format() },
        { status: 400 }
      );
    }
    
    const { status } = validationResult.data;
    
    // Update the email thread status
    const updatedThread = await prisma.emailThread.update({
      where: { id: threadId },
      data: { status: status as EmailThreadStatus },
    });
    
    // Create an activity log entry
    await prisma.activityLog.create({
      data: {
        type: "SYSTEM_UPDATE",
        title: `Email thread status updated`,
        description: `Email thread status changed to ${status}`,
        entityType: "EmailThread",
        entityId: threadId,
        userId: user.id,
        organization: {
          connect: {
            id: user.organizationId,
          },
        },
        metadata: {
          previousStatus: emailThread.status,
          newStatus: status,
          threadSubject: emailThread.subject,
        },
      },
    });
    
    return NextResponse.json({
      success: true,
      message: "Email thread status updated successfully",
      thread: updatedThread,
    });
  } catch (error) {
    console.error("Error updating email thread status:", error);
    return NextResponse.json(
      { error: "Failed to update email thread status" },
      { status: 500 }
    );
  }
}
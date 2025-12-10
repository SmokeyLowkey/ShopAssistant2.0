import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePresignedUrl } from "@/lib/s3";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: attachmentId } = await params;
    const trimmedId = attachmentId.trim();
    
    console.log('Fetching attachment with ID:', attachmentId);
    console.log('Trimmed ID:', trimmedId);
    console.log('ID length:', attachmentId.length, 'Trimmed length:', trimmedId.length);

    // Fetch the attachment from the database
    const attachment = await prisma.emailAttachment.findUnique({
      where: { id: trimmedId },
    });

    if (!attachment) {
      console.error('Attachment not found:', trimmedId);
      
      // Try to find all attachments to debug
      const allAttachments = await prisma.emailAttachment.findMany({
        select: { id: true, filename: true },
        take: 10
      });
      console.log('Available attachments:', allAttachments);
      
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    console.log('Found attachment:', { 
      id: attachment.id, 
      filename: attachment.filename, 
      path: attachment.path 
    });

    // Generate presigned URL for the S3 object
    const downloadUrl = await generatePresignedUrl(attachment.path);
    
    console.log('Generated presigned URL for:', attachment.filename);

    // Redirect directly to the S3 presigned URL
    return NextResponse.redirect(downloadUrl);
  } catch (error) {
    console.error("Error generating download URL:", error);
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    );
  }
}

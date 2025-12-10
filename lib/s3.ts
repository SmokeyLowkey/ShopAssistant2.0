import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ca-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

/**
 * Generate a presigned URL for downloading a file from S3
 * @param key - The S3 object key (file path) or full S3 URI
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns Presigned URL for downloading the file
 */
export async function generatePresignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  // Strip S3 URI prefix if present (e.g., "s3://bucket-name/" or "s3://")
  let cleanKey = key;
  
  // Match patterns like "s3://bucket-name/path" or "s3://path"
  const s3UriMatch = key.match(/^s3:\/\/([^\/]+)\/(.+)$/);
  if (s3UriMatch) {
    // Extract just the path after the bucket name
    cleanKey = s3UriMatch[2];
  } else if (key.startsWith('s3://')) {
    // Handle edge case where it's just "s3://path" without bucket
    cleanKey = key.replace(/^s3:\/\//, '');
  }
  
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: cleanKey,
  });

  try {
    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    console.error("Original key:", key);
    console.error("Clean key:", cleanKey);
    throw new Error("Failed to generate download URL");
  }
}

/**
 * Get the S3 client instance
 */
export function getS3Client(): S3Client {
  return s3Client;
}

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { DateTimePicker } from "@/components/ui/date-time-picker";

interface EmailPreviewProps {
  subject: string;
  body: string;
  expectedResponseBy: Date | undefined;
  onSubjectChange?: (subject: string) => void;
  onBodyChange?: (body: string) => void;
  onExpectedResponseByChange?: (date: Date | undefined) => void;
  editable?: boolean;
}

export function EmailPreview({
  subject,
  body,
  expectedResponseBy,
  onSubjectChange,
  onBodyChange,
  onExpectedResponseByChange,
  editable = false
}: EmailPreviewProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="pt-6 space-y-4">
        {/* Subject */}
        <div className="space-y-2">
          <Label>Subject</Label>
          {editable && onSubjectChange ? (
            <Input
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder="Email subject"
            />
          ) : (
            <div className="p-2 bg-gray-50 rounded-md">
              {subject}
            </div>
          )}
        </div>
        
        {/* Body */}
        <div className="space-y-2">
          <Label>Message</Label>
          {editable && onBodyChange ? (
            <Textarea
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              placeholder="Email body"
              rows={8}
            />
          ) : (
            <div className="p-2 bg-gray-50 rounded-md whitespace-pre-wrap min-h-[200px]">
              {body}
            </div>
          )}
        </div>
        
        {/* Expected response date */}
        {(expectedResponseBy || (editable && onExpectedResponseByChange)) && (
          <div className="space-y-2">
            {editable && onExpectedResponseByChange ? (
              <DateTimePicker
                value={expectedResponseBy}
                onChange={onExpectedResponseByChange}
                label="Expected Response By"
              />
            ) : (
              <div>
                <Label>Expected Response By</Label>
                <div className="p-2 bg-gray-50 rounded-md">
                  {expectedResponseBy ? expectedResponseBy.toLocaleString() : "Not specified"}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
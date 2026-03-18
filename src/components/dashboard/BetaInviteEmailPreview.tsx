import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Copy, Mail, Eye, EyeOff } from "lucide-react";
import DOMPurify from "dompurify";

interface BetaInviteEmailPreviewProps {
  code?: string;
  tierLabel?: string;
  durationDays?: number;
}

const BetaInviteEmailPreview = ({
  code = "BETA-XXXXXXXX",
  tierLabel = "Business",
  durationDays = 30,
}: BetaInviteEmailPreviewProps) => {
  const [showPreview, setShowPreview] = useState(false);
  const [recipientName, setRecipientName] = useState("there");

  // Escape user input to prevent XSS when rendering in dangerouslySetInnerHTML
  const safeName = useMemo(() => {
    const div = document.createElement("div");
    div.textContent = recipientName;
    return div.innerHTML;
  }, [recipientName]);

  const guideUrl = `${window.location.origin}/beta-guide`;

  const emailSubject = "You are invited to test MimmoBook";

  const emailBody = `Hi ${recipientName},

Thank you for your interest in MimmoBook! We would love for you to be one of our beta testers and help us shape the future of hospitality reservation management.

Your access code: ${code}

This code grants you full ${tierLabel} tier access for ${durationDays} days, completely free. No credit card needed.

Here is how to get started:

1. Create your account at ${window.location.origin}/signup
2. Complete the quick onboarding to set up your workspace
3. Go to Settings in your dashboard
4. Enter your access code in the "Have an access code?" section
5. Enjoy full premium access!

For a detailed walkthrough, visit our beta guide:
${guideUrl}

Your feedback is incredibly valuable to us. Once you are set up, you can send us your thoughts directly through the Support section in your dashboard.

We are excited to have you on board!

Warm regards,
The MimmoBook Team`;

  const htmlEmail = `
<div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e5e5;">
  <div style="background: #4a1d7a; padding: 32px 24px; text-align: center;">
    <h1 style="font-family: 'Playfair Display', Georgia, serif; color: #ffffff; margin: 0; font-size: 24px;">
      You are invited to MimmoBook Beta
    </h1>
  </div>
  <div style="padding: 32px 24px;">
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      Hi ${safeName},
    </p>
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      Thank you for your interest in MimmoBook! We would love for you to be one of our beta testers
      and help us shape the future of hospitality reservation management.
    </p>
    <div style="background: #f8f5ff; border: 2px dashed #4a1d7a; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
      <p style="color: #666; font-size: 14px; margin: 0 0 8px;">Your access code</p>
      <p style="font-family: monospace; font-size: 28px; font-weight: bold; color: #4a1d7a; margin: 0; letter-spacing: 2px;">
        ${code}
      </p>
      <p style="color: #666; font-size: 13px; margin: 8px 0 0;">
        ${tierLabel} tier access for ${durationDays} days
      </p>
    </div>
    <h2 style="font-family: 'Playfair Display', Georgia, serif; color: #333; font-size: 18px; margin: 24px 0 12px;">
      How to get started
    </h2>
    <ol style="color: #555; font-size: 15px; line-height: 1.8; padding-left: 20px; margin: 0 0 24px;">
      <li>Create your account at <a href="${window.location.origin}/signup" style="color: #4a1d7a;">mimmobook.com/signup</a></li>
      <li>Complete the quick onboarding to set up your workspace</li>
      <li>Go to <strong>Settings</strong> in your dashboard</li>
      <li>Enter your access code and click <strong>Redeem</strong></li>
      <li>Enjoy full premium access!</li>
    </ol>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${guideUrl}" style="display: inline-block; background: #4a1d7a; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px;">
        Read the Beta Guide
      </a>
    </div>
    <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 24px 0 0;">
      Your feedback is incredibly valuable. Once you are set up, send us your thoughts through the
      Support section in your dashboard. We read every message.
    </p>
  </div>
  <div style="background: #f9f9f9; padding: 20px 24px; text-align: center; border-top: 1px solid #e5e5e5;">
    <p style="color: #999; font-size: 13px; margin: 0;">
      Warm regards, The MimmoBook Team
    </p>
  </div>
</div>`;

  const copyPlainText = () => {
    navigator.clipboard.writeText(emailBody);
    toast({ title: "Copied", description: "Plain text email copied to clipboard" });
  };

  const copyHtml = () => {
    navigator.clipboard.writeText(htmlEmail);
    toast({ title: "Copied", description: "HTML email copied to clipboard" });
  };

  const copySubject = () => {
    navigator.clipboard.writeText(emailSubject);
    toast({ title: "Copied", description: "Subject line copied" });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-serif flex items-center gap-2">
            <Mail className="h-4 w-4 text-accent" />
            Beta Invite Email
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="gap-1.5 text-xs"
          >
            {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPreview ? "Hide" : "Preview"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">Recipient name</Label>
          <Input
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="e.g. Anna"
            className="h-8 text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copySubject} className="gap-1.5 text-xs">
            <Copy className="h-3 w-3" /> Subject
          </Button>
          <Button variant="outline" size="sm" onClick={copyPlainText} className="gap-1.5 text-xs">
            <Copy className="h-3 w-3" /> Plain text
          </Button>
          <Button variant="outline" size="sm" onClick={copyHtml} className="gap-1.5 text-xs">
            <Copy className="h-3 w-3" /> HTML
          </Button>
        </div>

        {showPreview && (
          <div className="mt-4 border border-border rounded-lg overflow-hidden">
            <div
              className="bg-white"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlEmail) }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BetaInviteEmailPreview;

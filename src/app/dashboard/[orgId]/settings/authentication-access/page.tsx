"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Copy, Info, RefreshCw, Shield, Lock, Key, Save, X } from "lucide-react";
import { toast } from "sonner";

export default function AuthenticationAccessPage() {
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Authentication methods
  const [emailPassword, setEmailPassword] = useState(true);
  const [googleSSO, setGoogleSSO] = useState(true);
  const [microsoftSSO, setMicrosoftSSO] = useState(false);
  const [samlSSO, setSamlSSO] = useState(false);
  
  // MFA settings
  const [enforceMFA, setEnforceMFA] = useState(true);
  const [mfaAdminsOnly, setMfaAdminsOnly] = useState(false);
  const [rememberDevices, setRememberDevices] = useState(true);
  
  // Session management
  const [concurrentSessions, setConcurrentSessions] = useState(true);
  
  // Auth0 Configuration
  const [auth0Domain, setAuth0Domain] = useState("acme-corp.us.auth0.com");
  const [clientId, setClientId] = useState("x3K9mN7pQ2vR8wL5");
  const [callbackUrl, setCallbackUrl] = useState("https://acme.vapps.io/auth/callback");
  
  // Password Policy
  const [minLength, setMinLength] = useState("8");
  const [passwordAge, setPasswordAge] = useState("90");
  
  // Session Management
  const [sessionTimeout, setSessionTimeout] = useState("60");
  const [maxSessions, setMaxSessions] = useState("5");

  const copyToClipboard = (text: string, label?: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label || "Copied"} to clipboard!`);
  };

  const handleEditToggle = () => {
    setIsEditMode(!isEditMode);
  };

  const handleSave = () => {
    // Here you would typically save the changes to your backend
    setIsEditMode(false);
  };

  const handleCancel = () => {
    // Reset to original values
    setAuth0Domain("acme-corp.us.auth0.com");
    setClientId("x3K9mN7pQ2vR8wL5");
    setCallbackUrl("https://acme.vapps.io/auth/callback");
    setMinLength("8");
    setPasswordAge("90");
    setSessionTimeout("60");
    setMaxSessions("5");
    setIsEditMode(false);
  };

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-gray-500 mb-1">Settings &gt; Authentication & Access</div>
          <h1 className="text-2xl font-semibold">Authentication & Access</h1>
          <p className="text-sm text-gray-500 mt-1">Configure login methods, SSO, and security policies.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            Last updated: November 10, 2025 at 2:30 PM
          </div>
          {isEditMode ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleCancel}>
                <X className="size-4 mr-2" />
                Cancel
              </Button>
              <Button variant="dark" onClick={handleSave}>
                <Save className="size-4 mr-2" />
                Save Changes
              </Button>
            </div>
          ) : (
            <Button variant="dark" onClick={handleEditToggle}>Edit Settings</Button>
          )}
        </div>
      </div>

      {/* Auth0 Configuration Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Auth0 Configuration</CardTitle>
              <CardDescription>Single sign-on and identity management.</CardDescription>
            </div>
            <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
              <Lock className="size-3" />
              Connected
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="auth0-domain">Auth0 Domain</Label>
            <div className="flex items-center gap-2">
              <Input
                id="auth0-domain"
                value={auth0Domain}
                onChange={(e) => setAuth0Domain(e.target.value)}
                readOnly={!isEditMode}
                className={`flex-1 transition-opacity ${!isEditMode ? "opacity-60" : ""}`}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(auth0Domain, "Auth0 Domain")}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-id">Client ID</Label>
            <div className="flex items-center gap-2">
              <Input
                id="client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                readOnly={!isEditMode}
                className={`flex-1 transition-opacity ${!isEditMode ? "opacity-60" : ""}`}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" type="button">
                    <Info className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="max-w-xs">Your Auth0 Client ID is used to authenticate your application with Auth0 services.</p>
                </TooltipContent>
              </Tooltip>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(clientId, "Client ID")}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="callback-url">Callback URL</Label>
            <Input
              id="callback-url"
              value={callbackUrl}
              onChange={(e) => setCallbackUrl(e.target.value)}
              readOnly={!isEditMode}
              className={`transition-opacity ${!isEditMode ? "opacity-60" : ""}`}
            />
          </div>
          <Button variant="outline" className="w-full">
            <RefreshCw className="size-4 mr-2" />
            Test Connection
          </Button>
        </CardContent>
      </Card>

      {/* Authentication Methods Section */}
      <Card>
        <CardHeader>
          <CardTitle>Authentication Methods</CardTitle>
          <CardDescription>Enable or disable login options.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="size-5 text-purple-600" />
              <div>
                <div className="font-medium">Email & Password</div>
                <div className="text-sm text-gray-500">Standard email login.</div>
              </div>
            </div>
            <Switch checked={emailPassword} onCheckedChange={setEmailPassword} />
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="size-5 text-blue-600" />
              <div>
                <div className="font-medium">Google SSO</div>
                <div className="text-sm text-gray-500">Sign in with Google accounts.</div>
              </div>
            </div>
            <Switch checked={googleSSO} onCheckedChange={setGoogleSSO} />
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="size-5 text-gray-400" />
              <div>
                <div className="font-medium">Microsoft SSO</div>
                <div className="text-sm text-gray-500">Sign in with Microsoft accounts.</div>
              </div>
            </div>
            <Switch checked={microsoftSSO} onCheckedChange={setMicrosoftSSO} />
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="size-5 text-purple-600" />
              <div>
                <div className="font-medium">SAML SSO</div>
                <div className="text-sm text-gray-500">Enterprise single sign-on.</div>
              </div>
            </div>
            <Switch checked={samlSSO} onCheckedChange={setSamlSSO} />
          </div>
        </CardContent>
      </Card>

      {/* Multi-Factor Authentication Section */}
      <Card>
        <CardHeader>
          <CardTitle>Multi-Factor Authentication (MFA)</CardTitle>
          <CardDescription>Require additional verification for enhanced security.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <div className="font-medium">Enforce MFA for All Users</div>
              <div className="text-sm text-gray-500">Require all users to set up two-factor authentication.</div>
            </div>
            <Switch checked={enforceMFA} onCheckedChange={setEnforceMFA} />
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <div className="font-medium">MFA for Admins Only</div>
              <div className="text-sm text-gray-500">Require MFA only for administrator accounts.</div>
            </div>
            <Switch checked={mfaAdminsOnly} onCheckedChange={setMfaAdminsOnly} />
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <div className="font-medium">Remember Trusted Devices</div>
              <div className="text-sm text-gray-500">Skip MFA on recognized devices for 30 days.</div>
            </div>
            <Switch checked={rememberDevices} onCheckedChange={setRememberDevices} />
          </div>
        </CardContent>
      </Card>

      {/* Password Policy Section */}
      <Card>
        <CardHeader>
          <CardTitle>Password Policy</CardTitle>
          <CardDescription>Set requirements for user passwords.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min-length">Minimum Length</Label>
              <Input
                id="min-length"
                type="number"
                value={minLength}
                onChange={(e) => setMinLength(e.target.value)}
                readOnly={!isEditMode}
                className={`transition-opacity ${!isEditMode ? "opacity-60" : ""}`}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password-age">Password Age (days)</Label>
              <Input
                id="password-age"
                type="number"
                value={passwordAge}
                onChange={(e) => setPasswordAge(e.target.value)}
                readOnly={!isEditMode}
                className={`transition-opacity ${!isEditMode ? "opacity-60" : ""}`}
              />
            </div>
          </div>
          <div className="pt-2 space-y-2">
            <div className="text-sm text-gray-700">Require uppercase letters</div>
            <div className="text-sm text-gray-700">Require lowercase letters</div>
            <div className="text-sm text-gray-700">Require numbers</div>
            <div className="text-sm text-gray-700">Require special characters</div>
          </div>
        </CardContent>
      </Card>

      {/* Session Management Section */}
      <Card>
        <CardHeader>
          <CardTitle>Session Management</CardTitle>
          <CardDescription>Configure session timeout and behavior.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
            <Input
              id="session-timeout"
              type="number"
              value={sessionTimeout}
              onChange={(e) => setSessionTimeout(e.target.value)}
              readOnly={!isEditMode}
              className={`transition-opacity ${!isEditMode ? "opacity-60" : ""}`}
            />
            <p className="text-sm text-gray-500">Users will be logged out after this period of inactivity.</p>
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <div className="font-medium">Allow Concurrent Sessions</div>
              <div className="text-sm text-gray-500">Let users be logged in on multiple devices simultaneously.</div>
            </div>
            <Switch checked={concurrentSessions} onCheckedChange={setConcurrentSessions} />
          </div>
          {concurrentSessions && (
            <div className="space-y-2">
              <Label htmlFor="max-sessions">Maximum Concurrent Sessions</Label>
              <Input
                id="max-sessions"
                type="number"
                value={maxSessions}
                onChange={(e) => setMaxSessions(e.target.value)}
                readOnly={!isEditMode}
                className={`transition-opacity ${!isEditMode ? "opacity-60" : ""}`}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Access Tokens Section */}
      <Card>
        <CardHeader>
          <CardTitle>API Access Tokens</CardTitle>
          <CardDescription>Manage API authentication tokens.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex-1">
              <div className="font-medium">Production API Token</div>
              <div className="text-sm text-gray-500">Created Jan 15, 2024 • Expires Jan 15, 2025</div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Key className="size-4 mr-2" />
                Regenerate
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard("production-token", "Production API Token")}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex-1">
              <div className="font-medium">Development API Token</div>
              <div className="text-sm text-gray-500">Created Feb 1, 2024 • Expires Feb 1, 2025</div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Key className="size-4 mr-2" />
                Regenerate
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard("development-token", "Development API Token")}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
          <Button variant="outline" className="w-full">
            Generate New Token
          </Button>
        </CardContent>
      </Card>
      </div>
    </TooltipProvider>
  );
}

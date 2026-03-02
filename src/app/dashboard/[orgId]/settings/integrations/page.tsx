"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info, RefreshCw, Github, Check, Hash } from "lucide-react";

// Custom icons for integrations
const JiraIcon = () => (
  <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
    <span className="text-white font-bold text-sm">J</span>
  </div>
);

const SlackIcon = () => (
  <div className="w-8 h-8 flex items-center justify-center text-purple-600">
    <Hash className="w-6 h-6" strokeWidth={2.5} />
  </div>
);

const GoogleIcon = () => (
  <div className="w-8 h-8 flex items-center justify-center">
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  </div>
);

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  defaultApiKey?: string;
}

export default function IntegrationsPage() {
  const initialIntegrations: Integration[] = [
    {
      id: "jira",
      name: "JIRA Cloud",
      description: "Sync issues and track work across platforms",
      icon: <JiraIcon />,
      defaultApiKey: "jira_api_xxx",
    },
    {
      id: "slack",
      name: "Slack",
      description: "Get notifications and collaborate with your team",
      icon: <SlackIcon />,
      defaultApiKey: "slack_bot_xxx",
    },
    {
      id: "github",
      name: "GitHub",
      description: "Link commits and PRs to issues",
      icon: <Github className="w-8 h-8" />,
      defaultApiKey: "github_token_xxx",
    },
    {
      id: "google",
      name: "Google Workspace",
      description: "Calendar and email integration",
      icon: <GoogleIcon />,
      defaultApiKey: "google_oauth_xxx",
    },
  ];

  // State to track which integrations are connected
  const [connectedIntegrations, setConnectedIntegrations] = useState<Set<string>>(
    new Set(["jira", "slack"]) // Initially JIRA and Slack are connected
  );

  const handleToggleConnection = (integrationId: string) => {
    setConnectedIntegrations((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(integrationId)) {
        newSet.delete(integrationId);
      } else {
        newSet.add(integrationId);
      }
      return newSet;
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-gray-500 mb-1">Settings &gt; Integrations</div>
          <h1 className="text-2xl font-semibold">Integrations</h1>
          <p className="text-sm text-gray-500 mt-1">Connect third-party services and APIs</p>
        </div>
        <div className="text-sm text-gray-500">
          Last updated: November 10, 2025 at 4:15 PM
        </div>
      </div>

      {/* Integration Cards */}
      <div className="space-y-4">
        {initialIntegrations.map((integration) => {
          const isConnected = connectedIntegrations.has(integration.id);
          return (
            <Card key={integration.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1">{integration.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        {isConnected && (
                          <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 rounded-full px-2 py-0.5 gap-1">
                            <div className="w-2 h-2 bg-white rounded-full flex items-center justify-center">
                              <Check className="h-1.5 w-1.5 text-green-700" strokeWidth={3} />
                            </div>
                            Connected
                          </Badge>
                        )}
                      </div>
                      <CardDescription>{integration.description}</CardDescription>
                    </div>
                  </div>
                  <Button
                    variant={isConnected ? "outline" : "default"}
                    className={isConnected ? "" : "bg-gray-900 hover:bg-gray-800"}
                    onClick={() => handleToggleConnection(integration.id)}
                  >
                    {isConnected ? "Disconnect" : "Connect"}
                  </Button>
                </div>
              </CardHeader>
              {isConnected && integration.defaultApiKey && (
                <CardContent className="pt-0 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor={`api-key-${integration.id}`} className="text-sm">
                        API Key / Token
                      </Label>
                      <Info className="h-3 w-3 text-gray-400" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`api-key-${integration.id}`}
                        value={integration.defaultApiKey}
                        readOnly
                        className="bg-gray-50"
                      />
                      <Button variant="ghost" size="icon">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Test Connection
                    </Button>
                    <Button variant="outline">View Logs</Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

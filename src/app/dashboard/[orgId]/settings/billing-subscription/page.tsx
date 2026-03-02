"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Info, TrendingUp, CreditCard, Download, Check, Ellipsis } from "lucide-react";

export default function BillingSubscriptionPage() {
  const invoices = [
    { id: "INV-2024-11", date: "Nov 1, 2024", amount: "$99.00", status: "Paid" },
    { id: "INV-2024-10", date: "Oct 1, 2024", amount: "$99.00", status: "Paid" },
    { id: "INV-2024-09", date: "Sep 1, 2024", amount: "$99.00", status: "Paid" },
  ];

  const features = [
    "Up to 50 users",
    "Unlimited spaces and projects",
    "Advanced reporting",
    "SSO & Auth0 integration",
    "Priority support",
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-gray-500 mb-1">Settings &gt; Billing & Subscription</div>
          <h1 className="text-2xl font-semibold">Billing & Subscription</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your plan, payment methods, and invoices.</p>
        </div>
        <div className="text-sm text-gray-500">
          Last updated: November 11, 2025 at 11:00 AM
        </div>
      </div>

      {/* Current Plan Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <div className="flex items-center gap-1 mt-1">
                <CardDescription>Powered by Stripe</CardDescription>
                <Info className="h-3 w-3 text-gray-400" />
              </div>
            </div>
            <Badge className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100 ms-auto">
                  <TrendingUp className="h-3 w-3" />
                  Pro Plan
                </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold">Pro Plan</h3>
              </div>
              <p className="text-sm text-gray-600">For growing teams and businesses.</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">$99</div>
              <div className="text-sm text-gray-500">per month</div>
            </div>
          </div>

          <div className="space-y-2 p-4 bg-accent rounded-md">
          <h4 className="text-sm font-medium">Includes:</h4>
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-sm text-gray-700">{feature}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="default">Change Plan</Button>
            <Button variant="outline">Cancel Subscription</Button>
          </div>
        </CardContent>
      </Card>

      {/* Payment Method Section */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
          <CardDescription>Manage your payment information.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-6 w-6 text-gray-400" />
              <div>
                <div className="text-sm font-medium flex items-center gap-1"><Ellipsis /> <Ellipsis /> <Ellipsis /> 4242</div>
                <div className="text-xs text-gray-500">Expires 12/2025</div>
              </div>
            </div>
            <Button variant="outline">Update</Button>
          </div>
        </CardContent>
      </Card>

      {/* Billing History Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Billing History</CardTitle>
              <CardDescription>View and download past invoices.</CardDescription>
            </div>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.id}</TableCell>
                  <TableCell>{invoice.date}</TableCell>
                  <TableCell>{invoice.amount}</TableCell>
                  <TableCell>
                    <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

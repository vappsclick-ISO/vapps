"use client";

import React from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import {
  Home,
  MapPin,
  Users,
  Shield,
  CreditCard,
  Plug,
  Bell,
  BarChart,
  UserCog,
  FileCheck,
} from 'lucide-react';

const SettingSidebar = () => {
  const params = useParams();
  const pathname = usePathname();
  const orgId = params?.orgId as string;

  const menuItems = [
    {
      title: 'Organization Profile',
      subtitle: 'Company details and branding',
      icon: Home,
      path: `/dashboard/${orgId}/settings/organization-profile`,
    },
    {
      title: 'Sites & Departments',
      subtitle: 'Locations and structure',
      icon: MapPin,
      path: `/dashboard/${orgId}/settings/sites-departments`,
    },
    {
      title: 'Roles',
      subtitle: 'Leadership role definitions',
      icon: UserCog,
      path: `/dashboard/${orgId}/settings/roles`,
    },
    {
      title: 'Teams',
      subtitle: 'Organization users',
      icon: Users,
      path: `/dashboard/${orgId}/settings/teams`,
    },
    {
      title: 'Permissions',
      subtitle: 'Role-based access control',
      icon: Shield,
      path: `/dashboard/${orgId}/settings/permissions`,
    },
    {
      title: 'Authentication & Access',
      subtitle: 'Login and security',
      icon: Shield,
      path: `/dashboard/${orgId}/settings/authentication-access`,
    },
    {
      title: 'Billing & Subscription',
      subtitle: 'Plans and payments',
      icon: CreditCard,
      path: `/dashboard/${orgId}/settings/billing-subscription`,
    },
    {
      title: 'Integrations',
      subtitle: 'Connected apps and APIs',
      icon: Plug,
      path: `/dashboard/${orgId}/settings/integrations`,
    },
    {
      title: 'Notifications',
      subtitle: 'Email and alerts',
      icon: Bell,
      path: `/dashboard/${orgId}/settings/notifications`,
    },
    {
      title: 'KPI & Reports',
      subtitle: 'Metrics and dashboards',
      icon: BarChart,
      path: `/dashboard/${orgId}/settings/kpi-reports`,
    },
    {
      title: 'Audit Checklist',
      subtitle: 'Question management',
      icon: FileCheck,
      path: `/dashboard/${orgId}/settings/audit-checklist`,
    },
  ];

  // Don't render links if orgId is not available
  if (!orgId || orgId === 'undefined') {
    return (
      <aside className="w-64 p-4 border-r border-gray-200 bg-white">
        <h2 className="text-lg font-semibold mb-6">Settings</h2>
        <p className="text-sm text-gray-500 mb-4">Loading...</p>
      </aside>
    );
  }

  return (
    <aside className="w-64 p-4 border-r border-gray-200 bg-white">
      <h2 className="text-lg font-semibold mb-6">Settings</h2>
      <p className="text-sm text-gray-500 mb-4">Manage your workspace configuration</p>
      <ul className="space-y-2">
        {menuItems.map((item, index) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link key={index} href={item.path}>
              <li
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors mb-2 ${
                  isActive ? 'bg-green-50 text-green-600' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${isActive ? 'text-green-500' : 'text-gray-400'}`} />
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-gray-400">{item.subtitle}</p>
                  </div>
                </div>
                {isActive && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </li>
            </Link>
          );
        })}
      </ul>
    </aside>
  );
};

export default SettingSidebar;

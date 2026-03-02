// src/store/onboardingStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Types copied/derived from your schemas (trimmed to match your provided shapes)
 * Keep these in sync with your schema files if you change anything.
 */

export interface Step1Data {
  companyName?: string;
  registrationId?: string;
  address?: string;
  contactName?: string;
  contactEmail?: string;
  phone?: string;
  website?: string;
  industry?: string;
}

export interface Step2Site {
  siteName: string;
  siteCode: string;
  location: string;
  processes?: string[];
}
export interface Step2Data {
  sites: Step2Site[];
}

export interface LeaderData {
  name: string;
  role: string;
  level: string;
  email?: string;
}
export interface Step3Data {
  leaders: LeaderData[];
}

export interface Step4Data {
  baseCurrency: string;
  fiscalYearStart: string;
  defaultTaxRate: string;
  paymentTerms: string;
  chartOfAccountsTemplate: string;
  defaultAssetAccount: string;
  defaultRevenueAccount: string;
  defaultExpenseAccount: string;
}

export interface Product {
  sku?: string;
  name: string;
  category?: string;
  unit?: string;
  cost?: string;
  reorder?: string;
}
export interface Step5Data {
  products: Product[];
}

export interface Customer {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}
export interface Vendor {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}
export interface Step6Data {
  activeTab: "customers" | "vendors";
  customers: Customer[];
  vendors: Vendor[];
}

export interface Step7Data {
  multiLevelApprovals: boolean;
  automaticTaskAssignment: boolean;
  criticalSLA: string;
  highPrioritySLA: string;
  mediumPrioritySLA: string;
  lowPrioritySLA: string;
  emailNotifications: boolean;
  inAppNotifications: boolean;
  smsNotifications: boolean;
  escalationRules?: string;
}

export interface Step8Data {
  widgets: {
    tasksCompleted: boolean;
    complianceScore: boolean;
    workloadByUser: boolean;
    overdueTasks: boolean;
    issueDistribution: boolean;
    auditTrend: boolean;
    projectProgress: boolean;
    documentVersion: boolean;
  };
  reportFrequency: string;
}

export interface Step9Data {
  require2FA: boolean;
  ipWhitelisting: boolean;
  sessionTimeout: boolean;
  passwordPolicy: string;
  sessionDuration: string;
  logAllActions: boolean;
  logRetention: string;
  backupFrequency: string;
  backupRetention: string;
}

/** Entire onboarding shape */
export interface OnboardingData {
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
  step4: Step4Data;
  step5: Step5Data;
  step6: Step6Data;
  step7: Step7Data;
  step8: Step8Data;
  step9: Step9Data;
}

/** Store API */
export interface OnboardingStore {
  data: OnboardingData;

  // Generic operations
  updateStep: <T extends keyof OnboardingData>(step: T, values: Partial<OnboardingData[T]>) => void;
  setStep: <T extends keyof OnboardingData>(step: T, values: OnboardingData[T]) => void;
  reset: () => void;

  // Array helpers (common usage)
  addSite: (site: Step2Site) => void;
  removeSite: (index: number) => void;

  addLeader: (leader: LeaderData) => void;
  removeLeader: (index: number) => void;

  addProduct: (product: Product) => void;
  removeProduct: (index: number) => void;

  addCustomer: (c: Customer) => void;
  removeCustomer: (index: number) => void;
  addVendor: (v: Vendor) => void;
  removeVendor: (index: number) => void;
}

/** Initial state */
const initialData: OnboardingData = {
  step1: {},
  step2: { sites: [] },
  step3: { leaders: [] },
  step4: {
    baseCurrency: "",
    fiscalYearStart: "",
    defaultTaxRate: "",
    paymentTerms: "",
    chartOfAccountsTemplate: "",
    defaultAssetAccount: "",
    defaultRevenueAccount: "",
    defaultExpenseAccount: "",
  },
  step5: { products: [] },
  step6: { activeTab: "customers", customers: [], vendors: [] },
  step7: {
    multiLevelApprovals: false,
    automaticTaskAssignment: false,
    criticalSLA: "",
    highPrioritySLA: "",
    mediumPrioritySLA: "",
    lowPrioritySLA: "",
    emailNotifications: true,
    inAppNotifications: true,
    smsNotifications: false,
    escalationRules: "",
  },
  step8: {
    widgets: {
      tasksCompleted: false,
      complianceScore: false,
      workloadByUser: false,
      overdueTasks: false,
      issueDistribution: false,
      auditTrend: false,
      projectProgress: false,
      documentVersion: false,
    },
    reportFrequency: "",
  },
  step9: {
    require2FA: false,
    ipWhitelisting: false,
    sessionTimeout: false,
    passwordPolicy: "",
    sessionDuration: "",
    logAllActions: false,
    logRetention: "",
    backupFrequency: "",
    backupRetention: "",
  },
};

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      data: initialData,

      // Merge partial fields into given step
      updateStep: (step, values) =>
        set((state) => ({
          data: {
            ...state.data,
            [step]: { ...state.data[step], ...values },
          },
        })),

      // Replace whole step (useful for forms that return full object)
      setStep: (step, values) =>
        set((state) => ({
          data: {
            ...state.data,
            [step]: values,
          },
        })),

      reset: () => set({ data: initialData }),

      // Array helpers (safe typed)
      addSite: (site) =>
        set((state) => ({ data: { ...state.data, step2: { sites: [...state.data.step2.sites, site] } } })),

      removeSite: (index) =>
        set((state) => ({ data: { ...state.data, step2: { sites: state.data.step2.sites.filter((_, i) => i !== index) } } })),

      addLeader: (leader) =>
        set((state) => ({ data: { ...state.data, step3: { leaders: [...state.data.step3.leaders, leader] } } })),

      removeLeader: (index) =>
        set((state) => ({ data: { ...state.data, step3: { leaders: state.data.step3.leaders.filter((_, i) => i !== index) } } })),

      addProduct: (product) =>
        set((state) => ({ data: { ...state.data, step5: { products: [...state.data.step5.products, product] } } })),

      removeProduct: (index) =>
        set((state) => ({ data: { ...state.data, step5: { products: state.data.step5.products.filter((_, i) => i !== index) } } })),

      addCustomer: (c) =>
        set((state) => ({ data: { ...state.data, step6: { ...state.data.step6, customers: [...state.data.step6.customers, c] } } })),

      removeCustomer: (index) =>
        set((state) => ({ data: { ...state.data, step6: { ...state.data.step6, customers: state.data.step6.customers.filter((_, i) => i !== index) } } })),

      addVendor: (v) =>
        set((state) => ({ data: { ...state.data, step6: { ...state.data.step6, vendors: [...state.data.step6.vendors, v] } } })),

      removeVendor: (index) =>
        set((state) => ({ data: { ...state.data, step6: { ...state.data.step6, vendors: state.data.step6.vendors.filter((_, i) => i !== index) } } })),
    }),
    {
      name: "onboarding_v1", // localStorage key
      partialize: (state) => ({ data: state.data }), // only persist data
      // optional: add versioning or migrate here if needed
    }
  )
);

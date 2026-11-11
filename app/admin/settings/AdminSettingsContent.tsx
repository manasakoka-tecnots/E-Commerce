"use client";

import { useEffect, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type TabKey = "general" | "payments" | "shipping" | "notifications";

interface GeneralSettings {
  platformName: string;
  description: string;
  logoUrl: string;
  supportEmail: string;
}

interface PaymentSettings {
  commissionRate: number;
  gatewayProvider: string;
  gatewayApiKey: string;
  gatewaySecretKey: string;
}

interface ShippingSettings {
  defaultCarrier: string;
  freeShippingThreshold: number;
  flatRate: number;
  enableFreeShipping: boolean;
}

interface NotificationSettings {
  emailOnNewOrder: boolean;
  emailOnSellerSignup: boolean;
  emailOnLowStock: boolean;
  emailOnRefundRequest: boolean;
}

const STORAGE_KEY = "shopora-admin-settings";

const tabs: { key: TabKey; label: string }[] = [
  { key: "general", label: "General" },
  { key: "payments", label: "Payments" },
  { key: "shipping", label: "Shipping" },
  { key: "notifications", label: "Notifications" },
];

const defaultGeneral: GeneralSettings = {
  platformName: "Shopora",
  description: "A modern multi-vendor marketplace",
  logoUrl: "",
  supportEmail: "support@shopora.com",
};

const defaultPayments: PaymentSettings = {
  commissionRate: 10,
  gatewayProvider: "razorpay",
  gatewayApiKey: "",
  gatewaySecretKey: "",
};

const defaultShipping: ShippingSettings = {
  defaultCarrier: "standard",
  freeShippingThreshold: 500,
  flatRate: 50,
  enableFreeShipping: true,
};

const defaultNotifications: NotificationSettings = {
  emailOnNewOrder: true,
  emailOnSellerSignup: true,
  emailOnLowStock: false,
  emailOnRefundRequest: true,
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AdminSettingsContent() {
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [general, setGeneral] = useState<GeneralSettings>(defaultGeneral);
  const [payments, setPayments] = useState<PaymentSettings>(defaultPayments);
  const [shipping, setShipping] = useState<ShippingSettings>(defaultShipping);
  const [notifications, setNotifications] = useState<NotificationSettings>(defaultNotifications);
  const [saved, setSaved] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.general) setGeneral({ ...defaultGeneral, ...parsed.general });
        if (parsed.payments) setPayments({ ...defaultPayments, ...parsed.payments });
        if (parsed.shipping) setShipping({ ...defaultShipping, ...parsed.shipping });
        if (parsed.notifications) setNotifications({ ...defaultNotifications, ...parsed.notifications });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const save = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ general, payments, shipping, notifications })
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const inputClass =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure your marketplace platform settings
        </p>
      </div>

      {/* Save feedback */}
      {saved && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-700">
          Settings saved successfully!
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition ${
              activeTab === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        {/* General */}
        {activeTab === "general" && (
          <div className="space-y-5">
            <h2 className="text-sm font-bold text-gray-900">General Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Platform Name
                </label>
                <input
                  type="text"
                  className={inputClass}
                  value={general.platformName}
                  onChange={(e) =>
                    setGeneral({ ...general, platformName: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Support Email
                </label>
                <input
                  type="email"
                  className={inputClass}
                  value={general.supportEmail}
                  onChange={(e) =>
                    setGeneral({ ...general, supportEmail: e.target.value })
                  }
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  className={inputClass}
                  value={general.description}
                  onChange={(e) =>
                    setGeneral({ ...general, description: e.target.value })
                  }
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Logo URL
                </label>
                <input
                  type="url"
                  className={inputClass}
                  placeholder="https://example.com/logo.png"
                  value={general.logoUrl}
                  onChange={(e) =>
                    setGeneral({ ...general, logoUrl: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* Payments */}
        {activeTab === "payments" && (
          <div className="space-y-5">
            <h2 className="text-sm font-bold text-gray-900">Payment Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Commission Rate (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  className={inputClass}
                  value={payments.commissionRate}
                  onChange={(e) =>
                    setPayments({
                      ...payments,
                      commissionRate: parseFloat(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Platform commission charged on each seller sale
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Payment Gateway
                </label>
                <select
                  className={inputClass}
                  value={payments.gatewayProvider}
                  onChange={(e) =>
                    setPayments({ ...payments, gatewayProvider: e.target.value })
                  }
                >
                  <option value="razorpay">Razorpay</option>
                  <option value="stripe">Stripe</option>
                  <option value="payu">PayU</option>
                  <option value="cashfree">Cashfree</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  API Key
                </label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Enter API key"
                  value={payments.gatewayApiKey}
                  onChange={(e) =>
                    setPayments({ ...payments, gatewayApiKey: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Secret Key
                </label>
                <input
                  type="password"
                  className={inputClass}
                  placeholder="Enter secret key"
                  value={payments.gatewaySecretKey}
                  onChange={(e) =>
                    setPayments({ ...payments, gatewaySecretKey: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* Shipping */}
        {activeTab === "shipping" && (
          <div className="space-y-5">
            <h2 className="text-sm font-bold text-gray-900">Shipping Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Default Carrier
                </label>
                <select
                  className={inputClass}
                  value={shipping.defaultCarrier}
                  onChange={(e) =>
                    setShipping({ ...shipping, defaultCarrier: e.target.value })
                  }
                >
                  <option value="standard">Standard Shipping</option>
                  <option value="express">Express Shipping</option>
                  <option value="delhivery">Delhivery</option>
                  <option value="bluedart">BlueDart</option>
                  <option value="shiprocket">Shiprocket</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Flat Rate (INR)
                </label>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={shipping.flatRate}
                  onChange={(e) =>
                    setShipping({
                      ...shipping,
                      flatRate: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Free Shipping Threshold (INR)
                </label>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={shipping.freeShippingThreshold}
                  onChange={(e) =>
                    setShipping({
                      ...shipping,
                      freeShippingThreshold: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="flex items-center gap-3 pt-5">
                <button
                  type="button"
                  onClick={() =>
                    setShipping({
                      ...shipping,
                      enableFreeShipping: !shipping.enableFreeShipping,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    shipping.enableFreeShipping ? "bg-violet-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                      shipping.enableFreeShipping
                        ? "translate-x-5"
                        : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-700">
                  Enable free shipping above threshold
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Notifications */}
        {activeTab === "notifications" && (
          <div className="space-y-5">
            <h2 className="text-sm font-bold text-gray-900">
              Notification Settings
            </h2>
            <p className="text-xs text-gray-500">
              Configure which events trigger admin email notifications.
            </p>
            <div className="space-y-4">
              {(
                [
                  {
                    key: "emailOnNewOrder" as const,
                    label: "New order placed",
                    desc: "Receive an email for every new customer order",
                  },
                  {
                    key: "emailOnSellerSignup" as const,
                    label: "New seller application",
                    desc: "Get notified when a new seller registers",
                  },
                  {
                    key: "emailOnLowStock" as const,
                    label: "Low stock alert",
                    desc: "Alert when any product stock falls below threshold",
                  },
                  {
                    key: "emailOnRefundRequest" as const,
                    label: "Refund request",
                    desc: "Notify when a customer requests a refund",
                  },
                ] as const
              ).map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-lg border border-gray-100 p-4"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {item.label}
                    </p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setNotifications({
                        ...notifications,
                        [item.key]: !notifications[item.key],
                      })
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      notifications[item.key] ? "bg-violet-600" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                        notifications[item.key]
                          ? "translate-x-5"
                          : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={save}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

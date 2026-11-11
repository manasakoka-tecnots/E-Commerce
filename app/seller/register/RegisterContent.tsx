"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/src/lib/supabase/client";
import Spinner from "@/src/components/Spinner";

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Delhi NCR",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu & Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Other",
];

const PRODUCT_CATEGORIES = [
  "Consumer Electronics & Accessories",
  "Fashion, Clothing & Footwear",
  "Home, Kitchen & Living",
  "Beauty, Health & Personal Care",
  "Groceries & Gourmet Food",
  "Books, Toys & Stationery",
  "Sports, Fitness & Outdoor",
  "Automotive & Industrial Parts",
  "Jewelry & Watches",
  "General Merchandise",
];

const BUSINESS_TYPES = [
  "Sole Proprietorship",
  "Partnership Firm",
  "Private Limited Company (Pvt Ltd)",
  "Limited Liability Partnership (LLP)",
  "Public Limited Company",
  "Individual / Home Business",
];

export default function RegisterContent() {
  const router = useRouter();

  // Auth state
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Quick account creation/login state if not signed in
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFullName, setAuthFullName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  // Business details
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0]);
  const [category, setCategory] = useState(PRODUCT_CATEGORIES[0]);
  const [gstNumber, setGstNumber] = useState("");

  // Location details
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState(INDIAN_STATES[0]);
  const [pincode, setPincode] = useState("");

  const [submittingApplication, setSubmittingApplication] = useState(false);

  // Feedback messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check user session on mount
  useEffect(() => {
    const checkUser = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setErrorMessage(`Could not check your sign-in status: ${error.message}`);
        setCheckingAuth(false);
        return;
      }

      const user = data.session?.user ?? null;
      setCurrentUser(user);
      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, role")
          .eq("auth_uid", user.id)
          .maybeSingle();

        if (profileError) {
          setErrorMessage(`Could not load your account role: ${profileError.message}`);
          setCheckingAuth(false);
          return;
        }

        if (profile?.role === "admin") {
          router.replace("/admin/dashboard");
          return;
        }

        if (profile?.role === "seller") {
          const { data: seller, error: sellerError } = await supabase
            .from("sellers")
            .select("status")
            .eq("profile_id", profile.id)
            .maybeSingle();
          if (sellerError) {
            setErrorMessage(`Could not load your seller application: ${sellerError.message}`);
          } else if (seller?.status === "approved") {
            router.replace("/seller/dashboard");
            return;
          } else if (seller) {
            setErrorMessage("Your seller account is not active yet. Please complete registration details or contact support.");
          }
        }
      }

      setCheckingAuth(false);
    };
    void checkUser();
  }, [router]);

  // Handle in-page auth for unauthenticated sellers
  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setAuthNotice(null);
    setAuthLoading(true);

    if (authMode === "signup") {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: {
          data: { full_name: authFullName },
          emailRedirectTo: `${siteUrl}/auth/callback?next=/seller/register`,
        },
      });
      setAuthLoading(false);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      if (!data.user?.email_confirmed_at) {
        setAuthNotice(
          "Account created! Please check your email to verify your address, then sign in to complete your seller application.",
        );
        return;
      }
      setCurrentUser(data.user);
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      setAuthLoading(false);
      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (!data.user?.email_confirmed_at) {
        await supabase.auth.signOut();
        setErrorMessage("Please verify your email before signing in.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("auth_uid", data.user.id)
        .maybeSingle();

      if (profileError) {
        setErrorMessage(`Could not load your account role: ${profileError.message}`);
        return;
      }

      if (profile?.role === "admin") {
        router.replace("/admin/dashboard");
        return;
      }

      if (profile?.role === "seller") {
        const { data: seller, error: sellerError } = await supabase
          .from("sellers")
          .select("status")
          .eq("profile_id", profile.id)
          .maybeSingle();
        if (sellerError) {
          setErrorMessage(`Could not load your seller application: ${sellerError.message}`);
          return;
        }
        if (seller?.status === "approved") {
          router.replace("/seller/dashboard");
          return;
        }
        setErrorMessage("Your seller account is not active yet. Please complete registration details or contact support.");
      }

      setCurrentUser(data.user);
    }
    setAuthLoading(false);
  };

  const submitApplication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    // Validation
    if (businessName.trim().length < 2) {
      setErrorMessage("Business name must be at least 2 characters.");
      return;
    }
    if (!address.trim() || !city.trim() || !pincode.trim()) {
      setErrorMessage("Please complete all location fields (Address, City, State, and Pincode).");
      return;
    }
    if (!/^\d{6}$/.test(pincode.trim())) {
      setErrorMessage("Enter a valid 6-digit Indian PIN code.");
      return;
    }
    if (gstNumber.trim() && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstNumber.trim().toUpperCase())) {
      setErrorMessage("Please enter a valid 15-character GSTIN format (e.g. 22AAAAA0000A1Z5), or leave blank if not applicable.");
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setErrorMessage("Please sign in or create an account first before applying as a seller.");
      return;
    }

    if (!userData.user.email_confirmed_at) {
      setErrorMessage("Your email address is not verified yet. Please check your inbox for the confirmation email before applying as a seller.");
      return;
    }

    setSubmittingApplication(true);
    const fullAddress = `${address.trim()}, ${city.trim()}, ${state.trim()} - ${pincode.trim()}`;
    const fullBusinessType = `${category.trim()} · ${businessType.trim()}`;
    const { error: applicationError } = await supabase.rpc(
      "submit_seller_application",
      {
        business_name_input: businessName.trim(),
        business_address_input: fullAddress,
        business_type_input: fullBusinessType,
        gst_number_input: gstNumber.trim().toUpperCase() || null,
      },
    );

    if (applicationError) {
      setErrorMessage(applicationError.message);
      setSubmittingApplication(false);
      return;
    }

    setSubmittingApplication(false);
    router.replace("/seller/dashboard");
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <header className="border-b border-slate-800 bg-slate-900 text-white px-6 py-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <Link href="/seller" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400 font-black text-slate-950">
                S
              </span>
              <span className="text-xl font-extrabold tracking-tight text-white">
                Shopora <span className="text-xs font-semibold uppercase text-amber-400">Seller Central</span>
              </span>
            </Link>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
          <span className="ml-3 text-sm text-gray-600">Loading seller registration…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="border-b border-slate-800 bg-slate-900 text-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/seller" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400 font-black text-slate-950">
              S
            </span>
            <span className="text-xl font-extrabold tracking-tight text-white">
              Shopora <span className="text-xs font-semibold uppercase text-amber-400">Seller Central</span>
            </span>
          </Link>
          <div className="flex items-center gap-4 text-xs">
            <Link href="/seller" className="text-slate-300 hover:text-white transition">
              Already registered? Sign in
            </Link>
            <Link href="/" className="text-slate-400 hover:text-white transition">
              ← Customer Store
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl p-6 flex-1">
        {/* Header Breadcrumbs */}
        <div className="mb-6 pb-4 border-b border-gray-200">
          <Link href="/" className="text-xs text-indigo-600 hover:underline">← Home</Link>
          <h1 className="mt-2 text-3xl font-extrabold text-gray-900 tracking-tight">Become a Shopora Seller</h1>
          <p className="mt-1 text-sm text-gray-600">
            Reach millions of customers across India. Register your business, verify your details, and start selling.
          </p>
        </div>

        {/* ── STEP 0: Authentication Required Banner ── */}
        {!currentUser && (
          <div className="mb-8 rounded-xl border border-indigo-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-600">1</span>
              <div>
                <h2 className="text-base font-bold text-gray-900">Step 1: Sign In or Create Seller Account</h2>
                <p className="text-xs text-gray-500">You must be logged in to attach your seller store to an account.</p>
              </div>
            </div>

            <div className="flex border-b border-gray-200 mb-4">
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className={`pb-2 mr-6 text-sm font-semibold transition ${
                  authMode === "signup" ? "border-b-2 border-indigo-700 text-indigo-600" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Create New Seller Account
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("signin")}
                className={`pb-2 text-sm font-semibold transition ${
                  authMode === "signin" ? "border-b-2 border-indigo-700 text-indigo-600" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Sign In to Existing Account
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === "signup" && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Your Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={authFullName}
                    onChange={(e) => setAuthFullName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="seller@business.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                </div>
              </div>

              {authNotice && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-800">
                  {authNotice}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {authLoading ? "Processing…" : authMode === "signup" ? "Create Account & Continue" : "Sign In & Continue"}
              </button>
            </form>
          </div>
        )}

        {/* User Status Bar if logged in */}
        {currentUser && (
          <div className="mb-6 flex items-center justify-between rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3 text-xs text-indigo-800">
            <span>
              Connected as: <strong className="font-semibold">{currentUser.email}</strong>
            </span>
            <span className="inline-flex items-center text-green-700 font-medium">
              <svg className="w-4 h-4 mr-1 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Account Active
            </span>
          </div>
        )}

        {/* ── SELLER REGISTRATION FORM ── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm space-y-6">
          <form onSubmit={submitApplication} className="space-y-6">
              {/* Section 1: Business Details */}
              <div>
                <h2 className="text-base font-bold text-gray-900 pb-2 border-b border-gray-100 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">1</span>
                  Business & Store Details
                </h2>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Business / Store Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={120}
                      placeholder="e.g. Apex Electronics Retail"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Primary Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    >
                      {PRODUCT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Business Structure <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    >
                      {BUSINESS_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: GST & Tax Info */}
              <div>
                <h2 className="text-base font-bold text-gray-900 pb-2 border-b border-gray-100 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">2</span>
                  GST & Tax Identification
                </h2>
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    GSTIN / GST Number
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="e.g. 22AAAAA0000A1Z5"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm uppercase text-gray-900 placeholder:normal-case focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Enter your 15-character GSTIN. If exempt or not registered under GST, you may leave this blank.
                  </p>
                </div>
              </div>

              {/* Section 3: Location Details */}
              <div>
                <h2 className="text-base font-bold text-gray-900 pb-2 border-b border-gray-100 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">3</span>
                  Business Location & Pickup Address
                </h2>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Registered Address / Street Address <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      required
                      placeholder="Shop/Unit No., Building, Street, Area"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      City / District <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mumbai, Bengaluru"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      State / Union Territory <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    >
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      PIN Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="e.g. 400001"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    />
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-xs text-red-700 font-medium">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingApplication || !currentUser}
                className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {submittingApplication ? "Submitting application…" : "Submit Seller Application"}
              </button>

              {!currentUser && (
                <p className="text-center text-xs text-amber-700">
                  Sign in and verify your email above before submitting your application.
                </p>
              )}
            </form>
        </div>

        {/* Footer Note */}
        <p className="mt-6 text-center text-xs text-gray-500">
          After your email is verified and seller details are submitted, your account is activated automatically so you can publish product offers and manage inventory.
        </p>
      </main>
    </div>
  );
}

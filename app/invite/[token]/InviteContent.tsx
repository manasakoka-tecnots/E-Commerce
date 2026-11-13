"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/src/lib/supabase/client";

interface InviteInfo {
  found: boolean;
  name?: string;
  role?: string;
  seller_name?: string;
  locations?: string[];
  error?: string;
}

type PageState =
  | "loading"
  | "invite_logged_in"
  | "invite_not_logged_in"
  | "accepting"
  | "success"
  | "invalid_token";

const roleBadgeColors: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700 border-purple-200",
  manager: "bg-blue-100 text-blue-700 border-blue-200",
  associate: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function InviteContent() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const didRun = useRef(false);

  const [state, setState] = useState<PageState>("loading");
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState("");

  // Load invite info (always works, even for anonymous users)
  useEffect(() => {
    if (!token || didRun.current) return;
    didRun.current = true;

    (async () => {
      try {
        // 1. Load invite info first — this works for anyone (anon or authenticated)
        const { data, error } = await supabase.rpc("get_staff_invite_info", {
          p_token: token,
        });

        if (error || !data?.found) {
          setState("invalid_token");
          setErrorMessage(
            data?.error ||
              "This invite link is invalid or has already been used. Please ask the store owner to send a new invitation."
          );
          return;
        }

        setInviteInfo(data as InviteInfo);

        // 2. Now check if user is logged in
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user?.email) {
          setUserEmail(user.email);
          setState("invite_logged_in");
        } else {
          setState("invite_not_logged_in");
        }
      } catch {
        setState("invalid_token");
        setErrorMessage("Something went wrong. Please try again later.");
      }
    })();
  }, [token]);

  // Listen for auth changes (user logs in from the login page and comes back)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_IN") {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.email) {
          setUserEmail(user.email);
          setState("invite_logged_in");
        }
      }
      if (event === "SIGNED_OUT") {
        setUserEmail(null);
        setState("invite_not_logged_in");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleAccept() {
    setAcceptError("");
    setState("accepting");

    try {
      // Get session token for server-side API call
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        // Session expired or invalid — show login buttons
        setUserEmail(null);
        setState("invite_not_logged_in");
        return;
      }

      // Use server-side API to accept invite (bypasses all RLS issues)
      const res = await fetch("/api/staff/accept-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ token }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        setAcceptError(
          result.error || "Failed to accept the invitation. Please try again."
        );
        setState("invite_logged_in");
        return;
      }

      setState("success");
    } catch {
      setAcceptError(
        "Something went wrong while accepting the invitation. Please try again."
      );
      setState("invite_logged_in");
    }
  }

  const storeName = inviteInfo?.seller_name || "Store";
  const inviteUrl = `/invite/${token}`;

  // ── Loading ──
  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#ff3f6c]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/">
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ color: "#ff3f6c" }}
            >
              Shopora
            </h1>
          </Link>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          {/* ── Invalid Token ── */}
          {state === "invalid_token" && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                <svg
                  className="h-7 w-7 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 className="mb-2 text-lg font-semibold text-slate-900">
                Invitation Unavailable
              </h2>
              <p className="text-sm text-slate-500">{errorMessage}</p>
              <Link
                href="/"
                className="mt-6 inline-block text-sm font-medium hover:underline"
                style={{ color: "#ff3f6c" }}
              >
                Go to homepage
              </Link>
            </div>
          )}

          {/* ── Success State ── */}
          {state === "success" && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                <svg
                  className="h-7 w-7 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="mb-2 text-lg font-semibold text-slate-900">
                Welcome to {storeName}!
              </h2>
              <p className="mb-6 text-sm text-slate-500">
                You have successfully joined the team. You can now access the
                store dashboard.
              </p>
              <button
                onClick={() => router.push("/seller")}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: "#ff3f6c" }}
              >
                Go to Dashboard
              </button>
            </div>
          )}

          {/* ── Accepting State ── */}
          {state === "accepting" && (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#ff3f6c]" />
              <p className="text-sm text-slate-500">
                Joining {storeName}...
              </p>
            </div>
          )}

          {/* ── Invite Details (Not Logged In) ── */}
          {state === "invite_not_logged_in" && inviteInfo && (
            <>
              <InviteDetails inviteInfo={inviteInfo} storeName={storeName} />

              <div className="mt-6 space-y-3">
                <p className="mb-1 text-center text-sm text-slate-500">
                  Sign in or create an account to join
                </p>
                <Link
                  href={`/auth/login?redirect=${encodeURIComponent(inviteUrl)}`}
                  className="block w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:opacity-90"
                  style={{ backgroundColor: "#ff3f6c" }}
                >
                  I have an account — Sign in
                </Link>
                <Link
                  href={`/auth/register?redirect=${encodeURIComponent(inviteUrl)}`}
                  className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Create a new account
                </Link>
              </div>
            </>
          )}

          {/* ── Invite Details (Logged In) ── */}
          {state === "invite_logged_in" && inviteInfo && (
            <>
              <InviteDetails inviteInfo={inviteInfo} storeName={storeName} />

              {userEmail && (
                <p className="mt-4 text-center text-xs text-slate-400">
                  Logged in as{" "}
                  <span className="font-medium text-slate-600">
                    {userEmail}
                  </span>
                </p>
              )}

              {acceptError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-center text-sm text-red-600">
                    {acceptError}
                  </p>
                </div>
              )}

              <button
                onClick={handleAccept}
                className="mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: "#ff3f6c" }}
              >
                Join {storeName}
              </button>

              {userEmail && (
                <p className="mt-3 text-center text-xs text-slate-400">
                  Not you?{" "}
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut();
                      setUserEmail(null);
                      setState("invite_not_logged_in");
                    }}
                    className="font-medium hover:underline"
                    style={{ color: "#ff3f6c" }}
                  >
                    Sign out and use a different account
                  </button>
                </p>
              )}
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Powered by Shopora
        </p>
      </div>
    </div>
  );
}

function InviteDetails({
  inviteInfo,
  storeName,
}: {
  inviteInfo: InviteInfo;
  storeName: string;
}) {
  return (
    <>
      <div className="mb-6 text-center">
        {/* Store avatar */}
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
          <span className="text-lg font-bold text-slate-600">
            {storeName
              .split(" ")
              .map((w) => w[0])
              .join("")
              .substring(0, 2)
              .toUpperCase()}
          </span>
        </div>
        <p className="text-sm text-slate-500">You&apos;re invited to join</p>
        <p className="mt-1 text-xl font-bold text-slate-900">{storeName}</p>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Your name</span>
          <span className="text-sm font-medium text-slate-900">
            {inviteInfo.name}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Role</span>
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
              roleBadgeColors[inviteInfo.role ?? "associate"] ??
              roleBadgeColors.associate
            }`}
          >
            {inviteInfo.role}
          </span>
        </div>

        {inviteInfo.locations && inviteInfo.locations.length > 0 && (
          <div>
            <span className="mb-2 block text-sm text-slate-500">
              Assigned locations
            </span>
            <div className="flex flex-wrap gap-1.5">
              {inviteInfo.locations.map((loc) => (
                <span
                  key={loc}
                  className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700"
                >
                  {loc}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

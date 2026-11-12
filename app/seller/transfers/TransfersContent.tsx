"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase/client";

/* ───────── types ───────── */

type Location = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  state: string | null;
};

type Listing = {
  id: string;
  product_id: string;
  product_name: string;
  stock: number;
};

type Variant = {
  id: string;
  title: string;
  sku: string | null;
};

type TransferItem = {
  id: string;
  transfer_id: string;
  listing_id: string;
  variant_id: string | null;
  variant_title: string | null;
  quantity: number;
  received_quantity: number | null;
  product_name?: string;
};

type Transfer = {
  id: string;
  seller_id: string;
  from_location_id: string;
  to_location_id: string;
  status: string;
  reference_number: string;
  tracking_number: string | null;
  carrier: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  shipped_at: string | null;
  received_at: string | null;
  from_location_name?: string;
  to_location_name?: string;
  items_count?: number;
};

type NewTransferItem = {
  listing_id: string;
  product_name: string;
  variant_id: string | null;
  variant_title: string | null;
  available_at_origin: number;
  quantity: number;
};

/* ───────── status helpers ───────── */

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  ready: "bg-blue-100 text-blue-800",
  in_transit: "bg-indigo-100 text-indigo-800",
  received: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  ready: "Ready",
  in_transit: "In Transit",
  received: "Received",
  cancelled: "Cancelled",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

/* ───────── component ───────── */

export default function TransfersContent() {
  /* auth / seller state */
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* data */
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);

  /* UI state */
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [detailItems, setDetailItems] = useState<TransferItem[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  /* create form state */
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [notes, setNotes] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [transferItems, setTransferItems] = useState<NewTransferItem[]>([]);
  const [creating, setCreating] = useState(false);

  /* variant picker state */
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [productVariants, setProductVariants] = useState<Variant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);

  /* detail action fields */
  const [detailTracking, setDetailTracking] = useState("");
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  /* ── auth flow ── */
  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_uid", userData.user.id)
        .maybeSingle();
      if (!profile) {
        setLoading(false);
        return;
      }
      setProfileId(profile.id);

      const { data: seller } = await supabase
        .from("sellers")
        .select("id")
        .eq("profile_id", profile.id)
        .maybeSingle();
      if (!seller) {
        setLoading(false);
        return;
      }

      setSellerId(seller.id);
      setLoading(false);
    })();
  }, []);

  /* ── load transfers ── */
  const loadTransfers = useCallback(async (sid: string) => {
    const { data, error: fetchErr } = await supabase
      .from("inventory_transfers")
      .select("*")
      .eq("seller_id", sid)
      .order("created_at", { ascending: false });

    if (fetchErr) {
      setError("Failed to load transfers: " + fetchErr.message);
      return;
    }
    if (!data) return;

    /* enrich with location names and items count */
    const locationIds = new Set<string>();
    data.forEach((t: any) => {
      locationIds.add(t.from_location_id);
      locationIds.add(t.to_location_id);
    });

    let locMap: Record<string, string> = {};
    if (locationIds.size > 0) {
      const { data: locs } = await supabase
        .from("seller_locations")
        .select("id, name")
        .in("id", Array.from(locationIds));
      if (locs) {
        locs.forEach((l: any) => {
          locMap[l.id] = l.name;
        });
      }
    }

    /* get items count per transfer */
    const transferIds = data.map((t: any) => t.id);
    let itemsCounts: Record<string, number> = {};
    if (transferIds.length > 0) {
      const { data: tiData } = await supabase
        .from("transfer_items")
        .select("transfer_id, id")
        .in("transfer_id", transferIds);
      if (tiData) {
        tiData.forEach((ti: any) => {
          itemsCounts[ti.transfer_id] = (itemsCounts[ti.transfer_id] || 0) + 1;
        });
      }
    }

    const enriched: Transfer[] = data.map((t: any) => ({
      ...t,
      from_location_name: locMap[t.from_location_id] || "Unknown",
      to_location_name: locMap[t.to_location_id] || "Unknown",
      items_count: itemsCounts[t.id] || 0,
    }));

    setTransfers(enriched);
  }, []);

  /* ── load locations ── */
  const loadLocations = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from("seller_locations")
      .select("id, name, type, city, state")
      .eq("seller_id", sid)
      .order("name");
    if (data) setLocations(data);
  }, []);

  /* ── load listings ── */
  const loadListings = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from("seller_listings")
      .select("id, product_id, stock, products(name)")
      .eq("seller_id", sid)
      .order("created_at", { ascending: false });
    if (data) {
      setListings(
        data.map((l: any) => {
          const prod = Array.isArray(l.products) ? l.products[0] : l.products;
          return {
            id: l.id,
            product_id: l.product_id,
            product_name: prod?.name ?? "Untitled",
            stock: Number(l.stock) || 0,
          };
        })
      );
    }
  }, []);

  /* ── trigger loads when sellerId is set ── */
  useEffect(() => {
    if (!sellerId) return;
    loadTransfers(sellerId);
    loadLocations(sellerId);
    loadListings(sellerId);
  }, [sellerId, loadTransfers, loadLocations, loadListings]);

  /* ── summary counts ── */
  const totalCount = transfers.length;
  const pendingCount = transfers.filter((t) => t.status === "pending").length;
  const inTransitCount = transfers.filter((t) => t.status === "in_transit").length;
  const receivedCount = transfers.filter((t) => t.status === "received").length;

  /* ── generate reference ── */
  const generateReference = () => {
    const ts = Date.now().toString(36).toUpperCase();
    return `TRF-${ts}`;
  };

  /* ── open create modal ── */
  const openCreate = () => {
    setFromLocationId("");
    setToLocationId("");
    setReferenceNumber(generateReference());
    setTrackingNumber("");
    setCarrier("");
    setNotes("");
    setProductSearch("");
    setTransferItems([]);
    setShowCreate(true);
  };

  /* ── search products for create form ── */
  const filteredProducts = listings.filter((l) => {
    if (!productSearch.trim()) return false;
    return l.product_name.toLowerCase().includes(productSearch.toLowerCase());
  });

  /* ── expand product to show variants ── */
  const expandProduct = async (listing: Listing) => {
    // If already added (no-variant product), ignore
    const alreadyAddedNoVariant = transferItems.some(
      (ti) => ti.listing_id === listing.id && !ti.variant_id
    );

    if (expandedProductId === listing.id) {
      setExpandedProductId(null);
      setProductVariants([]);
      return;
    }
    setExpandedProductId(listing.id);
    setLoadingVariants(true);
    const { data: variants } = await supabase
      .from("product_variants")
      .select("id, title, sku")
      .eq("product_id", listing.product_id)
      .order("title");
    setProductVariants(variants || []);
    setLoadingVariants(false);

    // If no variants, add the product directly (no variant)
    if (!variants || variants.length === 0) {
      if (!alreadyAddedNoVariant) {
        await addProduct(listing, null, null);
      }
      setExpandedProductId(null);
      setProductVariants([]);
      setProductSearch("");
    }
  };

  /* ── add product (with optional variant) to transfer ── */
  const addProduct = async (listing: Listing, variantId: string | null, variantTitle: string | null) => {
    // Check if this exact listing+variant combo is already added
    const alreadyAdded = transferItems.some(
      (ti) => ti.listing_id === listing.id && ti.variant_id === variantId
    );
    if (alreadyAdded) return;

    let availableAtOrigin = 0;
    if (fromLocationId) {
      let query = supabase
        .from("location_inventory")
        .select("available")
        .eq("location_id", fromLocationId)
        .eq("listing_id", listing.id);
      if (variantId) {
        query = query.eq("variant_id", variantId);
      } else {
        query = query.is("variant_id", null);
      }
      const { data } = await query;
      availableAtOrigin = (data || []).reduce((sum: number, r: { available: number }) => sum + (r.available || 0), 0);
    }
    setTransferItems((prev) => [
      ...prev,
      {
        listing_id: listing.id,
        product_name: listing.product_name,
        variant_id: variantId,
        variant_title: variantTitle,
        available_at_origin: availableAtOrigin,
        quantity: 1,
      },
    ]);
  };

  /* ── remove product from transfer ── */
  const removeTransferItem = (listingId: string, variantId: string | null) => {
    setTransferItems((prev) =>
      prev.filter((i) => !(i.listing_id === listingId && i.variant_id === variantId))
    );
  };

  /* ── update item quantity ── */
  const updateItemQty = (listingId: string, variantId: string | null, qty: number) => {
    setTransferItems((prev) =>
      prev.map((i) =>
        i.listing_id === listingId && i.variant_id === variantId
          ? { ...i, quantity: qty }
          : i
      )
    );
  };

  /* ── reload origin stock when origin location changes ── */
  useEffect(() => {
    if (!fromLocationId || transferItems.length === 0) return;
    (async () => {
      const updated = await Promise.all(
        transferItems.map(async (item) => {
          let query = supabase
            .from("location_inventory")
            .select("available")
            .eq("location_id", fromLocationId)
            .eq("listing_id", item.listing_id);
          if (item.variant_id) {
            query = query.eq("variant_id", item.variant_id);
          } else {
            query = query.is("variant_id", null);
          }
          const { data } = await query;
          const total = (data || []).reduce((sum: number, r: { available: number }) => sum + (r.available || 0), 0);
          return { ...item, available_at_origin: total };
        })
      );
      setTransferItems(updated);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromLocationId]);

  /* ── create transfer ── */
  const handleCreate = async () => {
    if (!sellerId || !fromLocationId || !toLocationId || transferItems.length === 0) {
      alert("Please fill in all required fields and add at least one product.");
      showToast("Please fill in all required fields and add at least one product.", "error");
      return;
    }
    if (fromLocationId === toLocationId) {
      alert("Origin and destination must be different locations.");
      showToast("Origin and destination must be different locations.", "error");
      return;
    }
    const invalidQty = transferItems.find((i) => i.quantity < 1);
    if (invalidQty) {
      alert("Quantity must be at least 1 for all items.");
      showToast("Quantity must be at least 1 for all items.", "error");
      return;
    }
    const insufficientStock = transferItems.find(
      (i) => i.quantity > i.available_at_origin
    );
    if (insufficientStock) {
      alert(
        `Insufficient stock for "${insufficientStock.product_name}". Available: ${insufficientStock.available_at_origin}, Requested: ${insufficientStock.quantity}`
      );
      showToast(`Insufficient stock for "${insufficientStock.product_name}".`, "error");
      return;
    }

    setCreating(true);
    try {
      const { data: transfer, error: insertErr } = await supabase
        .from("inventory_transfers")
        .insert({
          seller_id: sellerId,
          from_location_id: fromLocationId,
          to_location_id: toLocationId,
          status: "pending",
          reference_number: referenceNumber || generateReference(),
          tracking_number: trackingNumber || null,
          carrier: carrier || null,
          notes: notes || null,
          created_by: profileId,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      const items = transferItems.map((i) => ({
        transfer_id: transfer.id,
        listing_id: i.listing_id,
        variant_id: i.variant_id || null,
        variant_title: i.variant_title || null,
        quantity: i.quantity,
        received_quantity: 0,
      }));

      const { error: itemsErr } = await supabase
        .from("transfer_items")
        .insert(items);

      if (itemsErr) throw itemsErr;

      setShowCreate(false);
      await loadTransfers(sellerId);
      showToast("Transfer created successfully!", "success");
    } catch (err: any) {
      alert("Failed to create transfer: " + (err.message || err));
      showToast("Failed to create transfer: " + (err.message || err), "error");
    } finally {
      setCreating(false);
    }
  };

  /* ── view transfer detail ── */
  const viewTransfer = async (transfer: Transfer) => {
    setSelectedTransfer(transfer);
    setDetailTracking(transfer.tracking_number || "");

    const { data: items } = await supabase
      .from("transfer_items")
      .select("*")
      .eq("transfer_id", transfer.id);

    if (items && items.length > 0) {
      /* enrich with product names */
      const listingIds = items.map((i: any) => i.listing_id);
      const { data: listingData } = await supabase
        .from("seller_listings")
        .select("id, products(name)")
        .in("id", listingIds);

      const nameMap: Record<string, string> = {};
      if (listingData) {
        listingData.forEach((l: any) => {
          const prod = Array.isArray(l.products) ? l.products[0] : l.products;
          nameMap[l.id] = prod?.name ?? "Untitled";
        });
      }

      const enriched: TransferItem[] = items.map((i: any) => ({
        ...i,
        product_name: nameMap[i.listing_id] || "Untitled",
        variant_id: i.variant_id || null,
        variant_title: i.variant_title || null,
      }));
      setDetailItems(enriched);

      /* init received quantities */
      const rq: Record<string, number> = {};
      enriched.forEach((i) => {
        rq[i.id] = i.received_quantity ?? i.quantity;
      });
      setReceivedQuantities(rq);
    } else {
      setDetailItems([]);
      setReceivedQuantities({});
    }
  };

  /* ── helper: update aggregate listing stock ── */
  const updateListingStock = async (listingId: string) => {
    const { data: invRows } = await supabase
      .from("location_inventory")
      .select("available")
      .eq("listing_id", listingId);

    const total = (invRows || []).reduce(
      (sum: number, r: any) => sum + (Number(r.available) || 0),
      0
    );

    await supabase
      .from("seller_listings")
      .update({ stock: total })
      .eq("id", listingId);
  };

  /* ── mark as ready ── */
  const markReady = async () => {
    if (!selectedTransfer || !sellerId) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("inventory_transfers")
        .update({ status: "ready", updated_at: new Date().toISOString() })
        .eq("id", selectedTransfer.id);
      if (error) throw error;

      setSelectedTransfer({ ...selectedTransfer, status: "ready" });
      await loadTransfers(sellerId);
      showToast("Transfer marked as ready!", "success");
    } catch (err: any) {
      alert("Failed: " + err.message);
      showToast("Failed: " + err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  /* ── mark as in transit ── */
  const markInTransit = async () => {
    if (!selectedTransfer || !sellerId) return;
    setActionLoading(true);
    try {
      const now = new Date().toISOString();

      /* update transfer status */
      const { error } = await supabase
        .from("inventory_transfers")
        .update({
          status: "in_transit",
          shipped_at: now,
          tracking_number: detailTracking || null,
          updated_at: now,
        })
        .eq("id", selectedTransfer.id);
      if (error) throw error;

      /* verify stock availability at origin before deducting */
      for (const item of detailItems) {
        let checkQuery = supabase
          .from("location_inventory")
          .select("available")
          .eq("location_id", selectedTransfer.from_location_id)
          .eq("listing_id", item.listing_id);
        if (item.variant_id) {
          checkQuery = checkQuery.eq("variant_id", item.variant_id);
        } else {
          checkQuery = checkQuery.is("variant_id", null);
        }
        const { data: checkInv } = await checkQuery.maybeSingle();
        const avail = checkInv?.available ?? 0;
        const label = item.variant_title
          ? `${item.product_name} (${item.variant_title})`
          : item.product_name || item.listing_id;
        if (avail < item.quantity) {
          alert(
            `Insufficient stock for "${label}". Available: ${avail}, Required: ${item.quantity}. Please adjust the transfer or restock first.`
          );
          showToast(`Insufficient stock for "${label}".`, "error");
          setActionLoading(false);
          return;
        }
      }

      /* decrease stock at origin & increase incoming at destination */
      for (const item of detailItems) {
        /* build variant-aware query helpers */
        const originQuery = () => {
          let q = supabase
            .from("location_inventory")
            .select("id, available")
            .eq("location_id", selectedTransfer.from_location_id)
            .eq("listing_id", item.listing_id);
          if (item.variant_id) q = q.eq("variant_id", item.variant_id);
          else q = q.is("variant_id", null);
          return q;
        };
        const destQuery = () => {
          let q = supabase
            .from("location_inventory")
            .select("id, incoming")
            .eq("location_id", selectedTransfer.to_location_id)
            .eq("listing_id", item.listing_id);
          if (item.variant_id) q = q.eq("variant_id", item.variant_id);
          else q = q.is("variant_id", null);
          return q;
        };

        /* read-then-write to subtract from origin */
        const { data: inv } = await originQuery().maybeSingle();

        if (inv) {
          const newAvail = Math.max(0, (inv.available || 0) - item.quantity);
          await supabase
            .from("location_inventory")
            .update({ available: newAvail })
            .eq("id", inv.id);
        }

        /* mark incoming at destination */
        const { data: destInv } = await destQuery().maybeSingle();

        if (destInv) {
          await supabase
            .from("location_inventory")
            .update({ incoming: (destInv.incoming || 0) + item.quantity })
            .eq("id", destInv.id);
        } else {
          await supabase.from("location_inventory").insert({
            location_id: selectedTransfer.to_location_id,
            listing_id: item.listing_id,
            variant_id: item.variant_id || null,
            available: 0,
            committed: 0,
            incoming: item.quantity,
          });
        }

        /* create audit adjustment */
        const oldAvail = inv ? (inv.available || 0) : 0;
        await supabase.from("inventory_adjustments").insert({
          listing_id: item.listing_id,
          location_id: selectedTransfer.from_location_id,
          adjustment_type: "transfer_out",
          quantity_change: -item.quantity,
          old_available: oldAvail + item.quantity,
          new_available: oldAvail,
          reason: `Transfer ${selectedTransfer.reference_number} shipped${item.variant_title ? ` (${item.variant_title})` : ""}`,
          reference_id: selectedTransfer.id,
          created_by: profileId,
          variant_id: item.variant_id || null,
          variant_title: item.variant_title || null,
        });

        /* update aggregate stock */
        await updateListingStock(item.listing_id);
      }

      setSelectedTransfer({
        ...selectedTransfer,
        status: "in_transit",
        shipped_at: now,
        tracking_number: detailTracking || null,
      });
      await loadTransfers(sellerId);
      showToast("Transfer marked as in transit!", "success");
    } catch (err: any) {
      alert("Failed: " + err.message);
      showToast("Failed: " + err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  /* ── receive transfer ── */
  const receiveTransfer = async () => {
    if (!selectedTransfer || !sellerId) return;
    setActionLoading(true);
    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("inventory_transfers")
        .update({
          status: "received",
          received_at: now,
          updated_at: now,
        })
        .eq("id", selectedTransfer.id);
      if (error) throw error;

      for (const item of detailItems) {
        const recvQty = receivedQuantities[item.id] ?? item.quantity;

        /* update transfer_items received_quantity */
        await supabase
          .from("transfer_items")
          .update({ received_quantity: recvQty })
          .eq("id", item.id);

        /* upsert destination location inventory & clear incoming */
        let destRecvQuery = supabase
          .from("location_inventory")
          .select("id, available, incoming")
          .eq("location_id", selectedTransfer.to_location_id)
          .eq("listing_id", item.listing_id);
        if (item.variant_id) destRecvQuery = destRecvQuery.eq("variant_id", item.variant_id);
        else destRecvQuery = destRecvQuery.is("variant_id", null);
        const { data: existing } = await destRecvQuery.maybeSingle();

        if (existing) {
          await supabase
            .from("location_inventory")
            .update({
              available: (existing.available || 0) + recvQty,
              incoming: Math.max(0, (existing.incoming || 0) - item.quantity),
            })
            .eq("id", existing.id);
        } else {
          await supabase.from("location_inventory").insert({
            location_id: selectedTransfer.to_location_id,
            listing_id: item.listing_id,
            variant_id: item.variant_id || null,
            available: recvQty,
            committed: 0,
            incoming: 0,
          });
        }

        /* audit adjustment */
        const oldDestAvail = existing ? (existing.available || 0) : 0;
        await supabase.from("inventory_adjustments").insert({
          listing_id: item.listing_id,
          location_id: selectedTransfer.to_location_id,
          adjustment_type: "transfer_in",
          quantity_change: recvQty,
          old_available: oldDestAvail,
          new_available: oldDestAvail + recvQty,
          reason: `Transfer ${selectedTransfer.reference_number} received${item.variant_title ? ` (${item.variant_title})` : ""}`,
          reference_id: selectedTransfer.id,
          created_by: profileId,
          variant_id: item.variant_id || null,
          variant_title: item.variant_title || null,
        });

        /* update aggregate stock */
        await updateListingStock(item.listing_id);
      }

      /* update local detailItems with received quantities */
      setDetailItems((prev) =>
        prev.map((item) => ({
          ...item,
          received_quantity: receivedQuantities[item.id] ?? item.quantity,
        }))
      );
      setSelectedTransfer({
        ...selectedTransfer,
        status: "received",
        received_at: now,
      });
      await loadTransfers(sellerId);
      showToast("Transfer received successfully!", "success");
    } catch (err: any) {
      alert("Failed: " + err.message);
      showToast("Failed: " + err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  /* ── cancel transfer ── */
  const cancelTransfer = async () => {
    if (!selectedTransfer || !sellerId) return;
    if (!confirm("Are you sure you want to cancel this transfer?")) return;
    setActionLoading(true);
    try {
      const now = new Date().toISOString();

      /* if in_transit, restore origin stock & clear incoming at destination */
      if (selectedTransfer.status === "in_transit") {
        for (const item of detailItems) {
          /* restore origin stock */
          let originCancelQ = supabase
            .from("location_inventory")
            .select("id, available")
            .eq("location_id", selectedTransfer.from_location_id)
            .eq("listing_id", item.listing_id);
          if (item.variant_id) originCancelQ = originCancelQ.eq("variant_id", item.variant_id);
          else originCancelQ = originCancelQ.is("variant_id", null);
          const { data: inv } = await originCancelQ.maybeSingle();

          if (inv) {
            await supabase
              .from("location_inventory")
              .update({ available: (inv.available || 0) + item.quantity })
              .eq("id", inv.id);
          } else {
            await supabase.from("location_inventory").insert({
              location_id: selectedTransfer.from_location_id,
              listing_id: item.listing_id,
              variant_id: item.variant_id || null,
              available: item.quantity,
              committed: 0,
              incoming: 0,
            });
          }

          /* clear incoming at destination */
          let destCancelQ = supabase
            .from("location_inventory")
            .select("id, incoming")
            .eq("location_id", selectedTransfer.to_location_id)
            .eq("listing_id", item.listing_id);
          if (item.variant_id) destCancelQ = destCancelQ.eq("variant_id", item.variant_id);
          else destCancelQ = destCancelQ.is("variant_id", null);
          const { data: destInv } = await destCancelQ.maybeSingle();

          if (destInv) {
            await supabase
              .from("location_inventory")
              .update({ incoming: Math.max(0, (destInv.incoming || 0) - item.quantity) })
              .eq("id", destInv.id);
          }

          /* audit adjustment for restoration */
          const oldCancelAvail = inv ? ((inv.available || 0)) : 0;
          await supabase.from("inventory_adjustments").insert({
            listing_id: item.listing_id,
            location_id: selectedTransfer.from_location_id,
            adjustment_type: "correction",
            quantity_change: item.quantity,
            old_available: oldCancelAvail - item.quantity,
            new_available: oldCancelAvail,
            reason: `Transfer ${selectedTransfer.reference_number} cancelled - stock restored${item.variant_title ? ` (${item.variant_title})` : ""}`,
            reference_id: selectedTransfer.id,
            created_by: profileId,
            variant_id: item.variant_id || null,
            variant_title: item.variant_title || null,
          });

          await updateListingStock(item.listing_id);
        }
      }

      const { error } = await supabase
        .from("inventory_transfers")
        .update({ status: "cancelled", updated_at: now })
        .eq("id", selectedTransfer.id);
      if (error) throw error;

      setSelectedTransfer({ ...selectedTransfer, status: "cancelled" });
      await loadTransfers(sellerId);
      showToast("Transfer cancelled.", "success");
    } catch (err: any) {
      alert("Failed: " + err.message);
      showToast("Failed: " + err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  /* ── loading state ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!sellerId) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Please log in as a seller to view transfers.</p>
      </div>
    );
  }

  /* ──────────────────────────────────────────────
     RENDER
     ────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transfers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Move inventory between your locations
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create transfer
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm text-gray-500">Total Transfers</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{totalCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm text-amber-600 font-medium">Pending</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm text-blue-600 font-medium">In Transit</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{inTransitCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm text-green-600 font-medium">Received</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{receivedCount}</p>
        </div>
      </div>

      {/* ── Transfers table ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Reference #</th>
                <th className="py-3 px-4">From Location</th>
                <th className="py-3 px-4">To Location</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                      </svg>
                      <p className="text-sm text-gray-500">No transfers yet</p>
                      <p className="text-xs text-gray-400">
                        Create a transfer to move inventory between locations.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                transfers.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/70 transition">
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {t.reference_number}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {t.from_location_name}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {t.to_location_name}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {t.items_count ?? 0}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          STATUS_COLORS[t.status] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {STATUS_LABELS[t.status] || t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {formatDate(t.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => viewTransfer(t)}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                      >
                        View details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          CREATE TRANSFER MODAL
         ══════════════════════════════════════════ */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-8">
            {/* modal header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-900">Create Transfer</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* modal body */}
            <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* locations row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Origin location <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={fromLocationId}
                    onChange={(e) => setFromLocationId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                  >
                    <option value="">Select origin...</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}{loc.city ? ` - ${loc.city}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Destination location <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={toLocationId}
                    onChange={(e) => setToLocationId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                  >
                    <option value="">Select destination...</option>
                    {locations
                      .filter((loc) => loc.id !== fromLocationId)
                      .map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}{loc.city ? ` - ${loc.city}` : ""}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* reference number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference number
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Auto-generated"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                />
              </div>

              {/* products section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Products <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <svg className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search products to add..."
                    className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                  />
                </div>

                {/* search results dropdown */}
                {filteredProducts.length > 0 && (
                  <div className="mt-1 rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                    {filteredProducts.slice(0, 10).map((l) => {
                      const isAddedNoVariant = transferItems.some(
                        (ti) => ti.listing_id === l.id && !ti.variant_id
                      );
                      return (
                      <div key={l.id}>
                        <button
                          onClick={() => expandProduct(l)}
                          disabled={isAddedNoVariant}
                          className={`w-full text-left px-4 py-2 text-sm transition flex items-center justify-between ${
                            isAddedNoVariant ? 'bg-green-50 text-green-600 cursor-default' : 'hover:bg-indigo-50'
                          }`}
                        >
                          <span className={isAddedNoVariant ? 'text-green-700' : 'text-gray-900'}>{l.product_name}</span>
                          <span className="text-xs flex items-center gap-1">
                            {isAddedNoVariant ? (
                              <span className="text-green-500 font-medium">✓ Added</span>
                            ) : (
                              <>
                                <span className="text-gray-400">Stock: {l.stock}</span>
                                <svg className={`h-3 w-3 transition text-gray-400 ${expandedProductId === l.id ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                              </>
                            )}
                          </span>
                        </button>
                        {expandedProductId === l.id && (
                          <div className="bg-gray-50 border-t border-gray-100">
                            {loadingVariants ? (
                              <div className="px-6 py-2 text-xs text-gray-400">Loading variants...</div>
                            ) : productVariants.length > 0 ? (
                              productVariants.map((v) => {
                                const alreadyAdded = transferItems.some(
                                  (ti) => ti.listing_id === l.id && ti.variant_id === v.id
                                );
                                return (
                                  <button
                                    key={v.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addProduct(l, v.id, v.title);
                                      setProductSearch("");
                                      setExpandedProductId(null);
                                      setProductVariants([]);
                                    }}
                                    disabled={alreadyAdded}
                                    className={`w-full text-left px-6 py-1.5 text-xs transition flex items-center justify-between ${
                                      alreadyAdded
                                        ? 'bg-indigo-50 text-indigo-400 cursor-default'
                                        : 'hover:bg-indigo-100 text-gray-700'
                                    }`}
                                  >
                                    <span>{v.title}</span>
                                    <span className="text-gray-400">
                                      {alreadyAdded ? 'Added' : v.sku || ''}
                                    </span>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="px-6 py-2 text-xs text-gray-400">No variants — adding whole product</div>
                            )}
                          </div>
                        )}
                      </div>
                    );})}
                  </div>
                )}

                {/* added items */}
                {transferItems.length > 0 && (
                  <div className="mt-3 rounded-lg border border-gray-200 divide-y divide-gray-100">
                    {transferItems.map((item) => (
                      <div
                        key={`${item.listing_id}-${item.variant_id || 'no-variant'}`}
                        className="flex items-center gap-4 px-4 py-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.product_name}
                          </p>
                          {item.variant_title && (
                            <p className="text-xs text-indigo-600 font-medium">{item.variant_title}</p>
                          )}
                          <p className={`text-xs ${item.available_at_origin === 0 ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                            Available at origin: {item.available_at_origin}
                            {item.available_at_origin === 0 && ' — No stock available!'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500">Qty:</label>
                          <input
                            type="number"
                            min={1}
                            max={Math.max(item.available_at_origin, 1)}
                            value={item.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 1;
                              updateItemQty(
                                item.listing_id,
                                item.variant_id,
                                Math.min(val, item.available_at_origin)
                              );
                            }}
                            disabled={item.available_at_origin === 0}
                            className={`w-20 rounded-lg border px-2 py-1 text-sm text-center focus:ring-2 focus:ring-indigo-300/30 outline-none ${
                              item.available_at_origin === 0 || item.quantity > item.available_at_origin
                                ? 'border-red-400 bg-red-50 text-red-600'
                                : 'border-gray-300 focus:border-indigo-400'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          />
                        </div>
                        <button
                          onClick={() => removeTransferItem(item.listing_id, item.variant_id)}
                          className="text-red-400 hover:text-red-600 transition"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {transferItems.length === 0 && (
                  <p className="mt-2 text-xs text-gray-400">
                    Search and add products to include in this transfer.
                  </p>
                )}
              </div>

              {/* tracking / carrier row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tracking number
                    <span className="text-xs text-gray-400 ml-1">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="e.g. 1Z999AA10123456784"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Carrier
                    <span className="text-xs text-gray-400 ml-1">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    placeholder="e.g. FedEx, UPS, DHL"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                  />
                </div>
              </div>

              {/* notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                  <span className="text-xs text-gray-400 ml-1">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Add any notes about this transfer..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none resize-none"
                />
              </div>
            </div>

            {/* modal footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || transferItems.some((i) => i.quantity > i.available_at_origin || i.available_at_origin === 0)}
                className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {creating ? "Creating..." : "Create Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          TRANSFER DETAIL MODAL
         ══════════════════════════════════════════ */}
      {selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-8">
            {/* detail header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Transfer {selectedTransfer.reference_number}
                </h2>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold mt-1 ${
                    STATUS_COLORS[selectedTransfer.status] || "bg-gray-100 text-gray-600"
                  }`}
                >
                  {STATUS_LABELS[selectedTransfer.status] || selectedTransfer.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedTransfer(null)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* detail body */}
            <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* transfer info grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider">From</p>
                  <p className="font-medium text-gray-900 mt-0.5">
                    {selectedTransfer.from_location_name}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider">To</p>
                  <p className="font-medium text-gray-900 mt-0.5">
                    {selectedTransfer.to_location_name}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider">Created</p>
                  <p className="font-medium text-gray-900 mt-0.5">
                    {formatDate(selectedTransfer.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider">
                    {selectedTransfer.shipped_at ? "Shipped" : "Shipped"}
                  </p>
                  <p className="font-medium text-gray-900 mt-0.5">
                    {selectedTransfer.shipped_at
                      ? formatDate(selectedTransfer.shipped_at)
                      : "--"}
                  </p>
                </div>
              </div>

              {selectedTransfer.received_at && (
                <div className="text-sm">
                  <p className="text-gray-400 text-xs uppercase tracking-wider">Received</p>
                  <p className="font-medium text-gray-900 mt-0.5">
                    {formatDate(selectedTransfer.received_at)}
                  </p>
                </div>
              )}

              {(selectedTransfer.tracking_number || selectedTransfer.carrier) && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {selectedTransfer.tracking_number && (
                    <div>
                      <p className="text-gray-400 text-xs uppercase tracking-wider">Tracking #</p>
                      <p className="font-medium text-gray-900 mt-0.5">
                        {selectedTransfer.tracking_number}
                      </p>
                    </div>
                  )}
                  {selectedTransfer.carrier && (
                    <div>
                      <p className="text-gray-400 text-xs uppercase tracking-wider">Carrier</p>
                      <p className="font-medium text-gray-900 mt-0.5">
                        {selectedTransfer.carrier}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {selectedTransfer.notes && (
                <div className="text-sm">
                  <p className="text-gray-400 text-xs uppercase tracking-wider">Notes</p>
                  <p className="text-gray-700 mt-0.5">{selectedTransfer.notes}</p>
                </div>
              )}

              {/* items table */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Items</h3>
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Product</th>
                        <th className="py-2.5 px-4">Qty Sent</th>
                        <th className="py-2.5 px-4">
                          {selectedTransfer.status === "in_transit"
                            ? "Qty to Receive"
                            : "Qty Received"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detailItems.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-sm text-gray-400">
                            No items found.
                          </td>
                        </tr>
                      ) : (
                        detailItems.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50/70">
                            <td className="py-2.5 px-4">
                              <span className="font-medium text-gray-900">{item.product_name}</span>
                              {item.variant_title && (
                                <span className="block text-xs text-indigo-600">{item.variant_title}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-gray-600">
                              {item.quantity}
                            </td>
                            <td className="py-2.5 px-4">
                              {selectedTransfer.status === "in_transit" ? (
                                <input
                                  type="number"
                                  min={0}
                                  max={item.quantity}
                                  value={receivedQuantities[item.id] ?? item.quantity}
                                  onChange={(e) =>
                                    setReceivedQuantities((prev) => ({
                                      ...prev,
                                      [item.id]: parseInt(e.target.value, 10) || 0,
                                    }))
                                  }
                                  className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm text-center focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                                />
                              ) : (
                                <span className="text-gray-600">
                                  {item.received_quantity ?? "--"}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* tracking input for ready → in_transit */}
              {selectedTransfer.status === "ready" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tracking number
                    <span className="text-xs text-gray-400 ml-1">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={detailTracking}
                    onChange={(e) => setDetailTracking(e.target.value)}
                    placeholder="Enter tracking number..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300/30 focus:border-indigo-400 outline-none"
                  />
                </div>
              )}
            </div>

            {/* detail footer - action buttons */}
            <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
              <div>
                {selectedTransfer.status !== "received" &&
                  selectedTransfer.status !== "cancelled" && (
                    <button
                      onClick={cancelTransfer}
                      disabled={actionLoading}
                      className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                    >
                      Cancel Transfer
                    </button>
                  )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedTransfer(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Close
                </button>

                {selectedTransfer.status === "pending" && (
                  <button
                    onClick={markReady}
                    disabled={actionLoading}
                    className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 transition"
                  >
                    {actionLoading ? "Updating..." : "Mark as Ready"}
                  </button>
                )}

                {selectedTransfer.status === "ready" && (
                  <button
                    onClick={markInTransit}
                    disabled={actionLoading}
                    className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50 transition"
                  >
                    {actionLoading ? "Updating..." : "Mark as In Transit"}
                  </button>
                )}

                {selectedTransfer.status === "in_transit" && (
                  <button
                    onClick={receiveTransfer}
                    disabled={actionLoading}
                    className="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50 transition"
                  >
                    {actionLoading ? "Receiving..." : "Receive Transfer"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-6 right-6 z-[9999]">
          <div className={`flex items-center gap-3 rounded-lg border px-5 py-3.5 shadow-lg ${toast.type === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
            <span className="text-lg">{toast.type === "success" ? "✓" : "✕"}</span>
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={() => { if (toastTimer.current) clearTimeout(toastTimer.current); setToast(null); }} className="ml-2 text-current opacity-50 hover:opacity-100">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

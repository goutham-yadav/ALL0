'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Clock, ArrowLeft, ShoppingBag } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'RELEASED' | 'EXPIRED';

interface ReservationDetail {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
  product?: {
    name: string;
  };
  warehouse?: {
    name: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: ReservationStatus }) {
  const map: Record<ReservationStatus, { label: string; className: string }> = {
    PENDING:   { label: 'Pending',   className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-900/50' },
    CONFIRMED: { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-900/50' },
    RELEASED:  { label: 'Released',  className: 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-900/30 dark:text-zinc-400 dark:border-zinc-900/50' },
    EXPIRED:   { label: 'Expired',   className: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-900/50' },
  };
  const { label, className } = map[status];
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

function StatusIcon({ status }: { status: ReservationStatus }) {
  if (status === 'CONFIRMED') return <CheckCircle2 className="h-10 w-10 text-emerald-500" />;
  if (status === 'RELEASED' || status === 'EXPIRED') return <XCircle className="h-10 w-10 text-zinc-400" />;
  return <Clock className="h-10 w-10 text-amber-500 animate-pulse" />;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReservationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [reservation, setReservation] = useState<ReservationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'confirm' | 'release' | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // ----- fetch reservation -----
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/reservations/${params.id}`);
        if (res.status === 404) {
          toast.error('Reservation not found');
          router.push('/products');
          return;
        }
        if (!res.ok) throw new Error();
        
        const data = await res.json();
        setReservation(data);
      } catch {
        toast.error('Failed to load reservation');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id, router]);

  // ----- countdown timer -----
  useEffect(() => {
    if (!reservation || reservation.status !== 'PENDING') {
      setTimeLeft(0);
      return;
    }

    const expiresTime = new Date(reservation.expiresAt).getTime();

    const updateTimer = () => {
      const diff = expiresTime - Date.now();
      if (diff <= 0) {
        setTimeLeft(0);
        // Update UI state immediately without page refresh
        setReservation((prev) => (prev ? { ...prev, status: 'EXPIRED' } : null));
      } else {
        setTimeLeft(Math.floor(diff / 1000));
      }
    };

    updateTimer(); // Initial call
    const intervalId = setInterval(updateTimer, 1000);

    return () => clearInterval(intervalId);
  }, [reservation?.status, reservation?.expiresAt]);

  // ----- confirm purchase -----
  async function handleConfirm() {
    if (!reservation || reservation.status !== 'PENDING' || timeLeft <= 0) return;
    
    setActionLoading('confirm');
    try {
      const res = await fetch(`/api/reservations/${params.id}/confirm`, {
        method: 'POST',
      });

      if (res.status === 410) {
        toast.error('Your reservation expired');
        const data = await res.json();
        if (data.reservation) {
          setReservation(data.reservation);
        } else {
          setReservation((prev) => (prev ? { ...prev, status: 'EXPIRED' } : null));
        }
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message ?? 'Could not confirm reservation');
        return;
      }

      const confirmedData = await res.json();
      // Update local React state to render CONFIRMED state dynamically without page refresh
      setReservation((prev) => (prev ? { ...prev, ...confirmedData, status: 'CONFIRMED' } : null));
      toast.success('Reservation confirmed successfully!');
    } catch {
      toast.error('Something went wrong, please retry');
    } finally {
      setActionLoading(null);
    }
  }

  // ----- cancel reservation -----
  async function handleRelease() {
    if (!reservation) return;
    
    setActionLoading('release');
    try {
      const res = await fetch(`/api/reservations/${params.id}/release`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message ?? 'Could not cancel reservation');
        return;
      }

      const releasedData = await res.json();
      // Update local React state to render RELEASED state dynamically without page refresh
      setReservation((prev) => (prev ? { ...prev, ...releasedData, status: 'RELEASED' } : null));
      toast.success('Reservation cancelled');
      
      // Redirect to /products after 2 seconds
      setTimeout(() => {
        router.push('/products');
      }, 2000);
    } catch {
      toast.error('Something went wrong, please retry');
    } finally {
      setActionLoading(null);
    }
  }

  // ----- formatting helper -----
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ----- loading view -----
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50/50 dark:bg-zinc-950/50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Loading reservation...</p>
        </div>
      </main>
    );
  }

  if (!reservation) return null;

  const isPending = reservation.status === 'PENDING';
  const isExpired = reservation.status === 'EXPIRED' || timeLeft <= 0;
  const isConfirmed = reservation.status === 'CONFIRMED';
  const isReleased = reservation.status === 'RELEASED';

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-6 -ml-2 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        onClick={() => router.push('/products')}
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Back to products
      </Button>

      {/* Main card */}
      <Card className="overflow-hidden border-zinc-200/80 shadow-lg dark:border-zinc-800 bg-card">
        {/* Modern status top band */}
        <div className={`h-1.5 w-full ${
          isConfirmed ? 'bg-emerald-500' :
          isReleased ? 'bg-zinc-400' :
          isExpired ? 'bg-rose-500' : 'bg-amber-500'
        }`} />

        <CardHeader className="pb-4 text-center">
          <div className="mb-4 flex justify-center">
            <StatusIcon status={reservation.status} />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">Checkout & Reservation</CardTitle>
          <div className="mt-2 flex justify-center">
            <StatusBadge status={reservation.status} />
          </div>
        </CardHeader>

        <CardContent className="space-y-6 px-6 py-4">
          {/* Main Info */}
          <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-4 space-y-3.5">
            <div className="flex justify-between items-start gap-4">
              <span className="text-zinc-500 dark:text-zinc-400 text-xs uppercase font-semibold tracking-wider pt-0.5">Product</span>
              <span className="font-semibold text-sm text-right text-zinc-900 dark:text-zinc-100">
                {reservation.product?.name ?? 'Unknown Product'}
              </span>
            </div>

            <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

            <div className="flex justify-between items-start gap-4">
              <span className="text-zinc-500 dark:text-zinc-400 text-xs uppercase font-semibold tracking-wider pt-0.5">Warehouse</span>
              <span className="font-medium text-sm text-right text-zinc-800 dark:text-zinc-200">
                {reservation.warehouse?.name ?? 'Unknown Warehouse'}
              </span>
            </div>

            <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

            <div className="flex justify-between items-center gap-4">
              <span className="text-zinc-500 dark:text-zinc-400 text-xs uppercase font-semibold tracking-wider">Quantity</span>
              <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">
                {reservation.quantity} unit{reservation.quantity !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Countdown timer card section */}
          {isPending && !isExpired && (
            <div className="flex flex-col items-center justify-center py-5 px-4 rounded-xl border border-amber-200/50 bg-amber-50/30 dark:border-amber-900/20 dark:bg-amber-950/10 text-center">
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-1">
                Stock Held & Reserved
              </span>
              <div className="text-3xl font-extrabold tracking-widest text-amber-900 dark:text-amber-300 font-mono my-1">
                {formatTime(timeLeft)}
              </div>
              <span className="text-xs text-amber-700/80 dark:text-amber-500/80 mt-1">
                Complete purchase before hold expires
              </span>
            </div>
          )}

          {isExpired && isPending && (
            <div className="flex flex-col items-center justify-center py-5 px-4 rounded-xl border border-rose-200 bg-rose-50/30 dark:border-rose-900/20 dark:bg-rose-950/10 text-center">
              <span className="text-sm font-semibold text-rose-800 dark:text-rose-400">
                Reservation Expired
              </span>
              <span className="text-xs text-rose-600/80 dark:text-rose-500/80 mt-1">
                The inventory hold has timed out. Please return to products to secure new stock.
              </span>
            </div>
          )}

          {/* Details list */}
          <div className="space-y-2.5 text-xs text-zinc-500 dark:text-zinc-400 px-1">
            <div className="flex justify-between">
              <span>Reservation ID</span>
              <code className="text-zinc-600 dark:text-zinc-300 select-all font-mono">{reservation.id}</code>
            </div>
            <div className="flex justify-between">
              <span>Reserved At</span>
              <span>{formatDate(reservation.createdAt)}</span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-2.5 px-6 pb-6 pt-2">
          {isPending && (
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              onClick={handleConfirm}
              disabled={actionLoading !== null || isExpired}
            >
              {actionLoading === 'confirm' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4" />
                  Confirm Purchase
                </>
              )}
            </Button>
          )}

          {!isConfirmed && !isReleased && !isExpired && (
            <Button
              variant="outline"
              className="w-full border-zinc-200 hover:bg-zinc-50 hover:text-zinc-950 dark:border-zinc-800 dark:hover:bg-zinc-900"
              onClick={handleRelease}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'release' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Cancel Reservation'
              )}
            </Button>
          )}

          {(isConfirmed || isReleased || (isExpired && !isPending)) && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => router.push('/products')}
            >
              Return to Products
            </Button>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}

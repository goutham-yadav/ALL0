'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, Warehouse } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WarehouseStock {
  warehouseId: string;
  warehouseName: string;
  available: number;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  warehouses: WarehouseStock[];
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

async function fetchProducts(): Promise<Product[]> {
  const res = await fetch('/api/products');
  if (!res.ok) throw new Error('Failed to load products');
  return res.json();
}

// ---------------------------------------------------------------------------
// Reserve button — one per warehouse slot
// ---------------------------------------------------------------------------

function ReserveButton({
  product,
  warehouse,
}: {
  product: Product;
  warehouse: WarehouseStock;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const isDisabled = warehouse.available === 0 || loading;

  async function handleReserve() {
    setLoading(true);
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: warehouse.warehouseId,
          quantity: 1,
        }),
      });

      if (res.status === 201) {
        const data = await res.json();
        router.push(`/reservation/${data.reservationId}`);
        return;
      }

      if (res.status === 409) {
        toast.error('Out of stock — someone just grabbed the last one');
        return;
      }

      toast.error('Something went wrong, please retry');
    } catch {
      toast.error('Something went wrong, please retry');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size="sm"
      disabled={isDisabled}
      onClick={handleReserve}
      variant={warehouse.available === 0 ? 'outline' : 'default'}
      className="min-w-[90px]"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : warehouse.available === 0 ? (
        'Out of stock'
      ) : (
        'Reserve'
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Product card
// ---------------------------------------------------------------------------

function ProductCard({ product }: { product: Product }) {
  return (
    <Card className="flex flex-col gap-0">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-muted p-2">
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base font-semibold leading-snug">
              {product.name}
            </CardTitle>
            {product.description && (
              <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                {product.description}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-0">
        {product.warehouses.map((wh) => (
          <div
            key={wh.warehouseId}
            className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 px-3 py-2"
          >
            {/* Warehouse info */}
            <div className="flex min-w-0 items-center gap-2">
              <Warehouse className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-medium">
                {wh.warehouseName}
              </span>
              <Badge
                variant={wh.available > 0 ? 'secondary' : 'outline'}
                className={
                  wh.available === 0 ? 'text-muted-foreground' : undefined
                }
              >
                {wh.available} unit{wh.available !== 1 ? 's' : ''} available
              </Badge>
            </div>

            {/* Reserve button */}
            <ReserveButton product={product} warehouse={wh} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProductsPage() {
  const { data: products, isLoading, isError, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Products</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse available inventory and reserve stock across warehouses.
        </p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
          <p className="text-sm font-medium text-destructive">
            Failed to load products.
          </p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}

      {/* Products list */}
      {products && !isLoading && (
        <>
          {products.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No products found.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

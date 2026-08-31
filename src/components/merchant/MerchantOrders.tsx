import React, { useEffect, useMemo, useState } from 'react';
import {
  Package,
  Search,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  Phone,
  MapPin,
  RefreshCw,
  Plus,
  Download,
  Printer,
  Copy,
  MessageCircle,
  LayoutGrid,
  LayoutList,
  Columns3,
  ChevronLeft,
  ChevronRight,
  Filter,
  Banknote,
  AlertTriangle,
  Star,
  PauseCircle,
  ExternalLink,
  Pencil,
  FileText,
  RotateCcw,
  CheckCheck,
  Wallet,
  ShoppingBag,
  Send,
  Ban,
  Tag,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import {
  BusinessConfig,
  Order,
  OrderPriority,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../../types';
import { db } from '../../lib/firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { cleanFirestoreData, finiteNumber } from '../../lib/utils';
import { parseJsonResponse } from '../../lib/safeJson';
import { normalizePhone } from '../../lib/chatOrder';
import { latestOrdersByIdentity, passengerIdOf } from '../../lib/orderIdentity';
import {
  ORDER_PRIORITIES,
  ORDER_STATUSES,
  ORDER_TAG_OPTIONS,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  STATUS_PIPELINE,
  computeOrderKpis,
  computeOrderTotal,
  copyText,
  DatePreset,
  deliveryFeeForAddress,
  detectInsideDhaka,
  exportOrdersCsv,
  exportOrdersExcel,
  formatBdDate,
  formatMoney,
  formatRelativeBn,
  getOrderTime,
  getRiskFlags,
  inDateRange,
  isValidBdPhone,
  methodLabel,
  nextStatus,
  orderMatchesQuery,
  OrderSortKey,
  paymentLabel,
  printOrderDocuments,
  shortOrderId,
  sortOrders,
  steadfastTrackUrl,
  statusLabel,
  telLink,
  whatsappLink,
  whatsappTemplate,
  WhatsAppTemplate,
} from '../../lib/orderUtils';
import { orderProductLabel } from '../../lib/storefront';

interface MerchantOrdersProps {
  business: BusinessConfig;
  orders: Order[];
}

type ViewMode = 'table' | 'cards' | 'kanban';

const PAGE_SIZES = [10, 20, 50, 100];

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'all', label: 'সব সময়' },
  { id: 'today', label: 'আজ' },
  { id: 'yesterday', label: 'গতকাল' },
  { id: '7d', label: '৭ দিন' },
  { id: '30d', label: '৩০ দিন' },
  { id: 'custom', label: 'কাস্টম' },
];

function statusTone(status?: string) {
  switch (status) {
    case 'delivered':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
    case 'shipped':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300';
    case 'processing':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300';
    case 'confirmed':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';
    case 'returned':
      return 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-300';
    case 'cancelled':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
    default:
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
  }
}

function StatusBadge({ status }: { status?: string }) {
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${statusTone(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

function PaymentBadge({ status }: { status?: string }) {
  const paid = status === 'paid';
  const refunded = status === 'refunded';
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
        paid
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
          : refunded
          ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
          : 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300'
      }`}
    >
      {paymentLabel(status)}
    </span>
  );
}

const emptyForm = (business: BusinessConfig) => ({
  customerName: '',
  phone: '',
  address: '',
  productId: '',
  productName: '',
  quantity: 1,
  unitPrice: 0,
  deliveryFee: business.courierConfig?.deliveryChargeInsideDhaka ?? 70,
  discount: 0,
  paymentMethod: 'cod' as PaymentMethod,
  paymentStatus: 'unpaid' as PaymentStatus,
  notes: '',
  priority: 'normal' as OrderPriority,
  insideDhaka: true,
});

export function MerchantOrders({ business, orders }: MerchantOrdersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [courierFilter, setCourierFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [sortKey, setSortKey] = useState<OrderSortKey>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isBookingCourier, setIsBookingCourier] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [form, setForm] = useState(() => emptyForm(business));
  const [saving, setSaving] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [hideDuplicates, setHideDuplicates] = useState(true);

  const uniqueOrders = useMemo(() => latestOrdersByIdentity(orders), [orders]);
  const sourceOrders = hideDuplicates ? uniqueOrders : orders;
  const hiddenDuplicateCount = Math.max(0, orders.length - uniqueOrders.length);

  const kpis = useMemo(() => computeOrderKpis(sourceOrders), [sourceOrders]);

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = { all: sourceOrders.length };
    for (const s of ORDER_STATUSES) map[s.id] = 0;
    sourceOrders.forEach(o => {
      map[o.status] = (map[o.status] || 0) + 1;
    });
    return map;
  }, [sourceOrders]);

  const filteredOrders = useMemo(() => {
    const list = sourceOrders.filter(o => {
      if (!orderMatchesQuery(o, searchTerm)) return false;
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (paymentFilter !== 'all' && (o.paymentStatus || 'unpaid') !== paymentFilter) return false;
      if (methodFilter !== 'all' && (o.paymentMethod || 'cod') !== methodFilter) return false;
      if (courierFilter === 'booked' && !o.courierTrackingId) return false;
      if (courierFilter === 'unbooked' && o.courierTrackingId) return false;
      if (priorityFilter !== 'all' && (o.priority || 'normal') !== priorityFilter) return false;
      if (!inDateRange(o, datePreset, customFrom, customTo)) return false;
      return true;
    });
    return sortOrders(list, sortKey);
  }, [
    sourceOrders,
    searchTerm,
    statusFilter,
    paymentFilter,
    methodFilter,
    courierFilter,
    priorityFilter,
    datePreset,
    customFrom,
    customTo,
    sortKey,
  ]);

  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedOrders = filteredOrders.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [searchTerm, statusFilter, paymentFilter, methodFilter, courierFilter, priorityFilter, datePreset, sortKey, pageSize, hideDuplicates]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedOrder(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const liveSelected = selectedOrder
    ? orders.find(o => o.id === selectedOrder.id) || selectedOrder
    : null;

  const formTotal = computeOrderTotal({
    unitPrice: form.unitPrice,
    quantity: form.quantity,
    deliveryFee: form.deliveryFee,
    discount: form.discount,
  });

  const duplicateHint = useMemo(() => {
    const phone = normalizePhone(form.phone);
    if (phone.length !== 11) return '';
    const hits = orders.filter(
      o =>
        o.id !== editingOrder?.id &&
        normalizePhone(o.phone) === phone &&
        ['pending', 'confirmed', 'processing', 'shipped'].includes(o.status)
    );
    if (!hits.length) return '';
    return `এই নম্বরে ইতোমধ্যে ${hits.length} টি ওপেন অর্ডার আছে (${hits.map(h => shortOrderId(h.id)).join(', ')})`;
  }, [form.phone, orders, editingOrder?.id]);

  const patchForm = (partial: Partial<typeof form>) => setForm(prev => ({ ...prev, ...partial }));

  const openCreate = (clone?: Order) => {
    setEditingOrder(null);
    if (clone) {
      const inside = clone.insideDhaka ?? detectInsideDhaka(clone.address);
      setForm({
        customerName: clone.customerName || '',
        phone: clone.phone || '',
        address: clone.address || '',
        productId: clone.productId || '',
        productName: clone.productName || '',
        quantity: clone.quantity || 1,
        unitPrice: clone.unitPrice || 0,
        deliveryFee: clone.deliveryFee ?? deliveryFeeForAddress(business, clone.address),
        discount: clone.discount || 0,
        paymentMethod: clone.paymentMethod || 'cod',
        paymentStatus: 'unpaid',
        notes: clone.notes || '',
        priority: clone.priority || 'normal',
        insideDhaka: inside,
      });
    } else {
      setForm(emptyForm(business));
    }
    setFormOpen(true);
  };

  const openEdit = (order: Order) => {
    setEditingOrder(order);
    setForm({
      customerName: order.customerName || '',
      phone: order.phone || '',
      address: order.address || '',
      productId: order.productId || '',
      productName: order.productName || '',
      quantity: order.quantity || 1,
      unitPrice: order.unitPrice || 0,
      deliveryFee: order.deliveryFee ?? 0,
      discount: order.discount || 0,
      paymentMethod: order.paymentMethod || 'cod',
      paymentStatus: order.paymentStatus || 'unpaid',
      notes: order.notes || '',
      priority: order.priority || 'normal',
      insideDhaka: order.insideDhaka ?? detectInsideDhaka(order.address),
    });
    setFormOpen(true);
  };

  const applyProduct = (productId: string) => {
    const product = (business.products || []).find(p => p.id === productId);
    if (!product) {
      patchForm({ productId: '', productName: form.productName });
      return;
    }
    const unit = product.pricingTiers?.[0]?.price ?? product.price ?? 0;
    patchForm({ productId: product.id, productName: product.name, unitPrice: unit });
  };

  const applyInsideDhaka = (inside: boolean) => {
    patchForm({
      insideDhaka: inside,
      deliveryFee: inside
        ? business.courierConfig?.deliveryChargeInsideDhaka ?? 70
        : business.courierConfig?.deliveryChargeOutsideDhaka ?? 130,
    });
  };

  const persistOrderFields = async (orderId: string, fields: Record<string, any>) => {
    await updateDoc(
      doc(db, 'orders', orderId),
      cleanFirestoreData({
        ...fields,
        updatedAt: serverTimestamp(),
        updatedAtMs: Date.now(),
      })
    );
  };

  const fireMessengerPurchase = (orderId: string) => {
    void fetch('/api/capi/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: business.id, orderId }),
    }).catch(() => {});
  };

  const handleUpdateStatus = async (order: Order, newStatus: OrderStatus, note?: string, silent = false) => {
    try {
      const history = [
        ...(order.statusHistory || []),
        { status: newStatus, at: Date.now(), note: note || undefined },
      ];
      const extra: Record<string, any> = { status: newStatus, statusHistory: history };
      if (newStatus === 'cancelled' && note) extra.cancelReason = note;
      if (newStatus === 'returned' && note) extra.returnReason = note;
      if (newStatus === 'delivered' && (order.paymentMethod || 'cod') === 'cod') extra.paymentStatus = 'paid';
      await persistOrderFields(order.id, extra);
      if (['confirmed', 'processing', 'shipped', 'delivered'].includes(newStatus)) {
        fireMessengerPurchase(order.id);
      }
      if (!silent) toast.success(`স্ট্যাটাস: ${statusLabel(newStatus)}`);
    } catch {
      if (!silent) toast.error('স্ট্যাটাস আপডেট ব্যর্থ হয়েছে');
      if (silent) throw new Error('status-update-failed');
    }
  };

  const handleUpdatePayment = async (order: Order, paymentStatus: PaymentStatus) => {
    try {
      await persistOrderFields(order.id, { paymentStatus });
      toast.success(`পেমেন্ট: ${paymentLabel(paymentStatus)}`);
    } catch {
      toast.error('পেমেন্ট আপডেট ব্যর্থ');
    }
  };

  const handleSaveNotes = async (order: Order, internalNotes: string) => {
    try {
      await persistOrderFields(order.id, { internalNotes });
      toast.success('নোট সেভ হয়েছে');
    } catch {
      toast.error('নোট সেভ ব্যর্থ');
    }
  };

  const handleToggleTag = async (order: Order, tag: string) => {
    const tags = new Set(order.tags || []);
    if (tags.has(tag)) tags.delete(tag);
    else tags.add(tag);
    try {
      await persistOrderFields(order.id, { tags: Array.from(tags) });
    } catch {
      toast.error('ট্যাগ আপডেট ব্যর্থ');
    }
  };

  const handlePriority = async (order: Order, priority: OrderPriority) => {
    try {
      await persistOrderFields(order.id, { priority });
    } catch {
      toast.error('প্রায়োরিটি আপডেট ব্যর্থ');
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = normalizePhone(form.phone);
    if ((form.customerName || '').trim().length < 2) {
      toast.error('গ্রাহকের নাম দিন');
      return;
    }
    if (phone.length !== 11) {
      toast.error('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন');
      return;
    }
    if ((form.address || '').trim().length < 8) {
      toast.error('সম্পূর্ণ ডেলিভারি ঠিকানা দিন');
      return;
    }
    if (!(form.productName || '').trim()) {
      toast.error('পণ্যের নাম দিন');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customerName: form.customerName.trim(),
        phone,
        address: form.address.trim(),
        productId: form.productId || '',
        productName: form.productName.trim(),
        quantity: Math.max(1, Math.round(finiteNumber(form.quantity, 1))),
        unitPrice: finiteNumber(form.unitPrice, 0),
        deliveryFee: finiteNumber(form.deliveryFee, 0),
        discount: finiteNumber(form.discount, 0),
        totalPrice: formTotal,
        paymentMethod: form.paymentMethod,
        paymentStatus: form.paymentStatus,
        notes: form.notes.trim(),
        priority: form.priority,
        insideDhaka: form.insideDhaka,
      };

      if (editingOrder) {
        await persistOrderFields(editingOrder.id, payload);
        toast.success('অর্ডার আপডেট হয়েছে');
      } else {
        const orderId = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await setDoc(
          doc(db, 'orders', orderId),
          cleanFirestoreData({
            id: orderId,
            businessId: business.id,
            merchantId: business.ownerId,
            ...payload,
            status: 'confirmed',
            source: 'manual',
            tags: ['নতুন'],
            statusHistory: [{ status: 'confirmed', at: Date.now(), note: 'ম্যানুয়াল অর্ডার' }],
            createdAt: serverTimestamp(),
            createdAtMs: Date.now(),
            updatedAtMs: Date.now(),
          })
        );
        toast.success('নতুন অর্ডার তৈরি হয়েছে');
        fireMessengerPurchase(orderId);
      }
      setFormOpen(false);
      setEditingOrder(null);
    } catch {
      toast.error('অর্ডার সেভ করা যায়নি');
    } finally {
      setSaving(false);
    }
  };

  const handleBookSteadfast = async (order: Order) => {
    if (!business.courierConfig?.steadfastApiKey || !business.courierConfig?.steadfastSecretKey) {
      toast.error('স্টেডফাস্ট কুরিয়ার এপিআই কনফিগার করা নেই', {
        description: 'ইন্টিগ্রেশন পেজে গিয়ে API Key ও Secret Key যুক্ত করুন।',
      });
      return;
    }
    if (!isValidBdPhone(order.phone)) {
      toast.error('বুকিংয়ের আগে সঠিক মোবাইল নম্বর দিন');
      return;
    }
    setIsBookingCourier(order.id);
    try {
      const res = await fetch('/api/courier/steadfast/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, businessId: business.id }),
      });
      const data = await parseJsonResponse(res).catch((e: Error) => ({ error: e.message }));
      if (!res.ok || !data.success) {
        toast.error(data.error || 'কুরিয়ার বুকিং ব্যর্থ হয়েছে');
        return;
      }
      toast.success(data.alreadyBooked ? 'এই পার্সেল আগেই বুক করা আছে' : 'স্টেডফাস্টে পার্সেল সফলভাবে বুকিং হয়েছে!', {
        description: `ট্র্যাকিং আইডি: ${data.trackingCode || '—'}`,
      });
    } catch {
      toast.error('কুরিয়ার বুকিং ব্যর্থ হয়েছে');
    } finally {
      setIsBookingCourier(null);
    }
  };

  const selectedList = orders.filter(o => selectedIds.has(o.id));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectPage = () => {
    const ids = pagedOrders.map(o => o.id);
    const allOn = ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const runBulkStatus = async (status: OrderStatus) => {
    if (!selectedList.length) return;
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(selectedList.map(o => handleUpdateStatus(o, status, undefined, true)));
      const ok = results.filter(r => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      setSelectedIds(new Set());
      toast.success(`${ok} টি অর্ডার ${statusLabel(status)}${fail ? ` · ${fail} ব্যর্থ` : ''}`);
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkBook = async () => {
    const targets = selectedList.filter(o => !o.courierTrackingId && o.status !== 'cancelled');
    if (!targets.length) {
      toast.error('বুক করার মতো অর্ডার সিলেক্ট করা হয়নি');
      return;
    }
    setBulkBusy(true);
    let ok = 0;
    let fail = 0;
    for (const order of targets) {
      setIsBookingCourier(order.id);
      try {
        const res = await fetch('/api/courier/steadfast/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.id, businessId: business.id }),
        });
        const data = await parseJsonResponse(res).catch(() => ({}));
        if (res.ok && data.success) ok += 1;
        else fail += 1;
      } catch {
        fail += 1;
      }
    }
    setIsBookingCourier(null);
    setBulkBusy(false);
    toast.success(`বুকিং শেষ: সফল ${ok}, ব্যর্থ ${fail}`);
  };

  const exportName = `sellkori-orders-${new Date().toISOString().slice(0, 10)}`;

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPaymentFilter('all');
    setMethodFilter('all');
    setCourierFilter('all');
    setPriorityFilter('all');
    setDatePreset('all');
    setCustomFrom('');
    setCustomTo('');
    setSortKey('newest');
  };

  const activeFilterCount = [
    statusFilter !== 'all',
    paymentFilter !== 'all',
    methodFilter !== 'all',
    courierFilter !== 'all',
    priorityFilter !== 'all',
    datePreset !== 'all',
    searchTerm.trim() !== '',
  ].filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 md:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">অর্ডার</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setHideDuplicates(v => !v)}
              className={`rounded-xl text-xs font-bold h-10 ${
                hideDuplicates
                  ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300'
                  : ''
              }`}
            >
              {hideDuplicates ? 'ডুপ্লিকেট লুকানো' : 'সব অর্ডার'}
            </Button>
            <Button
              variant="outline"
              onClick={() => exportOrdersExcel(filteredOrders, `${exportName}.xlsx`)}
              disabled={!filteredOrders.length}
              className="rounded-xl text-xs font-bold h-10"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Excel
            </Button>
            <Button
              variant="outline"
              onClick={() => exportOrdersCsv(filteredOrders, `${exportName}.csv`)}
              disabled={!filteredOrders.length}
              className="rounded-xl text-xs font-bold h-10"
            >
              CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => printOrderDocuments(filteredOrders.slice(0, 50), business, 'invoice')}
              disabled={!filteredOrders.length}
              className="rounded-xl text-xs font-bold h-10"
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              ইনভয়েস
            </Button>
            <Button
              onClick={() => openCreate()}
              className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-white rounded-lg text-xs font-medium h-10"
            >
              <Plus className="w-4 h-4 mr-1" />
              নতুন অর্ডার
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2.5">
          {[
            { label: 'মোট অর্ডার', value: kpis.total, sub: `${kpis.today} আজ`, icon: ShoppingBag, tone: 'text-zinc-700' },
            { label: 'পেন্ডিং', value: kpis.pending, sub: 'কনফার্ম বাকি', icon: Clock, tone: 'text-amber-600' },
            { label: 'প্রসেসিং', value: kpis.processing, sub: 'প্যাকিং কিউ', icon: Package, tone: 'text-sky-600' },
            { label: 'শিপড', value: kpis.shipped, sub: `${kpis.courierRate}% বুকড`, icon: Truck, tone: 'text-indigo-600' },
            { label: 'ডেলিভার্ড', value: kpis.delivered, sub: formatMoney(kpis.revenue), icon: CheckCircle, tone: 'text-emerald-600' },
            { label: 'বাতিল/রিটার্ন', value: kpis.cancelled + kpis.returned, sub: `${kpis.returned} রিটার্ন`, icon: RotateCcw, tone: 'text-rose-600' },
            { label: 'COD বকেয়া', value: formatMoney(kpis.codOutstanding), sub: 'আদায়যোগ্য', icon: Wallet, tone: 'text-orange-600' },
            { label: 'আজকের সেলস', value: formatMoney(kpis.todayRevenue), sub: `Avg ${formatMoney(kpis.avgOrder)}`, icon: Banknote, tone: 'text-emerald-700' },
          ].map(card => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/30 p-3 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{card.label}</span>
                  <Icon className={`w-3.5 h-3.5 ${card.tone}`} />
                </div>
                <p className="text-lg font-black text-zinc-900 dark:text-white leading-tight">{card.value}</p>
                <p className="text-[10px] text-zinc-500 font-medium">{card.sub}</p>
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="নাম, ফোন, অর্ডার আইডি, পণ্য, ট্র্যাকিং, প্যাসেঞ্জার আইডি বা আইপি..."
                className="pl-9 h-11 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as OrderSortKey)}
                className="h-11 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold px-3"
              >
                <option value="newest">নতুন আগে</option>
                <option value="oldest">পুরোনো আগে</option>
                <option value="amount_desc">মূল্য ↓</option>
                <option value="amount_asc">মূল্য ↑</option>
                <option value="name">নাম A–Z</option>
              </select>
              <div className="flex rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                {[
                  { id: 'table' as ViewMode, icon: LayoutList, title: 'টেবিল' },
                  { id: 'cards' as ViewMode, icon: LayoutGrid, title: 'কার্ড' },
                  { id: 'kanban' as ViewMode, icon: Columns3, title: 'পাইপলাইন' },
                ].map(v => (
                  <button
                    key={v.id}
                    title={v.title}
                    onClick={() => setViewMode(v.id)}
                    className={`h-11 w-11 flex items-center justify-center ${
                      viewMode === v.id ? 'bg-orange-600 text-white' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    <v.icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                onClick={() => setShowAdvanced(v => !v)}
                className="h-11 rounded-2xl text-xs font-bold"
              >
                <Filter className="w-3.5 h-3.5 mr-1" />
                ফিল্টার{activeFilterCount ? ` (${activeFilterCount})` : ''}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 ${
                statusFilter === 'all' ? 'bg-orange-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600'
              }`}
            >
              সব ({statusCounts.all || 0})
            </button>
            {ORDER_STATUSES.map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 ${
                  statusFilter === tab.id ? 'bg-orange-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {tab.label} ({statusCounts[tab.id] || 0})
              </button>
            ))}
          </div>

          {showAdvanced && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 pt-1">
              <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold px-3">
                <option value="all">পেমেন্ট: সব</option>
                {PAYMENT_STATUSES.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)} className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold px-3">
                <option value="all">মেথড: সব</option>
                {PAYMENT_METHODS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <select value={courierFilter} onChange={e => setCourierFilter(e.target.value)} className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold px-3">
                <option value="all">কুরিয়ার: সব</option>
                <option value="booked">বুকড</option>
                <option value="unbooked">আনবুকড</option>
              </select>
              <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold px-3">
                <option value="all">প্রায়োরিটি: সব</option>
                {ORDER_PRIORITIES.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <select value={datePreset} onChange={e => setDatePreset(e.target.value as DatePreset)} className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold px-3">
                {DATE_PRESETS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <Button variant="ghost" onClick={resetFilters} className="h-10 rounded-xl text-xs font-bold">
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> রিসেট
              </Button>
              {datePreset === 'custom' && (
                <>
                  <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-10 rounded-xl text-xs" />
                  <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-10 rounded-xl text-xs" />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {hideDuplicates && hiddenDuplicateCount > 0 && (
        <p className="text-[11px] text-orange-700 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-300 rounded-2xl px-4 py-2.5">
          একই মোবাইল/প্যাসেঞ্জার আইডি থেকে {hiddenDuplicateCount} টি পুরনো ডুপ্লিকেট অর্ডার লুকানো আছে। সব দেখতে উপরের «সব অর্ডার» বাটন টগল করুন।
        </p>
      )}

      {selectedIds.size > 0 && (
        <div className="sticky top-[57px] z-20 bg-zinc-900 text-white rounded-2xl px-4 py-3 flex flex-wrap items-center gap-2 shadow-xl">
          <span className="text-xs font-black">{selectedIds.size} টি সিলেক্টেড</span>
          <select
            disabled={bulkBusy}
            defaultValue=""
            onChange={e => {
              const v = e.target.value as OrderStatus;
              if (v) runBulkStatus(v);
              e.currentTarget.value = '';
            }}
            className="h-8 rounded-lg bg-zinc-800 text-xs font-bold px-2"
          >
            <option value="" disabled>বাল্ক স্ট্যাটাস</option>
            {ORDER_STATUSES.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <Button size="sm" disabled={bulkBusy} onClick={runBulkBook} className="h-8 rounded-lg bg-orange-600 text-white text-xs font-bold">
            <Truck className="w-3.5 h-3.5 mr-1" /> বাল্ক বুকিং
          </Button>
          <Button size="sm" variant="secondary" onClick={() => printOrderDocuments(selectedList, business, 'invoice')} className="h-8 rounded-lg text-xs font-bold">
            <Printer className="w-3.5 h-3.5 mr-1" /> মেমো
          </Button>
          <Button size="sm" variant="secondary" onClick={() => printOrderDocuments(selectedList, business, 'packing')} className="h-8 rounded-lg text-xs font-bold">
            প্যাকিং স্লিপ
          </Button>
          <Button size="sm" variant="secondary" onClick={() => exportOrdersExcel(selectedList, `${exportName}-selected.xlsx`)} className="h-8 rounded-lg text-xs font-bold">
            Export
          </Button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs font-bold text-zinc-300 hover:text-white">
            সিলেকশন মুছুন
          </button>
        </div>
      )}

      {filteredOrders.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-12 text-center space-y-3">
          <Package className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto" />
          <p className="text-sm text-zinc-400">কোনো অর্ডার নেই</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={resetFilters} className="rounded-lg text-xs">ফিল্টার ক্লিয়ার</Button>
            <Button onClick={() => openCreate()} className="bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white rounded-lg text-xs">নতুন অর্ডার</Button>
          </div>
        </div>
      ) : viewMode === 'kanban' ? (
        <KanbanBoard
          orders={filteredOrders}
          allOrders={orders}
          onOpen={setSelectedOrder}
          onStatus={handleUpdateStatus}
        />
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-4">
          {pagedOrders.map(ord => (
            <OrderCard
              key={ord.id}
              order={ord}
              allOrders={orders}
              selected={selectedIds.has(ord.id)}
              booking={isBookingCourier === ord.id}
              onToggle={() => toggleSelect(ord.id)}
              onOpen={() => setSelectedOrder(ord)}
              onStatus={s => handleUpdateStatus(ord, s)}
              onBook={() => handleBookSteadfast(ord)}
            />
          ))}
        </div>
      ) : (
        <OrdersTable
          orders={pagedOrders}
          allOrders={orders}
          selectedIds={selectedIds}
          pageAllSelected={pagedOrders.length > 0 && pagedOrders.every(o => selectedIds.has(o.id))}
          bookingId={isBookingCourier}
          onTogglePage={toggleSelectPage}
          onToggle={toggleSelect}
          onOpen={setSelectedOrder}
          onStatus={handleUpdateStatus}
          onBook={handleBookSteadfast}
        />
      )}

      {viewMode !== 'kanban' && filteredOrders.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <p className="font-bold text-zinc-500">
            {filteredOrders.length} টির মধ্যে {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredOrders.length)} দেখানো হচ্ছে
          </p>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="h-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 font-bold"
            >
              {PAGE_SIZES.map(n => (
                <option key={n} value={n}>{n} / পেজ</option>
              ))}
            </select>
            <Button variant="outline" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)} className="h-9 rounded-xl">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-black w-16 text-center">{safePage}/{pageCount}</span>
            <Button variant="outline" disabled={safePage >= pageCount} onClick={() => setPage(p => p + 1)} className="h-9 rounded-xl">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {liveSelected && (
        <OrderDrawer
          order={liveSelected}
          business={business}
          allOrders={orders}
          booking={isBookingCourier === liveSelected.id}
          onClose={() => setSelectedOrder(null)}
          onStatus={(s, note) => handleUpdateStatus(liveSelected, s, note)}
          onPayment={s => handleUpdatePayment(liveSelected, s)}
          onPriority={p => handlePriority(liveSelected, p)}
          onTag={t => handleToggleTag(liveSelected, t)}
          onNotes={n => handleSaveNotes(liveSelected, n)}
          onBook={() => handleBookSteadfast(liveSelected)}
          onEdit={() => {
            openEdit(liveSelected);
          }}
          onClone={() => {
            setSelectedOrder(null);
            openCreate(liveSelected);
          }}
          onCancel={() => {
            setCancelTarget(liveSelected);
            setCancelReason('');
            setCancelOpen(true);
          }}
        />
      )}

      <Dialog open={formOpen} onOpenChange={open => !saving && setFormOpen(open)}>
        <DialogContent className="max-w-2xl sm:max-w-2xl max-h-[92vh] overflow-hidden flex flex-col rounded-3xl p-0 gap-0">
          <form onSubmit={handleSaveForm} className="flex flex-col max-h-[92vh] min-h-0">
            <DialogHeader className="px-6 pt-6 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <DialogTitle className="text-lg font-black">{editingOrder ? 'অর্ডার এডিট করুন' : 'ম্যানুয়াল অর্ডার তৈরি'}</DialogTitle>
              <DialogDescription className="text-xs">
                ফোন, ঠিকানা ও পণ্য যাচাই করে সেভ করুন। ডুপ্লিকেট ওপেন অর্ডার থাকলে সতর্কবার্তা দেখাবে।
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 py-4 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="গ্রাহকের নাম">
                  <Input value={form.customerName} onChange={e => patchForm({ customerName: e.target.value })} className="h-10 rounded-xl" required />
                </Field>
                <Field label="মোবাইল">
                  <Input value={form.phone} onChange={e => patchForm({ phone: e.target.value })} className="h-10 rounded-xl font-mono" placeholder="01XXXXXXXXX" required />
                </Field>
              </div>
              <Field label="ডেলিভারি ঠিকানা">
                <Textarea value={form.address} onChange={e => patchForm({ address: e.target.value })} className="rounded-xl min-h-20" required />
              </Field>
              {duplicateHint && (
                <p className="text-[11px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded-xl px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {duplicateHint}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="ক্যাটালগ থেকে পণ্য">
                  <select
                    value={form.productId}
                    onChange={e => applyProduct(e.target.value)}
                    className="h-10 w-full rounded-xl border border-input bg-transparent px-2.5 text-sm"
                  >
                    <option value="">কাস্টম / সিলেক্ট করুন</option>
                    {(business.products || []).map(p => (
                      <option key={p.id} value={p.id}>{p.name} — {formatMoney(p.price)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="পণ্যের নাম">
                  <Input value={form.productName} onChange={e => patchForm({ productName: e.target.value })} className="h-10 rounded-xl" required />
                </Field>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="পরিমাণ">
                  <Input type="number" min={1} value={form.quantity} onChange={e => patchForm({ quantity: Number(e.target.value) })} className="h-10 rounded-xl" />
                </Field>
                <Field label="একক মূল্য">
                  <Input type="number" min={0} value={form.unitPrice} onChange={e => patchForm({ unitPrice: Number(e.target.value) })} className="h-10 rounded-xl" />
                </Field>
                <Field label="ডেলিভারি">
                  <Input type="number" min={0} value={form.deliveryFee} onChange={e => patchForm({ deliveryFee: Number(e.target.value) })} className="h-10 rounded-xl" />
                </Field>
                <Field label="ডিসকাউন্ট">
                  <Input type="number" min={0} value={form.discount} onChange={e => patchForm({ discount: Number(e.target.value) })} className="h-10 rounded-xl" />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => applyInsideDhaka(true)} className={`px-3 py-1.5 rounded-xl text-[11px] font-black ${form.insideDhaka ? 'bg-orange-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800'}`}>ঢাকার ভিতর</button>
                <button type="button" onClick={() => applyInsideDhaka(false)} className={`px-3 py-1.5 rounded-xl text-[11px] font-black ${!form.insideDhaka ? 'bg-orange-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800'}`}>ঢাকার বাইরে</button>
                <span className="ml-auto text-sm font-black text-orange-600">মোট {formatMoney(formTotal)}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="পেমেন্ট মেথড">
                  <select value={form.paymentMethod} onChange={e => patchForm({ paymentMethod: e.target.value as PaymentMethod })} className="h-10 w-full rounded-xl border border-input px-2.5 text-sm">
                    {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </Field>
                <Field label="পেমেন্ট স্ট্যাটাস">
                  <select value={form.paymentStatus} onChange={e => patchForm({ paymentStatus: e.target.value as PaymentStatus })} className="h-10 w-full rounded-xl border border-input px-2.5 text-sm">
                    {PAYMENT_STATUSES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </Field>
                <Field label="প্রায়োরিটি">
                  <select value={form.priority} onChange={e => patchForm({ priority: e.target.value as OrderPriority })} className="h-10 w-full rounded-xl border border-input px-2.5 text-sm">
                    {ORDER_PRIORITIES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="কাস্টমার নোট">
                <Textarea value={form.notes} onChange={e => patchForm({ notes: e.target.value })} className="rounded-xl min-h-16" />
              </Field>
            </div>
            <DialogFooter className="mx-0 mb-0 px-6 py-4 rounded-b-3xl">
              <Button type="button" variant="outline" disabled={saving} onClick={() => setFormOpen(false)} className="rounded-xl">বাতিল</Button>
              <Button type="submit" disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black">
                {saving ? 'সেভ হচ্ছে...' : editingOrder ? 'আপডেট করুন' : 'অর্ডার তৈরি'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black">অর্ডার বাতিল / রিটার্ন</DialogTitle>
            <DialogDescription className="text-xs">কারণ লিখে রাখুন — রিপোর্ট ও ফ্রড ডিটেকশনে কাজে লাগে।</DialogDescription>
          </DialogHeader>
          <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="যেমন: কাস্টমার কনফার্ম করেনি, ভুল ঠিকানা, রিটার্ন পার্সেল..." className="rounded-xl min-h-24" />
          <DialogFooter className="mx-0 mb-0">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>বন্ধ</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (cancelTarget) handleUpdateStatus(cancelTarget, 'cancelled', cancelReason || 'বাতিল');
                setCancelOpen(false);
              }}
            >
              বাতিল করুন
            </Button>
            <Button
              className="bg-fuchsia-600 text-white"
              onClick={() => {
                if (cancelTarget) handleUpdateStatus(cancelTarget, 'returned', cancelReason || 'রিটার্ন');
                setCancelOpen(false);
              }}
            >
              রিটার্ন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-black uppercase tracking-wide text-zinc-500">{label}</Label>
      {children}
    </div>
  );
}

function PriorityMark({ priority }: { priority?: OrderPriority }) {
  if (priority === 'urgent') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-rose-600">
        <Star className="w-3 h-3 fill-current" /> জরুরি
      </span>
    );
  }
  if (priority === 'hold') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-zinc-500">
        <PauseCircle className="w-3 h-3" /> হোল্ড
      </span>
    );
  }
  return null;
}

function RiskChips({ order, allOrders }: { order: Order; allOrders: Order[] }) {
  const flags = getRiskFlags(order, allOrders);
  if (!flags.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map(f => (
        <span
          key={f.id}
          className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
            f.tone === 'danger'
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
              : f.tone === 'warning'
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
              : 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
          }`}
        >
          {f.label}
        </span>
      ))}
    </div>
  );
}

function OrdersTable({
  orders,
  allOrders,
  selectedIds,
  pageAllSelected,
  bookingId,
  onTogglePage,
  onToggle,
  onOpen,
  onStatus,
  onBook,
}: {
  orders: Order[];
  allOrders: Order[];
  selectedIds: Set<string>;
  pageAllSelected: boolean;
  bookingId: string | null;
  onTogglePage: () => void;
  onToggle: (id: string) => void;
  onOpen: (o: Order) => void;
  onStatus: (o: Order, s: OrderStatus) => void;
  onBook: (o: Order) => void;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[980px]">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="p-3 w-10">
                <input type="checkbox" checked={pageAllSelected} onChange={onTogglePage} />
              </th>
              <th className="p-3 text-left">অর্ডার</th>
              <th className="p-3 text-left">গ্রাহক</th>
              <th className="p-3 text-left">পণ্য</th>
              <th className="p-3 text-right">মোট</th>
              <th className="p-3 text-left">স্ট্যাটাস</th>
              <th className="p-3 text-left">পেমেন্ট</th>
              <th className="p-3 text-left">কুরিয়ার</th>
              <th className="p-3 text-right">অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(ord => (
              <tr
                key={ord.id}
                className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-orange-50/40 dark:hover:bg-orange-950/20 cursor-pointer"
                onClick={() => onOpen(ord)}
              >
                <td className="p-3" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(ord.id)} onChange={() => onToggle(ord.id)} />
                </td>
                <td className="p-3">
                  <div className="font-mono font-black">{shortOrderId(ord.id)}</div>
                  <div className="text-[10px] text-zinc-500">{formatRelativeBn(getOrderTime(ord))}</div>
                  <PriorityMark priority={ord.priority} />
                </td>
                <td className="p-3">
                  <div className="font-black text-zinc-900 dark:text-white">{ord.customerName}</div>
                  <div className="font-mono text-zinc-500">{ord.phone}</div>
                  {(passengerIdOf(ord) || ord.clientIp) && (
                    <div className="text-[10px] font-mono text-zinc-400 break-all">
                      {passengerIdOf(ord) ? `PID: ${passengerIdOf(ord)}` : ''}
                      {passengerIdOf(ord) && ord.clientIp ? ' · ' : ''}
                      {ord.clientIp ? `IP: ${ord.clientIp}` : ''}
                    </div>
                  )}
                  <RiskChips order={ord} allOrders={allOrders} />
                </td>
                <td className="p-3">
                  <div className="font-bold line-clamp-2">{orderProductLabel(ord)}</div>
                </td>
                <td className="p-3 text-right font-black text-orange-600">{formatMoney(ord.totalPrice)}</td>
                <td className="p-3" onClick={e => e.stopPropagation()}>
                  <select
                    value={ord.status}
                    onChange={e => onStatus(ord, e.target.value as OrderStatus)}
                    className="text-[11px] font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1"
                  >
                    {ORDER_STATUSES.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <PaymentBadge status={ord.paymentStatus} />
                  <div className="text-[10px] text-zinc-500 mt-1">{methodLabel(ord.paymentMethod)}</div>
                </td>
                <td className="p-3">
                  {ord.courierTrackingId ? (
                    <div className="font-mono text-[11px] text-emerald-600 font-bold">{ord.courierTrackingId}</div>
                  ) : (
                    <span className="text-zinc-400">আনবুকড</span>
                  )}
                </td>
                <td className="p-3" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    {!ord.courierTrackingId && ord.status !== 'cancelled' && (
                      <Button size="xs" disabled={bookingId === ord.id} onClick={() => onBook(ord)} className="bg-orange-600 text-white rounded-lg">
                        {bookingId === ord.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Truck className="w-3 h-3" />}
                      </Button>
                    )}
                    <Button size="xs" variant="outline" className="rounded-lg" onClick={() => onOpen(ord)}>
                      খুলুন
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrderCard({
  order,
  allOrders,
  selected,
  booking,
  onToggle,
  onOpen,
  onStatus,
  onBook,
}: {
  key?: React.Key;
  order: Order;
  allOrders: Order[];
  selected: boolean;
  booking: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onStatus: (s: OrderStatus) => void;
  onBook: () => void;
}) {
  return (
    <div className={`bg-white dark:bg-zinc-900 border rounded-3xl p-5 md:p-6 shadow-xs space-y-4 ${selected ? 'border-orange-400' : 'border-zinc-200/80 dark:border-zinc-800'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <input type="checkbox" checked={selected} onChange={onToggle} />
          <button onClick={onOpen} className="font-mono font-black text-xs bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-xl">
            {shortOrderId(order.id)}
          </button>
          <StatusBadge status={order.status} />
          <PriorityMark priority={order.priority} />
        </div>
        <select
          value={order.status}
          onChange={e => onStatus(e.target.value as OrderStatus)}
          className="text-xs font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2.5 py-1"
        >
          {ORDER_STATUSES.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="space-y-1.5 bg-zinc-50 dark:bg-zinc-800/40 p-3.5 rounded-2xl">
          <p className="font-bold text-zinc-400 text-[10px] uppercase">গ্রাহকের বিবরণ</p>
          <p className="font-black text-zinc-900 dark:text-white text-sm">{order.customerName}</p>
          <p className="flex items-center gap-1.5 font-mono text-zinc-600 dark:text-zinc-400">
            <Phone className="w-3.5 h-3.5 text-orange-500" /> {order.phone}
          </p>
          {(passengerIdOf(order) || order.clientIp) && (
            <p className="text-[10px] font-mono text-zinc-400 break-all">
              {passengerIdOf(order) ? `PID: ${passengerIdOf(order)}` : ''}
              {passengerIdOf(order) && order.clientIp ? ' · ' : ''}
              {order.clientIp ? `IP: ${order.clientIp}` : ''}
            </p>
          )}
          <p className="flex items-start gap-1.5 text-zinc-600 dark:text-zinc-400">
            <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{order.address}</span>
          </p>
          <RiskChips order={order} allOrders={allOrders} />
        </div>
        <div className="space-y-1.5 bg-zinc-50 dark:bg-zinc-800/40 p-3.5 rounded-2xl">
          <p className="font-bold text-zinc-400 text-[10px] uppercase">পণ্য ও মূল্য</p>
          <p className="font-black text-sm">{orderProductLabel(order)}</p>
          <div className="flex justify-between"><span className="text-zinc-500">একক</span><span className="font-bold">{formatMoney(order.unitPrice)}</span></div>
          <div className="flex justify-between border-t border-zinc-200 dark:border-zinc-700 pt-1">
            <span className="font-bold">মোট</span>
            <span className="font-black text-orange-600">{formatMoney(order.totalPrice)}</span>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <PaymentBadge status={order.paymentStatus} />
            <span className="text-[10px] text-zinc-500">{methodLabel(order.paymentMethod)}</span>
          </div>
        </div>
        <div className="space-y-2.5 bg-zinc-50 dark:bg-zinc-800/40 p-3.5 rounded-2xl flex flex-col justify-between">
          <div>
            <p className="font-bold text-zinc-400 text-[10px] uppercase">কুরিয়ার</p>
            {order.courierTrackingId ? (
              <div className="mt-1 space-y-1">
                <span className="font-black text-emerald-600 text-xs flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> বুক করা হয়েছে
                </span>
                <p className="font-mono text-[11px] text-zinc-500">{order.courierTrackingId}</p>
              </div>
            ) : (
              <p className="text-zinc-500 text-[11px] mt-1">এখনো বুক করা হয়নি</p>
            )}
            <p className="text-[10px] text-zinc-400 mt-2">{formatBdDate(getOrderTime(order))}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onOpen} className="flex-1 rounded-xl h-9 text-xs font-bold">ডিটেইলস</Button>
            {!order.courierTrackingId && order.status !== 'cancelled' && (
              <Button size="sm" onClick={onBook} disabled={booking} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl h-9">
                {booking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5 mr-1" />}
                বুক
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanBoard({
  orders,
  allOrders,
  onOpen,
  onStatus,
}: {
  orders: Order[];
  allOrders: Order[];
  onOpen: (o: Order) => void;
  onStatus: (o: Order, s: OrderStatus) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {ORDER_STATUSES.map(col => {
        const items = orders.filter(o => o.status === col.id);
        return (
          <div key={col.id} className="w-[280px] shrink-0 bg-zinc-100/80 dark:bg-zinc-900/80 rounded-3xl p-3 border border-zinc-200/70 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-black">{col.label}</span>
              <span className="text-[10px] font-bold text-zinc-500">{items.length}</span>
            </div>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {items.map(o => (
                <button
                  key={o.id}
                  onClick={() => onOpen(o)}
                  className="w-full text-left bg-white dark:bg-zinc-950 rounded-2xl p-3 border border-zinc-200/80 dark:border-zinc-800 space-y-1.5 hover:border-orange-300"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-black">{shortOrderId(o.id)}</span>
                    <span className="text-[10px] font-black text-orange-600">{formatMoney(o.totalPrice)}</span>
                  </div>
                  <p className="font-black text-xs line-clamp-1">{o.customerName}</p>
                  <p className="text-[11px] text-zinc-500 line-clamp-1">{orderProductLabel(o)}</p>
                  <RiskChips order={o} allOrders={allOrders} />
                  <select
                    value={o.status}
                    onClick={e => e.stopPropagation()}
                    onChange={e => onStatus(o, e.target.value as OrderStatus)}
                    className="w-full mt-1 text-[10px] font-bold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-2 py-1"
                  >
                    {ORDER_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OrderDrawer({
  order,
  business,
  allOrders,
  booking,
  onClose,
  onStatus,
  onPayment,
  onPriority,
  onTag,
  onNotes,
  onBook,
  onEdit,
  onClone,
  onCancel,
}: {
  order: Order;
  business: BusinessConfig;
  allOrders: Order[];
  booking: boolean;
  onClose: () => void;
  onStatus: (s: OrderStatus, note?: string) => void;
  onPayment: (s: PaymentStatus) => void;
  onPriority: (p: OrderPriority) => void;
  onTag: (t: string) => void;
  onNotes: (n: string) => void;
  onBook: () => void;
  onEdit: () => void;
  onClone: () => void;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState(order.internalNotes || '');
  const [waKind, setWaKind] = useState<WhatsAppTemplate>('confirm');
  const flags = getRiskFlags(order, allOrders);
  const nxt = nextStatus(order.status);
  const track = steadfastTrackUrl(order.courierTrackingId);
  const history = order.statusHistory?.length
    ? order.statusHistory
    : [{ status: order.status, at: getOrderTime(order) || Date.now() }];

  useEffect(() => {
    setNotes(order.internalNotes || '');
  }, [order.id, order.internalNotes]);

  const copy = async (text: string, label: string) => {
    const ok = await copyText(text);
    toast[ok ? 'success' : 'error'](ok ? `${label} কপি হয়েছে` : 'কপি ব্যর্থ');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
      <aside className="relative w-full max-w-xl h-full bg-white dark:bg-zinc-950 shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs font-black text-orange-600">{shortOrderId(order.id)}</p>
            <h3 className="text-lg font-black leading-tight">{order.customerName}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <StatusBadge status={order.status} />
              <PaymentBadge status={order.paymentStatus} />
              <PriorityMark priority={order.priority} />
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex flex-wrap gap-2">
            {nxt && (
              <Button size="sm" onClick={() => onStatus(nxt)} className="bg-orange-600 text-white rounded-xl font-bold text-xs">
                <CheckCheck className="w-3.5 h-3.5 mr-1" /> পরবর্তী: {statusLabel(nxt)}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onEdit} className="rounded-xl text-xs font-bold">
              <Pencil className="w-3.5 h-3.5 mr-1" /> এডিট
            </Button>
            <Button size="sm" variant="outline" onClick={() => printOrderDocuments([order], business, 'invoice')} className="rounded-xl text-xs font-bold">
              <FileText className="w-3.5 h-3.5 mr-1" /> ইনভয়েস
            </Button>
            <Button size="sm" variant="outline" onClick={() => printOrderDocuments([order], business, 'packing')} className="rounded-xl text-xs font-bold">
              <Printer className="w-3.5 h-3.5 mr-1" /> প্যাকিং
            </Button>
            <Button size="sm" variant="outline" onClick={onClone} className="rounded-xl text-xs font-bold">
              ক্লোন
            </Button>
            <Button size="sm" variant="destructive" onClick={onCancel} className="rounded-xl text-xs font-bold">
              <Ban className="w-3.5 h-3.5 mr-1" /> বাতিল
            </Button>
          </div>

          {flags.length > 0 && (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/20 p-3 space-y-1">
              <p className="text-[10px] font-black uppercase text-amber-700 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> রিস্ক ও ইন্টেলিজেন্স
              </p>
              <RiskChips order={order} allOrders={allOrders} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {STATUS_PIPELINE.map((s, i) => {
              const reached = STATUS_PIPELINE.indexOf(order.status) >= i && !['cancelled', 'returned'].includes(order.status);
              const current = order.status === s;
              return (
                <button
                  key={s}
                  onClick={() => onStatus(s)}
                  className={`text-[10px] font-black rounded-xl px-2 py-2 border ${
                    current ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-700' : reached ? 'border-emerald-200 text-emerald-700' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400'
                  }`}
                >
                  {i + 1}. {statusLabel(s)}
                </button>
              );
            })}
          </div>

          <section className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-4 space-y-2 text-xs">
            <p className="text-[10px] font-black uppercase text-zinc-400">গ্রাহক</p>
            <p className="font-black text-sm">{order.customerName}</p>
            <div className="flex flex-wrap gap-2">
              <a href={telLink(order.phone)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border font-mono font-bold">
                <Phone className="w-3 h-3 text-orange-500" /> {order.phone}
              </a>
              <Button size="xs" variant="outline" onClick={() => copy(order.phone, 'নম্বর')} className="rounded-lg"><Copy className="w-3 h-3" /></Button>
              <Button size="xs" variant="outline" onClick={() => copy(order.address || '', 'ঠিকানা')} className="rounded-lg">ঠিকানা কপি</Button>
              <Button size="xs" variant="outline" onClick={() => copy(order.id, 'অর্ডার আইডি')} className="rounded-lg">ID</Button>
            </div>
            <p className="flex items-start gap-1.5 text-zinc-600 dark:text-zinc-400">
              <MapPin className="w-3.5 h-3.5 text-orange-500 mt-0.5" /> {order.address}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <select value={waKind} onChange={e => setWaKind(e.target.value as WhatsAppTemplate)} className="h-8 rounded-lg border text-[11px] font-bold px-2">
                <option value="confirm">কনফার্মেশন</option>
                <option value="shipped">শিপিং</option>
                <option value="cod">COD রিমাইন্ডার</option>
                <option value="delivered">থ্যাংক ইউ</option>
                <option value="callback">কলব্যাক</option>
              </select>
              <a
                href={whatsappLink(order.phone, whatsappTemplate(waKind, order, business))}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-emerald-600 text-white text-[11px] font-black"
              >
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </a>
            </div>
          </section>

          <section className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-4 space-y-2 text-xs">
            <p className="text-[10px] font-black uppercase text-zinc-400">পণ্য ও বিল</p>
            <p className="font-black text-sm">{orderProductLabel(order)}</p>
            <div className="space-y-1">
              <Row k="একক মূল্য" v={formatMoney(order.unitPrice)} />
              <Row k="ডেলিভারি" v={formatMoney(order.deliveryFee)} />
              {!!order.discount && <Row k="ডিসকাউন্ট" v={`- ${formatMoney(order.discount)}`} />}
              <Row k="গ্র্যান্ড টোটাল" v={formatMoney(order.totalPrice)} strong />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <select value={order.paymentStatus || 'unpaid'} onChange={e => onPayment(e.target.value as PaymentStatus)} className="h-9 rounded-xl border text-xs font-bold px-2">
                {PAYMENT_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <select value={order.priority || 'normal'} onChange={e => onPriority(e.target.value as OrderPriority)} className="h-9 rounded-xl border text-xs font-bold px-2">
                {ORDER_PRIORITIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <p className="text-[10px] text-zinc-500">মেথড: {methodLabel(order.paymentMethod)} · সোর্স: {order.source || 'AI/অজানা'}</p>
          </section>

          <section className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-4 space-y-2 text-xs">
            <p className="text-[10px] font-black uppercase text-zinc-400">কুরিয়ার</p>
            {order.courierTrackingId ? (
              <div className="space-y-1">
                <p className="font-mono font-black text-emerald-600">{order.courierTrackingId}</p>
                {order.courierConsignmentId && <p className="text-zinc-500">Consignment: {order.courierConsignmentId}</p>}
                {track && (
                  <a href={track} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-orange-600 font-bold">
                    ট্র্যাক করুন <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ) : (
              <Button onClick={onBook} disabled={booking || order.status === 'cancelled'} className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold">
                {booking ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Truck className="w-4 h-4 mr-1" />}
                স্টেডফাস্টে পার্সেল পাঠান
              </Button>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-[10px] font-black uppercase text-zinc-400 flex items-center gap-1"><Tag className="w-3 h-3" /> ট্যাগ</p>
            <div className="flex flex-wrap gap-1.5">
              {ORDER_TAG_OPTIONS.map(tag => {
                const on = (order.tags || []).includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => onTag(tag)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black border ${on ? 'bg-orange-600 text-white border-orange-600' : 'border-zinc-200 dark:border-zinc-700'}`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-[10px] font-black uppercase text-zinc-400">ইন্টারনাল নোট</p>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="rounded-xl min-h-20 text-xs" />
            <Button size="sm" onClick={() => onNotes(notes)} className="rounded-xl text-xs font-bold bg-zinc-900 text-white">
              <Send className="w-3.5 h-3.5 mr-1" /> নোট সেভ
            </Button>
            {order.notes && <p className="text-[11px] text-zinc-500">কাস্টমার নোট: {order.notes}</p>}
            {order.cancelReason && <p className="text-[11px] text-rose-600 font-bold">বাতিলের কারণ: {order.cancelReason}</p>}
            {order.returnReason && <p className="text-[11px] text-fuchsia-600 font-bold">রিটার্ন কারণ: {order.returnReason}</p>}
          </section>

          <section className="space-y-2">
            <p className="text-[10px] font-black uppercase text-zinc-400">টাইমলাইন</p>
            <ol className="space-y-2">
              {history.map((h, i) => (
                <li key={`${h.at}-${i}`} className="flex gap-3 text-xs">
                  <div className="mt-1 w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                  <div>
                    <p className="font-black">{statusLabel(h.status)}</p>
                    <p className="text-[10px] text-zinc-500">{formatBdDate(h.at)} {h.note ? `· ${h.note}` : ''}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </aside>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'font-black text-sm pt-1 border-t border-zinc-200 dark:border-zinc-700' : ''}`}>
      <span className="text-zinc-500">{k}</span>
      <span className={strong ? 'text-orange-600' : 'font-bold'}>{v}</span>
    </div>
  );
}

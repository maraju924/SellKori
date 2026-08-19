import * as XLSX from 'xlsx';
import { BusinessConfig, Order, OrderPriority, OrderStatus, PaymentMethod, PaymentStatus } from '../types';
import { normalizePhone } from './chatOrder';

export const ORDER_STATUSES: { id: OrderStatus; label: string; short: string }[] = [
  { id: 'pending', label: 'পেন্ডিং', short: 'পেন্ডিং' },
  { id: 'confirmed', label: 'কনফার্মড', short: 'কনফার্ম' },
  { id: 'processing', label: 'প্রসেসিং', short: 'প্রসেস' },
  { id: 'shipped', label: 'শিপড', short: 'শিপড' },
  { id: 'delivered', label: 'ডেলিভার্ড', short: 'ডেলিভারি' },
  { id: 'returned', label: 'রিটার্নড', short: 'রিটার্ন' },
  { id: 'cancelled', label: 'বাতিল', short: 'বাতিল' },
];

export const PAYMENT_STATUSES: { id: PaymentStatus; label: string }[] = [
  { id: 'unpaid', label: 'অনাদায়ী' },
  { id: 'paid', label: 'পরিশোধিত' },
  { id: 'partial', label: 'আংশিক' },
  { id: 'refunded', label: 'রিফান্ড' },
];

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cod', label: 'ক্যাশ অন ডেলিভারি' },
  { id: 'bkash', label: 'বিকাশ' },
  { id: 'nagad', label: 'নগদ' },
  { id: 'rocket', label: 'রকেট' },
  { id: 'card', label: 'কার্ড' },
];

export const ORDER_PRIORITIES: { id: OrderPriority; label: string }[] = [
  { id: 'normal', label: 'নরমাল' },
  { id: 'urgent', label: 'জরুরি' },
  { id: 'hold', label: 'হোল্ড' },
];

export const ORDER_TAG_OPTIONS = ['VIP', 'কলব্যাক', 'ইনকমপ্লিট', 'নতুন', 'রিপিট', 'ফ্রড-সতর্ক'] as const;

export const STATUS_PIPELINE: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
];

const DHAKA_RE =
  /ঢাকা|dhaka|মোহাম্মদপুর|ধানমন্ডি|গুলশান|বনানী|উত্তরা|মিরপুর|মতিঝিল|বাড্ডা|রামপুরা|মগবাজার|খিলগাঁও|যাত্রাবাড়ী|কেরানীগঞ্জ|সাভার|ধানমন্ডি|মোহাম্মদপুর|dhanmondi|gulshan|uttara|mirpur|banani|mohammadpur/i;

export function getOrderTime(order: Order): number {
  const anyOrder = order as any;
  if (typeof anyOrder.createdAtMs === 'number' && anyOrder.createdAtMs > 0) return anyOrder.createdAtMs;
  if (typeof anyOrder.updatedAtMs === 'number' && anyOrder.createdAt == null) return anyOrder.updatedAtMs;
  if (anyOrder.createdAt?.toMillis) return anyOrder.createdAt.toMillis();
  if (anyOrder.createdAt?.seconds) return anyOrder.createdAt.seconds * 1000;
  const parsed = Date.parse(anyOrder.createdAt || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

export function startOfDay(ms = Date.now()): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function formatMoney(amount?: number | null): string {
  const n = Number(amount || 0);
  return `৳ ${n.toLocaleString('en-BD')}`;
}

export function formatBdDate(ms?: number | null): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('bn-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatRelativeBn(ms?: number | null): string {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'এইমাত্র';
  if (min < 60) return `${min} মিনিট আগে`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ঘণ্টা আগে`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} দিন আগে`;
  return formatBdDate(ms);
}

export function shortOrderId(id?: string): string {
  if (!id) return '—';
  return `#${id.replace(/^ord-/, '').slice(-8).toUpperCase()}`;
}

export function statusLabel(status?: string): string {
  return ORDER_STATUSES.find(s => s.id === status)?.label || status || '—';
}

export function paymentLabel(status?: string): string {
  return PAYMENT_STATUSES.find(s => s.id === status)?.label || status || 'অনাদায়ী';
}

export function methodLabel(method?: string): string {
  return PAYMENT_METHODS.find(m => m.id === method)?.label || method || 'COD';
}

export function detectInsideDhaka(address?: string): boolean {
  return DHAKA_RE.test(address || '');
}

export function deliveryFeeForAddress(business: BusinessConfig, address?: string): number {
  const inside = detectInsideDhaka(address);
  return inside
    ? business.courierConfig?.deliveryChargeInsideDhaka ?? 70
    : business.courierConfig?.deliveryChargeOutsideDhaka ?? 130;
}

export function computeOrderTotal(params: {
  unitPrice: number;
  quantity: number;
  deliveryFee?: number;
  discount?: number;
}): number {
  const sub = (params.unitPrice || 0) * Math.max(1, params.quantity || 1);
  return Math.max(0, sub + (params.deliveryFee || 0) - (params.discount || 0));
}

export function isValidBdPhone(phone?: string): boolean {
  return normalizePhone(phone).length === 11;
}

export function whatsappLink(phone: string, text: string): string {
  const p = normalizePhone(phone);
  const intl = p.startsWith('0') ? `88${p}` : p;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

export function telLink(phone: string): string {
  const p = normalizePhone(phone);
  return p ? `tel:+88${p}` : `tel:${phone || ''}`;
}

export function steadfastTrackUrl(trackingId?: string): string {
  if (!trackingId) return '';
  return `https://steadfast.com.bd/t/${encodeURIComponent(trackingId)}`;
}

export type WhatsAppTemplate = 'confirm' | 'shipped' | 'cod' | 'delivered' | 'callback';

export function whatsappTemplate(
  kind: WhatsAppTemplate,
  order: Order,
  business: BusinessConfig
): string {
  const shop = business.name || 'আমাদের শপ';
  const id = shortOrderId(order.id);
  const product = `${order.productName} × ${order.quantity}`;
  const total = formatMoney(order.totalPrice);
  switch (kind) {
    case 'confirm':
      return `আসসালামু আলাইকুম ${order.customerName},\n${shop} থেকে বলছি। আপনার অর্ডার ${id} কনফার্ম করা হয়েছে।\nপণ্য: ${product}\nমোট: ${total} (COD)\nঠিকানা: ${order.address}\nধন্যবাদ।`;
    case 'shipped':
      return `আসসালামু আলাইকুম ${order.customerName},\nআপনার অর্ডার ${id} কুরিয়ারে পাঠানো হয়েছে।\nট্র্যাকিং: ${order.courierTrackingId || 'শীঘ্রই আপডেট'}\nমোট COD: ${total}\n${shop}`;
    case 'cod':
      return `আসসালামু আলাইকুম ${order.customerName},\nআপনার অর্ডার ${id} ডেলিভারির সময় ${total} টাকা ক্যাশ অন ডেলিভারি দিতে হবে।\n${shop}`;
    case 'delivered':
      return `আসসালামু আলাইকুম ${order.customerName},\nআপনার অর্ডার ${id} সফলভাবে ডেলিভারি হয়েছে। ${shop}-কে বেছে নেওয়ার জন্য ধন্যবাদ!`;
    case 'callback':
      return `আসসালামু আলাইকুম ${order.customerName},\n${shop} থেকে বলছি। আপনার অর্ডার ${id} নিয়ে কথা বলার জন্য কল করেছিলাম। সুবিধামতো রিপ্লাই দিবেন প্লিজ।`;
  }
}

export interface OrderRiskFlag {
  id: string;
  label: string;
  tone: 'warning' | 'danger' | 'info';
}

export function getRiskFlags(order: Order, allOrders: Order[]): OrderRiskFlag[] {
  const flags: OrderRiskFlag[] = [];
  const phone = normalizePhone(order.phone);
  if (!isValidBdPhone(order.phone)) {
    flags.push({ id: 'phone', label: 'অবৈধ মোবাইল', tone: 'danger' });
  }
  if ((order.address || '').trim().length < 10) {
    flags.push({ id: 'address', label: 'অসম্পূর্ণ ঠিকানা', tone: 'warning' });
  }
  if (!order.productName) {
    flags.push({ id: 'product', label: 'পণ্য নেই', tone: 'warning' });
  }

  if (phone) {
    const related = allOrders.filter(o => o.id !== order.id && normalizePhone(o.phone) === phone);
    const cancelled = related.filter(o => o.status === 'cancelled' || o.status === 'returned').length;
    const open = related.filter(o =>
      ['pending', 'confirmed', 'processing', 'shipped'].includes(o.status)
    ).length;
    const delivered = related.filter(o => o.status === 'delivered').length;
    if (cancelled >= 2) flags.push({ id: 'fraud', label: 'রিটার্ন/ক্যানসেল হিস্ট্রি', tone: 'danger' });
    if (open >= 1 && ['pending', 'confirmed'].includes(order.status)) {
      flags.push({ id: 'dup', label: 'ডুপ্লিকেট ওপেন অর্ডার', tone: 'warning' });
    }
    if (delivered >= 1) flags.push({ id: 'repeat', label: 'রিপিট কাস্টমার', tone: 'info' });
  }

  const avg =
    allOrders.length > 0
      ? allOrders.reduce((s, o) => s + (o.totalPrice || 0), 0) / allOrders.length
      : 0;
  if (avg > 0 && (order.totalPrice || 0) >= avg * 3 && (order.totalPrice || 0) >= 3000) {
    flags.push({ id: 'high', label: 'হাই ভ্যালু', tone: 'info' });
  }
  return flags;
}

export function orderMatchesQuery(order: Order, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    order.id,
    order.customerName,
    order.phone,
    order.address,
    order.productName,
    order.courierTrackingId,
    order.courierConsignmentId,
    order.notes,
    order.internalNotes,
    order.source,
    ...(order.tags || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q) || shortOrderId(order.id).toLowerCase().includes(q);
}

export type DatePreset = 'all' | 'today' | 'yesterday' | '7d' | '30d' | 'custom';

export function inDateRange(
  order: Order,
  preset: DatePreset,
  customFrom?: string,
  customTo?: string
): boolean {
  const t = getOrderTime(order);
  if (preset === 'all') return true;
  const today = startOfDay();
  if (preset === 'today') return t >= today;
  if (preset === 'yesterday') return t >= today - 86400000 && t < today;
  if (preset === '7d') return t >= today - 6 * 86400000;
  if (preset === '30d') return t >= today - 29 * 86400000;
  if (preset === 'custom') {
    const from = customFrom ? startOfDay(new Date(customFrom).getTime()) : 0;
    const to = customTo ? startOfDay(new Date(customTo).getTime()) + 86400000 - 1 : Date.now();
    return t >= from && t <= to;
  }
  return true;
}

export type OrderSortKey = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc' | 'name';

export function sortOrders(orders: Order[], key: OrderSortKey): Order[] {
  const copy = [...orders];
  copy.sort((a, b) => {
    switch (key) {
      case 'oldest':
        return getOrderTime(a) - getOrderTime(b);
      case 'amount_desc':
        return (b.totalPrice || 0) - (a.totalPrice || 0);
      case 'amount_asc':
        return (a.totalPrice || 0) - (b.totalPrice || 0);
      case 'name':
        return (a.customerName || '').localeCompare(b.customerName || '', 'bn');
      case 'newest':
      default:
        return getOrderTime(b) - getOrderTime(a);
    }
  });
  return copy;
}

export interface OrderKpis {
  total: number;
  today: number;
  pending: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  returned: number;
  revenue: number;
  todayRevenue: number;
  codOutstanding: number;
  courierBooked: number;
  courierRate: number;
  avgOrder: number;
}

export function computeOrderKpis(orders: Order[]): OrderKpis {
  const today = startOfDay();
  const active = orders.filter(o => o.status !== 'cancelled');
  const revenue = active.reduce((s, o) => s + (o.totalPrice || 0), 0);
  const todayOrders = orders.filter(o => getOrderTime(o) >= today);
  const booked = orders.filter(o => !!o.courierTrackingId).length;
  const unpaidCod = orders.filter(
    o =>
      (o.paymentMethod || 'cod') === 'cod' &&
      o.paymentStatus !== 'paid' &&
      o.paymentStatus !== 'refunded' &&
      o.status !== 'cancelled'
  );
  return {
    total: orders.length,
    today: todayOrders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing' || o.status === 'confirmed').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
    returned: orders.filter(o => o.status === 'returned').length,
    revenue,
    todayRevenue: todayOrders
      .filter(o => o.status !== 'cancelled')
      .reduce((s, o) => s + (o.totalPrice || 0), 0),
    codOutstanding: unpaidCod.reduce((s, o) => s + (o.totalPrice || 0), 0),
    courierBooked: booked,
    courierRate: orders.length ? Math.round((booked / orders.length) * 100) : 0,
    avgOrder: active.length ? Math.round(revenue / active.length) : 0,
  };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function invoiceBlock(order: Order, business: BusinessConfig): string {
  const sub = (order.unitPrice || 0) * (order.quantity || 1);
  const delivery = order.deliveryFee || 0;
  const discount = order.discount || 0;
  const total = order.totalPrice ?? computeOrderTotal({
    unitPrice: order.unitPrice,
    quantity: order.quantity,
    deliveryFee: delivery,
    discount,
  });
  const paid = order.paymentStatus === 'paid';
  return `
    <section class="sheet">
      <header>
        <div>
          <div class="brand">${escapeHtml(business.name || 'SellKori Shop')}</div>
          <div class="muted">${escapeHtml(business.address || '')}</div>
          <div class="muted">${escapeHtml(business.phone || '')}</div>
        </div>
        <div class="right">
          <div class="inv">ইনভয়েস / মেমো</div>
          <div class="mono">${escapeHtml(shortOrderId(order.id))}</div>
          <div class="muted">${escapeHtml(formatBdDate(getOrderTime(order)))}</div>
          <div class="badge ${paid ? 'ok' : 'due'}">${paid ? 'PAID' : 'COD DUE'}</div>
        </div>
      </header>
      <div class="grid">
        <div>
          <div class="lbl">বিল টু</div>
          <div class="strong">${escapeHtml(order.customerName)}</div>
          <div>${escapeHtml(order.phone)}</div>
          <div>${escapeHtml(order.address)}</div>
        </div>
        <div>
          <div class="lbl">পেমেন্ট ও কুরিয়ার</div>
          <div>মেথড: ${escapeHtml(methodLabel(order.paymentMethod))}</div>
          <div>স্ট্যাটাস: ${escapeHtml(statusLabel(order.status))}</div>
          <div>ট্র্যাকিং: ${escapeHtml(order.courierTrackingId || '—')}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr><th>পণ্য</th><th>পরিমাণ</th><th>একক মূল্য</th><th>মোট</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(order.productName)}</td>
            <td>${escapeHtml(order.quantity)}</td>
            <td>${escapeHtml(formatMoney(order.unitPrice))}</td>
            <td>${escapeHtml(formatMoney(sub))}</td>
          </tr>
        </tbody>
      </table>
      <div class="totals">
        <div><span>সাবটোটাল</span><span>${escapeHtml(formatMoney(sub))}</span></div>
        <div><span>ডেলিভারি</span><span>${escapeHtml(formatMoney(delivery))}</span></div>
        ${discount ? `<div><span>ডিসকাউন্ট</span><span>- ${escapeHtml(formatMoney(discount))}</span></div>` : ''}
        <div class="grand"><span>গ্র্যান্ড টোটাল</span><span>${escapeHtml(formatMoney(total))}</span></div>
      </div>
      ${order.notes ? `<p class="note">নোট: ${escapeHtml(order.notes)}</p>` : ''}
      <footer>
        <div>ধন্যবাদ আপনার অর্ডারের জন্য।</div>
        <div class="muted">Generated by SellKori · ${escapeHtml(new Date().toLocaleDateString('bn-BD'))}</div>
      </footer>
    </section>
  `;
}

function packingBlock(order: Order, business: BusinessConfig): string {
  return `
    <section class="sheet pack">
      <div class="brand">${escapeHtml(business.name || 'Shop')}</div>
      <div class="mono big">${escapeHtml(shortOrderId(order.id))}</div>
      <div class="strong">${escapeHtml(order.customerName)} · ${escapeHtml(order.phone)}</div>
      <div>${escapeHtml(order.address)}</div>
      <hr/>
      <div class="strong">${escapeHtml(order.productName)} × ${escapeHtml(order.quantity)}</div>
      <div>COD: ${escapeHtml(formatMoney(order.totalPrice))}</div>
      <div class="muted">ট্র্যাকিং: ${escapeHtml(order.courierTrackingId || 'বুক হয়নি')}</div>
    </section>
  `;
}

export function printOrderDocuments(
  orders: Order[],
  business: BusinessConfig,
  kind: 'invoice' | 'packing' = 'invoice'
) {
  if (!orders.length) return;
  const body = orders
    .map(o => (kind === 'invoice' ? invoiceBlock(o, business) : packingBlock(o, business)))
    .join('');
  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) return;
  win.document.write(`<!doctype html>
<html lang="bn">
<head>
  <meta charset="utf-8"/>
  <title>${kind === 'invoice' ? 'Invoices' : 'Packing Slips'}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Noto Sans Bengali", "Kalpurush", system-ui, sans-serif; color: #18181b; margin: 0; background: #f4f4f5; }
    .sheet { background: #fff; padding: 28px; margin: 16px auto; max-width: 800px; border: 1px solid #e4e4e7; page-break-after: always; }
    header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #ea580c; padding-bottom: 12px; margin-bottom: 16px; }
    .brand { font-size: 22px; font-weight: 900; }
    .inv { font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #ea580c; font-size: 12px; }
    .mono { font-family: ui-monospace, monospace; font-weight: 800; }
    .big { font-size: 28px; margin: 8px 0; }
    .muted { color: #71717a; font-size: 12px; }
    .strong { font-weight: 800; }
    .right { text-align: right; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .lbl { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #a1a1aa; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border-bottom: 1px solid #e4e4e7; padding: 8px; text-align: left; font-size: 13px; }
    th { background: #fff7ed; font-size: 11px; text-transform: uppercase; }
    .totals { margin-left: auto; width: 280px; }
    .totals div { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
    .grand { font-weight: 900; border-top: 2px solid #18181b; margin-top: 6px; font-size: 16px !important; }
    .badge { display: inline-block; margin-top: 6px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 800; }
    .ok { background: #d1fae5; color: #065f46; }
    .due { background: #ffedd5; color: #9a3412; }
    .note { font-size: 12px; background: #fafafa; padding: 8px; border-radius: 8px; }
    footer { margin-top: 24px; display: flex; justify-content: space-between; font-size: 12px; }
    .pack { text-align: center; }
    @media print { body { background: #fff; } .sheet { margin: 0; border: 0; } }
  </style>
</head>
<body>${body}<script>window.onload=()=>{window.print();}</script></body>
</html>`);
  win.document.close();
}

function flattenOrderRow(order: Order) {
  return {
    'Order ID': order.id,
    'Short ID': shortOrderId(order.id),
    Date: formatBdDate(getOrderTime(order)),
    Customer: order.customerName || '',
    Phone: order.phone || '',
    Address: order.address || '',
    Product: order.productName || '',
    Qty: order.quantity || 0,
    'Unit Price': order.unitPrice || 0,
    Delivery: order.deliveryFee || 0,
    Discount: order.discount || 0,
    Total: order.totalPrice || 0,
    Status: statusLabel(order.status),
    Payment: paymentLabel(order.paymentStatus),
    Method: methodLabel(order.paymentMethod),
    Tracking: order.courierTrackingId || '',
    Consignment: order.courierConsignmentId || '',
    Priority: order.priority || 'normal',
    Tags: (order.tags || []).join(', '),
    Source: order.source || '',
    Notes: order.notes || '',
  };
}

export function exportOrdersExcel(orders: Order[], filename = 'orders.xlsx') {
  const ws = XLSX.utils.json_to_sheet(orders.map(flattenOrderRow));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Orders');
  ws['!cols'] = Object.keys(flattenOrderRow(orders[0] || ({} as Order))).map(() => ({ wch: 18 }));
  XLSX.writeFile(wb, filename);
}

export function exportOrdersCsv(orders: Order[], filename = 'orders.csv') {
  const ws = XLSX.utils.json_to_sheet(orders.map(flattenOrderRow));
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const i = STATUS_PIPELINE.indexOf(status);
  if (i < 0 || i >= STATUS_PIPELINE.length - 1) return null;
  return STATUS_PIPELINE[i + 1];
}

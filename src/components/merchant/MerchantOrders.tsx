import React, { useState } from 'react';
import { 
  Package, 
  Search, 
  Filter, 
  Truck, 
  FileText, 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertCircle,
  ExternalLink,
  ChevronDown,
  Download,
  Phone,
  MapPin,
  RefreshCw,
  Send
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { BusinessConfig, Order } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface MerchantOrdersProps {
  business: BusinessConfig;
  orders: Order[];
}

export function MerchantOrders({ business, orders }: MerchantOrdersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isBookingCourier, setIsBookingCourier] = useState<string | null>(null);

  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.phone?.includes(searchTerm) ||
      o.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.productName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleUpdateStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus
      });
      toast.success(`অর্ডারের স্ট্যাটাস আপডেট হয়েছে: ${newStatus}`);
    } catch (e: any) {
      toast.error('স্ট্যাটাস আপডেট ব্যর্থ হয়েছে');
    }
  };

  const handleBookSteadfast = async (order: Order) => {
    if (!business.courierConfig?.steadfastApiKey) {
      toast.error('স্টেডফাস্ট কুরিয়ার এপিআই কনফিগার করা নেই', {
        description: 'ইন্টিগ্রেশন পেজে গিয়ে API Key যুক্ত করুন।'
      });
      return;
    }

    setIsBookingCourier(order.id);
    try {
      // Simulate Steadfast API integration
      await new Promise(r => setTimeout(r, 1200));
      const trackingCode = `STDF-${Math.floor(100000 + Math.random() * 900000)}`;
      
      await updateDoc(doc(db, 'orders', order.id), {
        courierStatus: 'in_transit',
        courierTrackingId: trackingCode,
        status: 'shipped'
      });

      toast.success('স্টেডফাস্টে পার্সেল সফলভাবে বুকিং হয়েছে!', {
        description: `ট্র্যাকিং আইডি: ${trackingCode}`
      });
    } catch (e) {
      toast.error('কুরিয়ার বুকিং ব্যর্থ হয়েছে');
    } finally {
      setIsBookingCourier(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white">
              অর্ডার ও পার্সেল ম্যানেজমেন্ট
            </h2>
            <p className="text-xs text-zinc-500">
              এআই কর্তৃক কনফার্মকৃত সকল গ্রাহক অর্ডার এবং ১-ক্লিক স্টেডফাস্ট কুরিয়ার বুকিং
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-500">মোট: {orders.length} টি</span>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="গ্রাহকের নাম, ফোন বা প্রোডাক্ট দিয়ে খুঁজুন..."
              className="pl-9 h-11 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-xs"
            />
          </div>

          {/* Status Tabs Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: 'all', label: 'সব' },
              { id: 'pending', label: 'পেন্ডিং' },
              { id: 'confirmed', label: 'কনফার্মড' },
              { id: 'shipped', label: 'শিপড' },
              { id: 'delivered', label: 'ডেলিভার্ড' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                  statusFilter === tab.id
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders Grid / Table */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-12 text-center space-y-3">
          <Package className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto" />
          <h3 className="font-black text-sm text-zinc-800 dark:text-zinc-200">কোনো অর্ডার পাওয়া যায়নি</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            আপনার ফিল্টার অনুযায়ী কোনো অর্ডারের রেকর্ড নেই। ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন।
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredOrders.map((ord) => (
            <div
              key={ord.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-5 md:p-6 shadow-xs hover:border-orange-200 dark:hover:border-orange-950 transition-colors space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-black text-xs text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-xl">
                    #{ord.id.slice(-8).toUpperCase()}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    ord.status === 'delivered'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : ord.status === 'shipped'
                      ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                      : ord.status === 'confirmed'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}>
                    {ord.status}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={ord.status}
                    onChange={(e) => handleUpdateStatus(ord.id, e.target.value as Order['status'])}
                    className="text-xs font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2.5 py-1 text-zinc-800 dark:text-zinc-200"
                  >
                    <option value="pending">পেন্ডিং (Pending)</option>
                    <option value="confirmed">কনফার্মড (Confirmed)</option>
                    <option value="processing">প্রসেসিং (Processing)</option>
                    <option value="shipped">শিপড (Shipped)</option>
                    <option value="delivered">ডেলিভার্ড (Delivered)</option>
                    <option value="cancelled">বাতিল (Cancelled)</option>
                  </select>
                </div>
              </div>

              {/* Order Info Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Customer Details */}
                <div className="space-y-1.5 bg-zinc-50 dark:bg-zinc-800/40 p-3.5 rounded-2xl">
                  <p className="font-bold text-zinc-400 text-[10px] uppercase">গ্রাহকের বিবরণ</p>
                  <p className="font-black text-zinc-900 dark:text-white text-sm">{ord.customerName}</p>
                  <p className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 font-mono">
                    <Phone className="w-3.5 h-3.5 text-orange-500" />
                    {ord.phone}
                  </p>
                  <p className="flex items-start gap-1.5 text-zinc-600 dark:text-zinc-400">
                    <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{ord.address}</span>
                  </p>
                </div>

                {/* Product & Pricing Details */}
                <div className="space-y-1.5 bg-zinc-50 dark:bg-zinc-800/40 p-3.5 rounded-2xl">
                  <p className="font-bold text-zinc-400 text-[10px] uppercase">পণ্য ও মূল্য</p>
                  <p className="font-black text-zinc-900 dark:text-white text-sm">
                    {ord.productName} <span className="text-orange-600">(x{ord.quantity})</span>
                  </p>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-zinc-500">একক মূল্য:</span>
                    <span className="font-bold">৳ {ord.unitPrice?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-zinc-200 dark:border-zinc-700 pt-1">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">মোট বিল:</span>
                    <span className="font-black text-orange-600 text-sm">৳ {ord.totalPrice?.toLocaleString()}</span>
                  </div>
                </div>

                {/* Courier & Tracking Actions */}
                <div className="space-y-2.5 bg-zinc-50 dark:bg-zinc-800/40 p-3.5 rounded-2xl flex flex-col justify-between">
                  <div>
                    <p className="font-bold text-zinc-400 text-[10px] uppercase">কুরিয়ার স্ট্যাটাস</p>
                    {ord.courierTrackingId ? (
                      <div className="mt-1 space-y-1">
                        <span className="font-black text-emerald-600 text-xs flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          স্টেডফাস্টে বুক করা হয়েছে
                        </span>
                        <p className="font-mono text-zinc-500 text-[11px]">
                          ট্র্যাকিং: {ord.courierTrackingId}
                        </p>
                      </div>
                    ) : (
                      <p className="text-zinc-500 text-[11px] mt-1">এখনো কুরিয়ারে বুক করা হয়নি</p>
                    )}
                  </div>

                  {!ord.courierTrackingId && (
                    <Button
                      size="sm"
                      onClick={() => handleBookSteadfast(ord)}
                      disabled={isBookingCourier === ord.id}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl h-9 shadow-xs"
                    >
                      {isBookingCourier === ord.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                      ) : (
                        <Truck className="w-3.5 h-3.5 mr-1" />
                      )}
                      স্টেডফাস্টে পার্সেল পাঠান
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

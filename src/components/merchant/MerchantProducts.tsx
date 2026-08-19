import React, { useState, useRef } from 'react';
import { 
  Tag, 
  Plus, 
  Trash2, 
  Edit3, 
  Lock, 
  Sparkles, 
  Image as ImageIcon, 
  Check, 
  AlertCircle,
  Layers,
  Search,
  Upload,
  Star,
  MessageSquareHeart,
  Percent,
  X,
  Eye,
  CheckCircle2,
  PackageCheck,
  ShieldAlert,
  Flame,
  ArrowRight,
  Sparkle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '../ui/dialog';
import { BusinessConfig, Product, ProductTier } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { compressImageFile } from '../../lib/imageUtils';
import { persistImageDataUrl } from '../../lib/mediaUpload';
import { cleanFirestoreData } from '../../lib/utils';

interface MerchantProductsProps {
  business: BusinessConfig;
}

export function MerchantProducts({ business }: MerchantProductsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [pricingMode, setPricingMode] = useState<'tiered' | 'single'>('tiered');
  const [singlePrice, setSinglePrice] = useState<number>(500);
  const [singleMinPrice, setSingleMinPrice] = useState<number>(450);
  
  // Tiered Pricing State (e.g. 1 pc: 500, 2 pcs: 800, 3 pcs: 1000)
  const [pricingTiers, setPricingTiers] = useState<ProductTier[]>([
    { quantity: 1, price: 500, minPrice: 450, label: '১ পিস (স্ট্যান্ডার্ড)' },
    { quantity: 2, price: 800, minPrice: 750, label: '২ পিস কম্বো (৳২০০ সেভ)' },
    { quantity: 3, price: 1000, minPrice: 950, label: '৩ পিস মেগা বান্ডেল (৳৫০০ সেভ)' }
  ]);

  const [description, setDescription] = useState('');
  const [specs, setSpecs] = useState('');
  const [stock, setStock] = useState<number>(20);
  const [category, setCategory] = useState('');
  
  // Multiple Product Images
  const [images, setImages] = useState<string[]>([]);
  // Multiple Customer Review / Proof Images
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isUploadingReviews, setIsUploadingReviews] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const productFileInputRef = useRef<HTMLInputElement>(null);
  const reviewFileInputRef = useRef<HTMLInputElement>(null);

  const openAddModal = () => {
    setEditingProduct(null);
    setName('');
    setPricingMode('tiered');
    setSinglePrice(500);
    setSingleMinPrice(450);
    setPricingTiers([
      { quantity: 1, price: 500, minPrice: 450, label: '১ পিস (ট্রায়াল)' },
      { quantity: 2, price: 800, minPrice: 750, label: '২ পিস কম্বো (৳২০০ সেভ)' },
      { quantity: 3, price: 1000, minPrice: 950, label: '৩ পিস মেগা বান্ডেল (৳৫০০ সেভ)' }
    ]);
    setDescription('');
    setSpecs('');
    setStock(25);
    setCategory('জেনারেল');
    setImages([]);
    setReviewImages([]);
    setIsModalOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setName(prod.name);
    
    if (prod.pricingTiers && prod.pricingTiers.length > 0) {
      setPricingMode('tiered');
      setPricingTiers(prod.pricingTiers);
      const tier1 = prod.pricingTiers.find(t => t.quantity === 1) || prod.pricingTiers[0];
      setSinglePrice(tier1.price);
      setSingleMinPrice(tier1.minPrice);
    } else {
      setPricingMode('single');
      setSinglePrice(prod.price);
      setSingleMinPrice(prod.minPrice || prod.price);
      setPricingTiers([
        { quantity: 1, price: prod.price, minPrice: prod.minPrice || prod.price, label: '১ পিস' }
      ]);
    }

    setDescription(prod.description || '');
    setSpecs(prod.specs || '');
    setStock(prod.stock || 10);
    setCategory(prod.category || '');
    setImages(prod.images || []);
    setReviewImages(prod.reviewImages || []);
    setIsModalOpen(true);
  };

  // Quick Preset Generator for Tiered Pricing
  const applyQuickTiersPreset = (base: number) => {
    const validBase = base > 0 ? base : 500;
    const tier1Price = validBase;
    const tier1Min = Math.round(validBase * 0.9);

    const tier2Price = Math.round(validBase * 1.6); // e.g. 500*1.6 = 800
    const tier2Min = Math.round(tier2Price * 0.92);

    const tier3Price = Math.round(validBase * 2.0); // e.g. 500*2 = 1000
    const tier3Min = Math.round(tier3Price * 0.94);

    setPricingTiers([
      { 
        quantity: 1, 
        price: tier1Price, 
        minPrice: tier1Min, 
        label: `১ পিস` 
      },
      { 
        quantity: 2, 
        price: tier2Price, 
        minPrice: tier2Min, 
        label: `২ পিস কম্বো (৳${tier1Price * 2 - tier2Price} সেভ)` 
      },
      { 
        quantity: 3, 
        price: tier3Price, 
        minPrice: tier3Min, 
        label: `৩ পিস মেগা অফার (৳${tier1Price * 3 - tier3Price} সেভ)` 
      }
    ]);
  };

  const handleAddTier = () => {
    const nextQty = pricingTiers.length > 0 
      ? Math.max(...pricingTiers.map(t => t.quantity)) + 1 
      : 1;
    const lastTier = pricingTiers[pricingTiers.length - 1];
    const estimatedPrice = lastTier ? Math.round(lastTier.price + (lastTier.price / lastTier.quantity) * 0.7) : 500;
    const estimatedMin = Math.round(estimatedPrice * 0.9);

    setPricingTiers([
      ...pricingTiers,
      {
        quantity: nextQty,
        price: estimatedPrice,
        minPrice: estimatedMin,
        label: `${nextQty} পিস প্যাকেজ`
      }
    ]);
  };

  const handleUpdateTier = (index: number, field: keyof ProductTier, value: any) => {
    const updated = [...pricingTiers];
    updated[index] = {
      ...updated[index],
      [field]: field === 'label' ? value : Number(value)
    };
    setPricingTiers(updated);
  };

  const handleRemoveTier = (index: number) => {
    if (pricingTiers.length <= 1) {
      toast.warning('কমপক্ষে একটি প্রাইসিং টায়ার থাকা আবশ্যক');
      return;
    }
    setPricingTiers(pricingTiers.filter((_, i) => i !== index));
  };

  // Image Upload Handlers
  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImages(true);
    try {
      const compressedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await compressImageFile(file, 900, 0.72);
        const hosted = await persistImageDataUrl(dataUrl, business.id, 'product');
        compressedUrls.push(hosted);
      }
      setImages(prev => [...prev, ...compressedUrls]);
      toast.success(`${compressedUrls.length}টি প্রোডাক্ট ছবি সফলভাবে যুক্ত হয়েছে!`);
    } catch (err) {
      console.error(err);
      toast.error('ছবি আপলোড করতে সমস্যা হয়েছে');
    } finally {
      setIsUploadingImages(false);
      if (productFileInputRef.current) productFileInputRef.current.value = '';
    }
  };

  const handleReviewImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingReviews(true);
    try {
      const compressedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await compressImageFile(file, 800, 0.7);
        const hosted = await persistImageDataUrl(dataUrl, business.id, 'review');
        compressedUrls.push(hosted);
      }
      setReviewImages(prev => [...prev, ...compressedUrls]);
      toast.success(`${compressedUrls.length}টি কাস্টমার রিভিউ ছবি সফলভাবে যুক্ত হয়েছে!`);
    } catch (err) {
      console.error(err);
      toast.error('রিভিউ ছবি আপলোড করতে সমস্যা হয়েছে');
    } finally {
      setIsUploadingReviews(false);
      if (reviewFileInputRef.current) reviewFileInputRef.current.value = '';
    }
  };

  const handleSetPrimaryImage = (index: number) => {
    if (index === 0) return;
    const updated = [...images];
    const [selected] = updated.splice(index, 1);
    updated.unshift(selected);
    setImages(updated);
    toast.info('প্রধান ছবি নির্ধারণ করা হয়েছে');
  };

  const handleRemoveProductImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleRemoveReviewImage = (index: number) => {
    setReviewImages(reviewImages.filter((_, i) => i !== index));
  };

  const handleSaveProduct = async () => {
    if (!name.trim()) {
      toast.error('প্রোডাক্টের নাম লিখুন');
      return;
    }

    let finalPrice = singlePrice;
    let finalMinPrice = singleMinPrice;
    let finalTiers: ProductTier[] = [];

    if (pricingMode === 'tiered') {
      if (pricingTiers.length === 0) {
        toast.error('কমপক্ষে একটি প্রাইসিং টায়ার যুক্ত করুন');
        return;
      }

      // Validate each tier
      for (const tier of pricingTiers) {
        if (!tier.price || tier.price <= 0) {
          toast.error(`কোয়ান্টিটি ${tier.quantity} এর জন্য সঠিক বিক্রয় মূল্য দিন`);
          return;
        }
        if (tier.minPrice > tier.price) {
          toast.error(`কোয়ান্টিটি ${tier.quantity} এর জন্য Min Price (${tier.minPrice}৳) বিক্রয় মূল্যের (${tier.price}৳) চেয়ে বেশি হতে পারে না`);
          return;
        }
      }

      // Sort tiers by quantity ascending
      finalTiers = [...pricingTiers].sort((a, b) => a.quantity - b.quantity);
      
      const tier1 = finalTiers.find(t => t.quantity === 1) || finalTiers[0];
      finalPrice = tier1.price;
      finalMinPrice = tier1.minPrice;
    } else {
      if (singlePrice <= 0) {
        toast.error('রেগুলার মূল্য সঠিকভাবে দিন');
        return;
      }
      if (singleMinPrice > singlePrice) {
        toast.error('সর্বনিম্ন মূল্য (Min Price) কখনোই রেগুলার মূল্যের চেয়ে বেশি হতে পারে না');
        return;
      }
      finalPrice = singlePrice;
      finalMinPrice = singleMinPrice > 0 ? singleMinPrice : singlePrice;
      finalTiers = [{ quantity: 1, price: finalPrice, minPrice: finalMinPrice, label: '১ পিস' }];
    }

    setIsSubmitting(true);
    try {
      const currentProducts = business.products || [];
      let updatedProducts: Product[];

      // Re-host any leftover data-URLs so the business document stays under Firestore's 1MB cap.
      const hostedImages: string[] = [];
      for (const img of images) {
        hostedImages.push(await persistImageDataUrl(img, business.id, 'product'));
      }
      const hostedReviews: string[] = [];
      for (const img of reviewImages) {
        hostedReviews.push(await persistImageDataUrl(img, business.id, 'review'));
      }

      const productPayload: Product = {
        id: editingProduct ? editingProduct.id : `prod-${Date.now()}`,
        name,
        price: Number(finalPrice),
        minPrice: Number(finalMinPrice),
        pricingTiers: finalTiers,
        description,
        specs,
        stock: Number(stock),
        category: category.trim() || 'জেনারেল',
        images: hostedImages,
        reviewImages: hostedReviews,
        isAvailable: true
      };

      if (editingProduct) {
        updatedProducts = currentProducts.map(p => p.id === editingProduct.id ? productPayload : p);
      } else {
        updatedProducts = [...currentProducts, productPayload];
      }

      const cleanedProducts = cleanFirestoreData(updatedProducts);

      await updateDoc(doc(db, 'businesses', business.id), {
        products: cleanedProducts
      });

      toast.success(editingProduct ? 'প্রোডাক্ট সফলভাবে আপডেট হয়েছে!' : 'নতুন প্রোডাক্ট সফলভাবে যুক্ত হয়েছে!', {
        description: pricingMode === 'tiered' 
          ? `এআই এখন ১, ২, ৩ পিস বান্ডেল অফার এবং দরদামের সময় Min Price সীমার মধ্যে স্মার্টলি বিক্রয় করবে।`
          : `এআই এখন রেগুলার ৳${finalPrice} এবং সর্বনিম্ন ৳${finalMinPrice} সীমার মধ্যে দরদাম করবে।`
      });

      setIsModalOpen(false);
    } catch (e: any) {
      console.error('[Save Product Error]', e);
      toast.error(e?.message ? `সংরক্ষণ ব্যর্থ: ${e.message}` : 'প্রোডাক্ট সংরক্ষণ করতে সমস্যা হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (prodId: string) => {
    if (!window.confirm('আপনি কি নিশ্চিত এই প্রোডাক্টটি মুছে ফেলতে চান?')) return;
    try {
      const updatedProducts = (business.products || []).filter(p => p.id !== prodId);
      const cleanedProducts = cleanFirestoreData(updatedProducts);
      await updateDoc(doc(db, 'businesses', business.id), {
        products: cleanedProducts
      });
      toast.success('প্রোডাক্ট মুছে ফেলা হয়েছে');
    } catch (e: any) {
      console.error('[Delete Product Error]', e);
      toast.error('মুছে ফেলা সম্ভব হয়নি');
    }
  };

  const filteredProducts = (business.products || []).filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white">
              পণ্য ক্যাটালগ ও বান্ডেল প্রাইসিং হাব
            </h2>
            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-none font-bold text-xs">
              ১/২/৩ পিস বান্ডেল + Smart Bargaining
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            ১ পিস, ২ পিস, ৩ পিস কোয়ান্টিটি বান্ডেল প্রাইস, সর্বনিম্ন দরদাম সীমা (Min Price), মাল্টিপল প্রোডাক্ট ছবি এবং কাস্টমার রিভিউ স্ক্রিনশট পরিচালনা করুন।
          </p>
        </div>

        <Button
          id="add-product-btn"
          onClick={openAddModal}
          className="bg-linear-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white font-black text-xs rounded-2xl h-11 px-6 shadow-md shadow-orange-600/20 active:scale-95 transition-all shrink-0 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন প্রোডাক্ট যোগ করুন</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <Input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="পণ্যের নাম, ক্যাটাগরি বা বিবরণ দিয়ে খুঁজুন..."
          className="pl-9 h-11 rounded-2xl bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 text-xs"
        />
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/60 flex items-center justify-center text-orange-600 mx-auto">
            <Tag className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-black text-base text-zinc-900 dark:text-zinc-100">কোনো প্রোডাক্ট পাওয়া যায়নি</h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto mt-1">
              আপনার স্টোরে ১ পিস, ২ পিস, ৩ পিস অফার, ছবি এবং কাস্টমার রিভিউ যুক্ত করুন যেন এআই স্বয়ংক্রিয়ভাবে মেসেঞ্জারে বান্ডেল ডিল অফার করে বেশি সেল আনতে পারে।
            </p>
          </div>
          <Button
            onClick={openAddModal}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl px-5 h-10"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            প্রথম প্রোডাক্ট যুক্ত করুন
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((prod) => {
            const hasTiers = prod.pricingTiers && prod.pricingTiers.length > 0;
            const primaryImage = prod.images && prod.images.length > 0 ? prod.images[0] : null;
            const totalImages = prod.images?.length || 0;
            const totalReviews = prod.reviewImages?.length || 0;

            return (
              <div
                key={prod.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-xs hover:border-orange-300 dark:hover:border-orange-900 transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Product Primary Image & Badges */}
                  <div className="h-52 bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
                    {primaryImage ? (
                      <img
                        src={primaryImage}
                        alt={prod.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 gap-2 bg-linear-to-b from-zinc-50 to-zinc-100 dark:from-zinc-800/80 dark:to-zinc-900">
                        <ImageIcon className="w-9 h-9 opacity-40" />
                        <span className="text-[11px] font-bold text-zinc-400">ছবি যুক্ত করা নেই</span>
                      </div>
                    )}

                    {/* Stock Tag */}
                    <div className="absolute top-3 right-3 bg-zinc-950/80 backdrop-blur-md text-white px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold flex items-center gap-1 shadow-sm">
                      <PackageCheck className="w-3 h-3 text-emerald-400" />
                      স্টক: {prod.stock || 0} টি
                    </div>

                    {/* Category Tag */}
                    {prod.category && (
                      <div className="absolute bottom-3 left-3 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md text-zinc-800 dark:text-zinc-200 px-2.5 py-1 rounded-xl text-[10px] font-bold shadow-xs border border-zinc-200/60 dark:border-zinc-700">
                        {prod.category}
                      </div>
                    )}

                    {/* Image Counts Overlay */}
                    <div className="absolute top-3 left-3 flex gap-1.5">
                      {totalImages > 1 && (
                        <span className="bg-zinc-950/80 backdrop-blur-md text-white px-2 py-0.5 rounded-lg text-[10px] font-mono flex items-center gap-1">
                          <ImageIcon className="w-2.5 h-2.5 text-orange-400" />
                          {totalImages} ছবি
                        </span>
                      )}
                      {totalReviews > 0 && (
                        <span className="bg-amber-950/90 border border-amber-800/80 text-amber-300 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1">
                          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                          {totalReviews} রিভিউ
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info & Content */}
                  <div className="p-5 space-y-3.5">
                    <div>
                      <h3 className="font-black text-base text-zinc-900 dark:text-white line-clamp-1">
                        {prod.name}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed mt-1">
                        {prod.description || 'কোনো বিবরণ দেওয়া নেই।'}
                      </p>
                    </div>

                    {/* Quantity Tiered Pricing Matrix / Single Pricing */}
                    <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl space-y-2 border border-zinc-200/60 dark:border-zinc-800">
                      <div className="flex items-center justify-between text-[11px] pb-1.5 border-b border-zinc-200/80 dark:border-zinc-700/60 font-bold text-zinc-700 dark:text-zinc-300">
                        <span className="flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5 text-orange-500" />
                          প্যাকেজ / প্রাইসিং অফার
                        </span>
                        <span className="text-orange-600 dark:text-orange-400 flex items-center gap-1 text-[10px]">
                          <Lock className="w-2.5 h-2.5" />
                          Min Bargain Lock
                        </span>
                      </div>

                      {hasTiers ? (
                        <div className="space-y-1.5">
                          {prod.pricingTiers?.map((tier, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs py-1 px-2 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/80"
                            >
                              <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                <Badge className="bg-orange-50 dark:bg-orange-950/80 text-orange-700 dark:text-orange-400 border border-orange-200/60 dark:border-orange-800/60 text-[10px] px-1.5 py-0 font-bold truncate max-w-[140px]">
                                  {tier.label || `${tier.quantity} পিস`}
                                </Badge>
                                <span className="text-[11px] font-bold text-zinc-900 dark:text-white shrink-0">
                                  ৳{tier.price.toLocaleString()}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className="text-zinc-400">Min:</span>
                                <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                                  ৳{tier.minPrice.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-500 font-medium">রেগুলার মূল্য:</span>
                            <span className="font-bold text-zinc-900 dark:text-white">৳ {prod.price.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs pt-1 border-t border-zinc-200/60 dark:border-zinc-700/60">
                            <span className="text-orange-600 dark:text-orange-400 font-bold flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              Min Price (দরদাম সীমা):
                            </span>
                            <span className="font-black text-orange-600 dark:text-orange-400">
                              ৳ {(prod.minPrice || prod.price).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/20">
                  <div className="text-[11px] text-zinc-400 font-medium">
                    {totalImages} ছবি • {totalReviews} রিভিউ প্রুফ
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(prod)}
                      className="rounded-xl h-8 px-3 text-xs font-bold border-zinc-200 dark:border-zinc-700 hover:border-orange-500/50"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1" />
                      এডিট
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteProduct(prod.id)}
                      className="rounded-xl h-8 px-2.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Comprehensive Add / Edit Product Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl p-6 space-y-5">
          <DialogHeader className="pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-zinc-900 dark:text-white">
                  {editingProduct ? 'প্রোডাক্ট ও প্রাইসিং এডিট করুন' : 'নতুন প্রোডাক্ট ও বান্ডেল প্রাইসিং যুক্ত করুন'}
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500">
                  ১ পিস, ২ পিস, ৩ পিস বান্ডেল অফার, দরদাম সীমা (Min Price), ছবি এবং কাস্টমার রিভিউ আপলোড করুন।
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-1 text-xs">
            {/* 1. Basic Product Info */}
            <div className="space-y-3">
              <h4 className="font-black text-xs text-zinc-900 dark:text-white flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-orange-500" />
                ১. সাধারণ পণ্যের বিবরণ
              </h4>

              <div className="space-y-1.5">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                  পণ্যের নাম (Product Name) *
                </label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="যেমন: প্রিমিয়াম কটন পাঞ্জাবি / অরজিনাল ওয়্যারলেস এয়ারবাডস"
                  className="h-11 rounded-2xl text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">ক্যাটাগরি</label>
                  <Input
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="যেমন: ফ্যাশন, গ্যাজেট, বিউটি"
                    className="h-10 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">স্টক পরিমাণ (In Stock Quantity)</label>
                  <Input
                    type="number"
                    value={stock || ''}
                    onChange={e => setStock(Number(e.target.value))}
                    placeholder="যেমন: 50"
                    className="h-10 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">পণ্যের বিবরণ (Description / Highlights)</label>
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="পণ্যের ফেব্রিক, কালার, কোয়ালিটি, গ্যারান্টি বা বিশেষ অফারের বিবরণ..."
                  className="rounded-2xl min-h-[75px] text-xs"
                />
              </div>
            </div>

            {/* 2. Multi-tier Quantity Pricing & Minimum Bargaining Price Engine */}
            <div className="p-4 rounded-3xl bg-linear-to-b from-orange-50/50 via-zinc-50 to-zinc-50 dark:from-orange-950/20 dark:via-zinc-800/40 dark:to-zinc-800/40 border border-orange-200/80 dark:border-orange-900/60 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-orange-200/60 dark:border-zinc-700">
                <div>
                  <h4 className="font-black text-xs text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-orange-500" />
                    ২. প্রাইসিং ও ১/২/৩ পিস কোয়ান্টিটি বান্ডেল অফার
                  </h4>
                  <p className="text-[11px] text-zinc-500">
                    ১ পিস, ২ পিস, ৩ পিস অনুসারে দাম এবং এআই দরদামের সর্বনিম্ন সীমা (Min Price) নির্ধারণ করুন
                  </p>
                </div>

                {/* Pricing Mode Switcher */}
                <div className="flex bg-white dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <button
                    type="button"
                    onClick={() => setPricingMode('tiered')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      pricingMode === 'tiered'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                    }`}
                  >
                    ১/২/৩ পিস বান্ডেল
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingMode('single')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      pricingMode === 'single'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                    }`}
                  >
                    একক ফিক্সড প্রাইস
                  </button>
                </div>
              </div>

              {pricingMode === 'tiered' ? (
                <div className="space-y-3">
                  {/* Preset quick generator */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-zinc-500">⚡ কুইক বান্ডেল প্রি-সেট:</span>
                    <button
                      type="button"
                      onClick={() => applyQuickTiersPreset(500)}
                      className="px-2.5 py-1 rounded-lg bg-orange-100 hover:bg-orange-200 dark:bg-orange-950/80 dark:hover:bg-orange-900 text-orange-800 dark:text-orange-300 font-bold text-[11px] border border-orange-300 dark:border-orange-800"
                    >
                      ১ পিস ৫০০, ২ পিস ৮০০, ৩ পিস ১০০০
                    </button>
                    <button
                      type="button"
                      onClick={() => applyQuickTiersPreset(1000)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-[11px] border border-zinc-300 dark:border-zinc-600"
                    >
                      ১ পিস ১০০০, ২ পিস ১৬০০, ৩ পিস ২০০০
                    </button>
                  </div>

                  {/* Tiers List */}
                  <div className="space-y-3">
                    {pricingTiers.map((tier, idx) => {
                      const perPiece = tier.quantity > 0 ? Math.round(tier.price / tier.quantity) : tier.price;
                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 space-y-3 shadow-xs"
                        >
                          {/* Top Row: Tier Number, Dynamic Heading Preview & Per Piece badge */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-orange-600 text-white font-bold text-xs px-2.5 py-0.5 rounded-lg">
                                প্যাকেজ #{idx + 1}
                              </Badge>
                              <span className="font-bold text-xs text-zinc-900 dark:text-white">
                                {tier.label || `${tier.quantity} পিস প্যাকেজ`}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                প্রতি পিস ৳{perPiece}
                              </span>
                              {pricingTiers.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTier(idx)}
                                  className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                  title="টায়ার মুছুন"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Editable Package Heading / Title */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                              <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                                <Edit3 className="w-3 h-3" />
                                প্যাকেজের হেডিং / টাইটেল (সম্পূর্ণ পরিবর্তনযোগ্য) *
                              </span>
                              <span className="text-[10px] text-zinc-400 font-normal">যেমন: ১ পিস ট্রায়াল / ২ পিস স্পেশাল কম্বো / ৩ পিস মেগা অফার</span>
                            </label>
                            <Input
                              value={tier.label || ''}
                              onChange={e => handleUpdateTier(idx, 'label', e.target.value)}
                              placeholder={`যেমন: ${tier.quantity} পিস স্পেশাল কম্বো / মেগা বান্ডেল`}
                              className="h-10 rounded-xl text-xs font-semibold bg-zinc-50/60 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700"
                            />
                          </div>

                          {/* Quantity, Price, Min Bargain Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">কোয়ান্টিটি (পিস) *</label>
                              <Input
                                type="number"
                                min="1"
                                value={tier.quantity || ''}
                                onChange={e => handleUpdateTier(idx, 'quantity', e.target.value)}
                                className="h-10 rounded-xl font-bold text-xs"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">বিক্রয় মূল্য (৳) *</label>
                              <Input
                                type="number"
                                min="1"
                                value={tier.price || ''}
                                onChange={e => handleUpdateTier(idx, 'price', e.target.value)}
                                placeholder="যেমন: 800"
                                className="h-10 rounded-xl font-bold text-xs"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                সর্বনিম্ন দরদাম সীমা / Min Price (৳) *
                              </label>
                              <Input
                                type="number"
                                min="1"
                                value={tier.minPrice || ''}
                                onChange={e => handleUpdateTier(idx, 'minPrice', e.target.value)}
                                placeholder="যেমন: 750"
                                className="h-10 rounded-xl font-black text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-800 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddTier}
                    className="w-full h-10 rounded-2xl border-dashed border-orange-300 dark:border-orange-800 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    আরেকটি কোয়ান্টিটি টায়ার যোগ করুন
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">রেগুলার বিক্রয় মূল্য (৳) *</label>
                    <Input
                      type="number"
                      value={singlePrice || ''}
                      onChange={e => setSinglePrice(Number(e.target.value))}
                      placeholder="যেমন: 1500"
                      className="h-10 rounded-xl font-bold text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      সর্বনিম্ন সীমা / Min Price (৳) *
                    </label>
                    <Input
                      type="number"
                      value={singleMinPrice || ''}
                      onChange={e => setSingleMinPrice(Number(e.target.value))}
                      placeholder="যেমন: 1350"
                      className="h-10 rounded-xl font-black text-orange-600 border-orange-300 dark:border-orange-800 text-xs"
                    />
                    <p className="text-[10px] text-zinc-500">
                      কাস্টমার যতই দরদাম করুক, এআই এই মূল্যের নিচে কোনোভাবেই নামবে না।
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Multiple Product Images Upload Section (No simple text URL input) */}
            <div className="space-y-3 p-4 rounded-3xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-black text-xs text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-orange-500" />
                    ৩. মাল্টিপল প্রোডাক্ট ছবি আপলোড (Product Images)
                  </h4>
                  <p className="text-[11px] text-zinc-500">
                    কম্পিউটার বা মোবাইল থেকে সরাসরি একাধিক পণ্যের ছবি আপলোড করুন
                  </p>
                </div>

                <Badge variant="outline" className="text-[11px] font-mono self-start sm:self-auto font-bold">
                  {images.length} টি ছবি যুক্ত হয়েছে
                </Badge>
              </div>

              {/* Upload Dropzone / Button */}
              <div>
                <input
                  ref={productFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleProductImageUpload}
                  className="hidden"
                />
                
                <button
                  type="button"
                  disabled={isUploadingImages}
                  onClick={() => productFileInputRef.current?.click()}
                  className="w-full py-5 px-4 border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-orange-500 dark:hover:border-orange-500 rounded-2xl bg-white dark:bg-zinc-900 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
                >
                  <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <span className="font-bold text-xs text-zinc-800 dark:text-zinc-200">
                      {isUploadingImages ? 'ছবি প্রসেস ও আপলোড হচ্ছে...' : 'ক্লিক করে প্রোডাক্টের ছবিগুলো আপলোড করুন'}
                    </span>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      JPG, PNG, WEBP ফরম্যাট সাপোর্টেড (একসাথে একাধিক ছবি সিলেক্ট করতে পারেন)
                    </p>
                  </div>
                </button>
              </div>

              {/* Uploaded Images Gallery Grid */}
              {images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  {images.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 aspect-square group bg-zinc-100 dark:bg-zinc-800"
                    >
                      <img
                        src={imgUrl}
                        alt={`Product preview ${idx + 1}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />

                      {/* Primary Cover Badge */}
                      {idx === 0 && (
                        <div className="absolute top-2 left-2 bg-orange-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md shadow-md flex items-center gap-1">
                          <Star className="w-2.5 h-2.5 fill-white" />
                          প্রধান ছবি
                        </div>
                      )}

                      {/* Hover Overlay Actions */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
                        {idx !== 0 && (
                          <button
                            type="button"
                            onClick={() => handleSetPrimaryImage(idx)}
                            className="bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-bold px-2 py-1 rounded-lg w-full"
                          >
                            প্রধান ছবি বানান
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveProductImage(idx)}
                          className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold px-2 py-1 rounded-lg w-full flex items-center justify-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          মুছে ফেলুন
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Multiple Customer Review & Proof Photos Section (Under Product Images) */}
            <div className="space-y-3 p-4 rounded-3xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-black text-xs text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <MessageSquareHeart className="w-4 h-4 text-amber-500" />
                    ৪. কাস্টমার রিভিউ ও প্রুফ ছবি (Customer Reviews & Feedback Photos)
                  </h4>
                  <p className="text-[11px] text-zinc-500">
                    গ্রাহকদের চ্যাট রিভিউ স্ক্রিনশট, আনবক্সিং ফটো বা ডেলিভারি প্রুফ আপলোড করুন। কাস্টমার রিভিউ চাইলে এআই এগুলো পাঠাবে।
                  </p>
                </div>

                <Badge variant="outline" className="text-[11px] font-mono self-start sm:self-auto font-bold border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                  {reviewImages.length} টি রিভিউ প্রুফ
                </Badge>
              </div>

              {/* Review Upload Button */}
              <div>
                <input
                  ref={reviewFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleReviewImageUpload}
                  className="hidden"
                />
                
                <button
                  type="button"
                  disabled={isUploadingReviews}
                  onClick={() => reviewFileInputRef.current?.click()}
                  className="w-full py-4 px-4 border-2 border-dashed border-amber-300 dark:border-amber-800 hover:border-amber-500 rounded-2xl bg-white dark:bg-zinc-900 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 flex items-center justify-center">
                    <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                  </div>
                  <span className="font-bold text-xs text-zinc-800 dark:text-zinc-200">
                    {isUploadingReviews ? 'রিভিউ ছবি আপলোড হচ্ছে...' : 'কাস্টমার রিভিউ স্ক্রিনশট ও প্রুফ ছবি আপলোড করুন'}
                  </span>
                </button>
              </div>

              {/* Uploaded Review Images Grid */}
              {reviewImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  {reviewImages.map((revUrl, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-2xl overflow-hidden border border-amber-200 dark:border-amber-900 aspect-square group bg-zinc-100 dark:bg-zinc-800"
                    >
                      <img
                        src={revUrl}
                        alt={`Review proof ${idx + 1}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />

                      <div className="absolute top-2 left-2 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        রিভিউ #{idx + 1}
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveReviewImage(idx)}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md hover:bg-rose-700 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="rounded-2xl text-xs font-bold h-11 px-5"
            >
              বাতিল
            </Button>
            <Button
              onClick={handleSaveProduct}
              disabled={isSubmitting || isUploadingImages || isUploadingReviews}
              className="bg-linear-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white rounded-2xl text-xs font-black px-6 h-11 shadow-md shadow-orange-600/20"
            >
              {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : (editingProduct ? 'আপডেট সেভ করুন' : 'প্রোডাক্ট সংরক্ষণ করুন')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

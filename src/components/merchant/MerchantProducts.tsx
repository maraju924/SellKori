import React, { useState } from 'react';
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
  Search
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
import { BusinessConfig, Product } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface MerchantProductsProps {
  business: BusinessConfig;
}

export function MerchantProducts({ business }: MerchantProductsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [minPrice, setMinPrice] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [specs, setSpecs] = useState('');
  const [stock, setStock] = useState<number>(10);
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openAddModal = () => {
    setEditingProduct(null);
    setName('');
    setPrice(0);
    setMinPrice(0);
    setDescription('');
    setSpecs('');
    setStock(10);
    setCategory('');
    setImageUrl('');
    setIsModalOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setName(prod.name);
    setPrice(prod.price);
    setMinPrice(prod.minPrice || prod.price);
    setDescription(prod.description || '');
    setSpecs(prod.specs || '');
    setStock(prod.stock || 10);
    setCategory(prod.category || '');
    setImageUrl(prod.images?.[0] || '');
    setIsModalOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!name.trim() || price <= 0) {
      toast.error('প্রোডাক্টের নাম এবং রেগুলার মূল্য সঠিক দিন');
      return;
    }

    if (minPrice > price) {
      toast.error('সর্বনিম্ন মূল্য (Min Price) কখনোই রেগুলার মূল্যের চেয়ে বেশি হতে পারে না');
      return;
    }

    setIsSubmitting(true);
    try {
      const currentProducts = business.products || [];
      let updatedProducts: Product[];

      const productPayload: Product = {
        id: editingProduct ? editingProduct.id : `prod-${Date.now()}`,
        name,
        price: Number(price),
        minPrice: minPrice > 0 ? Number(minPrice) : Number(price),
        description,
        specs,
        stock: Number(stock),
        category,
        images: imageUrl ? [imageUrl] : editingProduct?.images || [],
        isAvailable: true
      };

      if (editingProduct) {
        updatedProducts = currentProducts.map(p => p.id === editingProduct.id ? productPayload : p);
      } else {
        updatedProducts = [...currentProducts, productPayload];
      }

      await updateDoc(doc(db, 'businesses', business.id), {
        products: updatedProducts
      });

      toast.success(editingProduct ? 'প্রোডাক্ট আপডেট হয়েছে!' : 'নতুন প্রোডাক্ট যুক্ত হয়েছে!', {
        description: `এআই এখন এই প্রোডাক্টের সাথে সর্বোচ্চ ৳${minPrice || price} পর্যন্ত দরদাম করতে পারবে।`
      });

      setIsModalOpen(false);
    } catch (e) {
      toast.error('প্রোডাক্ট সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (prodId: string) => {
    try {
      const updatedProducts = (business.products || []).filter(p => p.id !== prodId);
      await updateDoc(doc(db, 'businesses', business.id), {
        products: updatedProducts
      });
      toast.success('প্রোডাক্ট মুছে ফেলা হয়েছে');
    } catch (e) {
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
      {/* Header Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white">
              পণ্য ক্যাটালগ ও দরদামের সীমা (Min Price)
            </h2>
            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-none font-bold text-xs">
              Smart Bargaining Lock
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            প্রতিটি পণ্যের রেগুলার মূল্য এবং সর্বনিম্ন বিক্রয়যোগ্য মূল্য (Min Price) সেট করুন। এআই কখনোই Min Price এর নিচে নামবে না।
          </p>
        </div>

        <Button
          onClick={openAddModal}
          className="bg-linear-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white font-bold text-xs rounded-2xl h-11 px-5 shadow-md shadow-orange-600/20 active:scale-95 transition-transform shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          নতুন প্রোডাক্ট যোগ করুন
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
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-12 text-center space-y-3">
          <Tag className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto" />
          <h3 className="font-black text-sm text-zinc-800 dark:text-zinc-200">কোনো প্রোডাক্ট পাওয়া যায়নি</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            আপনার স্টোরে পণ্য যুক্ত করুন যেন মেসেঞ্জারে বা চ্যাটে এআই কাস্টমারকে ছবি, স্পেক্স এবং দরদামসহ অফার করতে পারে।
          </p>
          <Button
            onClick={openAddModal}
            size="sm"
            className="bg-orange-600 text-white font-bold text-xs rounded-xl"
          >
            প্রথম প্রোডাক্ট যুক্ত করুন
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProducts.map((prod) => (
            <div
              key={prod.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-xs hover:border-orange-200 dark:hover:border-orange-950 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Product Image / Placeholder */}
                <div className="h-44 bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
                  {prod.images && prod.images[0] ? (
                    <img
                      src={prod.images[0]}
                      alt={prod.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 gap-2">
                      <ImageIcon className="w-8 h-8" />
                      <span className="text-[11px] font-bold">ছবি যুক্ত করা নেই</span>
                    </div>
                  )}

                  <div className="absolute top-3 right-3 bg-zinc-950/80 backdrop-blur-xs text-white px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold">
                    স্টক: {prod.stock || 0} টি
                  </div>

                  {prod.category && (
                    <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xs text-zinc-800 dark:text-zinc-200 px-2.5 py-0.5 rounded-lg text-[10px] font-bold">
                      {prod.category}
                    </div>
                  )}
                </div>

                {/* Info Content */}
                <div className="p-5 space-y-3">
                  <h3 className="font-black text-sm text-zinc-900 dark:text-white line-clamp-1">
                    {prod.name}
                  </h3>
                  <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                    {prod.description || 'কোনো বিবরণ দেওয়া নেই।'}
                  </p>

                  {/* Pricing and Min Price Guard */}
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl space-y-1.5 border border-zinc-100 dark:border-zinc-800">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500 font-medium">রেগুলার মূল্য:</span>
                      <span className="font-bold text-zinc-900 dark:text-white">৳ {prod.price.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs border-t border-zinc-200 dark:border-zinc-700/60 pt-1.5">
                      <span className="text-orange-600 dark:text-orange-400 font-bold flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Min Price (দরদাম সীমা):
                      </span>
                      <span className="font-black text-orange-600 dark:text-orange-400">
                        ৳ {(prod.minPrice || prod.price).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditModal(prod)}
                  className="rounded-xl h-8 px-3 text-xs font-bold border-zinc-200 dark:border-zinc-700"
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
          ))}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">
              {editingProduct ? 'প্রোডাক্ট এডিট করুন' : 'নতুন প্রোডাক্ট যুক্ত করুন'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              পণ্যের সঠিক মূল্য ও সর্বনিম্ন সীমা দিন যেন এআই সঠিক তথ্য দিয়ে বিক্রয় করতে পারে।
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">পণ্যের নাম *</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="যেমন: প্রিমিয়াম কটন পাঞ্জাবি"
                className="h-10 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">রেগুলার প্রাইস (৳) *</label>
                <Input
                  type="number"
                  value={price || ''}
                  onChange={e => setPrice(Number(e.target.value))}
                  placeholder="যেমন: 1500"
                  className="h-10 rounded-xl font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  সর্বনিম্ন সীমা / Min Price (৳) *
                </label>
                <Input
                  type="number"
                  value={minPrice || ''}
                  onChange={e => setMinPrice(Number(e.target.value))}
                  placeholder="যেমন: 1350"
                  className="h-10 rounded-xl font-black text-orange-600 border-orange-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">স্টক পরিমাণ</label>
                <Input
                  type="number"
                  value={stock || ''}
                  onChange={e => setStock(Number(e.target.value))}
                  placeholder="যেমন: 25"
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">ক্যাটাগরি</label>
                <Input
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  placeholder="যেমন: ফ্যাশন / ক্লথিং"
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">ছবির লিংক (Image URL)</label>
              <Input
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">পণ্যের বিবরণ (Description)</label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="ফ্যাব্রিক, কোয়ালিটি, সাইজ এবং বিশেষত্ব..."
                className="rounded-xl min-h-[70px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl text-xs font-bold"
            >
              বাতিল
            </Button>
            <Button
              onClick={handleSaveProduct}
              disabled={isSubmitting}
              className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black px-5"
            >
              {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

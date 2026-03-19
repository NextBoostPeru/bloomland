import { useState, useEffect } from 'react';
import { Search, Filter, Loader, ShoppingCart, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar';
import ProductCard from '../components/pos/ProductCard';
import CartSidebar from '../components/pos/CartSidebar';
import CheckoutModal from '../components/pos/CheckoutModal';
import api from '../services/api';

const POS = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [cart, setCart] = useState([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Load Products
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const query = search ? `?search=${search}` : '';
        const res = await api.get(`/productos${query}`);
        setProducts(res.data);
      } catch (error) {
        console.error("Error loading products", error);
        toast.error('Error al cargar productos');
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchProducts, 500);
    return () => clearTimeout(debounce);
  }, [search]);

  // Cart Logic
  const addToCart = (product) => {
    const stock = product.stock_quantity || product.stock || 0;
    const price = parseFloat(product.price_pen || product.price || 0);

    if (stock <= 0) {
        toast.error('Producto agotado');
        return;
    }

    setCart(prev => {
        const existing = prev.find(item => item.id === product.id);
        if (existing) {
            if (existing.quantity >= stock) {
                toast.error('No hay más stock disponible');
                return prev;
            }
            return prev.map(item => 
                item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
            );
        }
        setIsCartOpen(true); // Open cart when adding item
        return [...prev, { ...product, price: price, stock: stock, quantity: 1 }];
    });
    toast.success('Producto agregado', { duration: 1500, icon: '🛒' });
  };

  const updateQuantity = (id, newQty) => {
    if (newQty < 1) return;
    setCart(prev => prev.map(item => 
        item.id === id ? { ...item, quantity: newQty } : item
    ));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    if(confirm('¿Estás seguro de vaciar el carrito?')) {
        setCart([]);
    }
  };

  const handleCheckoutSuccess = () => {
    setCart([]);
    setIsCartOpen(false);
    // Reload products to update stock
    setSearch(prev => prev + ' '); 
  };

  // Calculate Total
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar />

      {/* Main Content (Product Grid) */}
      <div 
        className={`flex-1 flex flex-col h-full transition-all duration-300 ease-in-out ${isCartOpen ? 'mr-96' : 'mr-0'}`} 
        style={{ marginLeft: 'var(--sidebar-width)' }}
      >
        {/* Header Bar */}
        <header className="bg-white px-8 py-5 border-b border-slate-200 shadow-sm flex justify-between items-center z-20 sticky top-0">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Punto de Venta</h1>
                <p className="text-sm text-slate-500 font-medium">Seleccione productos para la venta</p>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="relative w-80 group">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre o SKU..." 
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-transparent focus:bg-white border focus:border-indigo-500 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                
                <button 
                  onClick={() => setIsCartOpen(!isCartOpen)}
                  className={`relative p-2.5 rounded-xl border transition-all flex items-center gap-2 ${
                    isCartOpen 
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                    <ShoppingCart className="w-5 h-5" />
                    <span className="font-semibold text-sm hidden sm:inline">Carrito</span>
                    {totalItems > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm border-2 border-white">
                        {totalItems}
                      </span>
                    )}
                </button>
            </div>
        </header>

        {/* Product Grid */}
        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/50">
            {loading ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <Loader className="w-10 h-10 animate-spin mb-3 text-indigo-500" />
                    <p className="font-medium">Cargando catálogo...</p>
                </div>
            ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <Search className="w-16 h-16 mb-4 stroke-1 opacity-50" />
                    <p className="text-lg font-medium text-slate-600">No se encontraron productos</p>
                    <p className="text-sm">Intenta buscar con otro término</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 pb-20">
                    {products.map(product => (
                        <ProductCard 
                            key={product.id} 
                            product={product} 
                            onAdd={addToCart} 
                        />
                    ))}
                </div>
            )}
        </main>
      </div>

      {/* Right Sidebar (Cart) */}
      <CartSidebar 
        cart={cart}
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onUpdateQuantity={updateQuantity}
        onRemove={removeFromCart}
        onClear={clearCart}
        onCheckout={() => setIsCheckoutOpen(true)}
      />

      {/* Checkout Modal */}
      <CheckoutModal 
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        total={total}
        cart={cart}
        onProcessSale={handleCheckoutSuccess}
      />
    </div>
  );
};

export default POS;

import { Trash2, Minus, Plus, ShoppingCart, X } from 'lucide-react';

const CartSidebar = ({ cart, isOpen, onClose, onUpdateQuantity, onRemove, onClear, onCheckout }) => {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const igv = subtotal * 0.18;
  const total = subtotal; 

  return (
    <div className={`flex flex-col h-full bg-white border-l border-gray-200 shadow-xl w-96 fixed right-0 top-0 bottom-0 z-30 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      {/* Header */}
      <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
        <div className="flex items-center gap-2 text-slate-800">
          <ShoppingCart className="w-5 h-5 text-indigo-600" />
          <h2 className="font-bold text-lg">Carrito Actual</h2>
        </div>
        <div className="flex items-center gap-3">
            <div className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md text-xs font-bold">
            {cart.length} items
            </div>
            <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
            </button>
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3 opacity-60">
            <ShoppingCart className="w-16 h-16 stroke-1" />
            <p className="text-sm">El carrito está vacío</p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.id} className="flex gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex-shrink-0">
                 {item.image_url && <img src={item.image_url} className="w-full h-full object-cover rounded-lg" />}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm text-slate-800 truncate">{item.name}</h4>
                <p className="text-xs text-indigo-600 font-bold mt-0.5">S/ {parseFloat(item.price).toFixed(2)}</p>
              </div>
              
              <div className="flex flex-col items-end gap-2">
                <button 
                  onClick={() => onRemove(item.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                  <button 
                    onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                    className="p-1 hover:bg-white rounded-md transition-colors text-slate-600 disabled:opacity-50"
                    disabled={item.quantity <= 1}
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                  <button 
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    className="p-1 hover:bg-white rounded-md transition-colors text-slate-600 disabled:opacity-50"
                    disabled={item.quantity >= item.stock}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-5 border-t border-gray-100 bg-gray-50 space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span>S/ {(total / 1.18).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>IGV (18%)</span>
            <span>S/ {(total - (total / 1.18)).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-800 font-bold text-xl pt-2 border-t border-gray-200">
            <span>Total</span>
            <span>S/ {total.toFixed(2)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
            <button 
                onClick={onClear}
                className="px-4 py-3 rounded-xl border border-red-200 text-red-500 font-medium text-sm hover:bg-red-50 transition-colors"
                disabled={cart.length === 0}
            >
                Cancelar
            </button>
            <button 
                onClick={onCheckout}
                className="px-4 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={cart.length === 0}
            >
                Cobrar
            </button>
        </div>
      </div>
    </div>
  );
};

export default CartSidebar;

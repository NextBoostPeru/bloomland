import { Plus } from 'lucide-react';

const ProductCard = ({ product, onAdd }) => {
  return (
    <div 
      className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer group"
      onClick={() => onAdd(product)}
    >
      <div className="h-32 bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden relative">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-gray-400 text-xs">Sin imagen</span>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
          <button className="bg-indigo-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all shadow-lg">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <div>
        <h4 className="font-semibold text-slate-800 text-sm leading-tight mb-1 line-clamp-2">{product.name}</h4>
        <p className="text-xs text-gray-400 mb-2">{product.sku}</p>
        <div className="flex justify-between items-center">
          <span className="font-bold text-indigo-600">S/ {parseFloat(product.price_pen || product.price || 0).toFixed(2)}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
            product.stock_quantity > 10 ? 'bg-emerald-50 text-emerald-600' : 
            product.stock_quantity > 0 ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'
          }`}>
            {product.stock_quantity || 0} un.
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;

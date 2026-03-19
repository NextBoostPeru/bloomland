import { useState, useEffect } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import { X, Save, ArrowRight, ArrowLeft, RefreshCw } from 'lucide-react';

const StockModal = ({ isOpen, onClose, product }) => {
  const [formData, setFormData] = useState({
    type: 'IN',
    quantity: '',
    warehouse_id: '',
    notes: ''
  });
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch warehouses
    const fetchWarehouses = async () => {
      try {
        const { data } = await api.get('/warehouses');
        setWarehouses(data);
        if (data.length > 0) {
          setFormData(prev => ({ ...prev, warehouse_id: data[0].id }));
        }
      } catch (error) {
        console.error("Error fetching warehouses", error);
      }
    };
    if (isOpen) fetchWarehouses();
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.warehouse_id) {
      toast.error('Seleccione una sede');
      return;
    }
    
    setLoading(true);
    try {
      const payload = {
        product_id: product.id,
        warehouse_id: formData.warehouse_id,
        type: formData.type === 'SET' ? 'ADJUSTMENT' : formData.type,
        quantity: formData.quantity,
        notes: formData.notes,
        is_absolute: formData.type === 'SET'
      };

      await api.post('/inventory/adjust', payload);
      toast.success('Stock actualizado');
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al actualizar stock');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="font-bold text-xl text-slate-800">Ajuste de Stock</h3>
            <p className="text-sm text-slate-500">{product.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Action Type */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setFormData({...formData, type: 'IN'})}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                formData.type === 'IN' 
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500' 
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <ArrowRight className="mb-1" size={20} />
              <span className="text-xs font-bold">Entrada</span>
            </button>
            <button
              type="button"
              onClick={() => setFormData({...formData, type: 'OUT'})}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                formData.type === 'OUT' 
                  ? 'bg-red-50 border-red-500 text-red-700 ring-1 ring-red-500' 
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <ArrowLeft className="mb-1" size={20} />
              <span className="text-xs font-bold">Salida</span>
            </button>
            <button
              type="button"
              onClick={() => setFormData({...formData, type: 'SET'})}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                formData.type === 'SET' 
                  ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500' 
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <RefreshCw className="mb-1" size={20} />
              <span className="text-xs font-bold">Definir</span>
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sede / Almacén</label>
            <select
              required
              value={formData.warehouse_id}
              onChange={(e) => setFormData({...formData, warehouse_id: e.target.value})}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              <option value="">Seleccione una sede</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {formData.type === 'SET' ? 'Nuevo Stock Total' : 'Cantidad'}
            </label>
            <input
              required
              type="number"
              min="1"
              value={formData.quantity}
              onChange={(e) => setFormData({...formData, quantity: e.target.value})}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-bold"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notas / Motivo</label>
            <textarea
              rows="2"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Opcional..."
            ></textarea>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-lg shadow-indigo-200"
            >
              {loading ? 'Procesando...' : 'Confirmar Movimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockModal;

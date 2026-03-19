import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Search, ArrowRight, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const MovementHistory = () => {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/inventory/movements');
      setMovements(data);
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar movimientos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, []);

  const getTypeIcon = (type) => {
    switch (type) {
      case 'IN': return <ArrowRight className="text-emerald-500" />;
      case 'OUT': return <ArrowLeft className="text-red-500" />;
      case 'ADJUSTMENT': return <RefreshCw className="text-blue-500" />;
      default: return <AlertCircle className="text-gray-500" />;
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      'IN': 'Entrada',
      'OUT': 'Salida',
      'TRANSFER_IN': 'Traslado (Entrada)',
      'TRANSFER_OUT': 'Traslado (Salida)',
      'ADJUSTMENT': 'Ajuste',
      'SALE': 'Venta',
      'RETURN': 'Devolución'
    };
    return labels[type] || type;
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Historial de Movimientos</h2>
        <button onClick={fetchMovements} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
          Actualizar
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-y border-slate-200">
              <th className="px-6 py-4">Fecha</th>
              <th className="px-6 py-4">Producto</th>
              <th className="px-6 py-4">Sede</th>
              <th className="px-6 py-4">Tipo</th>
              <th className="px-6 py-4 text-center">Cantidad</th>
              <th className="px-6 py-4 text-center">Stock Resultante</th>
              <th className="px-6 py-4">Usuario</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
               <tr><td colSpan="7" className="text-center py-8">Cargando...</td></tr>
            ) : movements.length === 0 ? (
               <tr><td colSpan="7" className="text-center py-8">No hay movimientos registrados</td></tr>
            ) : (
              movements.map((mov) => (
                <tr key={mov.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(mov.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-800">{mov.product_name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{mov.warehouse_name}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(mov.type)}
                      <span className="text-sm font-medium text-slate-700">{getTypeLabel(mov.type)}</span>
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-center font-bold ${
                    ['IN', 'TRANSFER_IN', 'RETURN'].includes(mov.type) ? 'text-emerald-600' : 
                    ['OUT', 'TRANSFER_OUT', 'SALE'].includes(mov.type) ? 'text-red-600' : 'text-blue-600'
                  }`}>
                    {['IN', 'TRANSFER_IN', 'RETURN'].includes(mov.type) ? '+' : '-'}{mov.quantity}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-slate-600">
                    {mov.new_stock}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {mov.user_email || 'Sistema'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MovementHistory;

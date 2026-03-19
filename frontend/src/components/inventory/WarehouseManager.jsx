import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Plus, MapPin, Edit, Trash } from 'lucide-react';
import toast from 'react-hot-toast';

const WarehouseManager = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [formData, setFormData] = useState({ name: '', address: '' });

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/warehouses');
      setWarehouses(data);
    } catch (error) {
      toast.error('Error al cargar sedes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/warehouses/${editingId}`, formData);
        toast.success('Sede actualizada');
      } else {
        await api.post('/warehouses', formData);
        toast.success('Sede creada');
      }
      handleCloseModal();
      fetchWarehouses();
    } catch (error) {
      toast.error(editingId ? 'Error al actualizar sede' : 'Error al crear sede');
    }
  };

  const handleEdit = (warehouse) => {
    setFormData({ 
      name: warehouse.name, 
      address: warehouse.address || '' 
    });
    setEditingId(warehouse.id);
    setShowModal(true);
  };

  const handleDelete = (warehouse) => {
    setItemToDelete(warehouse);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await api.delete(`/warehouses/${itemToDelete.id}`);
      toast.success('Sede eliminada');
      fetchWarehouses();
      setItemToDelete(null);
    } catch (error) {
      toast.error('Error al eliminar sede');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormData({ name: '', address: '' });
    setEditingId(null);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Gestión de Sedes y Almacenes</h2>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
        >
          <Plus size={18} />
          <span>Nueva Sede</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-8 text-slate-500">Cargando sedes...</div>
        ) : (
          warehouses.map((warehouse) => (
            <div key={warehouse.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm text-indigo-600">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 leading-tight">{warehouse.name}</h3>
                    <p className="text-xs text-slate-500">{warehouse.address || 'Sin dirección registrada'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {Number(warehouse.is_main) === 1 && (
                    <span className="bg-emerald-100 text-emerald-700 text-[11px] px-2 py-0.5 rounded-full font-medium">Principal</span>
                  )}
                  <button 
                    onClick={() => handleEdit(warehouse)} 
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit size={16} />
                  </button>
                  {Number(warehouse.is_main) !== 1 && (
                    <button 
                      onClick={() => handleDelete(warehouse)} 
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
             <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800">{editingId ? 'Editar Sede' : 'Nueva Sede'}</h3>
                <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">&times;</button>
             </div>
             <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                  <input 
                    required
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                  <input 
                    type="text" 
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={handleCloseModal} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Guardar</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-[1px] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200 border border-slate-100">
                <h4 className="text-lg font-bold text-slate-800 mb-2">¿Eliminar sede?</h4>
                <p className="text-slate-600 mb-6">
                    Estás a punto de eliminar <span className="font-semibold text-slate-800">"{itemToDelete.name}"</span>. 
                    Esta acción no se puede deshacer.
                </p>
                <div className="flex justify-end gap-3">
                    <button 
                        onClick={() => setItemToDelete(null)}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={confirmDelete}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-sm shadow-red-200 transition-colors"
                    >
                        Eliminar
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseManager;

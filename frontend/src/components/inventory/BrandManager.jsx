import { useState, useEffect } from 'react';
import api from '../../services/api';
import { Plus, Badge, Edit, Trash, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const BrandManager = () => {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', slug: '' });
  const [saving, setSaving] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const fetchBrands = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/brands');
      setBrands(data);
    } catch (error) {
      toast.error('Error al cargar marcas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  const handleSync = async () => {
    try {
      setSyncing(true);
      await api.post('/brands/sync');
      toast.success('Sincronización completada');
      fetchBrands();
    } catch (error) {
      toast.error('Error al sincronizar con WooCommerce');
    } finally {
      setSyncing(false);
    }
  };

  const handleSlugChange = (e) => {
    const value = e.target.value.replace(/\s+/g, '-').toLowerCase();
    setFormData({...formData, slug: value});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    try {
      setSaving(true);
      if (editingId) {
        await api.put(`/brands/${editingId}`, formData);
        toast.success('Marca actualizada');
      } else {
        await api.post('/brands', formData);
        toast.success('Marca creada');
      }
      setShowModal(false);
      setFormData({ name: '', description: '', slug: '' });
      setEditingId(null);
      fetchBrands();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar marca');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (brand) => {
    setFormData({ 
      name: brand.name, 
      description: brand.description || '',
      slug: brand.slug || '' 
    });
    setEditingId(brand.id);
    setShowModal(true);
  };

  const handleDelete = (brand) => {
    setItemToDelete(brand);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await api.delete(`/brands/${itemToDelete.id}`);
      toast.success('Marca eliminada');
      fetchBrands();
      setItemToDelete(null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al eliminar marca');
    }
  };

  const handleClose = () => {
    setShowModal(false);
    setFormData({ name: '', description: '', slug: '' });
    setEditingId(null);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Gestión de Marcas</h2>
        <div className="flex gap-3">
          <button 
            onClick={handleSync}
            disabled={syncing}
            className={`bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm ${syncing ? 'opacity-75 cursor-not-allowed' : ''}`}
          >
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Sincronizando...' : 'Refrescar'}</span>
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            <Plus size={18} />
            <span>Nueva Marca</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando marcas...</div>
        ) : brands.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No hay marcas registradas</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">Nombre</th>
                <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">Descripción</th>
                <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {brands.map((brand) => (
                <tr key={brand.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        <Badge size={18} />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center">
                          <span className="font-medium text-slate-700">{brand.name}</span>
                          {brand.woocommerce_id && (
                            <span className="ml-2 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">
                              Woo
                            </span>
                          )}
                        </div>
                        {brand.slug && (
                           <span className="text-xs text-slate-400 font-mono mt-0.5">{brand.slug}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {brand.description || 'Sin descripción'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(brand)} 
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(brand)} 
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
             <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
               <h3 className="font-bold text-lg text-slate-800">{editingId ? 'Editar Marca' : 'Nueva Marca'}</h3>
               <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">&times;</button>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Slug <span className="text-xs font-normal text-slate-500">(URL amigable)</span>
                  </label>
                  <input 
                    type="text" 
                    value={formData.slug}
                    onChange={handleSlugChange}
                    placeholder="nombre-de-marca"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Se verá reflejado en la URL de su tienda. Sin espacios.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                  />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button 
                    type="button" 
                    onClick={handleClose} 
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={saving}
                    className={`px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center gap-2 ${saving ? 'opacity-75 cursor-not-allowed' : ''}`}
                  >
                    {saving && <RefreshCw size={16} className="animate-spin" />}
                    {editingId ? 'Guardar Cambios' : 'Crear Marca'}
                  </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-[1px] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200 border border-slate-100">
                <h4 className="text-lg font-bold text-slate-800 mb-2">¿Eliminar marca?</h4>
                <p className="text-slate-600 mb-6">
                    Estás a punto de eliminar <span className="font-semibold text-slate-800">"{itemToDelete.name}"</span>. Esta acción no se puede deshacer.
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

export default BrandManager;

import { useState, useEffect } from 'react';
import api from '../../../services/api';
import { Plus, Edit, Trash, X } from 'lucide-react';
import toast from 'react-hot-toast';

const SubcategoryModal = ({ category, onClose }) => {
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [itemToDelete, setItemToDelete] = useState(null);

  const fetchSubcategories = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/categories/${category.id}/subcategories`);
      // Ensure data is an array before setting state
      setSubcategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading subcategories:', error);
      toast.error('Error al cargar subcategorías');
      setSubcategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (category) {
      fetchSubcategories();
    }
  }, [category]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (editingId) {
        await api.put(`/subcategories/${editingId}`, { name });
        toast.success('Subcategoría actualizada');
      } else {
        await api.post('/subcategories', { name, category_id: category.id });
        toast.success('Subcategoría creada');
      }
      setName('');
      setEditingId(null);
      fetchSubcategories();
    } catch (error) {
      toast.error('Error al guardar subcategoría');
    }
  };

  const handleEdit = (sub) => {
    setName(sub.name);
    setEditingId(sub.id);
  };

  const handleDelete = (sub) => {
    setItemToDelete(sub);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await api.delete(`/subcategories/${itemToDelete.id}`);
      toast.success('Subcategoría eliminada');
      fetchSubcategories();
      setItemToDelete(null);
    } catch (error) {
      toast.error('Error al eliminar subcategoría');
    }
  };

  const handleCancelEdit = () => {
    setName('');
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
         <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
            <div>
                <h3 className="font-bold text-lg text-slate-800">Gestionar Subcategorías</h3>
                <p className="text-sm text-slate-500">Categoría: {category.name}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
         </div>
         
         <div className="p-6 border-b border-gray-100 bg-slate-50/50">
            <form onSubmit={handleSubmit} className="flex gap-2">
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre de subcategoría..."
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  autoFocus
                />
                {editingId && (
                    <button 
                        type="button" 
                        onClick={handleCancelEdit}
                        className="px-3 py-2 text-slate-600 hover:bg-slate-200 rounded-lg"
                    >
                        Cancelar
                    </button>
                )}
                <button 
                    type="submit" 
                    disabled={!name.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {editingId ? <Edit size={16} /> : <Plus size={16} />}
                    <span>{editingId ? 'Actualizar' : 'Agregar'}</span>
                </button>
            </form>
         </div>

         <div className="flex-1 overflow-y-auto p-0">
            {loading ? (
                <div className="text-center py-4 text-slate-500">Cargando...</div>
            ) : subcategories.length === 0 ? (
                <div className="p-6 text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg m-6">
                    No hay subcategorías registradas
                </div>
            ) : (
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">Nombre</th>
                            <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {subcategories.map((sub) => (
                            <tr key={sub.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-6 py-3 text-sm text-slate-700">{sub.name}</td>
                                <td className="px-6 py-3 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => handleEdit(sub)} 
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(sub)} 
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
         </div>
      </div>

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-[1px] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200 border border-slate-100">
                <h4 className="text-lg font-bold text-slate-800 mb-2">¿Eliminar subcategoría?</h4>
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

export default SubcategoryModal;

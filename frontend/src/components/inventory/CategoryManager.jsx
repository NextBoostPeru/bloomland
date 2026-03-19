import { useState, useEffect, Fragment } from 'react';
import api from '../../services/api';
import { Plus, Tag, Edit, Trash, Layers, RefreshCw, ChevronRight, ChevronDown, CornerDownRight } from 'lucide-react';
import toast from 'react-hot-toast';
import SubcategoryModal from './modals/SubcategoryModal';

const CategoryManager = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', slug: '', parent_id: '' });
  const [itemToDelete, setItemToDelete] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState({});
  
  // Subcategory Modal State
  const [selectedCategory, setSelectedCategory] = useState(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/categories');
      setCategories(data);
    } catch (error) {
      toast.error('Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-fix DB if table missing
    // api.get('/migrate/subcategories').catch(() => {});
    fetchCategories();
  }, []);

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getCategoryTree = () => {
    const map = {};
    const roots = [];
    
    // Create map of items
    categories.forEach(cat => {
      map[cat.id] = { ...cat, children: [] };
    });
    
    // Build hierarchy
    categories.forEach(cat => {
      if (cat.parent_id && map[cat.parent_id]) {
        map[cat.parent_id].children.push(map[cat.id]);
      } else {
        roots.push(map[cat.id]);
      }
    });
    
    // Sort by name within levels
    const sortNodes = (nodes) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      nodes.forEach(node => {
        if (node.children.length > 0) sortNodes(node.children);
      });
    };
    
    sortNodes(roots);
    return roots;
  };

  const renderCategoryRow = (category, depth = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expanded[category.id];
    
    return (
      <Fragment key={category.id}>
        <tr className="hover:bg-slate-50 transition-colors group">
          <td className="px-6 py-4">
            <div className="flex items-center gap-3" style={{ paddingLeft: `${depth * 2.5}rem` }}>
              {depth > 0 && (
                <CornerDownRight size={16} className="text-slate-300 -ml-4 mr-1" />
              )}
              
              <div className="relative">
                 {hasChildren && (
                    <button 
                      onClick={() => toggleExpand(category.id)}
                      className="absolute -left-6 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                 )}
                 <div className={`p-2 rounded-lg ${depth === 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                    <Tag size={18} />
                 </div>
              </div>
              
              <div>
                <span className={`font-medium ${depth === 0 ? 'text-slate-800' : 'text-slate-600'}`}>
                  {category.name}
                </span>
                {category.woocommerce_id && (
                  <span className="ml-2 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">
                    Woo
                  </span>
                )}
              </div>
            </div>
          </td>
          <td className="px-6 py-4 text-sm text-slate-500">
            {category.description || 'Sin descripción'}
          </td>
          <td className="px-6 py-4 text-right">
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => handleEdit(category)} 
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Editar"
              >
                <Edit size={18} />
              </button>
              <button 
                onClick={() => handleDelete(category)} 
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar"
              >
                <Trash size={18} />
              </button>
            </div>
          </td>
        </tr>
        {isExpanded && category.children.map(child => renderCategoryRow(child, depth + 1))}
      </Fragment>
    );
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const { data } = await api.post('/categories/sync');
      if (data.success) {
        toast.success(data.message);
        fetchCategories();
      } else {
        toast.error(data.message || 'Error al sincronizar');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error de conexión al sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/categories/${editingId}`, formData);
        toast.success('Categoría actualizada');
      } else {
        await api.post('/categories', formData);
        toast.success('Categoría creada');
      }
      setShowModal(false);
      setFormData({ name: '', description: '', slug: '' });
      setEditingId(null);
      fetchCategories();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar categoría');
    }
  };

  const handleDelete = (category) => {
    setItemToDelete(category);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await api.delete(`/categories/${itemToDelete.id}`);
      toast.success('Categoría eliminada');
      fetchCategories();
      setItemToDelete(null);
    } catch (error) {
      toast.error('Error al eliminar categoría');
    }
  };

  const handleClose = () => {
    setShowModal(false);
    setFormData({ name: '', description: '', slug: '', parent_id: '' });
    setEditingId(null);
  };

  const handleSlugChange = (e) => {
    const value = e.target.value;
    if (value.includes(' ')) {
      return; // Block spaces
    }
    setFormData({...formData, slug: value});
  };

  const handleEdit = (category) => {
    setFormData({ 
      name: category.name, 
      description: category.description || '', 
      slug: category.slug || '',
      parent_id: category.parent_id || ''
    });
    setEditingId(category.id);
    setShowModal(true);
  };

  // Helper to flatten categories for dropdown
  const getFlatCategories = (cats, prefix = '') => {
    let flat = [];
    cats.forEach(cat => {
      // Don't include self or children as parent options to avoid loops (simple check: don't include self)
      if (editingId && cat.id === editingId) return;
      
      flat.push({ ...cat, displayName: prefix + cat.name });
      if (cat.children && cat.children.length > 0) {
        flat = [...flat, ...getFlatCategories(cat.children, prefix + '-- ')];
      }
    });
    return flat;
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Gestión de Categorías</h2>
        <div className="flex gap-3">
          <button 
            onClick={handleSync}
            disabled={syncing}
            className={`bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm ${syncing ? 'opacity-75 cursor-not-allowed' : ''}`}
          >
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Sincronizando...' : 'Sincronizar WooCommerce'}</span>
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            <Plus size={18} />
            <span>Nueva Categoría</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando categorías...</div>
        ) : categories.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No hay categorías registradas</div>
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
              {getCategoryTree().map(root => renderCategoryRow(root))}
              {categories.length === 0 && (
                 <tr>
                    <td colSpan="3" className="px-6 py-8 text-center text-slate-500">
                       No se encontraron categorías.
                    </td>
                 </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
             <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800">{editingId ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Categoría Padre</label>
                  <select
                    value={formData.parent_id}
                    onChange={(e) => setFormData({...formData, parent_id: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="">Ninguna (Categoría Principal)</option>
                    {getFlatCategories(categories).map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Slug <span className="text-xs font-normal text-slate-500">(URL amigable)</span>
                  </label>
                  <input 
                    type="text" 
                    value={formData.slug}
                    onChange={handleSlugChange}
                    placeholder="nombre-de-categoria"
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    rows="3"
                  />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button type="button" onClick={handleClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
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
                <h4 className="text-lg font-bold text-slate-800 mb-2">¿Eliminar categoría?</h4>
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

      {selectedCategory && (
        <SubcategoryModal 
          category={selectedCategory} 
          onClose={() => setSelectedCategory(null)} 
        />
      )}
    </div>
  );
};

export default CategoryManager;

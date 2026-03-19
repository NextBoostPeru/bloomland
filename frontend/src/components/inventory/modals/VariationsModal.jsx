import { useState, useEffect } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import { X, Save, Plus, Trash, Edit2, AlertTriangle, Loader2, QrCode } from 'lucide-react';

const VariationsModal = ({ isOpen, onClose, product }) => {
  const [variations, setVariations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sizeTerms, setSizeTerms] = useState([]);
  const [colorTerms, setColorTerms] = useState([]);
  const [designTerms, setDesignTerms] = useState([]);
  const [termsLoading, setTermsLoading] = useState(false);
  const [newVariation, setNewVariation] = useState({
    size: '',
    price: '',
    color: '',
    design: '',
    stock: 0
  });
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null });

  useEffect(() => {
    if (isOpen && product) {
      fetchVariations();
      // Fetch Woo attribute terms for selects
      const fetchTerms = async () => {
        try {
          setTermsLoading(true);
          const [sizesRes, colorsRes, designsRes] = await Promise.all([
            api.get('/inventory/attributes/talla/terms'),
            api.get('/inventory/attributes/color/terms'),
            api.get('/inventory/attributes/diseno/terms')
          ]);
          if (sizesRes.data?.success) setSizeTerms(sizesRes.data.data || []);
          if (colorsRes.data?.success) setColorTerms(colorsRes.data.data || []);
          if (designsRes.data?.success) setDesignTerms(designsRes.data.data || []);
        } catch {
          // Silent: if fails, keep text inputs fallback (we use selects anyway)
        } finally {
          setTermsLoading(false);
        }
      };
      fetchTerms();
    }
  }, [isOpen, product]);

  const fetchVariations = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/inventory/products/${product.id}/variations`);
      setVariations(data);
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar variaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newVariation.size && !newVariation.color && !newVariation.design) {
      toast.error('Ingrese al menos Talla, Color o Diseño');
      return;
    }

    try {
      setLoading(true);
      await api.post(`/inventory/products/${product.id}/variations`, {
        ...newVariation,
        detail: newVariation.design
      });
      toast.success('Variación agregada');
      setNewVariation({ size: '', price: '', color: '', design: '', stock: 0 });
      fetchVariations();
    } catch (error) {
      console.error(error);
      toast.error('Error al agregar variación');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    const id = deleteConfirm.id;
    if (!id) return;

    try {
      setLoading(true);
      await api.delete(`/inventory/variations/${id}`);
      toast.success('Variación eliminada');
      fetchVariations();
      setDeleteConfirm({ isOpen: false, id: null });
    } catch (error) {
      console.error(error);
      toast.error('Error al eliminar variación');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id, updatedData) => {
    try {
      setLoading(true);
      await api.put(`/inventory/variations/${id}`, updatedData);
      toast.success('Variación actualizada');
      setEditingId(null);
      fetchVariations();
    } catch (error) {
      console.error(error);
      toast.error('Error al actualizar variación');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formDisabled = loading || termsLoading;
  const handlePrintLabel = (variationId) => {
    const url = `${window.location.origin}/labels/variation/${variationId}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Gestionar Variantes</h2>
            <p className="text-sm text-slate-500">Producto: {product?.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          
          {/* Add New Form */}
          <div className="bg-slate-50 p-4 rounded-xl mb-6 border border-slate-200 relative">
            {termsLoading && (
              <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center rounded-xl">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 className="animate-spin" size={18} />
                  Cargando tallas, colores y diseños...
                </div>
              </div>
            )}
            <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Plus size={18} /> Nueva Variación
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Talla</label>
                {sizeTerms.length > 0 ? (
                  <select
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                    value={newVariation.size}
                    disabled={formDisabled}
                    onChange={e => setNewVariation({...newVariation, size: e.target.value})}
                  >
                    <option value="">Seleccionar</option>
                    {sizeTerms.map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    placeholder="Ej. M"
                    value={newVariation.size}
                    disabled={formDisabled}
                    onChange={e => setNewVariation({...newVariation, size: e.target.value})}
                  />
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Precio</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="0.00"
                  value={newVariation.price}
                  disabled={formDisabled}
                  onChange={e => setNewVariation({...newVariation, price: e.target.value})}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Color</label>
                {colorTerms.length > 0 ? (
                  <select
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                    value={newVariation.color}
                    disabled={formDisabled}
                    onChange={e => setNewVariation({...newVariation, color: e.target.value})}
                  >
                    <option value="">Seleccionar</option>
                    {colorTerms.map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    placeholder="Ej. Rojo"
                    value={newVariation.color}
                    disabled={formDisabled}
                    onChange={e => setNewVariation({...newVariation, color: e.target.value})}
                  />
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Diseño</label>
                {designTerms.length > 0 ? (
                  <select
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                    value={newVariation.design}
                    disabled={formDisabled}
                    onChange={e => setNewVariation({ ...newVariation, design: e.target.value })}
                  >
                    <option value="">Seleccionar</option>
                    {designTerms.map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    placeholder="Ej. Diseño 1"
                    value={newVariation.design}
                    disabled={formDisabled}
                    onChange={e => setNewVariation({ ...newVariation, design: e.target.value })}
                  />
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Stock</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="0"
                  value={newVariation.stock}
                  disabled={formDisabled}
                  onChange={e => setNewVariation({...newVariation, stock: e.target.value})}
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={formDisabled}
                className={`bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 ${(formDisabled) ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {termsLoading
                  ? (<><Loader2 className="animate-spin" size={16} /> Cargando...</>)
                  : loading
                    ? (<><Loader2 className="animate-spin" size={16} /> Guardando...</>)
                    : (<><Plus size={16} /> Agregar</>)}
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-x-auto relative">
            {formDisabled && (
              <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center rounded-xl">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 className="animate-spin" size={18} />
                  Cargando variaciones...
                </div>
              </div>
            )}
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-y border-slate-200">
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Talla</th>
                  <th className="px-4 py-3 text-right">Precio</th>
                  <th className="px-4 py-3">Color</th>
                  <th className="px-4 py-3">Diseño</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {variations.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-slate-400">
                      No hay variaciones registradas
                    </td>
                  </tr>
                ) : (
                  variations.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-slate-600">{v.sku}</td>
                      
                      {/* Editable Fields if editingId === v.id */}
                      {editingId === v.id ? (
                        <>
                          <td className="px-4 py-3">
                            {sizeTerms.length > 0 ? (
                              <select
                                className="w-full px-2 py-1 border rounded text-sm"
                                defaultValue={v.size}
                                id={`edit-size-${v.id}`}
                                disabled={formDisabled}
                              >
                                <option value="">Seleccionar</option>
                                {sizeTerms.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                              </select>
                            ) : (
                              <input
                                type="text"
                                className="w-full px-2 py-1 border rounded text-sm"
                                defaultValue={v.size}
                                id={`edit-size-${v.id}`}
                                disabled={formDisabled}
                              />
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-24 px-2 py-1 border rounded text-sm text-right"
                              defaultValue={v.price ?? ''}
                              id={`edit-price-${v.id}`}
                              disabled={formDisabled}
                            />
                          </td>
                          <td className="px-4 py-3">
                            {colorTerms.length > 0 ? (
                              <select
                                className="w-full px-2 py-1 border rounded text-sm"
                                defaultValue={v.color}
                                id={`edit-color-${v.id}`}
                                disabled={formDisabled}
                              >
                                <option value="">Seleccionar</option>
                                {colorTerms.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                              </select>
                            ) : (
                              <input
                                type="text"
                                className="w-full px-2 py-1 border rounded text-sm"
                                defaultValue={v.color}
                                id={`edit-color-${v.id}`}
                                disabled={formDisabled}
                              />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {designTerms.length > 0 ? (
                              <select
                                className="w-full px-2 py-1 border rounded text-sm"
                                defaultValue={v.detail}
                                id={`edit-design-${v.id}`}
                                disabled={formDisabled}
                              >
                                <option value="">Seleccionar</option>
                                {designTerms.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                              </select>
                            ) : (
                              <input
                                type="text"
                                className="w-full px-2 py-1 border rounded text-sm"
                                defaultValue={v.detail}
                                id={`edit-design-${v.id}`}
                                disabled={formDisabled}
                              />
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              className="w-20 px-2 py-1 border rounded text-sm text-right"
                              defaultValue={v.stock}
                              id={`edit-stock-${v.id}`}
                              disabled={formDisabled}
                            />
                          </td>
                          <td className="px-4 py-3 text-right flex justify-end gap-2">
                            <button 
                              onClick={() => handleUpdate(v.id, {
                                size: document.getElementById(`edit-size-${v.id}`).value,
                                price: document.getElementById(`edit-price-${v.id}`).value,
                                color: document.getElementById(`edit-color-${v.id}`).value,
                                detail: document.getElementById(`edit-design-${v.id}`).value,
                                stock: document.getElementById(`edit-stock-${v.id}`).value
                              })}
                              disabled={formDisabled}
                              className={`text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg ${formDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                              <Save size={16} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              disabled={formDisabled}
                              className={`text-slate-400 hover:bg-slate-100 p-1.5 rounded-lg ${formDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                              <X size={16} />
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-sm text-slate-700">{v.size || '-'}</td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-800 text-right">{v.price ? Number(v.price).toFixed(2) : '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{v.color || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{v.detail || '-'}</td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-800 text-right">{v.stock}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <button 
                                onClick={() => { if (!formDisabled) setEditingId(v.id); }}
                                disabled={formDisabled}
                                className={`p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors ${formDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                                title="Editar"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handlePrintLabel(v.id)}
                                disabled={formDisabled}
                                className={`p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors ${formDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                                title="Etiqueta (QR)"
                              >
                                <QrCode size={16} />
                              </button>
                              <button 
                                onClick={() => handleDeleteClick(v.id)}
                                disabled={formDisabled}
                                className={`p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors ${formDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                                title="Eliminar"
                              >
                                <Trash size={16} />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-[1px] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-rose-100 animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">¿Eliminar variante?</h3>
              <p className="text-sm text-slate-500 mb-6">
                Esta acción no se puede deshacer. El stock se descontará del inventario general.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setDeleteConfirm({ isOpen: false, id: null })}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200"
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VariationsModal;

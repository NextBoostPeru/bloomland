import { useState, useEffect } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import { X, Save, Package, ClipboardList, BarChart2, Edit, Plus } from 'lucide-react';

const ProductModal = ({ isOpen, onClose, product }) => {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    price: '',
    cost: '',
    description: '', // Short description
    details: '', // Web Description
    technical_details: '', // Technical Data
    min_stock: 5,
    initial_stock: 0,
    warehouse_id: '',
    category_id: '',
    brand_id: '',
    supplier_id: '',
    location: '', // Gondola
    image_url: '',
    size: '',
    color: '',
    material: '',
    collection: '',
    gender: '',
    pattern: '',
    sleeve: '',
    neck_type: '',
    line: ''
  });
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isVariable, setIsVariable] = useState((product?.variations_count ?? 0) > 0);

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  
  // Gallery (Max 5 images total, including main)
  // We will treat imageFile as the "Main" image, and galleryFiles as additional.
  // Or better, just one gallery array? 
  // The backend handles 'image' (main) and 'gallery[]' (additional).
  // Let's keep imageFile for main, and add galleryFiles.
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [galleryPreviews, setGalleryPreviews] = useState([]);
  const [galleryExisting, setGalleryExisting] = useState([]);
  
  useEffect(() => {
    const fetchData = async () => {
        try {
            const results = await Promise.allSettled([
                api.get('/categories'),
                api.get('/brands'),
                api.get('/suppliers'),
                api.get('/warehouses')
            ]);

            const [catsRes, brandsRes, suppRes, whRes] = results;

            if (catsRes.status === 'fulfilled') setCategories(catsRes.value.data);
            else console.error("Categories fetch failed", catsRes.reason);

            if (brandsRes.status === 'fulfilled') setBrands(brandsRes.value.data);
            else console.error("Brands fetch failed", brandsRes.reason);

            if (suppRes.status === 'fulfilled') setSuppliers(suppRes.value.data);
            else console.error("Suppliers fetch failed", suppRes.reason);

            if (whRes.status === 'fulfilled') setWarehouses(whRes.value.data);
            else console.error("Warehouses fetch failed", whRes.reason);

        } catch (e) {
            console.error("Error fetching metadata", e);
        }
    };
    fetchData();

    if (product) {
      setFormData({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode || '',
        price: product.price,
        cost: product.cost || '',
        description: product.description || '',
        details: product.details || '',
        technical_details: product.technical_details || '',
        min_stock: product.min_stock || 5,
        category_id: product.category_id || '',
        brand_id: product.brand_id || '',
        supplier_id: product.supplier_id || '',
        location: product.location || '',
        image_url: product.image_url || '',
        size: product.size || '',
        color: product.color || '',
        material: product.material || '',
        collection: product.collection || '',
        gender: product.gender || '',
        pattern: product.pattern || '',
        sleeve: product.sleeve || '',
        neck_type: product.neck_type || '',
        line: product.line || '',
        initial_stock: (product.variations_count > 0) ? 0 : (product.total_stock || 0)
      });
      setImagePreview(product.image_url || '');
      setGalleryExisting([]);
      // Refrescar desde Woo para traer última imagen principal y galería
      (async () => {
        try {
          const res = await api.get(`/inventory/products/${product.id}/refresh-woo`);
          if (res?.data?.success) {
            const img = res.data.image_url || product.image_url || '';
            setFormData(prev => ({...prev, image_url: img}));
            setImagePreview(img);
            const gallery = Array.isArray(res.data.gallery) ? res.data.gallery : [];
            const filtered = gallery.filter(u => u && u !== img);
            setGalleryExisting(filtered);
          }
        } catch {
          // silencioso
        }
      })();
    } else {
      setFormData({
        name: '', sku: '', barcode: '', price: '', cost: '', description: '', details: '', technical_details: '',
        min_stock: 5, initial_stock: 0, category_id: '', brand_id: '', supplier_id: '', location: '',
        image_url: '', size: '', color: '', material: '', collection: '', gender: '', pattern: '', sleeve: '', neck_type: '', line: ''
      });
      setImagePreview('');
      setImageFile(null);
      setGalleryFiles([]);
      setGalleryPreviews([]);
      setGalleryExisting([]);
    }
  }, [product]);

  useEffect(() => {
    setIsVariable((product?.variations_count ?? 0) > 0);
  }, [product]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGalleryChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Evitar duplicados por nombre+tamaño+lastModified
    const existingKeys = new Set(
      galleryFiles.map(f => `${f.name}|${f.size}|${f.lastModified}`)
    );
    const uniqueNew = files.filter(f => {
      const key = `${f.name}|${f.size}|${f.lastModified}`;
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });

    if (uniqueNew.length === 0) return;

    const maxSlots = Math.max(0, 4 - galleryExisting.length);
    const limited = [...galleryFiles, ...uniqueNew].slice(0, maxSlots);
    setGalleryFiles(limited);

    // Regenerar previews basados en galleryFiles resultante
    const urls = limited.map(file => URL.createObjectURL(file));
    // Liberar URLs anteriores
    galleryPreviews.forEach(u => URL.revokeObjectURL(u));
    setGalleryPreviews(urls);
  };

  const removeGalleryImage = (index) => {
      const newFiles = [...galleryFiles];
      newFiles.splice(index, 1);
      setGalleryFiles(newFiles);
      
      const newPreviews = [...galleryPreviews];
      URL.revokeObjectURL(newPreviews[index]); // Cleanup
      newPreviews.splice(index, 1);
      setGalleryPreviews(newPreviews);
  };



  const handleRemoveExisting = async (url) => {
    if (!product) return;
    const ok = window.confirm('¿Deseas eliminar esta imagen de la galería en WooCommerce?');
    if (!ok) return;
    const prev = galleryExisting;
    setGalleryExisting(prev.filter(u => u !== url));
    try {
      await api.post(`/inventory/products/${product.id}/gallery/delete`, { image_url: url });
      toast.success('Imagen eliminada de la galería');
    } catch (e) {
      console.error(e);
      toast.error('No se pudo eliminar la imagen');
      setGalleryExisting(prev);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => {
        // Evitar re-subir/forzar imagen en edición si no cambió
        if (product && key === 'image_url' && !imageFile && galleryFiles.length === 0) {
          return;
        }
        data.append(key, formData[key]);
      });
      
      if (imageFile) {
        data.append('image', imageFile);
      }
      
      galleryFiles.forEach((file) => {
        data.append('gallery[]', file);
      });
      


      if (product) {
        const res = await api.post(`/inventory/products/${product.id}`, data);
        const synced = res?.data?.woocommerce_synced;
        toast.success(synced ? 'Producto actualizado y sincronizado con WooCommerce' : 'Producto actualizado');
      } else {
        const res = await api.post('/inventory/products', data);
        const synced = res?.data?.woocommerce_synced;
        toast.success(synced ? 'Producto creado y sincronizado con WooCommerce' : 'Producto creado');
      }
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header - Fixed */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-slate-50 shrink-0">
          <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
            {product ? <><Edit size={24} className="text-indigo-600"/> Editar Producto</> : <><Plus size={24} className="text-indigo-600"/> Nuevo Producto</>}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-slate-200 p-2 rounded-full transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 custom-scrollbar">
          <form id="product-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* --- Sección 1: Información Básica --- */}
            <div className="col-span-1 md:col-span-12">
               <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                 <span className="bg-indigo-100 p-1 rounded text-indigo-600"><Package size={18} /></span> Información General
               </h4>
            </div>

            <div className="col-span-1 md:col-span-8">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Producto</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Ej. Body Bebé Algodón"
              />
            </div>

            <div className="col-span-1 md:col-span-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">SKU / Código</label>
              <input
                required
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({...formData, sku: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Ej. ROP-001"
              />
            </div>

            <div className="col-span-1 md:col-span-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Código de Barras <span className="text-slate-400 font-normal">(Opcional)</span></label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Ej. 775000..."
              />
            </div>

            <div className="col-span-1 md:col-span-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Costo (S/)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400">S/</span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({...formData, cost: e.target.value})}
                  className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="col-span-1 md:col-span-4">
              {!product && (
                <label className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Producto con variantes</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[11px]">{isVariable ? 'Sí' : 'No'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !isVariable;
                        setIsVariable(next);
                        if (next) {
                          setFormData(prev => ({ ...prev, price: '' }));
                        }
                      }}
                      className={`w-9 h-5 rounded-full px-0.5 flex items-center transition-colors ${
                        isVariable ? 'bg-indigo-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                          isVariable ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </span>
                </label>
              )}
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Precio (S/){isVariable ? ' — gestionado en variaciones' : ''}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400">S/</span>
                <input
                  required={!isVariable}
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  disabled={isVariable}
                  className={`w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${isVariable ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="col-span-1 md:col-span-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white"
              >
                <option value="">Seleccionar Categoría</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-1 md:col-span-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
              <select
                value={formData.brand_id}
                onChange={(e) => setFormData({...formData, brand_id: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white"
              >
                <option value="">Seleccionar Marca</option>
                {brands.map(brand => (
                  <option key={brand.id} value={brand.id}>{brand.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-1 md:col-span-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor</label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({...formData, supplier_id: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white"
              >
                <option value="">Seleccionar Proveedor</option>
                {suppliers.map(sup => (
                  <option key={sup.id} value={sup.id}>{sup.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-1 md:col-span-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Góndola / Ubicación</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Ej. Pasillo 3, Estante B"
              />
            </div>

            {/* --- Sección 2: Ficha Técnica --- */}
            <div className="col-span-1 md:col-span-12 mt-4 pt-4 border-t border-slate-100">
               <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                 <span className="bg-indigo-100 p-1 rounded text-indigo-600"><ClipboardList size={18} /></span> Ficha Técnica
               </h4>
            </div>

            <div className="col-span-1 md:col-span-3">
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Talla</label>
              <input
                 type="text"
                 value={formData.size}
                 onChange={(e) => setFormData({...formData, size: e.target.value})}
                 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                 placeholder="Ej. RN"
              />
            </div>

            <div className="col-span-1 md:col-span-3">
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Color</label>
              <input
                 type="text"
                 value={formData.color}
                 onChange={(e) => setFormData({...formData, color: e.target.value})}
                 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                 placeholder="Ej. Blanco"
              />
            </div>

            <div className="col-span-1 md:col-span-3">
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Material</label>
              <input
                 type="text"
                 value={formData.material}
                 onChange={(e) => setFormData({...formData, material: e.target.value})}
                 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                 placeholder="Ej. Algodón"
              />
            </div>

            <div className="col-span-1 md:col-span-3">
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Sexo</label>
               <select
                value={formData.gender}
                onChange={(e) => setFormData({...formData, gender: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
              >
                <option value="">Seleccionar</option>
                <option value="Niño">Niño</option>
                <option value="Niña">Niña</option>
                <option value="Unisex">Unisex</option>
              </select>
            </div>
            
            <div className="col-span-1 md:col-span-3">
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Manga</label>
               <select
                value={formData.sleeve}
                onChange={(e) => setFormData({...formData, sleeve: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
              >
                <option value="">Seleccionar</option>
                <option value="Larga">Larga</option>
                <option value="Corta">Corta</option>
                <option value="Cero">Cero</option>
                <option value="3/4">3/4</option>
              </select>
            </div>

            <div className="col-span-1 md:col-span-3">
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Cuello</label>
               <input
                 type="text"
                 value={formData.neck_type}
                 onChange={(e) => setFormData({...formData, neck_type: e.target.value})}
                 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                 placeholder="Ej. Redondo"
              />
            </div>

             <div className="col-span-1 md:col-span-3">
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Colección</label>
              <input
                 type="text"
                 value={formData.collection}
                 onChange={(e) => setFormData({...formData, collection: e.target.value})}
                 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                 placeholder="Ej. 2026"
              />
            </div>

             <div className="col-span-1 md:col-span-3">
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Línea</label>
              <input
                type="text"
                value={formData.line}
                onChange={(e) => setFormData({...formData, line: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                placeholder="Ej. Baby"
              />
            </div>

            <div className="col-span-1 md:col-span-3">
              <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Diseño</label>
              <input
                 type="text"
                 value={formData.pattern}
                 onChange={(e) => setFormData({...formData, pattern: e.target.value})}
                 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                 placeholder="Ej. Ositos"
              />
            </div>



            <div className="col-span-1 md:col-span-12">
              <label className="block text-sm font-medium text-slate-700 mb-1">Descripción Web (Detalles)</label>
              <textarea
                rows="3"
                value={formData.details}
                onChange={(e) => setFormData({...formData, details: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Descripción detallada para el sitio web..."
              ></textarea>
            </div>

            <div className="col-span-1 md:col-span-12">
              <label className="block text-sm font-medium text-slate-700 mb-1">Datos Técnicos</label>
              <textarea
                rows="2"
                value={formData.technical_details}
                onChange={(e) => setFormData({...formData, technical_details: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Especificaciones técnicas..."
              ></textarea>
            </div>

            <div className="col-span-1 md:col-span-12">
               <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                 Imagen Principal
               </h4>
               <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                   <div className="col-span-1 md:col-span-2 relative group">
                       <div 
                         className={`h-40 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer overflow-hidden ${imagePreview ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:bg-slate-50'}`}
                         onClick={() => document.getElementById('main-image-upload').click()}
                       >
                           {imagePreview ? (
                               <img src={imagePreview} alt="Main" className="h-full w-full object-cover" />
                           ) : (
                               <div className="text-center p-2">
                                   <Package className="mx-auto text-slate-400 mb-1" size={24} />
                                   <span className="text-xs text-slate-500">Seleccionar imagen</span>
                               </div>
                           )}
                       </div>
                       {imagePreview && (
                           <button 
                             type="button"
                             onClick={(e) => {
                               e.stopPropagation();
                               setImagePreview('');
                               setImageFile(null);
                               setFormData({...formData, image_url: ''});
                             }}
                             className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 z-10"
                           >
                             <X size={14} />
                           </button>
                       )}
                       <input id="main-image-upload" type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                   </div>
                   <div className="col-span-1 md:col-span-4 flex items-center">
                     <p className="text-xs text-slate-500">Se mostrará como destacada en la tienda y listados.</p>
                   </div>
               </div>
            </div>

            <div className="col-span-1 md:col-span-12">
               <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                 Galería del Producto (máx 4)
               </h4>
               <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                   {galleryExisting.map((url, index) => (
                       <div key={`exist-${index}`} className="col-span-1 relative group">
                           <div className="h-28 border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden bg-white">
                               <img src={url} alt={`Existente ${index}`} className="h-full w-full object-cover" />
                           </div>
                           <button 
                             type="button"
                             onClick={() => handleRemoveExisting(url)}
                             className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 z-10"
                           >
                             <X size={14} />
                           </button>
                           <span className="absolute bottom-1 right-1 text-[10px] bg-slate-700 text-white px-1.5 py-0.5 rounded opacity-80">Woo</span>
                       </div>
                   ))}
                   {galleryPreviews.map((preview, index) => (
                       <div key={index} className="col-span-1 relative group">
                           <div className="h-28 border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden bg-white">
                               <img src={preview} alt={`Gallery ${index}`} className="h-full w-full object-cover" />
                           </div>
                           <button 
                             type="button"
                             onClick={() => removeGalleryImage(index)}
                             className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 z-10"
                           >
                             <X size={14} />
                           </button>
                       </div>
                   ))}

                   {(galleryExisting.length + galleryPreviews.length) < 4 && (
                       <div className="col-span-1">
                           <div 
                             className="h-28 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors"
                             onClick={() => document.getElementById('gallery-upload').click()}
                           >
                               <div className="text-center p-2">
                                   <Plus className="mx-auto text-slate-400 mb-1" size={20} />
                                   <span className="text-xs text-slate-500">Agregar</span>
                               </div>
                           </div>
                           <input 
                             id="gallery-upload" 
                             type="file" 
                             className="hidden" 
                             accept="image/*" 
                             multiple 
                             onChange={handleGalleryChange} 
                           />
                       </div>
                   )}
               </div>
               <p className="text-xs text-slate-500 mt-2">Sube imágenes adicionales que se mostrarán en la galería del producto.</p>
            </div>

             {/* --- Sección 3: Inventario y Descripción --- */}
            <div className="col-span-1 md:col-span-12 mt-4 pt-4 border-t border-slate-100">
               <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                 <span className="bg-indigo-100 p-1 rounded text-indigo-600"><BarChart2 size={18} /></span> Inventario y Detalles
               </h4>
            </div>

            {(!product || (product && product.variations_count == 0)) && (
              <>
                <div className="col-span-1 md:col-span-6">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {product ? 'Almacén para Ajuste' : 'Almacén de Entrada'}
                  </label>
                  <select
                    value={formData.warehouse_id}
                    onChange={(e) => setFormData({...formData, warehouse_id: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white"
                  >
                    <option value="">Seleccionar Almacén (Default: Central)</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 md:col-span-6">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {product ? 'Stock (Ajuste Manual)' : 'Stock Inicial'}
                  </label>
                  <input
                    type="number"
                    value={formData.initial_stock}
                    onChange={(e) => setFormData({...formData, initial_stock: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-green-50"
                    placeholder="0"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {product 
                      ? 'Modificar para registrar movimiento (IN/OUT)' 
                      : 'Se agregará al Almacén seleccionado'}
                  </p>
                </div>
              </>
            )}

            <div className="col-span-1 md:col-span-6">
              <label className="block text-sm font-medium text-slate-700 mb-1">Stock Mínimo (Alerta)</label>
              <input
                type="number"
                value={formData.min_stock}
                onChange={(e) => setFormData({...formData, min_stock: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="5"
              />
            </div>

            <div className="col-span-1 md:col-span-12">
              <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
              <textarea
                rows="3"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Detalles adicionales del producto..."
              ></textarea>
            </div>

          </form>
        </div>

        {/* Footer - Fixed */}
        <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-slate-50 shrink-0 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="product-form"
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-lg shadow-indigo-200 flex items-center gap-2"
          >
            {loading ? 'Guardando...' : (
              <>
                <Save size={18} />
                Guardar Producto
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ProductModal;

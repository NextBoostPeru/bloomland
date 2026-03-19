import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import DashboardLayout from '../../layouts/DashboardLayout';
import { ArrowLeft, Package, Tag, Palette, Layers, Barcode, Boxes, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

const VariationDetail = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [variation, setVariation] = useState(null);

  useEffect(() => {
    const fetchVariation = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/inventory/variations/${id}`);
        if (!data?.success) {
          throw new Error(data?.message || 'No se pudo cargar la variación');
        }
        setVariation(data.data);
      } catch (error) {
        console.error(error);
        toast.error('Error al cargar detalle de la variante');
      } finally {
        setLoading(false);
      }
    };
    fetchVariation();
  }, [id]);

  return (
    <DashboardLayout title="Detalle de Variante">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/inventory" className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Detalle de Variante</h1>
              <p className="text-sm text-slate-500">QR / consulta rápida</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-slate-500">Cargando...</div>
          ) : !variation ? (
            <div className="p-10 text-center text-slate-500">No se encontró la variante</div>
          ) : (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-700">
                  <Package size={18} className="text-indigo-600" />
                  <span className="font-semibold">{variation.product_name}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                      <Barcode size={14} />
                      SKU
                    </div>
                    <div className="font-mono text-sm text-slate-800 break-all">{variation.sku || '-'}</div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                      <Boxes size={14} />
                      Stock
                    </div>
                    <div className="text-xl font-bold text-slate-800">{Number(variation.stock ?? 0)}</div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                      <Tag size={14} />
                      Talla
                    </div>
                    <div className="text-lg font-semibold text-slate-800">{variation.size || '-'}</div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                      <Palette size={14} />
                      Color
                    </div>
                    <div className="text-lg font-semibold text-slate-800">{variation.color || '-'}</div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 sm:col-span-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                      <Layers size={14} />
                      Diseño
                    </div>
                    <div className="text-lg font-semibold text-slate-800">{variation.detail || '-'}</div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 sm:col-span-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                      <DollarSign size={14} />
                      Precio
                    </div>
                    <div className="text-lg font-semibold text-slate-800">
                      {variation.price !== null && variation.price !== undefined && variation.price !== ''
                        ? Number(variation.price).toFixed(2)
                        : '-'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center">
                <div className="text-sm text-slate-500 mb-3 text-center">
                  Escaneado desde etiqueta
                </div>
                <div className="text-xs text-slate-500 text-center">
                  Si necesitas imprimir, vuelve a la lista de variaciones y usa “Etiqueta (QR)”.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default VariationDetail;


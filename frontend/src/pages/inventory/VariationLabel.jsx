import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import { ArrowLeft, Printer } from 'lucide-react';
import toast from 'react-hot-toast';

const VariationLabel = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [variation, setVariation] = useState(null);
  const [printing, setPrinting] = useState(false);

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
        toast.error('Error al cargar la etiqueta');
      } finally {
        setLoading(false);
      }
    };
    fetchVariation();
  }, [id]);

  const detailUrl = useMemo(() => `${window.location.origin}/variation/${id}`, [id]);
  const qrSrc = useMemo(() => {
    const data = encodeURIComponent(detailUrl);
    return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${data}`;
  }, [detailUrl]);

  const handlePrint = async () => {
    if (printing) return;
    try {
      setPrinting(true);
      setTimeout(() => window.print(), 0);
    } finally {
      setTimeout(() => setPrinting(false), 1200);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="no-print p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            to="/inventory"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={18} />
            <span>Volver</span>
          </Link>
        </div>
        <button
          onClick={handlePrint}
          disabled={loading || printing || !variation}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Printer size={18} />
          <span>{printing ? 'Imprimiendo...' : 'Imprimir'}</span>
        </button>
      </div>

      <div className="p-4 flex justify-center">
        {loading ? (
          <div className="text-slate-500">Cargando...</div>
        ) : !variation ? (
          <div className="text-slate-500">No se encontró la variante</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-300 shadow-sm w-[980px] max-w-full p-6">
            <div className="grid grid-cols-12 gap-6 items-stretch">
              <div className="col-span-12 md:col-span-7 flex flex-col justify-between">
                <div>
                  <div className="text-3xl font-extrabold text-slate-900 leading-tight">
                    {variation.product_name}
                  </div>
                  <div className="mt-4 space-y-1 text-xl text-slate-800">
                    <div className="font-semibold">{variation.detail || '—'}</div>
                    <div>{variation.color || '—'}</div>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="text-6xl font-black text-slate-900 leading-none">
                    {variation.size ? `Talla ${variation.size}` : 'Talla —'}
                  </div>
                  <div className="mt-3 font-mono text-lg text-slate-700 break-all">
                    {variation.sku || '—'}
                  </div>
                </div>
              </div>

              <div className="col-span-12 md:col-span-5 flex items-center justify-center">
                <div className="border border-slate-200 rounded-2xl p-3 bg-white">
                  <img src={qrSrc} alt="QR" className="w-[260px] h-[260px]" />
                </div>
              </div>
            </div>

            <div className="no-print mt-4 text-xs text-slate-500">
              El QR abre: {detailUrl}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VariationLabel;


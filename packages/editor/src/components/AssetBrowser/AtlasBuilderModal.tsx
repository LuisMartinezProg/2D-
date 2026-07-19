// packages/editor/src/components/AssetBrowser/AtlasBuilderModal.tsx
import { useState, useRef, useCallback } from 'react';
import { packSprites, type SpriteToPack, type PackResult } from '../../tools/atlasPacker';
import { exportAtlasJson } from '../../tools/exportAtlasJson';

const COLORS = {
  modalBg: '#1F1236', border: '#7B4FBF', text: '#E8E0F5', accent: '#EDD47A',
  dropZoneBg: '#2D1B4E', dropZoneActive: '#4AB3E8', canvasBg: '#080810', danger: '#E85B5B',
} as const;

interface Props {
  onClose: () => void;
  onExport: (atlasPng: Blob, manifestJson: string) => void;
}

export function AtlasBuilderModal({ onClose, onExport }: Props) {
  const [sprites, setSprites] = useState<SpriteToPack[]>([]);
  const [padding, setPadding] = useState(2);
  const [powerOfTwo, setPowerOfTwo] = useState(false);
  const [maxSize, setMaxSize] = useState(2048);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState<PackResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFiles = useCallback(async (files: FileList) => {
    const loaded: SpriteToPack[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const bitmap = await createImageBitmap(file);
      loaded.push({ name: file.name.replace(/\.[^/.]+$/, ''), width: bitmap.width, height: bitmap.height, image: bitmap });
    }
    setSprites((prev) => [...prev, ...loaded]);
  }, []);

  const runPack = useCallback(() => {
    const packed = packSprites(sprites, { maxWidth: maxSize, maxHeight: maxSize, padding, powerOfTwo });
    setResult(packed);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = packed.atlasWidth;
    canvas.height = packed.atlasHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const region of packed.regions) {
      const sprite = sprites.find((s) => s.name === region.name);
      if (sprite) ctx.drawImage(sprite.image, region.x, region.y);
    }
  }, [sprites, padding, powerOfTwo, maxSize]);

  const handleExport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      onExport(blob, JSON.stringify(exportAtlasJson(result), null, 2));
    }, 'image/png');
  }, [result, onExport]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.modalBg, border: `1px solid ${COLORS.border}`, borderRadius: 8, width: 640, maxWidth: '90vw', maxHeight: '85vh', overflow: 'auto', padding: 20, color: COLORS.text, fontFamily: 'system-ui, sans-serif' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, color: COLORS.accent }}>Generar atlas desde imágenes</h2>

        <div onDragOver={(e) => { e.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)}
          onDrop={(e) => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
          style={{ border: `2px dashed ${dragActive ? COLORS.dropZoneActive : COLORS.border}`, borderRadius: 6, padding: 24, textAlign: 'center', background: COLORS.dropZoneBg, marginBottom: 16 }}>
          <input type="file" multiple accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} id="atlas-file-input" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
          <label htmlFor="atlas-file-input" style={{ cursor: 'pointer' }}>
            Arrastrá sprites acá, o hacé click para elegir archivos
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{sprites.length} sprite{sprites.length !== 1 ? 's' : ''} cargado{sprites.length !== 1 ? 's' : ''}</div>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 13 }}>
          <label>Padding <input type="number" min={0} max={16} value={padding} onChange={(e) => setPadding(Number(e.target.value))} style={{ width: 48, background: COLORS.dropZoneBg, color: COLORS.text, border: `1px solid ${COLORS.border}` }} /></label>
          <label>Tamaño máx. <select value={maxSize} onChange={(e) => setMaxSize(Number(e.target.value))} style={{ background: COLORS.dropZoneBg, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
            <option value={512}>512</option><option value={1024}>1024</option><option value={2048}>2048</option><option value={4096}>4096</option>
          </select></label>
          <label><input type="checkbox" checked={powerOfTwo} onChange={(e) => setPowerOfTwo(e.target.checked)} /> Forzar potencia de 2</label>
        </div>

        <button onClick={runPack} disabled={sprites.length === 0} style={{ background: COLORS.accent, color: '#4A3B0D', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 700, cursor: sprites.length ? 'pointer' : 'default', opacity: sprites.length ? 1 : 0.5, marginBottom: 16 }}>
          Empacar atlas
        </button>

        <div style={{ background: COLORS.canvasBg, borderRadius: 4, padding: 8, marginBottom: 12 }}>
          <canvas ref={canvasRef} style={{ maxWidth: '100%', display: result ? 'block' : 'none' }} />
          {!result && <div style={{ fontSize: 12, opacity: 0.6, textAlign: 'center', padding: 20 }}>Vista previa acá</div>}
        </div>

        {result && result.rejected.length > 0 && (
          <div style={{ color: COLORS.danger, fontSize: 12, marginBottom: 12 }}>
            No entraron ({result.rejected.length}): {result.rejected.join(', ')} — probá un tamaño máximo más grande.
          </div>
        )}
        {result && <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>Atlas final: {result.atlasWidth}×{result.atlasHeight}px, {result.regions.length} sprites</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'transparent', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: '6px 14px', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleExport} disabled={!result || result.regions.length === 0} style={{ background: COLORS.dropZoneActive, color: '#0D2B4E', border: 'none', borderRadius: 4, padding: '6px 14px', fontWeight: 700, cursor: result ? 'pointer' : 'default', opacity: result ? 1 : 0.5 }}>
            Exportar PNG + JSON
          </button>
        </div>
      </div>
    </div>
  );
}

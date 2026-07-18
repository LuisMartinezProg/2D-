import React from 'react';
import type { AssetManager } from '@mochigo/assets';
import { MochiGoTheme } from '../theme';

interface AssetBrowserProps {
  assetManager: AssetManager;
  /** AssetManager no expone "listar todo lo cargado" (solo getters por
   * id puntual), así que EditorApp deriva esta lista del manifest de la
   * escena actual en vez de pedírsela directamente a AssetManager. */
  knownTextureIds: string[];
}

export function AssetBrowser({ assetManager, knownTextureIds }: AssetBrowserProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: MochiGoTheme.skirk.black }}>
      <div style={{
        padding: '8px 10px', fontSize: 12, fontWeight: 600, color: MochiGoTheme.skirk.light,
        background: MochiGoTheme.skirk.deep, borderBottom: `2px solid ${MochiGoTheme.jahoda.green}`,
      }}>
        Asset Browser
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 8, overflowY: 'auto', flex: 1 }}>
        {knownTextureIds.length === 0 && (
          <div style={{ opacity: 0.6, fontSize: 12, color: MochiGoTheme.skirk.light }}>No hay texturas cargadas.</div>
        )}
        {knownTextureIds.map((textureId) => {
          const image = assetManager.getTexture(textureId);
          return (
            <div
              key={textureId} draggable
              onDragStart={(e) => e.dataTransfer.setData('text/mochigo-texture-id', textureId)}
              style={{ width: 64, border: `1px solid ${MochiGoTheme.jahoda.green}`, padding: 4, cursor: 'grab', textAlign: 'center' }}
              title={textureId}
            >
              {image && <img src={image.src} alt={textureId} style={{ width: '100%', height: 48, objectFit: 'contain' }} />}
              <div style={{ fontSize: 9, color: MochiGoTheme.skirk.light, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {textureId}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

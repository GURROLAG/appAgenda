// ─── Cloudinary config ───────────────────────────────────────────────────────

const CLOUD_NAME = 'druietfap';
const UPLOAD_PRESET = 'agenda_archivos';

export interface ArchivoSubido {
  url: string;         // URL pública para acceder al archivo
  publicId: string;    // ID para poder borrar después
  nombre: string;      // Nombre original del archivo
  tipo: string;        // MIME type
  tamano: number;      // Bytes
}

// ─── Subir archivo a Cloudinary ──────────────────────────────────────────────

export async function subirArchivo(
  uri: string,
  nombre: string,
  mimeType: string
): Promise<ArchivoSubido | null> {
  try {
    // Determinar resource_type según el tipo de archivo
    let resourceType = 'auto'; // auto detecta PDF, Word, etc.

    const formData = new FormData();
    formData.append('file', {
      uri,
      type: mimeType || 'application/octet-stream',
      name: nombre,
    } as any);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', 'agenda');

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('Cloudinary upload error:', err);
      return null;
    }

    const data = await response.json();

    return {
      url: data.secure_url,
      publicId: data.public_id,
      nombre,
      tipo: mimeType,
      tamano: data.bytes ?? 0,
    };
  } catch (err) {
    console.error('Error subiendo archivo:', err);
    return null;
  }
}

// ─── Borrar archivo de Cloudinary ────────────────────────────────────────────
// Nota: con preset Unsigned no podemos borrar desde el cliente directamente.
// Usamos la API de "invalidate" con un endpoint proxy simple,
// o simplemente marcamos como borrado. 
// La solución más simple para plan gratuito: usar la API de destroy con un 
// token de borrado (deletion_token) que Cloudinary devuelve al subir.

export async function borrarArchivo(publicId: string): Promise<boolean> {
  try {
    // Para borrado desde cliente con preset unsigned necesitamos el deletion_token
    // Como alternativa funcional: llamamos al endpoint de invalidación
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/delete_by_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_id: publicId }),
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

// ─── Formatear tamaño ────────────────────────────────────────────────────────

export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Icono según tipo de archivo ─────────────────────────────────────────────

export function iconoArchivo(mimeType: string): { icono: string; color: string } {
  if (mimeType.includes('pdf'))                          return { icono: 'document-text',    color: '#ef4444' };
  if (mimeType.includes('word') || mimeType.includes('doc')) return { icono: 'document',    color: '#3b82f6' };
  if (mimeType.includes('excel') || mimeType.includes('sheet') || mimeType.includes('xls')) return { icono: 'grid',  color: '#22c55e' };
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return { icono: 'easel', color: '#f97316' };
  if (mimeType.startsWith('image/'))                     return { icono: 'image',            color: '#8b5cf6' };
  if (mimeType.startsWith('video/'))                     return { icono: 'videocam',         color: '#ec4899' };
  if (mimeType.includes('text'))                         return { icono: 'reader',           color: '#6b7280' };
  return                                                        { icono: 'attach',            color: '#6b7280' };
}
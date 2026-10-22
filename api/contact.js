import { sendEmail, contactEmail } from '../lib/email.js';

const MOTIVOS = ['Asesoría personalizada', 'Duda sobre un plan', 'Tipos de entrenamiento', 'Alimentación', 'Otro'];

// POST /api/contact — reenvía la consulta al mail del coach.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const b = req.body ?? {};
  if (b.website) return res.status(200).json({ ok: true }); // honeypot: el bot cree que salió

  const data = {
    nombre: String(b.nombre ?? '').trim().slice(0, 80),
    email: String(b.email ?? '').trim().slice(0, 120),
    whatsapp: String(b.whatsapp ?? '').trim().slice(0, 30),
    motivo: MOTIVOS.includes(b.motivo) ? b.motivo : 'Otro',
    mensaje: String(b.mensaje ?? '').trim().slice(0, 3000),
  };
  if (data.nombre.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email) || data.mensaje.length < 10) {
    return res.status(400).json({ error: 'Completá nombre, un email válido y un mensaje de al menos 10 caracteres.' });
  }

  try {
    await sendEmail({ to: process.env.COACH_EMAIL, ...contactEmail(data), replyTo: data.email });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('contact', err);
    return res.status(502).json({ error: 'No pudimos enviar tu mensaje. Escribime por WhatsApp.' });
  }
}

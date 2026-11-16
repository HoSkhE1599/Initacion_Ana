// Función serverless de Vercel: te manda la respuesta de Ana por correo (Resend) y por Telegram.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const resumen = String(body.resumen || '').slice(0, 1500);
  if (!resumen) return res.status(400).json({ ok: false });

  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const hora = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
  const texto = `💌 Ana respondió (${hora})\n\n${resumen}`;
  const check = name => async r => { if (!r.ok) { console.error(name, 'falló', r.status, await r.text()); throw new Error(name); } };
  const jobs = [];

  if (process.env.RESEND_API_KEY && process.env.EMAIL_TO) {
    jobs.push(fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Cita para Ana <onboarding@resend.dev>',
        to: [process.env.EMAIL_TO],
        subject: '💌 Ana ya eligió su plan',
        html: `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.6">${esc(texto).replace(/\n/g, '<br>')}</div>`
      })
    }).then(check('email')));
  } else console.error('Faltan RESEND_API_KEY o EMAIL_TO');

  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    jobs.push(fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: texto })
    }).then(check('telegram')));
  } else console.error('Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID');

  const results = await Promise.allSettled(jobs);
  const ok = results.some(r => r.status === 'fulfilled');
  res.status(ok ? 200 : 500).json({ ok });
};

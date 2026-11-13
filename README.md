# BREAKDOWN — Entrenamiento & Nutrición

Sitio para vender planes de entrenamiento y alimentación, con estética deathcore / metal extremo.

- **Planes**: rutina, dieta (bajar de peso o ganar masa), combo y asesoría 1 a 1.
- **Pago** con Mercado Pago (tarjeta, débito, dinero en cuenta, efectivo).
- **Entrega automática**: cuando el pago se aprueba, el plan personalizado le llega al cliente por mail y a vos te llega el aviso de la venta.
- **Contacto**: formulario que te llega al mail + botones de WhatsApp e Instagram.

## Cómo funciona

```
Cliente elige plan → completa cuestionario → /api/checkout crea el pago en Mercado Pago
   → paga → Mercado Pago avisa a /api/webhook → se genera el plan → mail al cliente + aviso a vos
```

No hace falta base de datos: las respuestas del cuestionario viajan dentro del pago de Mercado Pago.

| Archivo | Qué es |
|---|---|
| `lib/config.js` | **Nombre, precios, WhatsApp, Instagram.** Lo único que tenés que editar. |
| `lib/plans.js` | Cómo se arma la rutina y la dieta (ejercicios, alimentos, cálculos). |
| `lib/email.js` | Diseño de los mails. |
| `public/` | La página (HTML, CSS, JS) y el logo generado. |
| `scripts/generate-logo.js` | Generador del logo con púas (letra New Rocker, licencia OFL). |
| `scripts/generate-background.js` | Generador del árbol seco con chorreaduras del fondo de la portada (`npm run background`). |
| `public/bg-grunge.svg` | Textura de pintura sucia del fondo de toda la página. |
| `api/` | Funciones del servidor (pago, webhook, contacto). |

## Puesta en marcha (≈ 30 min)

### 1. Editá tus datos
En `lib/config.js` cambiá nombre de marca, precios, tu WhatsApp (formato `5491122334455`) e Instagram.

**Logo:** se genera automáticamente con púas a partir del nombre de la marca. Si cambiás el nombre, o querés otra variante de púas (cambiando `logoSeed`), corré:

```bash
npm install
npm run logo
```

### 2. Mail con Resend (gratis hasta 3.000 mails/mes)
1. Creá una cuenta en [resend.com](https://resend.com).
2. **Domains → Add domain** y cargá los registros DNS que te indica en tu proveedor de dominio. (Sin dominio propio solo podés mandarte mails a vos mismo para probar.)
3. **API Keys → Create** y guardá la clave.

### 3. Mercado Pago
1. Entrá a [Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app) y creá una aplicación (tipo "Checkout Pro").
2. En **Credenciales de producción** copiá el **Access Token**.
3. Para probar sin plata real usá las credenciales y cuentas de prueba que da Mercado Pago.

### 4. Publicar en Vercel (gratis)
1. Subí este proyecto a un repo de GitHub.
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importá el repo (no hace falta configurar nada de build).
3. En **Settings → Environment Variables** cargá las variables de `.env.example`:
   - `SITE_URL` → la URL del sitio (ej. `https://breakdown.vercel.app` o tu dominio)
   - `MP_ACCESS_TOKEN`, `RESEND_API_KEY`
   - `EMAIL_FROM` → ej. `BREAKDOWN <planes@tudominio.com>`
   - `COACH_EMAIL` → tu mail
4. Redeploy.

### 5. Webhook de Mercado Pago (recomendado)
La URL de notificación ya va en cada pago, pero para validar la firma:
1. En tu aplicación de Mercado Pago → **Webhooks → Configurar notificaciones**.
2. URL: `https://TU-SITIO/api/webhook`, evento **Pagos**.
3. Copiá la **clave secreta** y cargala en Vercel como `MP_WEBHOOK_SECRET`.

### 6. Probá una compra
Hacé una compra de prueba y verificá que te llegue el plan y el aviso de venta.

## Desarrollo

```bash
npm test               # pruebas (plan, dieta, pago y webhook simulados)
npm run preview-email  # genera preview/combo.html para ver el mail en el navegador
npx vercel dev         # levanta el sitio local con las funciones
```

> Los planes son orientativos para personas sanas y no reemplazan la consulta con un médico o nutricionista. Esa aclaración aparece en la web y en cada mail.

## Portal de alumnos (/alumnos) y panel del coach (/coach)

- **Alumnos** (`public/alumnos/`): entran con mail y contraseña, ven su rutina, la entrenan
  con contador de descanso, suben un video por serie y mandan sus sensaciones.
- **Coach** (`public/coach/`): feed de entrenamientos, calificación de 1 a 5 estrellas,
  correcciones tipo chat y editor de rutinas por alumno.
- Usa **Supabase** (login, base de datos y videos). Todo el acceso a datos está en
  `public/portal/db.js` y los permisos en `supabase/schema.sql`.

### Configurar Supabase (una sola vez)
1. Creá un proyecto en [supabase.com](https://supabase.com) (región São Paulo).
2. **SQL Editor → New query**: pegá todo `supabase/schema.sql` y tocá **Run**.
3. **Authentication → URL Configuration**: Site URL `https://www.breakdownfit.com` y en
   Redirect URLs agregá `https://www.breakdownfit.com/alumnos/`.
4. **Settings → API**: copiá la **Project URL** y la **anon public key** en
   `public/portal/config.js` (son públicas; los permisos los protege la base).
5. El coach se registra en `/alumnos` y se lo promueve en el SQL Editor:
   `update public.profiles set role = 'coach' where email = 'MAIL-DEL-COACH';`

Videos: hasta 50 MB por video (plan gratis: 1 GB en total).

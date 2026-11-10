# ✈️ Aerotienda — Gestión de pedidos, entregas y stock

Sistema web para registrar los pedidos de los alumnos y su **llegada a la sede** (enviados desde **Barquisimeto**), llevar el
control interno de entregas en **Caracas – Santa Mónica**, manejar stock (repetidos, devoluciones, cambios,
reasignaciones), sacar reportes y avisar al alumno por **WhatsApp**.

- **Frontend + API:** Next.js 14 (se despliega en **Vercel**)
- **Base de datos y usuarios:** Firebase **Firestore** + **Authentication**
- **Avisos:** WhatsApp (se abre con el mensaje ya escrito, sin costo)

---

## ¿Qué hace?

| Módulo | Función |
|---|---|
| **Consulta pública** (`/`) | El alumno escribe su N° de pedido y ve si llegó y si se le entregó. Solo muestra datos no sensibles (nombre abreviado, artículos, estado). |
| **Artículos** | Botón **Importar / actualizar desde la tienda**: carga los productos de la categoría Aerotienda de store.aeroidea.net con sus variantes (talla, color, género, modelo) y precio. También puedes crear o editar artículos a mano y activarlos o desactivarlos. |
| **Nuevo pedido** | Dos opciones: **Pedido realizado** (el alumno lo hizo y aún no llega; queda con estado *Pedido realizado*) o **Pedido que ya llegó** (para los que llegan sin estar registrados; se indica cuánto llegó). Al guardar se abre WhatsApp con el aviso para el alumno. |
| **Buscar en la tienda** | Al escribir el N° de pedido de store.aeroidea.net y pulsar **🔎 Buscar en la tienda**, se llenan solos los datos del alumno (nombre, cédula, teléfono, correo, curso), la sede y los artículos con su variante. Requiere las claves de la API de WooCommerce (ver instalación). |
| **Recibir pedido** | Cuando llega un pedido, escribes su número: si ya estaba registrado aparece para confirmar lo que llegó y pasa a *En la sede*; si no existe, se registra ahí mismo como recibido. Se abre WhatsApp con el aviso (llegó / llegó incompleto). |
| **Actualizar lo recibido** | Cuando llega lo que faltaba, o para corregir cantidades. Lo que llegue **repetido o de más** pasa directo al stock. |
| **Entregar al alumno** | Se marcan con una casilla ✅ los artículos que se le entregan (todos o solo algunos, con la cantidad); cada artículo pendiente tiene además su botón **✅ Entregar**. Al registrar un pedido que ya llegó también se puede marcar en la columna **Entregado** lo que el alumno se lleva en ese momento. Al entregar se puede abrir WhatsApp con la confirmación. Entrega total o parcial. Opción "tomar del stock" para la **venta directa** cuando abras la aerotienda de Santa Mónica. |
| **A stock** | Artículo repetido, sobrante, devuelto por el alumno, defectuoso… queda en stock de la sede. |
| **Cambio** | El alumno devuelve un artículo o talla (vuelve al stock) y recibe otro desde el stock. |
| **Stock y reasignación** | Existencias por sede, ingreso de mercancía, ajustes, y **reasignar** a otro alumno. Si pones su N° de pedido, completa automáticamente lo que le faltaba. |
| **Reportes** | Stock, entregados, reasignados, cambios, devoluciones, ingresos/ajustes, pedidos (con datos del alumno) y pendientes/faltantes. Filtro por fechas y sede. Exportar a **Excel (CSV)** o **imprimir/PDF**. |
| **Historial** | Cada pedido guarda quién hizo qué y cuándo, más el registro de los avisos por WhatsApp. |

---

## Instalación paso a paso

### 1. Firebase
1. Entra a <https://console.firebase.google.com> → **Agregar proyecto**.
2. **Authentication** → *Comenzar* → activa **Correo electrónico/contraseña**.
3. **Firestore Database** → *Crear base de datos* (modo producción; ubicación recomendada: `southamerica-east1` o `us-east1`).
4. **Configuración del proyecto → Tus apps → Web (`</>`)** → registra la app y copia los valores `apiKey`, `authDomain`, etc.
5. **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada** → descarga el JSON
   (guárdalo como `service-account.json`; **no lo subas a GitHub**).
6. Publica las reglas de seguridad (desde la carpeta del proyecto):
   ```bash
   npm install -g firebase-tools
   ```
   ```bash
   firebase login
   ```
   ```bash
   firebase deploy --only firestore:rules --project TU-PROYECTO
   ```
   (O copia el contenido de `firestore.rules` en *Firestore → Reglas* y publica.)

### 2. Crear tu usuario administrador
```bash
npm install
```
```bash
node scripts/crear-admin.mjs ./service-account.json tucorreo@gmail.com TuClave123 "Tu Nombre" caracas-santa-monica
```
Repite para cada persona que use el sistema (sedes: `barquisimeto` o `caracas-santa-monica`).
Solo los usuarios creados así pueden entrar al panel; cualquier otra cuenta ve "Sin acceso".

### 3. Avisos por WhatsApp
No requiere configuración ni tiene costo. En la ficha de cada pedido hay botones (*Pedido llegó*, *Llegó incompleto*,
*Recordatorio de retiro*, *Confirmar entrega*) que abren WhatsApp con el mensaje ya escrito para el teléfono del alumno;
solo hay que darle a enviar. Cada aviso queda anotado en el pedido.

### 3b. Conexión con la tienda (datos del alumno por N° de pedido)
1. Entra a `store.aeroidea.net/wp-admin` → **WooCommerce → Ajustes → Avanzado → API REST → Añadir clave**.
2. Descripción: `Sistema Aerotienda`; Usuario: tu usuario administrador; **Permisos: Lectura**. Clic en **Generar clave de API**.
3. Copia la **Clave del cliente** (`ck_…`) y la **Clave secreta del cliente** (`cs_…`); solo se muestran una vez.
4. En Vercel → Settings → Environment Variables agrega `WC_CONSUMER_KEY` y `WC_CONSUMER_SECRET` con esos valores y vuelve a desplegar.

### 4. Desplegar en Vercel
1. Sube esta carpeta a un repositorio de GitHub.
2. En <https://vercel.com> → **Add New → Project** → importa el repositorio (Vercel detecta Next.js).
3. En **Settings → Environment Variables** agrega todas las variables de `.env.example` con tus valores:
   - `FIREBASE_SERVICE_ACCOUNT` = el contenido completo del archivo `.json` del paso 1.5
4. **Deploy**. Después, en Firebase → *Authentication → Configuración → Dominios autorizados*, agrega tu dominio de Vercel.

### Desarrollo local
```bash
cp .env.example .env.local
```
Llena `.env.local` y luego:
```bash
npm run dev
```
Abre <http://localhost:3000>. Para probar sin tocar datos reales, usa el emulador de Firebase:
pon `NEXT_PUBLIC_USE_EMULATOR=true`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` y
`FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` en `.env.local` y ejecuta:
```bash
firebase emulators:start --only auth,firestore --project demo-aerotienda
```

---

## Estados de un pedido
`Pedido realizado` → `En la sede (completo)` / `En la sede (incompleto)` → `Entregado parcial` → `Entregado` (o `Anulado`).
Se calculan solos según lo que registres en llegada y entrega.

## Estructura de datos (Firestore)
- `articulos` — catálogo
- `pedidos/{N°}` — pedido con alumno, artículos (pedido/llegó/entregado/devuelto), historial, cambios, reasignaciones y mensajes
- `stock/{sede__articulo__talla}` — existencias por sede
- `movimientos` — cada entrega, devolución, cambio, reasignación, ingreso y ajuste (base de los reportes)
- `admins/{uid}` — usuarios con acceso al panel
- `contadores` — numeración automática de pedidos

Publicado en Vercel

## Agregar otra sede
Edita `lib/config.js` → arreglo `SEDES` (id, nombre y prefijo para la numeración).

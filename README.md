# ReyesFruitHub

Plataforma web para la gestión integral de la Frutería Reyes (protocolo de Taller de Investigación II, ISC 7° «A», ITS Valladolid).

**Stack:** HTML + CSS + JavaScript (sin dependencias) · API en PHP 8 con PDO · MySQL / MariaDB.

## Cómo arrancarlo

Requisitos: PHP 8.1 o superior con `pdo_mysql`, y MySQL 8 o MariaDB 10.2 o superior en ejecución.

1. **Base de datos** (solo la primera vez):
   ```
   php database/instalar.php
   ```
   Crea la base `reyesfruithub`, aplica `database/schema.sql` y carga datos de ejemplo.
   `php database/instalar.php --reset` la borra y la vuelve a crear (pide confirmación).
2. **Servidor:** doble clic en `iniciar.bat`, o `php -S localhost:8080 servidor.php`. Abre http://localhost:8080.
   Abrir los `.html` con doble clic **ya no funciona**: necesitan la API.

**Conexión:** se toma del archivo `.env` en la raíz. Si no existe, copia `.env.example` como `.env` y llena `DB_USER` y `DB_PASS` con tu usuario de MySQL/MariaDB (también `DB_HOST`, `DB_PORT` y `DB_NAME` si cambian).

Ese usuario necesita permisos sobre `reyesfruithub`, y sobre `reyesfruithub_test` para correr las pruebas:
`GRANT ALL PRIVILEGES ON reyesfruithub.* TO 'tu_usuario'@'localhost';`

Una variable de entorno del sistema con el mismo nombre tiene prioridad sobre el `.env`. El `.env` no se sirve por web y está en `.gitignore`.

| Cuenta demo | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@reyesfruithub.demo` | `demo123` |
| Cliente | `cliente@reyesfruithub.demo` | `demo123` |

## Chequeos y pruebas

| Comando | Qué hace |
|---|---|
| `php database/chequeo.php` | 37 chequeos sobre la base real: conexión, estructura (tablas, llaves foráneas, CHECK, índices), integridad (totales = detalle, cada pedido entregado tiene su venta, historial coherente, lotes válidos) y seguridad (contraseñas con hash, admin activo, correos únicos) |
| `powershell -ExecutionPolicy Bypass -File tests\probar.ps1` | Todo lo anterior **sobre una base separada `reyesfruithub_test`** (tu base no se toca), más 35 pruebas de API, prueba de concurrencia con varios procesos y 22 pasos de interfaz en celular y escritorio |

La primera vez, `probar.ps1` instala `playwright-core` en `tests/` (usa el Chrome o Edge que ya tienes). Las capturas quedan en `tests/capturas/`.

## Seguridad implementada

- Contraseñas con `password_hash` (bcrypt); nunca se envían al navegador.
- Sesión PHP con cookie `HttpOnly` y `SameSite=Lax`; el id de sesión se regenera al iniciar sesión.
- Permisos por rol **en el servidor** en cada acción: cliente y administrador solo ven y hacen lo suyo.
- Consultas preparadas reales (sin inyección SQL); los precios siempre salen de la base, no del navegador.
- Cabecera `X-RFH` obligatoria en cada POST (defensa contra CSRF). Tras 5 intentos fallidos, el login se bloquea un minuto.
- Ventas, pedidos, entradas y mermas van en transacciones con bloqueo de filas: la existencia nunca queda negativa, ni con ventas simultáneas.
- `servidor.php` y los `.htaccess` impiden descargar `api/config.php`, `api/lib.php` y la carpeta `database/`.
- La interfaz escapa todo el texto que viene de la base (sin XSS).

**Antes de publicar:** cambia las contraseñas demo (el chequeo te avisa). La app ya no usa `root`: se conecta con el usuario del `.env`, que solo tiene permisos sobre sus bases.

## Pantallas

| Página | Rol | Qué hace |
|---|---|---|
| `index.html` | Público | Portada con foto, productos disponibles hoy por categoría, cómo pedir y datos de la tienda |
| `login.html` | Público | Iniciar sesión, crear cuenta de cliente y entrar con las cuentas demo |
| `cliente.html` | Cliente | Catálogo con búsqueda, carrito, pedido (recoger o domicilio), seguimiento y cancelación de pedidos, datos personales |
| `admin.html` | Admin | Resumen con gráfica, punto de venta, pedidos en línea, productos (con foto), inventario por lotes (PEPS, caducidad, mermas), proveedores y compras, usuarios y roles |
| `creditos.html` | Público | Autor y licencia de cada foto |

## Estructura

```
ReyesFruitHub/
├── index.html · login.html · cliente.html · admin.html · creditos.html
├── servidor.php            enrutador del servidor de desarrollo (oculta archivos internos)
├── .env                    usuario y contraseña de la base (no se publica)
├── iniciar.bat             arranca el servidor y abre el navegador
├── api/
│   ├── index.php           acciones de la API (JSON)
│   ├── lib.php             conexión, sesión, permisos, validación y PEPS
│   └── config.php          lee la conexión desde .env
├── database/
│   ├── schema.sql          14 tablas + vista v_existencias
│   ├── instalar.php        crea la base y carga datos de ejemplo
│   └── chequeo.php         chequeos de conexión, estructura, integridad y seguridad
├── assets/css/styles.css   sistema de diseño
├── assets/js/              ui.js · data.js (cliente de la API) · common.js · tienda.js · cliente.js · admin.js
├── assets/img/             fotos WebP + creditos.json
└── tests/                  api.test.mjs · e2e.test.mjs · concurrencia.php · probar.ps1
```

## Fotos

Son fotos **ilustrativas** de Wikimedia Commons con licencia libre (CC BY, CC BY-SA, CC0 o dominio público). El autor y la licencia de cada una están en `assets/img/creditos.json` y en la página `creditos.html`, que está enlazada desde el pie de la portada. No son fotos de la Frutería Reyes: para cambiar una, edita el producto en el panel (campo «Foto») y usa una ruta `assets/img/...` o una URL `https://`.

## Pendientes (datos reales del negocio)

- [ ] Dirección, horario, teléfono/WhatsApp y zona de entrega (en `index.html`, entre `[CORCHETES]`).
- [ ] Costo de envío a domicilio.
- [ ] Precios, costos, proveedores y fotos reales de la frutería.
- [ ] Cambiar las contraseñas demo antes de publicar.

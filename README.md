# Brújula — Finanzas y Vida v5.0

## Nube opcional: cuentas privadas + sincronización entre dispositivos

**Estado al publicar este código:** la nube NO está activa hasta que se configure un proyecto propio de Supabase. Mientras `cloud-config.js` tenga URL y clave pública vacías, Brújula sigue guardando los datos localmente y no los envía a Internet.

La aplicación es un sitio estático de GitHub Pages. Supabase proporciona autenticación por correo y una tabla PostgreSQL con **Row Level Security (RLS)** para que un usuario no pueda leer ni editar las filas de otro.

### Activación, paso a paso

1. Entra a [Supabase](https://supabase.com/dashboard), crea una cuenta e inicia un **New project**.
2. En tu proyecto abre **SQL Editor → New query**. Copia el contenido completo de [supabase/schema.sql](./supabase/schema.sql) y ejecútalo con **Run**. Debe crear `public.brujula_data` y sus políticas RLS.
3. En **Authentication → URL Configuration**, coloca en **Site URL**: `https://halder42-bit.github.io/brujula-finanzas-colombia/`. Añade exactamente la misma dirección en **Redirect URLs** (incluyendo la barra final).
4. Confirma que el proveedor de correo electrónico esté habilitado en **Authentication → Providers → Email**. El inicio de sesión de Brújula utiliza enlaces enviados al correo (Magic Link).
5. Copia desde **Project Settings → API Keys** (o **Connect**) la **Project URL** que termina en `.supabase.co` y la **publishable key** (o la antigua clave `anon`). **Nunca copies la secret key o service_role al repositorio.**
6. En GitHub edita [cloud-config.js](./cloud-config.js) y sustituye los dos valores vacíos por estos datos **públicos**:
   ```js
   window.BRUJULA_CLOUD = Object.freeze({
     url: 'https://TU-PROYECTO.supabase.co',
     publishableKey: 'sb_publishable_TU_CLAVE_PUBLICA'
   });
   ```
   Conserva el resto del archivo y haz **Commit changes**.
7. Abre tu GitHub Pages y actualiza la página. Ya debe aparecer **Ingresa a tu cuenta**. Escribe tu correo, solicita el enlace y ábrelo desde el mismo navegador o uno con acceso a tu correo.
8. Si Brújula detecta datos antiguos en ese navegador, utiliza **Descargar respaldo local** y luego **Importar mis datos locales a la nube**, solo cuando esos datos te pertenezcan. La app crea la fila remota primero y solo elimina la copia local tras confirmar el guardado.
9. Inicia sesión desde otro dispositivo con **el mismo correo** para consultar tu información. Desde la barra lateral puedes actualizarla o cerrar sesión.

### Cómo evita mezclar información

- La tabla `brujula_data` tiene una fila por `auth.users.id`, protegida por RLS.
- La app solicita acceso con el token del usuario y nunca almacena claves privadas.
- Cuando la nube está activa, **Brújula no escribe los datos financieros nuevos en el `localStorage` compartido del navegador**. Supabase sí guarda su sesión de autenticación en el dispositivo.
- Si otro dispositivo guarda una versión diferente, la revisión numérica evita que la escritura más antigua la sobrescriba silenciosamente. El usuario puede descargar el estado sin guardar y volver a cargar la nube.
- El sistema muestra el estado **Guardado en la nube**, **Cambios pendientes** o **Sin guardar**. Nunca presupongas que los cambios están sincronizados si no aparece la confirmación.
- Las copias JSON pueden contener información financiera privada. Guárdalas en un lugar seguro.

### Limitaciones importantes

- El modo nube necesita conexión a Internet. Si se cae la conexión durante una edición, el sistema avisa que hay cambios pendientes y trata de reintentarlo. **No cierres la pestaña hasta confirmar el guardado**.
- Es un primer diseño de sincronización de documento completo, no un sistema multiusuario en tiempo real. Si haces cambios simultáneos desde dos dispositivos, se detectará conflicto y podría requerirse combinar manualmente los registros.
- El servidor y su disponibilidad dependen del proyecto Supabase que conectes. Las políticas RLS deben probarse en un proyecto real antes de ofrecer la aplicación a terceros.
- No compartas contraseñas, secretos ni claves `service_role`. La configuración pública sí puede aparecer en GitHub porque RLS controla el acceso.
- La URL `https://halder42-bit.github.io/brujula-finanzas-colombia/` es la dirección prevista. Si publicas en otro dominio, actualiza los permisos de redirección en Supabase.

### Archivos nuevos v5

- `cloud-config.js`: configuración pública opcional.
- `cloud.js`: login, migración, estado de guardado, control de versiones y cierre de sesión.
- `cloud.css`: pantalla de acceso y avisos.
- `supabase/schema.sql`: tabla PostgreSQL con aislamiento por usuario.

---


## Nueva experiencia en Presupuestos

La sección de presupuestos ahora tiene **dos niveles**:

1. **Carrusel de tarjetas** (primera vista): diez categorías con iconos ilustrativos de alimentación, vivienda, transporte, servicios, salud, educación, deudas, familia, entretenimiento y otros. Las tarjetas incluyen presupuesto asignado, gasto real, barra de progreso, dinero restante y un botón **Editar** grande y cuadrado. Desliza horizontalmente en móvil o usa los botones de flechas.
2. **Panorama completo** (debajo): resumen mensual de presupuesto total, gasto real, diferencia y porcentaje utilizado. Muestra las diez categorías con información detallada y edición directa.

Las categorías con presupuestos asignados aparecen primero en el carrusel. El control conserva los datos de meses anteriores y permite seguir copiando los límites del mes pasado.

### Compatibilidad

Se mantiene el mismo esquema de datos de presupuestos `db.budgets[mes][categoria]`; no hay migración ni pérdida de datos. Sigue disponible el resumen compacto de presupuestos en el panel principal. Este rediseño es una actualización de presentación y navegación.

---


## Saldo total y metas de ahorro realistas

- En el inicio se muestran **Dinero total (efectivo + cuenta)**, ambos saldos separados, **Reservado para metas** y **Libre para gastar o ahorrar**.
- La reserva en metas **no es un gasto ni un ingreso**, y no incrementa tu saldo total. Es dinero de tus cuentas que queda marcado como reservado.
- Los aportes a metas se limitan al dinero libre, descontando los aportes hechos a **todas** las metas; también se limitan a lo que falta para completar cada meta.
- Se rechazan aportes negativos, decimales, futuros, superiores a los fondos libres y dirigidos a metas inexistentes.
- Los usuarios con aportes antiguos que superan el saldo real ven una advertencia. Los registros existentes no se borran automáticamente.
- Si registras un gasto que reduce el dinero total por debajo de lo reservado, el saldo libre se muestra como $0 con una advertencia: no se borran ahorros antiguos por sorpresa.
- Todo sigue guardado de manera local en el navegador. Se recomienda exportar un respaldo JSON antes de hacer cambios significativos.

**Pruebas:** 31 escenarios de código revisados para esta actualización, entre ellos varias metas, dinero insuficiente, importación de datos existentes, gastos, ingresos y ausencia de saldos iniciales.

---


## Correcciones v4.1

- **Demostración segura:** los datos ficticios se cargan únicamente si la aplicación todavía no tiene saldos, ingresos, gastos, transferencias, presupuestos, metas ni evaluaciones fiscales. Una demo no puede reemplazar saldos reales. La vista de demostración identifica sus números como ficticios.
- **Registro coherente:** al seleccionar cuenta, el método de pago se sincroniza. Los movimientos nuevos nunca guardan las combinaciones contradictorias «Efectivo · Cuenta» o «Débito · Efectivo». El listado también presenta una etiqueta coherente para movimientos antiguos.
- **Caché:** `index.html` utiliza versiones de recursos para que GitHub Pages entregue el código actualizado.
- **Datos:** se mantiene el mismo almacenamiento local y no se borran datos de usuarios existentes.

**Pruebas:** 26 comprobaciones automatizadas del código, incluidos saldos, consignaciones, gastos, demo y migración de registros anteriores. No sustituyen una auditoría financiera ni una prueba completa del navegador.

---


## Nuevo: efectivo, cuenta y traslados de dinero propio

- **Primer ingreso:** dos saldos separados, dinero en efectivo y dinero en cuenta o billeteras digitales (Nequi, Daviplata, bancos).
- **Panel principal:** muestra el total y el detalle de efectivo y cuenta.
- **Gastos e ingresos:** selecciona a qué cuenta pertenece cada movimiento. El gasto reduce solo ese saldo; el ingreso aumenta solo ese saldo.
- **Consignación:** traslada efectivo a cuenta sin aumentar los ingresos.
- **Retiro:** traslada dinero de la cuenta a efectivo sin aumentar los ingresos.
- **Historial de traslados:** aparece separado de los ingresos, gastos y presupuestos; permite eliminar un traslado registrado por error.
- **Control de saldo:** no permite consignar o retirar más dinero del saldo disponible en la cuenta de origen.
- **Compatibilidad con v3:** muestra una propuesta para repartir el saldo anterior, conservando los movimientos ya registrados. Se puede ajustar el reparto libremente.
- **Ajustar saldos:** toma una nueva fotografía del dinero actual y evita contabilizar de nuevo operaciones anteriores.
- **Respaldos JSON:** conservan los saldos y traslados al exportar e importar.

### Importante

Esto es un registro **manual**, no realiza transferencias bancarias reales. Las transferencias entre dinero propio no se suman al cálculo de ingresos de la app; las **consignaciones y depósitos** deben revisarse por separado en el radar fiscal a partir de los extractos correspondientes. Los datos permanecen en el almacenamiento local del navegador y **no se sincronizan entre dispositivos**.

### Archivos necesarios para GitHub Pages

Coloca estos siete archivos en la raíz del repositorio:

- \`index.html\`
- \`styles.css\`
- \`app.js\`
- \`balance.css\`
- \`balance.js\`
- \`wallets.css\`
- \`wallets.js\`

GitHub Pages: Settings → Pages → Deploy from a branch → main / (root).

---


## Novedad: saldo inicial y dinero disponible

Al entrar por primera vez, la aplicación te pregunta cuánto dinero tienes actualmente en efectivo, bancos y billeteras digitales. Ese saldo inicial **no es un ingreso**. Los movimientos nuevos de ingresos y gastos modifican el saldo disponible. Puedes ajustar el saldo cuando necesites reconciliarlo con tu dinero real: el ajuste mantiene el historial pero no vuelve a contar movimientos antiguos.

Los usuarios de v2 conservan su información en el mismo navegador; verán una opción para configurar su saldo actual. La información sigue almacenándose únicamente en el navegador, sin sincronización entre dispositivos.

## Archivos v3

Mantén `index.html`, `styles.css`, `app.js`, `balance.css` y `balance.js` juntos en la raíz. GitHub Pages se despliega desde la rama `main`, carpeta raíz.

---


Aplicación estática de finanzas personales para Colombia. Funciona con HTML, CSS y JavaScript sin compilación ni dependencias externas.

## Empezar

Abre `index.html` desde un servidor web local o publica estos tres archivos juntos. En GitHub: crea un repositorio, sube `index.html`, `styles.css` y `app.js` en la raíz y activa **Settings → Pages → Deploy from a branch → main / (root)**.

## Uso

1. En la página principal elige **Registrar gasto** o **Registrar ingreso**.
2. Escribe el monto (por ejemplo `25.000` o `25000`), el concepto opcional y la categoría.
3. La fecha se propone según el mes que estás viendo. Al guardar, te lleva automáticamente al registro del mes de esa fecha y resalta el nuevo movimiento.
4. Los demás módulos permiten administrar presupuestos mensuales, metas de ahorro, tareas y un radar tributario orientativo.

## Datos y privacidad

- Se guardan solamente en `localStorage` del navegador con la clave `brujula_colombia_v1`, lo que permite conservar datos del prototipo anterior **en el mismo origen web**.
- Un archivo local y un dominio de GitHub Pages tienen orígenes diferentes: los datos NO se migran automáticamente entre ambos. Usa Configuración → Exportar respaldo e Importar respaldo.
- No existe base de datos online, autenticación ni sincronización.
- Publicar el código no publica tus registros locales, pero cualquier persona podrá abrir la web si el Pages está configurado como público.
- El módulo tributario es informativo. Confirma normas y valores aplicables con DIAN o contador antes de tomar decisiones.

## Cambios respecto a v1

- Pantalla principal con acceso directo a gasto e ingreso.
- Formulario simplificado con modo de gasto/ingreso, monto destacado, campos mínimos y opciones avanzadas plegadas.
- Acepta números en formato colombiano como `15.000`.
- Al guardar, cambia automáticamente al mes del movimiento, lo muestra y resalta.
- Mejora el aviso cuando el navegador no puede almacenar los datos.
- Código dividido en HTML, CSS y JS para facilitar el trabajo en GitHub.

## Desarrollo

Sin dependencias externas. Pruebas de interacción disponibles en `tests/smoke_test.py` (requiere Python y Playwright con Chromium).

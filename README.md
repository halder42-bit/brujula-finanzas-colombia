# Brújula — Finanzas personales v3

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

# Almorzeitor

App web para coordinar almuerzos de grupo en el bar De Luca's (Mas Camarena).

## Qué hace

Un grupo de compañeros de trabajo (5-15 personas, normalmente miércoles y jueves) usa esta app para:
1. Alguien crea una lista de almuerzo con fecha, hora, nombre de reserva y hora límite para apuntarse
2. Comparte el link y cada compañero se apunta eligiendo bocadillo de la carta, algo personalizado, o solo reservando sitio
3. Tras la hora límite, la lista se bloquea
4. Cualquiera puede pulsar "Enviar pedido por WhatsApp" que abre WhatsApp con el mensaje preparado (protocolo `whatsapp://`)

## Stack

- **Backend**: Node.js + Express, datos en memoria (sin BD, las listas son efímeras)
- **Frontend**: HTML/CSS/JS vanilla (sin frameworks), optimizado para móvil
- **Despliegue**: Render (free tier) — la app se duerme tras 15min sin visitas

## Estructura

- `config.js` — Bares, menú de bocadillos y defaults (hora límite, etc). El teléfono del bar está aquí
- `server.js` — API REST (listas, entries, generación de mensaje WhatsApp)
- `public/` — Frontend estático (index.html, style.css, app.js)

## Decisiones de diseño

- **Sin autenticación**: cualquiera con el link puede crear listas, apuntarse y enviar el pedido
- **Sin roles**: pensado para que funcione aunque el "organizador" habitual no esté
- **Timezone**: el deadline se construye en el navegador del cliente (zona horaria local) y se envía como ISO/UTC al servidor. Esto evita problemas con Render (que corre en UTC)
- **Datos como colecciones**: aunque ahora solo hay un bar y una lista activa, el modelo de datos usa arrays/maps para facilitar futuras ampliaciones (múltiples bares, múltiples listas)
- **Polling**: el frontend hace polling cada 10s para sincronizar entre usuarios, pero no re-renderiza si no hay cambios (para no perder selecciones del usuario)
- **WhatsApp**: usa protocolo `whatsapp://send` para abrir la app directamente sin pestaña intermedia del navegador
- **Mensaje WhatsApp**: no incluye nombres propios (solo el nombre de la reserva), agrupa bocadillos por cantidad sin el número del menú

## Mejoras futuras previstas

- Múltiples listas simultáneas (para que distintos grupos reserven sus propias mesas)
- Múltiples bares (actualmente solo De Luca's, pero la estructura lo soporta)

## Comandos

```bash
npm install    # Instalar dependencias
node server.js # Arrancar en http://localhost:3000
```

## Repo y despliegue

- GitHub: https://github.com/Guillermo-David/almorzeitor
- Render: redeploy automático al hacer push a main

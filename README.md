# ⚡ Rabbit Viewer (`rabbit-viewer`)

Una interfaz web moderna, minimalista y de alta precisión para **RabbitMQ**, inspirada en la estética técnica de [Hermes](https://hermes-agent.nousresearch.com/), diseñada específicamente para **visualizar, diagnosticar e inspeccionar mensajes atascados en colas**.

---

## 🎯 Capacidades Principales

1. **Gestor Multi-Instancia de Conexiones (Brokers):**
   - Configuración de múltiples perfiles de conexión (ej. *Local Docker*, *Staging Cluster*, *Prod Workers*).
   - Credenciales **100% en el cliente**: se almacenan únicamente en el `localStorage` del navegador y viajan en encabezados al proxy en cada petición. Nunca se persisten en bases de datos ni en el backend.
   - Prueba en tiempo real de conectividad (`⚡ Test Connection`) con reporte de versión de RabbitMQ, Erlang y nombre del cluster.
   - Exportación e importación de perfiles en formato JSON.

2. **Detección Inmediata de Colas Atascadas (*Stuck Queues*):**
   - Detección visual automática cuando una cola tiene mensajes listos (`messages_ready > 0`) pero **ningún consumidor activo** (`consumers === 0`).
   - Badges de alerta pulsantes: `[ ⚠️ STUCK: NO ACTIVE CONSUMERS ]`.
   - Filtro rápido para aislar instantáneamente las colas con mensajes varados sin listeners.

3. **Visualizador de Colas en Orden Real (FIFO Pipeline):**
   - Vista en forma de fila/línea de ensamblaje horizontal o vertical: `[ #1 HEAD OF QUEUE ]` → `[ #2 ]` → `[ #3 ]`.
   - Muestra de cada mensaje:
     - **Payload con Syntax Highlighting JSON**, selector de formato Raw/Formatted, y botón de copia rápida al portapapeles.
     - Indicador de reenvío: `[ ⚠️ REDELIVERED ]`.
     - Routing Key, Exchange, Delivery Mode y tamaño en bytes.
     - `correlation_id` y `reply_to` (vital para diagnosticar llamadas RPC y microservicios atascados).
     - Tabla expandible de headers personalizados.

4. **Operaciones Seguras y Destructivas con Confirmación:**
   - **Espiar (Peek) mensajes:** Usa `ackmode: "ack_requeue_true"` para inspeccionar el contenido exacto de los mensajes en cola **sin consumirlos ni eliminarlos**.
   - **Ack / Drop Head Message:** Permite consumir y eliminar el mensaje que está al frente de la cola tras confirmación explícita.
   - **Purgar Cola Completa:** Requiere confirmación tipada escribiendo la palabra `PURGE` antes de vaciar la cola.

5. **Auto-Refresh Configurable:**
   - Intervalos de refresco en tiempo real (Off, 3s, 5s, 10s, 30s) tanto para la lista de colas como para las métricas de la cola individual.

6. **Diseño Inspirado en Hermes con Paleta Personalizable:**
   - Tipografía monospaciada técnica (`JetBrains Mono` / `Inter`).
   - Marcos limpios, badges de estado con corchetes, fondos oscuros de alto contraste (`#08090d`).
   - Selector de color de acento integrado: *Solar Amber* (`#ff5500`, por defecto), *Acid Emerald* (`#00e575`), *Cyber Cyan* (`#00bfff`) y *Electric Violet* (`#8a2be2`).

---

## 🛠️ Arquitectura

- **Backend (`/server`):** Node.js + Express + TypeScript. Actúa como un proxy transparente y sin estado hacia la Management HTTP API de RabbitMQ (`15672`). Elimina problemas de CORS y permite interactuar con cualquier broker RabbitMQ sin exponer credenciales directamente en el código fuente.
- **Frontend (`/client`):** React 18 + Vite + TypeScript + Tailwind CSS + Lucide Icons.

---

## 🚀 Inicio Rápido

### Prerrequisitos
- Node.js 18+ o superior (verificado con Node v24).
- Un broker RabbitMQ con el plugin de Management activo (por defecto en el puerto `15672`).

### 1. Clonar e Instalar Dependencias
Desde la raíz del proyecto:
```bash
npm install
```

### 2. Modo Desarrollo (Frontend + Backend concurrentes)
Ejecuta ambos servidores simultáneamente con recarga automática:
```bash
npm run dev
```
- **Frontend (Vite):** [http://localhost:5173](http://localhost:5173) (con proxy automático hacia el backend).
- **Backend Proxy (Express):** [http://localhost:3001](http://localhost:3001).

### 3. Modo Producción
Para compilar ambos paquetes y correr el servidor unificado:
```bash
npm run build
npm start
```
Abre en tu navegador [http://localhost:3001](http://localhost:3001).

---

## 📡 Endpoints del Proxy Backend

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Estado del proxy. |
| `POST` | `/api/test-connection` | Verifica credenciales y conectividad con `/api/whoami` y `/api/overview`. |
| `GET` | `/api/overview` | Métricas generales del broker. |
| `GET` | `/api/vhosts` | Lista de Virtual Hosts disponibles. |
| `GET` | `/api/queues?vhost=/` | Lista de colas para el vhost especificado. |
| `GET` | `/api/queues/:vhost/:queue` | Detalle y métricas de una cola específica. |
| `POST` | `/api/queues/:vhost/:queue/messages` | Peek o consumo de mensajes (`ack_requeue_true` o `ack_requeue_false`). |
| `DELETE` | `/api/queues/:vhost/:queue/contents` | Purga total de mensajes de una cola. |

---

## 🔒 Seguridad y Privacidad
- La aplicación **no cuenta con base de datos propia** ni persistencia en disco de credenciales.
- Los datos de acceso a RabbitMQ se transmiten mediante encabezados HTTP seguros (`x-rmq-host`, `x-rmq-port`, `x-rmq-user`, `x-rmq-pass`, `x-rmq-vhost`) enviados desde el navegador únicamente cuando se ejecutan las llamadas.

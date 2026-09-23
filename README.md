# Lead Prospecting Agent — Prospección IA multi-fuente

Sistema de generación de leads B2B que corre en [Make.com](https://make.com), pensado para vender servicios de automatización con IA (chatbots de WhatsApp, agentes IA, automatización de procesos) a pymes y negocios locales en LatAm.

Todos los días a las 08:00 AR, el agente:

1. Elige un rubro y una ciudad según un contador rotativo guardado en Google Sheets (12 combinaciones: inmobiliarias, consultorios odontológicos, gimnasios, salones de belleza, restaurantes, talleres mecánicos, estudios contables, hoteles y veterinarias, en Buenos Aires, Córdoba, Rosario y Mendoza).
2. Busca negocios de ese rubro/ciudad en **tres fuentes en paralelo**: Google Maps, búsqueda de páginas de Facebook y hashtags de Instagram (vía actors de [Apify](https://apify.com)).
3. Le pasa los resultados crudos a Claude junto con el CSV de negocios ya cargados, para que: descarte duplicados, puntúe cada negocio como lead `alta` / `media` / `baja` / `descartar` según señales de negocio (sin sitio web, sin automatización, alto volumen de reseñas con quejas de demora, múltiples sucursales, etc.), y redacte un mensaje de primer contacto corto y personalizado por cada uno.
4. Guarda los leads calificados en Google Sheets y manda un resumen por email — incluso cuando no hay resultados, para que el silencio nunca se confunda con una falla del pipeline.

## Por qué existe

Antes de esto, la prospección era 100% manual: buscar negocios uno por uno, armar una lista, y escribir mensajes a mano. Este agente reemplaza esa parte repetitiva y deja el criterio de calificación (¿vale la pena este lead o no?) en manos de un LLM con instrucciones explícitas, no de reglas rígidas tipo "si tiene más de X reseñas".

## Arquitectura (Make.com)

```
Trigger diario 08:00
  └─ Leer contador de rotación (Google Sheets, celda N1)
  └─ Avanzar el contador al siguiente rubro/ciudad (0-11, cíclico)
  └─ Exportar la hoja de negocios existentes como CSV (para deduplicar)
  └─ Router (3 ramas en paralelo, una por fuente)
       ├─ Google Maps  (Apify: compass/crawler-google-places)
       ├─ Facebook     (Apify: apify/facebook-search-scraper)
       └─ Instagram    (Apify: apify/instagram-scraper, búsqueda por hashtag)
  Cada rama, si hay resultados:
       └─ Claude (structured output / JSON schema) → califica cada negocio,
          dedup contra el CSV, redacta mensaje de contacto
       └─ Parsear JSON de respuesta (con manejo de error si Claude corta la respuesta)
       └─ Email de resumen del día (o de "no se pudo procesar" si algo falla)
       └─ Por cada lead con prioridad != "descartar": agregar fila a Google Sheets
  Si una fuente no tuvo resultados: email de "sin negocios nuevos hoy" igual
```

Puntos de diseño que vale la pena remarcar:

- **Cada fuente es independiente**: si Instagram falla o no devuelve nada, Google Maps y Facebook siguen su curso normal. Nada bloquea a nada.
- **Dedup contra la base real, no contra la corrida anterior**: el CSV se exporta fresco en cada ejecución, así que un negocio no se vuelve a sugerir aunque haya entrado por otra fuente en otro día.
- **Salida estructurada (JSON Schema)**: en vez de parsear texto libre, el prompt le pide a Claude una respuesta con schema fijo (`leads[]` + `resumen_email`), lo que hace el pipeline mucho más robusto que "parsear lo que devuelva".
- **Manejo de error explícito en cada paso crítico**: si Claude corta la respuesta a mitad de un JSON grande (pasa con arrays largos), el `onerror` de `ParseJSON` evita que el escenario se rompa en silencio.

## El prompt de calificación de leads

Ver [`docs/ai-prompt-lead-scoring.md`](docs/ai-prompt-lead-scoring.md) — es el prompt real (sanitizado de datos de contacto propios), con las reglas de priorización, el formato de salida y las instrucciones anti-alucinación ("no inventes datos que no estén en el JSON de entrada").

## Scripts locales complementarios

Antes de que el agente en Make cubriera Facebook e Instagram, la prospección de Google Maps se hacía en tandas grandes con un puñado de scripts Node.js sencillos (sin dependencias externas más que `fetch`). Se mantienen en [`scripts/`](scripts/) porque documentan bien el patrón de trabajo: scrapear por zona → combinar y deduplicar por `placeId` → filtrar exclusiones manuales → auditar manualmente qué negocios ya tienen algún tipo de automatización.

| Script | Qué hace |
|---|---|
| `scrape-zone.mjs` | Llama a un actor de Apify (Google Maps) para una zona puntual y guarda el resultado crudo en JSON. |
| `combine.mjs` | Combina el JSON de varias zonas, deduplica por `placeId` (evita duplicados en búsquedas de zonas superpuestas) y marca posibles cadenas (mismo nombre en más de una dirección). |
| `filter.mjs` | Excluye de la lista final negocios ya revisados manualmente (ejemplo con datos ficticios en este repo — la lista real vive en un archivo separado, no versionado). |
| `add-chatbot-status.mjs` | Cruza cada negocio contra un mapa de dominio → estado de automatización, completado a mano revisando cada sitio (ejemplo con datos ficticios). |

## Stack

- **Make.com**: orquestación, scheduling, routing, Google Sheets, Gmail.
- **Apify**: actors de scraping para Google Maps, Facebook y Instagram.
- **Claude (Anthropic API)**: calificación de leads y redacción de mensajes, con `structured output` (JSON Schema).
- **Google Sheets**: base de leads + contador de rotación de rubro/ciudad.
- **Node.js** (scripts locales): preprocesamiento por lotes antes de que existiera la rama de Facebook/Instagram.

## Notas de auditoría honesta

- El HTTP module que llama a Apify tiene el token de API puesto directamente en el header `Authorization`, en vez de usar una conexión/credential store de Make. Funciona, pero no es la práctica recomendada — un blueprint exportado sin cuidado podría filtrar el token. Pendiente: migrarlo a un connection type propio o a una variable de entorno del escenario.
- Los IDs reales de spreadsheet, chat de Telegram y cuentas de Facebook/Instagram fueron reemplazados por placeholders en este repo. La lógica y estructura son 100% las del escenario en producción.
- No hay tests automatizados — el escenario se valida corriendo manualmente y revisando el log de ejecución en Make.

## Por Andrés Serrano

Parte de una fábrica de agentes de IA para pymes ([@adantonlabs](https://instagram.com/adantonlabs)). Ver también: [crm-agent-inmobiliaria-portfolio](https://github.com/andresjsa25/crm-agent-inmobiliaria-portfolio) (agente de calificación de leads para inmobiliarias) y [marketing-content-agent-portfolio](https://github.com/andresjsa25/marketing-content-agent-portfolio) (agente de generación y publicación de contenido).

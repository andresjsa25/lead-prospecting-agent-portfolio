# Prompt real de calificación de leads

Este es el prompt que usa el módulo `anthropic-claude:createAMessage` en cada una de las tres ramas del escenario (Google Maps / Facebook / Instagram). Solo cambia una frase que indica la fuente de datos ("extraídos de Google Maps" / "extraídos de Facebook" / "extraídos de Instagram (búsqueda por hashtag de rubro+ciudad)").

Se transcribe tal cual corre en producción, salvo el bloque de negocios de ejemplo que fue reemplazado por `<negocios_json>` y `<csv_negocios_existentes>` para no exponer datos reales de terceros.

```
Eres un asistente que evalua leads B2B para servicios de automatizacion con IA
(chatbots WhatsApp, agentes IA, automatizacion de procesos) dirigidos a pymes y
negocios locales en LatAm.

A continuacion tienes un ARRAY JSON con varios negocios extraidos de Google Maps
(formato crudo, los nombres de campo pueden variar segun la fuente). Algunos
negocios pueden incluir datos de contacto enriquecidos desde su sitio web (email,
redes sociales) si estaban disponibles publicamente.

<negocios_json>

Estos son los negocios que YA estan cargados en nuestra base (CSV exportado de la
planilla, columna 'negocio'). Si un negocio del array de arriba coincide con uno
de esta lista (aunque tenga mayusculas, tildes o espacios distintos), NO lo
repitas: marcalo con prioridad "descartar" y señal_detectada "Ya existe en la base".

CSV de negocios existentes:
<csv_negocios_existentes>

Tu tarea: evalua CADA negocio del array por separado y devuelve un lead evaluado
por cada uno (mismo orden, uno por cada elemento del array de entrada). SE MUY
BREVE: mensaje_sugerido maximo 2 lineas cortas, señal_detectada maximo 6 palabras.
Esto es obligatorio para no exceder el limite de tokens de salida.

Para cada negocio:
1. Primero revisa si ya existe en la base (ver arriba). Si existe, prioridad "descartar".
2. Si no existe, evalua si es un buen lead considerando estas senales de prioridad
   (de mayor a menor peso): no tiene sitio web o es muy basico/desactualizado;
   tiene muchas resenas (alta actividad) pero senales de atencion manual (sin
   chatbot, sin respuestas automaticas, quejas de demora en las resenas); rubro
   conversacional donde WhatsApp/atencion al cliente es clave (clinicas, salones,
   restaurantes, inmobiliarias, gimnasios, talleres, hoteles, estudios
   profesionales); multiples ubicaciones/sucursales; resenas mencionando demoras
   o falta de atencion.
3. Si el negocio NO tiene telefono ni sitio web utilizable Y no hay ninguna senal
   clara, marca prioridad "descartar".
4. Redacta un mensaje de primer contacto MUY corto (maximo 2 lineas), personalizado
   con el nombre del negocio y la senal detectada, ofreciendo un agente de
   IA/automatizacion de WhatsApp. Tono profesional, cercano, en espanol. El mensaje
   DEBE cerrar con una llamada a la accion breve (ej: "¿Te muestro una demo?").
5. Si falta informacion clave (telefono, nombre) que no se puede inferir de los
   datos, indicalo con el string "NO_DISPONIBLE" en ese campo. No inventes datos
   que no esten presentes en el JSON de entrada.
6. Formatea el campo telefono SIN el signo "+" al inicio (ejemplo: "54 11
   xxxx-xxxx" en vez de "+54 11 xxxx-xxxx"). Esto es obligatorio: la hoja de
   calculo interpreta un "+" inicial como formula y rompe el dato.
7. Extrae el campo email si el negocio tiene uno disponible en los datos de
   contacto enriquecidos. Si no hay ninguno, usa "NO_DISPONIBLE". No inventes emails.

Ademas, arma el campo resumen_email: SOLO negocios con prioridad distinta de
"descartar". Cada negocio en una linea distinta, EXACTAMENTE en este formato,
usando el separador HTML <br> literal entre cada negocio (NO uses saltos de
linea, usa <br>):
Nombre (prioridad) | Telefono | Email | Sitio web | Senal breve<br>Nombre2
(prioridad) | Telefono | Email | Sitio web | Senal breve

Si todos los negocios evaluados terminaron con prioridad "descartar" (ningun
lead nuevo hoy), resumen_email debe decir exactamente: "No se encontraron leads
nuevos hoy."
```

## Salida (JSON Schema)

El módulo usa `outputFormat: json_schema` en vez de pedir JSON por instrucción de texto, así la respuesta es siempre parseable:

```json
{
  "type": "object",
  "required": ["leads", "resumen_email"],
  "properties": {
    "leads": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "prioridad", "negocio", "rubro", "ciudad", "telefono",
          "email", "sitio_web", "cantidad_resenas",
          "señal_detectada", "mensaje_sugerido"
        ],
        "properties": {
          "prioridad": { "enum": ["alta", "media", "baja", "descartar"], "type": "string" },
          "negocio": { "type": "string" },
          "rubro": { "type": "string" },
          "ciudad": { "type": "string" },
          "telefono": { "type": "string" },
          "email": { "type": "string" },
          "sitio_web": { "type": "string" },
          "cantidad_resenas": { "type": "string" },
          "señal_detectada": { "type": "string" },
          "mensaje_sugerido": { "type": "string" }
        },
        "additionalProperties": false
      }
    },
    "resumen_email": { "type": "string" }
  },
  "additionalProperties": false
}
```

### Por qué está diseñado así

- **"No inventes datos" repetido dos veces** (puntos 5 y 7): sin esto, el modelo tiende a rellenar campos vacíos con datos plausibles pero falsos. Es la instrucción anti-alucinación más importante del prompt.
- **La regla del "+" en el teléfono** (punto 6) no es un capricho de estilo: es un bug real de Google Sheets (interpreta `+549...` como el inicio de una fórmula) que rompía la hoja antes de agregar esta instrucción.
- **Límite de longitud explícito** ("SE MUY BREVE") existe porque con arrays de entrada grandes, una respuesta verbosa corta el `max_tokens` a mitad del JSON y rompe el parseo — de ahí también el `onerror` en el módulo `ParseJSON` del escenario.

# FlowBot — Constructor de Bots Conversacionales

> Crea bots automatizados con menú interactivo para tus números de WhatsApp. Atención al cliente 24/7 sin código.

---

## Índice

- [¿Qué es FlowBot?](#qué-es-flowbot)
- [Cómo funciona](#cómo-funciona)
- [Crear un FlowBot](#crear-un-flowbot)
  - [Datos básicos](#datos-básicos)
  - [Triggers de activación](#triggers-de-activación)
- [Tipos de nodo](#tipos-de-nodo)
  - [Menú](#menú)
  - [Mensaje](#mensaje)
  - [Redirección](#redirección)
- [Editor de árbol](#editor-de-árbol)
  - [Jerarquía y niveles](#jerarquía-y-niveles)
  - [Acciones por nodo](#acciones-por-nodo)
- [Comando # — Volver al menú](#comando---volver-al-menú)
- [Timeouts de sesión](#timeouts-de-sesión)
- [Preview — Probar el bot](#preview---probar-el-bot)
- [Ejemplo completo: Bot de Clínica](#ejemplo-completo-bot-de-clínica)
- [Buenas prácticas](#buenas-prácticas)

---

## ¿Qué es FlowBot?

FlowBot es un módulo que permite construir bots conversacionales con menú jerárquico, directamente vinculados a un número de WhatsApp. Los bots se configuran desde el panel sin programación: defines preguntas, opciones y respuestas en un editor visual tipo árbol.

Cuando un contacto envía un mensaje que coincide con las palabras clave del bot, FlowBot responde automáticamente guiando al usuario por un menú de opciones. Ideal para:

- **Autoservicio 24/7**: responder consultas frecuentes sin intervención humana.
- **Filtro de reclamos**: dirigir cada caso al área correspondiente.
- **Información**: dar horarios, precios, direcciones sin que un agente intervenga.

---

## Cómo funciona

1. **Activación**: un contacto envía un mensaje que contiene una palabra clave definida en el bot.
2. **Menú principal**: FlowBot responde con un menú numerado (opciones 1, 2, 3…).
3. **Navegación**: el contacto responde con el número de la opción deseada.
4. **Profundidad**: puede avanzar hasta 3 niveles dentro del árbol.
5. **Cierre**: llega a un nodo de tipo Mensaje que muestra la información final.
6. **Volver**: en cualquier momento, el contacto envía `#` para regresar al menú principal.

---

## Crear un FlowBot

En el menú lateral, haz clic en **Flow Bots** y luego en **+ New Bot**.

### Datos básicos

| Campo | Descripción |
|-------|-------------|
| **Bot Name** | Nombre interno del bot. Ej: "Atención Clínica" |
| **WhatsApp Connection** | Selecciona qué número de WhatsApp responderá con este bot |
| **Enabled** | Activa o desactiva el bot. Solo los bots activos responden mensajes |
| **Trigger Keywords** | Palabras o frases que activan el bot (una por línea) |

### Triggers de activación

Cuando un contacto envía un mensaje de texto, FlowBot revisa si el mensaje contiene alguna de las palabras clave definidas. Si hay coincidencia, el bot responde con su menú principal.

Ejemplo: si defines `horarios`, `atención`, `consulta`, cualquier mensaje que contenga esas palabras (ej: "¿cuál es el horario de atención?") activará el bot.

> **Importante**: la comparación ignora mayúsculas/minúsculas. Basta con que el mensaje *contenga* la palabra clave, no necesita ser exacta.

---

## Tipos de nodo

Cada nodo en el árbol tiene un tipo que define cómo se comporta:

### Menú

| Característica | Detalle |
|----------------|---------|
| **Propósito** | Presenta opciones numeradas al contacto |
| **Contenido** | Texto descriptivo + lista de hijos (se numeran automáticamente) |
| **Hijos** | Puede tener múltiples nodos hijos (opciones de menú) |
| **Comportamiento** | Muestra el texto del nodo seguido de la lista numerada de hijos. Espera que el contacto elija un número |
| **Raíz** | El nodo raíz del árbol **siempre** debe ser de tipo Menú |

Ejemplo de menú enviado al contacto:

```
Bienvenido a la Clínica San José. ¿cómo podemos ayudarte?

*1* - Agendar hora
*2* - Consultar horarios
*3* - Hablar con un ejecutivo
```

### Mensaje

| Característica | Detalle |
|----------------|---------|
| **Propósito** | Envía un texto informativo al contacto (nodo hoja) |
| **Contenido** | El mensaje que se enviará |
| **Hijos** | No puede tener hijos |
| **Comportamiento** | Envía el contenido y la sesión finaliza. Si hay más nodos Mensaje hermanos, se envían en secuencia |

### Redirección

| Característica | Detalle |
|----------------|---------|
| **Propósito** | Salta a otro nodo del árbol sin mostrar contenido propio |
| **Destino** | Debes seleccionar el nodo de destino en "Redirect To Node" |
| **Hijos** | No aplica |
| **Comportamiento** | Redirige automáticamente al nodo destino, ejecutando su tipo (menú o mensaje) |

Útil para: crear atajos, reutilizar sub-árboles, o devolver al usuario a un punto específico.

---

## Editor de árbol

Desde la lista de bots, haz clic en el ícono **Árbol** (tercer ícono) para entrar al editor visual.

### Jerarquía y niveles

- El árbol tiene un máximo de **3 niveles** de profundidad.
- El **nodo raíz** (nivel 1) siempre es de tipo Menú.
- Los **nodos hijo** (nivel 2) pueden ser Menú, Mensaje o Redirección.
- Los **nodos nieto** (nivel 3) solo pueden ser Mensaje o Redirección (no pueden tener hijos).
- Cada nodo muestra una etiqueta `L1`, `L2` o `L3` que indica su nivel.

### Acciones por nodo

Cada nodo tiene una barra de acciones que aparece al pasar el mouse:

| Acción | Ícono | Descripción |
|--------|-------|-------------|
| **Expandir/Colapsar** | ▼ / ▶ | Muestra u oculta los hijos del nodo |
| **Agregar hijo** | ➕ | Crea un nuevo nodo hijo (solo disponible si nivel < 3) |
| **Editar** | ✏️ | Abre el modal para modificar título, contenido o tipo |
| **Eliminar** | 🗑️ | Elimina el nodo y todos sus descendientes |
| **Subir** | ▲ | Mueve el nodo una posición arriba entre sus hermanos |
| **Bajar** | ▼ | Mueve el nodo una posición abajo entre sus hermanos |

Para crear el primer nodo raíz, haz clic en **Add Root Node**. Si ya existe un nodo raíz, agrega hijos desde el botón ➕ de cada nodo.

### Modal de edición de nodo

Al hacer clic en **Editar** o **Agregar hijo**, se abre un modal con los siguientes campos:

| Campo | Descripción |
|-------|-------------|
| **Node Title** | Nombre del nodo (se muestra en la lista del menú) |
| **Node Type** | Menú, Mensaje o Redirección |
| **Content** | Texto que se envía al contacto. Para menús, describe las opciones disponibles |
| **Trigger Keywords** | Solo visible en nodos raíz. Palabras clave que activan el bot |
| **Redirect To Node** | Solo visible para tipo Redirección. Selecciona el nodo destino |

---

## Comando # — Volver al menú

En cualquier momento de la conversación, el contacto puede enviar `#` (símbolo numeral) y FlowBot lo regresará al **menú principal** (nodo raíz), reiniciando la navegación desde el inicio.

Esto es útil si el contacto se pierde, quiere cambiar de opción, o si la sesión estaba a medio camino.

---

## Timeouts de sesión

Cada conversación con un bot tiene una **sesión activa** con tiempo límite:

- **Duración máxima de inactividad**: 30 minutos.
- Si el contacto no responde dentro de ese período, la sesión expira.
- Al expirar, el contacto puede escribir cualquier mensaje (ya no necesita triggers) y el bot responderá desde el menú principal.
- Una tarea programada limpia periódicamente las sesiones expiradas.

---

## Preview — Probar el bot

Desde el editor de árbol, haz clic en el botón **Preview** para abrir un simulador de conversación tipo chat de WhatsApp.

- Escribe un mensaje como si fueras un contacto y observa cómo responde el bot.
- El preview usa una sesión virtual aislada, no afecta sesiones reales de usuarios.
- Puedes navegar por todo el árbol, probar opciones inválidas, y usar `#` para volver al inicio.

---

## Ejemplo completo: Bot de Clínica

Construyamos un bot para la **Clínica San José** con 3 niveles de profundidad.

### Árbol del bot

```
L1 │ 📁 Menú Principal (raíz)
   │   Triggers: "clínica", "san josé", "turno", "horario"
   │
   ├─ L2 │ 📁 Menú: Cardiología
   │      │
   │      ├─ L3 │ 📄 Mensaje: "El Dr. García atende lun–vie 9–13hs.
   │      │         │  Para agendar: whatsapp 11-5555-0101"
   │      │
   │      └─ L3 │ 🔄 Redirección: Volver al menú principal
   │
   ├─ L2 │ 📄 Mensaje: Horarios
   │      │   "🕒 Lunes a viernes: 8:00–20:00
   │      │    🕒 Sábados: 8:00–14:00
   │      │    🏥 Urgencias: 24 horas"
   │
   └─ L2 │ 📁 Menú: Reclamos
          │
          ├─ L3 │ 📄 Mensaje: "📞 Reclamos: 0800-555-CLINICA
          │         │  O escribinos a reclamos@clinica.com"
          │
          └─ L3 │ 🔄 Redirección: Volver al menú principal
```

### Paso a paso para crearlo

1. **Ir a Flow Bots > + New Bot**
   - Name: `Atención Clínica San José`
   - WhatsApp Connection: seleccionar el número
   - Trigger Keywords: ingresar:
     ```
     clínica
     san josé
     turno
     horario
     ```
   - Enabled: activar

2. **Clic en ícono Árbol** → **Add Root Node**
   - Title: `Menú Principal`
   - Type: `Menu`
   - Content: `Bienvenido a la Clínica San José. Elegí una opción:`

3. **Agregar hijo "Cardiología"** (clic ➕ en nodo raíz)
   - Title: `Cardiología`
   - Type: `Menu`
   - Content: `Consultá sobre cardiología:`

4. **Agregar hijo a Cardiología** (clic ➕ en Cardiología)
   - Title: `Información Dr. García`
   - Type: `Message`
   - Content: `El Dr. García atiende lun–vie 9–13hs. Para agendar: whatsapp 11-5555-0101`

5. **Agregar segundo hijo a Cardiología**
   - Title: `Volver al menú principal`
   - Type: `Redirect`
   - Redirect To Node: seleccionar `Menú Principal`

6. **Agregar hijo "Horarios"** al raíz
   - Title: `Horarios`
   - Type: `Message`
   - Content: 🕒 Lunes a viernes: 8:00–20:00\n🕒 Sábados: 8:00–14:00\n🏥 Urgencias: 24 horas

7. **Agregar hijo "Reclamos"** al raíz
   - Title: `Reclamos`
   - Type: `Menu`
   - Content: `Opciones de reclamo:`

8. **Agregar hijos a Reclamos** (Mensaje + Redirección, como en Cardiología)

9. **Probar con Preview**: escribe "horario" y verifica que el bot responda con el menú principal.

### Conversación real

```
Contacto:   "¿tienen horario para clínica?"
FlowBot:    "Bienvenido a la Clínica San José. Elegí una opción:
             *1* - Cardiología
             *2* - Horarios
             *3* - Reclamos"
Contacto:   "1"
FlowBot:    "Consultá sobre cardiología:
             *1* - Información Dr. García
             *2* - Volver al menú principal"
Contacto:   "1"
FlowBot:    "El Dr. García atiende lun–vie 9–13hs. ..."
                                     ← sesión finaliza
Contacto:   "#"
FlowBot:    (vuelve a mostrar el menú principal)
```

---

## Buenas prácticas

### Triggers
- Usa palabras clave específicas del rubro. Evita palabras demasiado genéricas como "hola" o "ayuda".
- Pon las palabras más importantes primero.
- 3 a 7 keywords por bot es un buen rango.

### Menús
- Máximo **10 opciones** por menú. WhatsApp se ve mejor con listas cortas.
- Agrupa opciones relacionadas bajo un mismo sub-menú.
- Siempre incluye una opción para "Volver" o "Salir".

### Árbol
- No superes los 3 niveles. Los usuarios se pierden con más profundidad.
- Cada nodo de tipo Mensaje debe ser conciso. Si es muy largo, el usuario dejará de leer.
- Usa Redirección para evitar duplicar contenido (ej: "Volver al menú" en varios lados).

### Activación
- Prueba el bot con Preview antes de activarlo.
- Monitorea las primeras conversaciones para ajustar triggers que puedan causar falsos positivos.

---

*FlowBot v1.0 — WhaTicket Community*

# FlowBot API Reference

> REST API for creating and managing conversational flow bots with interactive menus.
> Base URL: `http://<your-server>:8080`

All endpoints require authentication via `Authorization: Bearer <token>` header.

---

## Table of Contents

- [FlowBots CRUD](#flowbots-crud)
  - [List FlowBots](#list-flowbots)
  - [Get FlowBot](#get-flowbot)
  - [Create FlowBot](#create-flowbot)
  - [Update FlowBot](#update-flowbot)
  - [Delete FlowBot](#delete-flowbot)
  - [Duplicate FlowBot](#duplicate-flowbot)
- [FlowNodes CRUD](#flownodes-crud)
  - [List Nodes](#list-nodes)
  - [Create Node](#create-node)
  - [Update Node](#update-node)
  - [Delete Node](#delete-node)
  - [Reorder Nodes](#reorder-nodes)
  - [Move Node](#move-node)
- [FlowSessions](#flowsessions)
  - [Get Sessions by Contact](#get-sessions-by-contact)
  - [Delete Session](#delete-session)
- [Preview](#preview)
  - [Preview Bot](#preview-bot)

---

## FlowBots CRUD

### List FlowBots

```
GET /flow-bots
```

Returns all flow bots with their node count. Optionally filtered by WhatsApp connection.

**Query Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `whatsappId` | number | No | Filter bots by WhatsApp connection ID |

**Response `200 OK`**

```json
[
  {
    "id": 1,
    "name": "Atención Clínica",
    "whatsappId": 2,
    "enabled": true,
    "triggerKeywords": "clínica\nsan josé\nhorario",
    "nodesCount": 7,
    "createdAt": "2026-05-20T12:00:00.000Z",
    "updatedAt": "2026-05-20T12:30:00.000Z"
  }
]
```

> The `nodesCount` field is computed via `COUNT(*)` on the FlowNodes table. It is not stored in the database.

---

### Get FlowBot

```
GET /flow-bots/:id
```

Returns a single flow bot by ID.

**Response `200 OK`**

```json
{
  "id": 1,
  "name": "Atención Clínica",
  "whatsappId": 2,
  "enabled": true,
  "triggerKeywords": "clínica\nsan josé\nhorario",
  "createdAt": "2026-05-20T12:00:00.000Z",
  "updatedAt": "2026-05-20T12:30:00.000Z"
}
```

**Response `404 Not Found`**

```json
{
  "error": "FlowBot not found",
  "code": 404
}
```

---

### Create FlowBot

```
POST /flow-bots
```

Creates a new flow bot. The bot is inactive (`enabled: false`) by default.

**Request Body**

```json
{
  "name": "Atención Clínica",
  "whatsappId": 2,
  "triggerKeywords": "clínica\nsan josé\nhorario",
  "enabled": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **Yes** | Display name for the bot |
| `whatsappId` | number | **Yes** | ID of the WhatsApp connection |
| `triggerKeywords` | string | No | Keywords that trigger the bot (one per line) |
| `enabled` | boolean | No | Whether the bot is active (default: `false`) |

**Response `201 Created`**

```json
{
  "id": 1,
  "name": "Atención Clínica",
  "whatsappId": 2,
  "enabled": true,
  "triggerKeywords": "clínica\nsan josé\nhorario",
  "updatedAt": "2026-05-20T12:00:00.000Z",
  "createdAt": "2026-05-20T12:00:00.000Z"
}
```

---

### Update FlowBot

```
PUT /flow-bots/:id
```

Updates one or more fields of an existing flow bot. Partial updates are supported — only send the fields you want to change.

**Request Body**

```json
{
  "name": "Atención Clínica San José",
  "enabled": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | New display name |
| `whatsappId` | number | No | Change the associated WhatsApp connection |
| `triggerKeywords` | string | No | Replace trigger keywords |
| `enabled` | boolean | No | Activate/deactivate the bot |

**Response `200 OK`**

```json
{
  "id": 1,
  "name": "Atención Clínica San José",
  "whatsappId": 2,
  "enabled": false,
  "triggerKeywords": "clínica\nsan josé\nhorario",
  "createdAt": "2026-05-20T12:00:00.000Z",
  "updatedAt": "2026-05-20T13:00:00.000Z"
}
```

---

### Delete FlowBot

```
DELETE /flow-bots/:id
```

Permanently deletes a flow bot and **all** its associated nodes and sessions (cascade delete).

**Response `204 No Content`**

---

### Duplicate FlowBot

```
POST /flow-bots/:id/duplicate
```

Deep-clones a flow bot including its entire node tree. The copy is created with:
- Name: `"<original name> (copy)"`
- Same WhatsApp connection
- `enabled: false` (inactive)
- Deep copy of all nodes with preserved hierarchy and redirect references

**Response `201 Created`**

```json
{
  "id": 8,
  "name": "Atención Clínica (copy)",
  "whatsappId": 2,
  "enabled": false,
  "triggerKeywords": "clínica\nsan josé\nhorario",
  "updatedAt": "2026-05-20T14:00:00.000Z",
  "createdAt": "2026-05-20T14:00:00.000Z"
}
```

---

## FlowNodes CRUD

### List Nodes

```
GET /flow-bots/:id/nodes
```

Returns nodes for a given flow bot. Optionally filtered by parent node to fetch one level at a time.

**Query Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `parentId` | number | No | If omitted, returns root nodes (`parentId IS NULL`). Pass a node ID to get its direct children |

**Response `200 OK`**

```json
[
  {
    "id": 10,
    "flowBotId": 1,
    "parentId": null,
    "title": "Menú Principal",
    "content": "Bienvenido. Elegí una opción:",
    "type": "menu",
    "redirectToNodeId": null,
    "sortOrder": 0,
    "createdAt": "2026-05-20T12:05:00.000Z",
    "updatedAt": "2026-05-20T12:05:00.000Z"
  },
  {
    "id": 11,
    "flowBotId": 1,
    "parentId": 10,
    "title": "Cardiología",
    "content": "Consultá sobre cardiología:",
    "type": "menu",
    "redirectToNodeId": null,
    "sortOrder": 0,
    "createdAt": "2026-05-20T12:06:00.000Z",
    "updatedAt": "2026-05-20T12:06:00.000Z"
  }
]
```

Nodes are sorted by `sortOrder` ascending.

---

### Create Node

```
POST /flow-bots/:id/nodes
```

Creates a new node under the specified flow bot.

**Validation rules:**
- Root nodes (no `parentId`) must be of type `menu`.
- Maximum tree depth is **3 levels**.
- A node of type `redirect` requires `redirectToNodeId`.
- `sortOrder` is auto-assigned (appended after the last sibling).

**Request Body**

```json
{
  "parentId": 10,
  "title": "Cardiología",
  "content": "Consultá sobre cardiología:",
  "type": "menu"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `parentId` | number | No | Parent node ID. Omit or `null` for a root node |
| `title` | string | **Yes** | Display title (shown in menu lists) |
| `content` | string | No | Message body sent to the contact |
| `type` | string | **Yes** | One of: `"menu"`, `"message"`, `"redirect"` |
| `redirectToNodeId` | number | No | Target node ID (required when type is `"redirect"`) |

**Response `201 Created`**

```json
{
  "id": 15,
  "flowBotId": 1,
  "parentId": 10,
  "title": "Cardiología",
  "content": "Consultá sobre cardiología:",
  "type": "menu",
  "redirectToNodeId": null,
  "sortOrder": 0,
  "createdAt": "2026-05-20T12:06:00.000Z",
  "updatedAt": "2026-05-20T12:06:00.000Z"
}
```

**Error Responses**

```json
// 400 — Root node must be of type menu
{ "error": "Root node must be of type menu" }

// 400 — Max flow depth is 3 levels
{ "error": "Max flow depth is 3 levels" }
```

---

### Update Node

```
PUT /flow-nodes/:id
```

Updates an existing node. Supports partial updates. The root node's type cannot be changed.

**Request Body**

```json
{
  "title": "Cardiología (Actualizado)",
  "content": "Nueva descripción del servicio:"
}
```

**Response `200 OK`**

```json
{
  "id": 15,
  "flowBotId": 1,
  "parentId": 10,
  "title": "Cardiología (Actualizado)",
  "content": "Nueva descripción del servicio:",
  "type": "menu",
  "redirectToNodeId": null,
  "sortOrder": 0,
  "createdAt": "2026-05-20T12:06:00.000Z",
  "updatedAt": "2026-05-20T14:15:00.000Z"
}
```

---

### Delete Node

```
DELETE /flow-nodes/:id
```

Removes a node and **all its descendants** (children, grandchildren, etc.). This operation is irreversible.

**Response `204 No Content`**

---

### Reorder Nodes

```
PUT /flow-nodes/:id/order
```

Update the sort order of multiple sibling nodes at once. Accepts two formats.

**Format A — ids + orders arrays** (frontend format)

```json
{
  "ids": [11, 12, 13],
  "orders": [2, 0, 1]
}
```

**Format B — nodes array** (backend format)

```json
{
  "nodes": [
    { "nodeId": 11, "sortOrder": 2 },
    { "nodeId": 12, "sortOrder": 0 },
    { "nodeId": 13, "sortOrder": 1 }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ids` | number[] | In format A | Node IDs in the order they should appear |
| `orders` | number[] | In format A | New `sortOrder` values (parallel to `ids`) |
| `nodes` | object[] | In format B | Array of `{ nodeId, sortOrder }` objects |

**Response `200 OK`**

```json
{}
```

---

### Move Node

```
PUT /flow-nodes/:id/move
```

Move a node to a new parent (re-parenting). Validates:
- Circular references (cannot move a node under itself or its own descendant).
- Depth constraint (resulting subtree depth must not exceed 3 levels).
- Cross-flowBot moves are forbidden.
- Only menu-type nodes can be root.

**Request Body**

```json
{
  "newParentId": 12,
  "newSortOrder": 1
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `newParentId` | number | **Yes** | Target parent node ID. Use `null` to move to root |
| `newSortOrder` | number | No | Desired position among siblings. Omitted = appended at end |

**Response `200 OK`**

```json
{
  "id": 15,
  "flowBotId": 1,
  "parentId": 12,
  "title": "Cardiología",
  "type": "menu",
  "sortOrder": 1,
  "...": "..."
}
```

**Error Responses**

```json
// 400 — Only menu nodes can be root
{ "error": "Only menu nodes can be root" }

// 400 — Circular reference
{ "error": "Cannot move node to its own descendant" }

// 400 — Depth limit
{ "error": "Max flow depth is 3 levels" }
```

---

## FlowSessions

### Get Sessions by Contact

```
GET /flow-sessions/:contactJid
```

Returns all active sessions for a given contact JID (WhatsApp ID).

**Path Parameters**

| Name | Type | Description |
|------|------|-------------|
| `contactJid` | string | The WhatsApp contact JID (e.g. `5511999999999@s.whatsapp.net`) |

**Response `200 OK`**

```json
[
  {
    "id": 5,
    "flowBotId": 1,
    "contactJid": "5511999999999@s.whatsapp.net",
    "currentNodeId": 15,
    "createdAt": "2026-05-20T12:30:00.000Z",
    "updatedAt": "2026-05-20T12:35:00.000Z"
  }
]
```

If no sessions exist, returns an empty array `[]`.

---

### Delete Session

```
DELETE /flow-sessions/:id
```

Terminates a specific session. The contact will need to trigger the bot again to start a new conversation.

**Response `204 No Content`**

```json
// Session not found:
{
  "error": "Session not found"
}
```

---

## Preview

### Preview Bot

```
POST /flow-bots/:id/preview
```

Simulates a conversation with a flow bot without sending actual WhatsApp messages. Uses an isolated preview session (prefix `preview-{id}@flow`) to avoid interfering with real sessions.

**Request Body**

```json
{
  "message": "horario"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | **Yes** | The simulated user message |

**Special commands:**
- `"#"` resets the preview session back to the root menu.
- Any number (e.g. `"1"`) selects a menu option.
- Invalid input returns an error message and re-displays the current menu.

**Response `200 OK`**

Starting a conversation:
```json
{
  "replies": [
    "Bienvenido a la Clínica San José. Elegí una opción:\n\n*1* - Cardiología\n*2* - Horarios\n*3* - Reclamos"
  ],
  "finalNodeId": 10
}
```

After selecting option 1:
```json
{
  "replies": [
    "Consultá sobre cardiología:\n\n*1* - Información Dr. García\n*2* - Volver al menú principal"
  ],
  "finalNodeId": 11
}
```

After selecting a leaf node:
```json
{
  "replies": [
    "El Dr. García atiende lun–vie 9–13hs. Para agendar: whatsapp 11-5555-0101"
  ],
  "finalNodeId": null
}
```

---

## Common Error Codes

| Code | Meaning |
|------|---------|
| `400` | Bad request — validation error (invalid type, depth exceeded, etc.) |
| `401` | Unauthorized — missing or invalid JWT token |
| `404` | Not found — the specified FlowBot, FlowNode, or Session does not exist |
| `500` | Internal server error |

All error responses follow the format:

```json
{
  "error": "Descriptive error message"
}
```

---

## HTTP Status Codes Summary

| Method | Route | Status |
|--------|-------|--------|
| `GET` | `/flow-bots` | `200` |
| `GET` | `/flow-bots/:id` | `200` / `404` |
| `POST` | `/flow-bots` | `201` |
| `PUT` | `/flow-bots/:id` | `200` / `404` |
| `DELETE` | `/flow-bots/:id` | `204` / `404` |
| `POST` | `/flow-bots/:id/duplicate` | `201` / `404` |
| `GET` | `/flow-bots/:id/nodes` | `200` |
| `POST` | `/flow-bots/:id/nodes` | `201` / `400` / `404` |
| `PUT` | `/flow-nodes/:id` | `200` / `404` |
| `DELETE` | `/flow-nodes/:id` | `204` / `404` |
| `PUT` | `/flow-nodes/:id/order` | `200` / `404` |
| `PUT` | `/flow-nodes/:id/move` | `200` / `400` / `404` |
| `GET` | `/flow-sessions/:contactJid` | `200` |
| `DELETE` | `/flow-sessions/:id` | `204` / `404` |
| `POST` | `/flow-bots/:id/preview` | `200` / `404` |

---

## Database Schema Reference

### FlowBots

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | INTEGER | PK, auto-increment |
| `name` | VARCHAR(255) | NOT NULL |
| `whatsappId` | INTEGER | FK → Whatsapps, NOT NULL, CASCADE on delete |
| `enabled` | BOOLEAN | NOT NULL, DEFAULT false |
| `triggerKeywords` | TEXT | nullable |
| `createdAt` | DATETIME | |
| `updatedAt` | DATETIME | |

### FlowNodes

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | INTEGER | PK, auto-increment |
| `flowBotId` | INTEGER | FK → FlowBots, NOT NULL, CASCADE on delete |
| `parentId` | INTEGER | FK → FlowNodes (self), nullable, SET NULL on delete |
| `title` | VARCHAR(255) | NOT NULL |
| `content` | TEXT | nullable |
| `type` | ENUM('menu','message','redirect') | NOT NULL, DEFAULT 'message' |
| `redirectToNodeId` | INTEGER | FK → FlowNodes, nullable |
| `sortOrder` | INTEGER | NOT NULL, DEFAULT 0 |
| `createdAt` | DATETIME | |
| `updatedAt` | DATETIME | |

Index: `(flowBotId, parentId)`

### FlowSessions

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | INTEGER | PK, auto-increment |
| `flowBotId` | INTEGER | FK → FlowBots, NOT NULL, CASCADE on delete |
| `contactJid` | VARCHAR(255) | NOT NULL |
| `currentNodeId` | INTEGER | FK → FlowNodes, nullable, SET NULL on delete |
| `createdAt` | DATETIME | |
| `updatedAt` | DATETIME | |

Index: `contactJid`  
Unique: `(flowBotId, contactJid)` as `uq_flow_sessions_bot_contact`

---

*FlowBot API v1.0 — WhaTicket Community*

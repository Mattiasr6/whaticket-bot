# WhaTicket + FlowBot — Deploy en servidor cliente

## Requisitos
- Ubuntu 22.04/24.04 (o cualquier Linux con Docker)
- Docker + Docker Compose (plugin)
- Git
- Node.js 18+ (para compilar TypeScript)

## Instalación rápida

```bash
# 1. Clonar o copiar el proyecto
git clone <tu-repo> whaticket
cd whaticket

# 2. Configurar entorno
cp .env.example .env
nano .env   # Editar contraseñas y API keys

# 3. Iniciar todo
docker compose up -d --build
```

## Primer uso

1. Abrir `http://<IP-DEL-SERVIDOR>:3000`
2. Registrarse (primer usuario es admin)
3. Ir a **Connections** → **Add WhatsApp** → escanear QR
4. Crear FlowBots y Cron Jobs desde la interfaz

## Puertos

| Servicio | Puerto interno | Puerto externo (default) |
|----------|---------------|--------------------------|
| Frontend | 80 | 3000 |
| Backend | 3000 | 8080 |
| MySQL | 3306 | 3306 |

## Archivos importantes

| Ruta | Propósito |
|------|-----------|
| `.env` | Configuración del sistema |
| `docker-compose.yaml` | Servicios Docker |
| `backend/public/` | Archivos multimedia (imágenes, videos) |
| `.docker/data/` | Datos persistentes de MySQL |

## Variables de entorno clave

| Variable | Descripción |
|----------|-------------|
| `MYSQL_ROOT_PASSWORD` | Contraseña de MySQL |
| `JWT_SECRET` | Secreto para tokens JWT |
| `JWT_REFRESH_SECRET` | Secreto para refresh tokens |
| `OPENCODE_API_KEY` | API Key de OpenCode Go (para AI Agent) |
| `AI_MODEL` | Modelo de IA (default: deepseek-v4-flash) |

## Comandos útiles

```bash
# Ver logs
docker compose logs -f backend

# Ejecutar migraciones
docker compose exec backend npx sequelize db:migrate

# Ejecutar seeds
docker compose exec backend npx sequelize db:seed:all

# Activar AI Agent
docker compose exec mysql mysql -u root -p<password> whaticket -e \
  "UPDATE Settings SET \`value\`='true' WHERE \`key\`='aiAgentEnabled';"

# Backup DB
docker compose exec mysql mysqldump -u root -p<password> whaticket > backup.sql

# Restart
docker compose restart
```

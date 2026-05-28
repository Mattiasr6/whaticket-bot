#!/bin/bash
# === WhaTicket + FlowBot — Setup automático ===
set -e

echo "🚀 Instalando WhaTicket + FlowBot..."
echo ""

# 1. Cargar imágenes Docker
echo "📦 Cargando imágenes Docker..."
docker load -i images.tar

# 2. Crear .env si no existe
if [ ! -f .env ]; then
    echo "📝 Creando .env desde .env.example"
    cp .env.example .env
    # Generar passwords aleatorios
    sed -i "s/your-strong-password/$(openssl rand -hex 12)/" .env
    sed -i "s/your-jwt-secret-here/$(openssl rand -hex 32)/" .env
    sed -i "s/your-jwt-refresh-secret-here/$(openssl rand -hex 32)/" .env
    echo "⚠️  EDITAR .env y poner la API Key de OpenCode Go"
    echo "   nano .env"
    echo ""
fi

# 3. Iniciar servicios
echo "🐳 Iniciando servicios..."
docker compose up -d

# 4. Esperar a que MySQL esté listo
echo "⏳ Esperando MySQL..."
sleep 15

# 5. Migraciones
echo "🗄️  Ejecutando migraciones..."
docker compose exec -T backend npx sequelize db:migrate 2>/dev/null || true
docker compose exec -T backend npx sequelize db:seed:all 2>/dev/null || true

# 6. Crear setting del AI Agent
docker compose exec -T mysql mysql -u root -p$(grep MYSQL_ROOT_PASSWORD .env | cut -d= -f2) whaticket \
  -e "INSERT IGNORE INTO Settings (\`key\`, \`value\`, createdAt, updatedAt) VALUES ('aiAgentEnabled', 'false', NOW(), NOW());" 2>/dev/null

echo "✅ Listo!"
echo "   Abre: http://localhost:3000"
echo "   Registra tu primer usuario y conecta WhatsApp"

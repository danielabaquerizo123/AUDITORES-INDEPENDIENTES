# SISTEM-AUDITORIA

Base tecnica para una plataforma de auditoria. Esta fase contiene estructura, seguridad inicial y entorno local; no incluye reglas contables ni procesamiento financiero definitivo.

## Inicio local

1. Copie `.env.example` a `.env` y reemplace los placeholders antes de usar credenciales reales.
2. Ejecute `docker compose up -d` para PostgreSQL y Redis.
3. Ejecute `npm install`.
4. Ejecute `npm run dev`.

API: `http://localhost:3000/api/health`. Swagger: `http://localhost:3000/api/docs`.

Los archivos de clientes pertenecen a `storage/` y se excluyen de Git.

## Administrador local

Con `backend/.env` configurado, proporcione `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME` y `ADMIN_ORGANIZATION_ID` como variables de entorno y ejecute `npm --workspace backend run create:admin`. No versionar `backend/.env` ni credenciales.

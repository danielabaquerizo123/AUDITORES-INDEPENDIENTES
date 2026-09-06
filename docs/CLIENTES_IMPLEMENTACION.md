# Módulo Clientes — implementación y verificación

Fecha: 5 de septiembre de 2026.

## Resultado

Listado, detalle, edición y registro son pantallas independientes, integradas en el layout existente. Login y Dashboard conservan sus componentes, estilos y assets. No se desarrolló funcionalidad de Contratos.

## Rutas

- `/clientes`: listado, búsqueda por razón social/RUC/representante y paginación real (5 filas por página).
- `/clientes/nuevo`: registro de compañía y representante legal en el mismo formulario.
- `/clientes/:id`: detalle con datos reales.
- `/clientes/:id/editar`: edición y regreso al detalle actualizado.
- Las rutas anteriores `/clients`, `/clients/new`, `/clients/:id` y `/clients/:id/edit` redirigen a sus equivalentes. Las rutas de períodos existentes no se modificaron.

## Endpoints y datos

Se reutilizaron `Client`, `ClientRepresentative` y los endpoints `/api/clients` y `/api/clients/:id`. No se cambiaron modelos Prisma ni se añadieron migraciones.

- `GET /api/clients?page=1&pageSize=5&search=...`: devuelve `{ items, total, page, pageSize }`, incluyendo representantes vigentes. Busca y pagina en PostgreSQL.
- `GET /api/clients` sin parámetros conserva la respuesta de tipo arreglo para consumidores existentes.
- `GET /api/clients/:id`: compañía y representantes vigentes, con el principal primero.
- `POST /api/clients`: admite compañía y objeto `representative`; guarda ambos y su auditoría en una transacción.
- `PATCH /api/clients/:id`: actualiza compañía, RUC y representante en una transacción. Permite borrar correo, teléfono o dirección enviando `null`.
- Los endpoints existentes `GET/POST /api/clients/:clientId/representatives` y `PATCH /api/clients/:clientId/representatives/:representativeId` permanecen compatibles. El nuevo formulario utiliza la petición conjunta para evitar guardados parciales.

Se mantiene el aislamiento por organización, la autenticación JWT y el guard de permisos. Un identificador de representante perteneciente a otro cliente es rechazado y revierte la actualización de la compañía.

## Causa y reparación de permisos

La inspección de la base real encontró un único usuario activo, asociado al rol `ADMIN`, con cero asociaciones `RolePermission`. El seed creaba permisos y roles, pero no los relacionaba; el alta de administrador heredaba ese rol vacío.

Se implementó una asignación idempotente de permisos reales en `grantAdminPermissions`, reutilizada por el seed, el alta de administradores y el script de reparación. El script reparó un rol ADMIN existente, sin cambiar usuario, contraseña ni credenciales y sin omitir controles de autorización.

La comprobación posterior del usuario real devolvió `200` en `/api/auth/me` y `/api/clients?page=1&pageSize=5`, con `clients.read`, `clients.create` y `clients.update` presentes. La base real conserva cero clientes: no se insertaron empresas de demostración.

Si la sesión estaba abierta antes de reparar los permisos, cerrar sesión e ingresar de nuevo actualiza los permisos almacenados en memoria por el frontend.

## Validaciones

- Razón social, RUC, actividad económica y nombres/cédula/cargo del representante obligatorios en el formulario.
- Recorte de espacios y límites de longitud acordes con la API.
- Correos opcionales con formato válido.
- Teléfonos opcionales: dígitos y signos habituales; al menos siete dígitos en el formulario.
- RUC duplicado: respuesta 409 y mensaje visible, tanto al crear como al editar.
- Campos opcionales vacíos se guardan como `null`, evitando que reaparezcan valores anteriores.
- Los datos históricos no presentes en el formulario (país, ciudad, provincia, nombre comercial, estado) se conservan al editar. Para nuevos clientes se envía `country: EC`.
- Errores por campo, error del servidor y estado de guardado visibles. El backend mantiene compatibilidad con sus consumidores anteriores.

## Componentes

Nuevos: `ClientEditor`, `ClientIcon`, `BackToClients`, `ClientLoadState` y `DataRows` (local al detalle).

Actualizados: `ClientsPage`, `ClientDetailPage`, `ClientEditPage`, `ClientNewPage`, `ClientForm`. El header activa su búsqueda únicamente dentro de Clientes; el sidebar navega a `/clientes`.

## Archivos modificados

Frontend:

- `frontend/src/app/routes.tsx`
- `frontend/src/layouts/app-layout.tsx`
- `frontend/src/modules/clients/clients-page.tsx`
- `frontend/src/modules/clients/client-detail-page.tsx`
- `frontend/src/modules/clients/client-edit-page.tsx`
- `frontend/src/modules/clients/client-new-page.tsx`
- `frontend/src/modules/clients/components/client-form.tsx`
- `frontend/src/modules/clients/services/clients.api.ts`
- `frontend/src/modules/clients/schemas/client.schema.ts`
- Las cuatro pruebas de listado, detalle, edición y registro de Clientes.

Backend:

- `backend/src/clients/clients.controller.ts`
- `backend/src/clients/clients.service.ts`
- `backend/src/clients/dto/client.dto.ts`
- `backend/prisma/seed.ts`
- `backend/scripts/create-admin.ts`
- `backend/test/create-admin.integration.spec.js` (limpieza de los permisos creados en la prueba).

## Archivos creados

- `frontend/src/styles/clients.css`
- `frontend/src/modules/clients/components/client-editor.tsx`
- `frontend/src/modules/clients/components/client-icon.tsx`
- `frontend/src/modules/clients/components/client-page-state.tsx`
- `backend/src/auth/admin-permissions.ts`
- `backend/scripts/repair-admin-permissions.ts`
- `backend/test/clients-workflow.integration.spec.js`
- Este reporte.

## Pruebas

- Compilación de frontend y backend.
- Lint de frontend y backend.
- Suite de frontend: 66 pruebas aprobadas.
- Backend: 72 pruebas de integración y 31 unitarias aprobadas.
- Integración específica: reproducción y reparación del 403, guardado y lectura en PostgreSQL, RUC duplicado, rechazo de representante incompleto, actualización y borrado de campos opcionales, reversión transaccional, aislamiento entre organizaciones, búsqueda y paginación.
- Navegador Edge a 100%: 1920×1080, 1440×900, 1366×768 y 390×844, con capturas de las cuatro pantallas. Sin overflow horizontal en el documento; en móvil, desplazamiento limitado al contenedor de tabla.
- Flujo de navegador contra Nest y PostgreSQL de pruebas reales, sin respuestas simuladas: login, Dashboard, listado vacío, validación, crear, verificar persistencia en la base, ver, editar, volver, buscar, paginar y cancelar.
- Aviso de React corregido al cambiar entre el buscador deshabilitado del Dashboard y el controlado de Clientes. Repetición final del flujo sin errores de consola.
- Datos temporales con prefijo TEST aislados por organización en `sistem_auditoria_test` y eliminados al finalizar.

## Diferencias respecto de la referencia

- Se conserva la identidad, logo e iconografía existentes; no se copian empresas ni datos del montaje de referencia.
- La tabla muestra cantidades y páginas reales; en la base real vacía aparece el estado vacío.
- “Observaciones” muestra `—`: el modelo no contiene ese campo y no se inventó un valor ni se añadió persistencia fuera de los campos pedidos.
- El formulario se apila en móvil; la tabla permite desplazamiento horizontal dentro de su contenedor.
- Las capturas de verificación muestran exclusivamente datos TEST, no registros de la organización real.

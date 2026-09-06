# Contratos de auditoría externa — entrega

## Resultado

Módulo integrado en `/contratos`, con búsqueda combinada por razón social/RUC y año auditado, paginación de ocho filas, preparación, consulta, edición y menú de generación Word/PDF. No se añadieron indicadores, columna Estado ni flujos de estados. Se conservan el sidebar, topbar, logo, estilos globales y los módulos aprobados. La única integración en el layout es el destino del enlace Contratos.

## Plantilla maestra

Original: `C:\Users\Usuario\Downloads\Contrato DRIVERNET S.A.  2025.docx`.

Copia: `C:\Users\Usuario\Desktop\SISTEM-AUDITORIA\backend\storage\templates\contracts\contrato-auditoria-externa-base.docx`.

SHA-256 de ambos: `34d5b3039cf619bd3b0a193eb1d7ca274e948564a7942d91fa63a93c51c80598`.

Se verificaron el contenedor ZIP y XML de Word, la identidad byte a byte y la permanencia del original en Descargas. El original no se guardó, movió ni editó. Microsoft Word renderizó la copia en ocho páginas.

## Preservación DOCX

Se inspeccionaron los 65 párrafos y sus runs XML antes de implementar el reemplazo. `template-map.json` identifica 17 posiciones semánticas con índice, rango, texto esperado y regla de mayúsculas. El generador verifica la huella de la plantilla y el texto original de cada párrafo antes de modificarlo.

JSZip abre una copia de la plantilla. Solo se modifican los nodos `w:t` necesarios de `word/document.xml`. Las sustituciones automáticas heredan el formato del run de su posición; las ediciones manuales se aplican mediante diferencias de caracteres, conservando los caracteres no editados en sus runs originales. El contenido se escapa para XML.

No se reconstruye el Word desde HTML ni se utiliza un documento nuevo. Se conservan las propiedades de párrafo/run/sección y todos los demás miembros del DOCX: estilos, márgenes, fuentes, encabezados, pies, imágenes, relaciones, numeración y saltos. Las pruebas comparan estos miembros byte a byte y comparan la estructura XML excluyendo los nodos de texto. No se inserta el logo del sistema: permanece únicamente el de la plantilla.

## Datos automáticos

- Empresa: razón social, RUC, actividad económica y correo.
- Representante vigente: tratamiento, nombre, cédula y cargo.
- Año auditado: exclusivamente las cuatro apariciones del ejercicio auditado en los párrafos 1, 10 (dos apariciones) y 47 del mapa.

Los valores se capturan al preparar el contrato y quedan asociados a él. Los cambios posteriores en Clientes no regeneran silenciosamente su contenido. Los honorarios, plazos, domicilios, jurisdicción y fechas conservan el texto de la plantilla hasta que se editen. No hay cálculo de año + 1. El período contable utiliza el año seleccionado; sus límites de calendario no se utilizan como fechas contractuales.

## Guardado y edición

Se reutilizan `Contract.variables` para identificar la versión/huella de la plantilla y guardar los datos capturados, y `ContractClause` para el texto editable de cada párrafo. La creación del período, si no existe, y del contrato con sus secciones es transaccional. Se impide duplicar el contrato de una empresa para un período existente.

`/contratos/:id/editar` ofrece edición estructurada por secciones desplegables, sin simular Word en el navegador. Permite cambiar fechas, cláusulas, honorarios, firma y textos como “10 días hábiles”. Conserva la estructura de párrafos; saltos introducidos dentro de un campo se normalizan a espacios. No ofrece cambios de tipografía ni inserción de imágenes o páginas.

El guardado actualiza las secciones en una transacción. La versión `updatedAt` evita sobrescribir cambios de otra sesión: un conflicto devuelve 409. No se aceptan identificadores de secciones ajenos a la plantilla. Las generaciones usan las secciones guardadas, no vuelven a aplicar los valores iniciales por encima de las ediciones.

## Ver y generar

`/contratos/:id` muestra empresa, RUC, año y contenido guardado, con regreso al listado, edición y generación. La lectura inicial es una representación de texto; **Ver documento PDF** abre la representación paginada real en un visor independiente dentro de la pantalla.

**Word:** aplica la versión guardada sobre la plantilla, registra `GeneratedDocument`, la huella del archivo y su instantánea de contenido. Descarga mediante el endpoint autenticado existente. Nombre saneado: `Contrato_EMPRESA_AÑO.docx`.

**PDF:** genera el mismo DOCX y lo exporta mediante Microsoft Word instalado en Windows, en una instancia oculta, de solo lectura y sin guardar sobre el DOCX. Las conversiones se serializan y utilizan carpetas temporales independientes. Se registra la huella del DOCX fuente en ambos formatos. La comprobación de navegador confirmó que ambas descargas procedían de exactamente los mismos bytes DOCX.

## Prisma y API

No se modificó `schema.prisma`; no se crearon migraciones, tablas ni se resetearon datos. Se reutilizan `AuditPeriod`, `Contract`, `ContractClause`, `GeneratedDocument` y el registro de auditoría.

Endpoints reutilizados:

- `GET /api/clients`: selección de clientes reales y representantes vigentes.
- `GET /api/contracts`: listado real; búsqueda y paginación se aplican en el frontend sobre esta respuesta.
- `GET /api/contracts/:id`: información y secciones guardadas.
- `PATCH /api/contracts/:id`: se amplía con `sections` y `expectedUpdatedAt`.
- `GET /api/contracts/:id/preview`: admite las secciones de la plantilla oficial.
- `POST /api/contracts/:id/documents`: generación DOCX/PDF de la versión guardada.
- `GET /api/contracts/:id/documents` y `GET /api/contracts/:id/documents/:docId/download`: registro y descarga.

Endpoint añadido: `POST /api/contracts` con `clientId` y `auditedYear`. Resuelve el período y prepara la plantilla oficial en una operación; el alta anterior por período sigue disponible para consumidores existentes.

Se mantienen JWT, permisos y aislamiento por organización. No se cambió autenticación. El administrador real recibió 200 en el listado después de reiniciar el backend.

## Archivos modificados

- `backend/package.json`: JSZip como dependencia directa.
- `package-lock.json`: sincronización de esa dependencia, sin instalar paquetes nuevos.
- `backend/src/contracts/contracts.module.ts`: registro del generador oficial.
- `backend/src/contracts/contracts.controller.ts`: preparación mediante el cliente y año.
- `backend/src/contracts/contracts.service.ts`: preparación, persistencia y generación oficial, conservando compatibilidad con el motor anterior.
- `backend/src/contracts/dto/contracts.dto.ts`: validación de preparación, secciones y versión.
- `frontend/src/app/routes.tsx`: cuatro rutas canónicas y redirección del listado anterior.
- `frontend/src/layouts/app-layout.tsx`: destino del enlace Contratos.
- `frontend/src/modules/contracts/contracts-page.tsx`: listado aprobado.
- `frontend/src/modules/contracts/services/contracts.api.ts`: preparación y actualización estructurada.
- `frontend/src/modules/contracts/contracts-page.test.tsx`: pruebas del comportamiento solicitado, sustituyendo las de la interfaz masiva anterior.

## Archivos creados

- `backend/storage/templates/contracts/contrato-auditoria-externa-base.docx`.
- `backend/storage/templates/contracts/template-map.json`.
- `backend/src/contracts/documents/official-contract-document.ts`.
- `backend/scripts/contract-to-pdf.ps1`.
- `backend/test/official-contract-document.spec.js`.
- `backend/test/official-contract-workflow.integration.spec.js`.
- `frontend/src/modules/contracts/contract-prepare-page.tsx`.
- `frontend/src/modules/contracts/contract-document-page.tsx`.
- `frontend/src/modules/contracts/components/contract-ui.tsx`.
- `frontend/src/styles/contracts.css`.
- Este reporte.

## Verificación

- Build frontend: aprobado.
- Build backend: aprobado.
- Lint frontend y backend: aprobados.
- Frontend: 63 pruebas; tras corregir el selector accesible del menú, las tres pruebas de Contratos pasan y las otras 60 ya habían pasado.
- Backend: 35 pruebas unitarias y 75 de integración aprobadas.
- Pruebas específicas: datos seguros, año separado de firma/plazos, rechazo de duplicados, cliente ajeno, autenticación, edición persistida, conflictos concurrentes, vista previa y contenido Word.
- Prueba adicional de 200 ediciones sobre texto dividido en múltiples runs.
- Edge a 100%: 1920×1080, 1440×900, 1366×768 y 390×844. Las cuatro pantallas se adaptan; en móvil solo la tabla permite desplazamiento horizontal.
- Flujo real contra Nest y PostgreSQL de pruebas: login, preparar, editar, guardar, ver, descargar Word/PDF, abrir visor PDF, buscar por empresa/RUC, combinar año y paginar. Sin respuestas simuladas ni errores de consola.
- Las descargas DOCX y PDF incluyen “20 días hábiles”, la empresa seleccionada y el año 2027. Las fechas no auditadas conservan sus valores originales. El ejemplo verificado mantiene ocho páginas.
- Comparación de fuente: ambos formatos registran el mismo SHA-256 del DOCX; se comprobó contra el Word descargado.
- Los datos temporales se crearon exclusivamente en `sistem_auditoria_test` y se eliminaron al terminar. La base real conserva su cliente existente y cero contratos; no se insertaron empresas ni contratos de demostración.
- Frontend disponible en `http://127.0.0.1:5173`; backend reiniciado en el puerto 3000.

## Limitaciones reales

1. La conversión PDF requiere Microsoft Word instalado y disponible para el usuario que ejecuta el backend en Windows. No es todavía una solución de conversión para un servidor Linux o un servicio Windows sin sesión Office. Si Word falla, la API devuelve 503; no se produce un PDF simplificado o de otra versión.
2. Se conserva el formato, pero Word pagina en función de la longitud del texto. La plantilla y los ejemplos verificados tienen ocho páginas; no se puede garantizar ese número para nombres, actividades o ediciones arbitrariamente extensos sin alterar márgenes, tamaños o saltos. No se aplicaron esas alteraciones. El diseño original ya deja algunos textos sobre la zona decorativa del pie; se respetó tal cual.
3. El editor es estructurado: conserva los párrafos originales y permite editar su texto, no maquetar visualmente un DOCX completo. La fidelidad paginada se revisa en **Ver documento PDF** o en Word.
4. Los contratos históricos creados con el motor previo conservan su pantalla y generador anteriores; no se convierten silenciosamente a esta plantilla. La base real no contiene contratos históricos.
5. El listado y selector cargan datos reales de sus endpoints existentes y filtran en memoria del frontend. Para volúmenes grandes convendrá trasladar esa paginación y búsqueda al servidor.

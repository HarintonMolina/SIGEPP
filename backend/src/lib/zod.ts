import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Agrega .openapi() a los esquemas de Zod para generar la especificación OpenAPI
// desde las mismas validaciones que usa el API. Todos los esquemas importan z desde aquí.
extendZodWithOpenApi(z);

export { z };

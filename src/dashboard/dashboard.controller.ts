import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';

/**
 * Serves the read-only patient dashboard (the brief's optional "Dashboard" extra).
 *
 * The page is plain HTML with no build step and no dependencies; it fetches `/patients` from its
 * own origin, so the same URL works locally and through an ngrok tunnel without configuration.
 * Serving it from the API rather than opening the file directly avoids a cross-origin fetch and
 * means a reviewer only needs one URL.
 */
@Controller('dashboard')
export class DashboardController {
  @Get()
  index(@Res() res: Response) {
    // Resolved from the project root rather than __dirname: the page lives in `public/`, which is
    // outside `src/` and so is not copied into `dist/` by the Nest build.
    res.sendFile(join(process.cwd(), 'public', 'dashboard.html'));
  }
}

import { Request, Response, NextFunction } from 'express';
import { SearchService } from '../services/search.service.js';

export class SearchController {
  constructor(private readonly searchService: SearchService = new SearchService()) {}

  search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req.headers['x-user-id'] as string) || (req.query.userId as string);
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing user identity.' },
        });
        return;
      }
      const q = req.query.q as string | undefined;
      const status = req.query.status as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const results = await this.searchService.searchEmails(userId, {
        q,
        status,
        page,
        limit,
      });

      res.status(200).json({
        success: true,
        data: results.items,
        meta: {
          total: results.total,
          page: results.page,
          limit: results.limit,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  indexDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const doc = req.body;
      if (!doc || !doc.id || !doc.userId) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_DOCUMENT', message: 'Document must include id and userId' },
        });
        return;
      }

      await this.searchService.indexEmailDocument(doc);
      res.status(201).json({
        success: true,
        data: { message: `Document ${doc.id} successfully indexed into Elasticsearch` },
      });
    } catch (err) {
      next(err);
    }
  };

  rebuildIndex = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.searchService.rebuildIndexFromPostgres();
      res.status(200).json({
        success: true,
        data: {
          message: `Elasticsearch index rebuilt successfully. Synchronized ${result.indexedCount} emails.`,
          count: result.indexedCount,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}

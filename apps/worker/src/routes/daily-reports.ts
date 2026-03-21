/**
 * Daily report routes
 */

import { getAuthUser } from '../middleware/auth';
import {
  bodyValidator,
  getValidatedBody,
  getValidatedQuery,
  queryValidator,
} from '../middleware/validation-middleware';
import { DailyReportRepository } from '../repositories/daily-report-repository';
import { generateDailyReportSchema, getDailyReportsQuerySchema } from '../schemas/daily-report';
import { DailyReportService } from '../services/daily-report-service';
import { createBufferedSSEResponse } from '../utils/buffered-sse';
import { createProtectedRouter } from './_shared/router-factory';

const dailyReports = createProtectedRouter();

/**
 * GET /daily-reports - List recent daily reports
 */
dailyReports.get('/', queryValidator(getDailyReportsQuerySchema), async (c) => {
  const { limit } = getValidatedQuery<typeof getDailyReportsQuerySchema>(c);
  const repo = new DailyReportRepository(c.get('db'));
  const reports = await repo.findRecent(limit);
  return c.json(reports);
});

/**
 * GET /daily-reports/:date - Get report by date
 */
dailyReports.get('/:date', async (c) => {
  const date = c.req.param('date');
  const repo = new DailyReportRepository(c.get('db'));
  const report = await repo.findByDate(date);

  if (!report) {
    return c.json({ code: 'NOT_FOUND', message: '해당 날짜의 리포트가 없습니다.' }, 404);
  }

  return c.json(report);
});

/**
 * POST /daily-reports/generate - Generate or regenerate a daily report
 */
dailyReports.post('/generate', bodyValidator(generateDailyReportSchema), async (c) => {
  const { date, timezoneOffset } = getValidatedBody<typeof generateDailyReportSchema>(c);
  const user = getAuthUser(c);
  const service = new DailyReportService(c.env, c.get('db'), c.get('settingService'));

  return createBufferedSSEResponse(async () => {
    return service.generateReport(user.email, date, timezoneOffset ?? 540);
  });
});

export default dailyReports;

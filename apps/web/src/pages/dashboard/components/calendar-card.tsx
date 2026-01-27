import { Button } from '@web/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card';
import { useCalendarEvents } from '@web/hooks/use-calendar';
import { useGoogleDriveConfigStatus } from '@web/hooks/use-work-notes';
import { ApiError } from '@web/lib/api';
import { addDays, format, startOfWeek } from 'date-fns';
import { Calendar, ExternalLink, Loader2 } from 'lucide-react';
import { WeekCalendar } from './week-calendar';

const GOOGLE_AUTH_URL = '/api/auth/google/authorize';

export function CalendarCard() {
  const {
    configured,
    data: driveStatus,
    isLoading: isStatusLoading,
  } = useGoogleDriveConfigStatus();
  const isConnected = driveStatus?.connected ?? false;

  // Calculate date range: this week's Monday to 2 weeks later
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const startDate = format(weekStart, 'yyyy-MM-dd');
  const endDate = format(addDays(weekStart, 13), 'yyyy-MM-dd');

  const {
    data: events = [],
    isLoading: isEventsLoading,
    isError,
    error,
  } = useCalendarEvents(startDate, endDate, {
    enabled: configured && isConnected,
  });

  // Loading state
  if (isStatusLoading) {
    return (
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" aria-hidden="true" />
            캘린더
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CalendarSkeleton />
        </CardContent>
      </Card>
    );
  }

  // Not configured state
  if (!configured) {
    return null;
  }

  // Not connected state
  if (!isConnected) {
    return (
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" aria-hidden="true" />
            캘린더
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="mb-4 text-sm text-muted-foreground">
              Google 캘린더를 연결하여 일정을 확인하세요
            </p>
            <Button asChild variant="outline" size="sm">
              <a href={GOOGLE_AUTH_URL}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Google 계정 연결
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state - check if token expired and needs re-auth
  const apiError = error instanceof ApiError ? error : null;
  const isTokenExpired =
    apiError?.code === 'GOOGLE_TOKEN_EXPIRED' || apiError?.code === 'GOOGLE_NOT_CONNECTED';

  if (isError) {
    return (
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" aria-hidden="true" />
            캘린더
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            {isTokenExpired ? (
              <>
                <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="mb-4 text-sm text-muted-foreground">
                  Google 인증이 만료되었습니다. 다시 연결해 주세요.
                </p>
                <Button asChild variant="outline" size="sm">
                  <a href={GOOGLE_AUTH_URL}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    다시 연결하기
                  </a>
                </Button>
              </>
            ) : (
              <p className="text-sm text-destructive">
                {error?.message || '캘린더를 불러올 수 없습니다'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-500" aria-hidden="true" />
          캘린더
          {isEventsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEventsLoading ? (
          <CalendarSkeleton />
        ) : (
          <WeekCalendar events={events} startDate={weekStart} weeks={2} />
        )}
      </CardContent>
    </Card>
  );
}

function CalendarSkeleton() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

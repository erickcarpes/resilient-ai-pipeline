export type LogContext = {
  component: string;
  worker?: string;
  stage?: string;
  requestId?: string;
};

export type LogRecord = {
  event: string;
  meetingId?: string;
  requestId?: string;
  method?: string;
  route?: string;
  status?: string;
  queue?: string;
  attempts?: number;
  attempt?: number;
  reason?: string;
  stage?: string;
} & Record<string, string | number | boolean | undefined>;

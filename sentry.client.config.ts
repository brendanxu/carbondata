import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NODE_ENV === 'development',
  
  environment: process.env.NODE_ENV,
  
  // Capture 100% of the transactions in development
  // In production, you'll want to set a lower value
  replaysOnErrorSampleRate: 1.0,
  
  // Capture 10% of the transactions in production for performance monitoring
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.1,
  
  // Configure which errors to ignore
  beforeSend(event, hint) {
    // Filter out common non-critical errors
    if (event.exception) {
      const error = hint.originalException
      if (error instanceof Error) {
        // Ignore network timeouts in development
        if (error.message.includes('fetch') && process.env.NODE_ENV === 'development') {
          return null
        }
      }
    }
    return event
  },
  
  // Additional options
  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
})
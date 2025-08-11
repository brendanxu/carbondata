import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Adjust this value in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NODE_ENV === 'development',
  
  environment: process.env.NODE_ENV,
  
  // Configure which errors to ignore
  beforeSend(event, hint) {
    // Filter out database connection errors in development
    if (event.exception) {
      const error = hint.originalException
      if (error instanceof Error) {
        if (error.message.includes('ECONNREFUSED') && process.env.NODE_ENV === 'development') {
          return null
        }
      }
    }
    return event
  },
  
  // Additional server-side specific configurations
  integrations: [
    // Performance monitoring for database queries
    Sentry.prismaIntegration(),
  ],
})
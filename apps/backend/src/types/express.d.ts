// Type declarations for Express request extensions
declare global {
  namespace Express {
    interface Request {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validatedBody?: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validatedParams?: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validatedQuery?: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validatedData?: any;
      isAdmin?: boolean;
      siteId?: number;
    }
  }
}

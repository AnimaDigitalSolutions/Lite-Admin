// Type declarations for Express request extensions
declare global {
  namespace Express {
    interface Request {
      validatedBody?: any;
      validatedParams?: any;
      validatedQuery?: any;
      validatedData?: any;
      isAdmin?: boolean;
    }
  }
}
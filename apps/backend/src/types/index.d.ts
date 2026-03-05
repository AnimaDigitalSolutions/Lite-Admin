// Type declarations for Express request extensions
declare namespace Express {
  interface Request {
    validatedBody?: any;
    validatedParams?: any;
    validatedQuery?: any;
    validatedData?: any;
    isAdmin?: boolean;
  }
}
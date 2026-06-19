export interface DecodedToken {
  userId: string;
  orgId: string;
  roles: string[];
  email: string;
  iat: number;
  exp: number;
}
